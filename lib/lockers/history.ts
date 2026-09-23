import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export type LockerHistoryView = {
  id: string;
  createdAt: string | null;
  evento: string;
  eventoLabel: string;
  tipoEvento: string;
  operadorNombre: string;
  colaboradorNombre: string;
  lockerCodigo: string;
  local: string;
  area: string;
  llavesText: string;
};

type HistoryRow = {
  id?: string | null;
  locker_id?: string | null;
  evento?: string | null;
  detalle?: unknown;
  created_at?: string | null;
};

type LockerRow = { id: string; codigo?: string | null; local?: string | null; area?: string | null };

const EVENT_LABELS: Record<string, string> = {
  ASIGNACION_CREADA: 'Asignación creada',
  ENTREGA_LLAVES: 'Entrega de llaves',
  DEVOLUCION: 'Devolución',
  INCIDENCIA_GENERADA: 'Incidencia generada',
  LOCKER_BLOQUEADO: 'Locker bloqueado',
  LOCKER_LIBERADO: 'Locker liberado'
};

const EVENT_ALIASES: Record<string, string> = {
  ASIGNACION: 'ASIGNACION_CREADA',
  ASIGNACION_CREADA: 'ASIGNACION_CREADA',
  CREACION_ASIGNACION: 'ASIGNACION_CREADA',
  ENTREGA: 'ENTREGA_LLAVES',
  ENTREGA_LLAVES: 'ENTREGA_LLAVES',
  ENTREGA_DE_LLAVES: 'ENTREGA_LLAVES',
  LLAVES_ENTREGADAS: 'ENTREGA_LLAVES',
  DEVOLUCION: 'DEVOLUCION',
  INCIDENCIA: 'INCIDENCIA_GENERADA',
  INCIDENCIA_GENERADA: 'INCIDENCIA_GENERADA',
  LOCKER_BLOQUEADO: 'LOCKER_BLOQUEADO',
  BLOQUEADO: 'LOCKER_BLOQUEADO',
  MANTENIMIENTO: 'LOCKER_BLOQUEADO',
  LOCKER_LIBERADO: 'LOCKER_LIBERADO',
  LIBERADO: 'LOCKER_LIBERADO',
  REACTIVADO: 'LOCKER_LIBERADO'
};

function text(value: unknown, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeEvent(value: unknown) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_');
}

function parseDetail(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}

function pick(detail: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = detail[key];
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return undefined;
}

function entityName(value: unknown, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return text(value, fallback);
  if (Array.isArray(value)) return text(value.map((item) => String(item ?? '').trim()).filter(Boolean).join(', '), fallback);
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return text(object.nombre ?? object.nombre_completo ?? object.name ?? object.full_name ?? object.usuario ?? object.email ?? object.dni ?? object.id, fallback);
  }
  return fallback;
}

function eventLabel(evento: unknown, detail: Record<string, unknown>) {
  const type = pick(detail, ['tipo_evento', 'tipoEvento', 'tipo', 'evento', 'accion', 'action']) ?? evento;
  const normalized = normalizeEvent(evento || type);
  const mapped = EVENT_ALIASES[normalized] || normalized;
  return {
    label: EVENT_LABELS[mapped] || text(type, '—'),
    type: text(type, '—')
  };
}

function keysText(detail: Record<string, unknown>) {
  const declared = pick(detail, ['llaves_declaradas', 'llavesDeclaradas', 'llaves_entregadas', 'llavesEntregadas']);
  const expected = pick(detail, ['llaves_esperadas', 'llavesEsperadas', 'llaves_respaldo', 'llavesRespaldo']);
  if (declared !== undefined && expected !== undefined) return `${String(declared)} / ${String(expected)}`;
  if (declared !== undefined) return String(declared);
  if (expected !== undefined) return String(expected);
  return '—';
}

export async function readLockerHistory(): Promise<LockerHistoryView[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('historial_locker')
    .select('id,locker_id,evento,detalle,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data || []) as HistoryRow[];
  const lockerIds = [...new Set(rows.map((row) => text(row.locker_id)).filter(Boolean))];
  const lockersResult = lockerIds.length
    ? await supabase.from('lockers').select('id,codigo,local,area').in('id', lockerIds)
    : { data: [] as LockerRow[], error: null };
  if (lockersResult.error) throw lockersResult.error;
  const lockerById = new Map(((lockersResult.data || []) as LockerRow[]).map((row) => [text(row.id), row]));

  return rows.map((row, index) => {
    const detail = parseDetail(row.detalle);
    const lockerDetail = pick(detail, ['locker', 'locker_detalle', 'lockerDetalle']);
    const lockerObject = lockerDetail && typeof lockerDetail === 'object' && !Array.isArray(lockerDetail) ? lockerDetail as Record<string, unknown> : {};
    const locker = lockerById.get(text(row.locker_id));
    const event = eventLabel(row.evento, detail);

    return {
      id: text(row.id, `${text(row.locker_id)}-${text(row.created_at)}-${index}`),
      createdAt: text(row.created_at) || null,
      evento: text(row.evento, '—'),
      eventoLabel: event.label,
      tipoEvento: event.type,
      operadorNombre: entityName(pick(detail, ['operador', 'operador_nombre', 'operadorNombre', 'usuario', 'usuario_nombre', 'responsable', 'actor'])),
      colaboradorNombre: entityName(pick(detail, ['colaborador', 'colaborador_nombre', 'colaboradorNombre', 'empleado', 'asignado_a', 'persona'])),
      lockerCodigo: text(locker?.codigo ?? lockerObject.codigo ?? pick(detail, ['locker_codigo', 'lockerCodigo', 'codigo']), '—'),
      local: text(locker?.local ?? lockerObject.local ?? pick(detail, ['local', 'locker_local', 'lockerLocal']), '—'),
      area: text(locker?.area ?? lockerObject.area ?? pick(detail, ['area', 'locker_area', 'lockerArea']), '—'),
      llavesText: keysText(detail)
    } satisfies LockerHistoryView;
  });
}
