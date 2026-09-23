import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export type InspectionDetail = {
  tipo: string;
  datos: {
    separacion_lateral_central?: number | string | null;
    altura_mampara?: number | string | null;
    observacion_texto?: string;
  };
  imagenes: {
    foto_panoramica_unidad?: string | null;
    foto_altura_mampara?: string | null;
    foto_lateral_central?: string | null;
    foto_observacion?: string | null;
  };
  timestamp?: string;
  json_storage?: { bucket?: string; path?: string; publicUrl?: string };
};

export type InspectionInput = {
  fecha: string;
  hora: string;
  responsable: string;
  empresa: string;
  placa: string;
  chofer: string;
  lugar: string;
  incorreccion: string;
  observaciones: string;
  separacion_central: number | null;
  medida_altura: string | null;
  medida_central: string | null;
  altura_mampara: number | null;
  foto_unidad: string | null;
  foto_observacion: string | null;
  detalle: string;
};

export type InspectionView = InspectionInput & { id: string };

const SELECT_FIELDS = 'id,fecha,hora,responsable,empresa,placa,chofer,lugar,incorreccion,observaciones,separacion_central,medida_altura,medida_central,altura_mampara,foto_unidad,foto_observacion,detalle';

function text(value: unknown) {
  return String(value ?? '').trim();
}

export function normalizePlate(value: unknown) {
  return text(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseInspectionDetail(value: unknown): InspectionDetail | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as InspectionDetail;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as InspectionDetail : null;
  } catch {
    return null;
  }
}

function normalizeRow(row: Record<string, unknown>): InspectionView {
  return {
    id: text(row.id),
    fecha: text(row.fecha),
    hora: text(row.hora),
    responsable: text(row.responsable),
    empresa: text(row.empresa),
    placa: text(row.placa).toUpperCase(),
    chofer: text(row.chofer),
    lugar: text(row.lugar),
    incorreccion: text(row.incorreccion),
    observaciones: text(row.observaciones),
    separacion_central: numberOrNull(row.separacion_central),
    medida_altura: text(row.medida_altura) || null,
    medida_central: text(row.medida_central) || null,
    altura_mampara: numberOrNull(row.altura_mampara),
    foto_unidad: text(row.foto_unidad) || null,
    foto_observacion: text(row.foto_observacion) || null,
    detalle: typeof row.detalle === 'string' ? row.detalle : row.detalle ? JSON.stringify(row.detalle) : ''
  };
}

export async function readInspections(plate?: string): Promise<InspectionView[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('inspecciones')
    .select(SELECT_FIELDS)
    .order('fecha', { ascending: false })
    .order('hora', { ascending: false })
    .limit(500);
  if (error) throw error;
  const rows = (data || []).map((row) => normalizeRow(row as Record<string, unknown>));
  const normalizedPlate = normalizePlate(plate);
  if (!normalizedPlate) return rows;
  return rows.filter((row) => normalizePlate(row.placa) === normalizedPlate);
}

export async function createInspection(input: InspectionInput): Promise<InspectionView> {
  const supabase = getSupabaseAdmin();
  const payload: InspectionInput = {
    ...input,
    fecha: text(input.fecha),
    hora: text(input.hora),
    responsable: text(input.responsable),
    empresa: text(input.empresa),
    placa: normalizePlate(input.placa),
    chofer: text(input.chofer),
    lugar: text(input.lugar),
    incorreccion: text(input.incorreccion),
    observaciones: text(input.observaciones),
    separacion_central: numberOrNull(input.separacion_central),
    altura_mampara: numberOrNull(input.altura_mampara),
    medida_altura: text(input.medida_altura) || null,
    medida_central: text(input.medida_central) || null,
    foto_unidad: text(input.foto_unidad) || null,
    foto_observacion: text(input.foto_observacion) || null,
    detalle: text(input.detalle)
  };
  const { data, error } = await supabase.from('inspecciones').insert([payload]).select(SELECT_FIELDS).single();
  if (error) throw error;
  return normalizeRow(data as Record<string, unknown>);
}
