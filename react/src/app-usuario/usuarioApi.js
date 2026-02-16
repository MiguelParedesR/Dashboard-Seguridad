import { getSupabaseClient } from '../shared/supabaseClient.js';

export const STORAGE_BUCKET = 'lockers';

function sanitizeFileName(name) {
  return String(name || 'imagen')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
}

export async function getClientOrThrow() {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error('No se pudo inicializar el cliente de datos.');
  }
  return supabase;
}

export function uniqueIds(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .filter((value) => value !== null && value !== undefined && value !== '')
        .map((value) => String(value))
    )
  );
}

export function mapById(rows) {
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row.id), row]));
}

export async function fetchColaboradoresByIds(supabase, ids) {
  const safeIds = uniqueIds(ids);
  if (safeIds.length === 0) return new Map();

  const withDni = await supabase
    .from('colaboradores')
    .select('id,nombre_completo,dni')
    .in('id', safeIds);

  if (!withDni.error) {
    return mapById(withDni.data || []);
  }

  const fallback = await supabase
    .from('colaboradores')
    .select('id,nombre_completo')
    .in('id', safeIds);

  if (fallback.error) throw fallback.error;
  return mapById(fallback.data || []);
}

export async function fetchLockersByIds(supabase, ids) {
  const safeIds = uniqueIds(ids);
  if (safeIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('lockers')
    .select('id,codigo,estado,local,area,tiene_candado,tiene_duplicado_llave')
    .in('id', safeIds);

  if (error) throw error;
  return mapById(data || []);
}

export async function fetchAsignacionesByIds(supabase, ids) {
  const safeIds = uniqueIds(ids);
  if (safeIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('asignaciones_locker')
    .select('id,solicitud_id,colaborador_id,locker_id,activa,fecha_asignacion,fecha_liberacion')
    .in('id', safeIds);

  if (error) throw error;
  return mapById(data || []);
}

export async function uploadImageToLockers(supabase, file, folder, referenceId) {
  if (!file) throw new Error('No se recibio una imagen valida.');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = `${folder}/${referenceId || 'general'}/${timestamp}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file, {
    upsert: false
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) throw new Error('No se pudo generar URL publica de imagen.');
  return publicUrl;
}

export async function fetchRowsByAsignacion(supabase, table, asignacionId) {
  const ordered = await supabase
    .from(table)
    .select('*')
    .eq('asignacion_id', asignacionId)
    .order('created_at', { ascending: false });

  if (!ordered.error) {
    return ordered.data || [];
  }

  const fallback = await supabase.from(table).select('*').eq('asignacion_id', asignacionId);
  if (fallback.error) throw fallback.error;
  return fallback.data || [];
}

export function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDateOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function normalizeText(value, fallback = '--') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}
