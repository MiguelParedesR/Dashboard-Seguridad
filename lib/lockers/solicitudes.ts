import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const LOCKER_REQUEST_PENDING_STATES = ['CREADA', 'EN_REVISION'] as const;
export type LockerRequestAction = 'aprobar' | 'rechazar';

export type LockerRequestView = {
  id: string;
  colaboradorId: string;
  lockerId: string;
  estado: string;
  fotoLockerUrl: string | null;
  observaciones: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  colaboradorNombre: string | null;
  colaboradorDni: string | null;
  lockerCodigo: string | null;
  local: string | null;
  area: string | null;
  lockerEstado: string | null;
};

type RequestRow = {
  id: string;
  colaborador_id?: string | null;
  locker_id?: string | null;
  estado?: string | null;
  foto_locker_url?: string | null;
  observaciones?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CollaboratorRow = {
  id: string;
  nombre_completo?: string | null;
  dni?: string | null;
};

type LockerRow = {
  id: string;
  codigo?: string | null;
  local?: string | null;
  area?: string | null;
  estado?: string | null;
};

export type LockerRequestProcessResult =
  | { kind: 'ok'; estado: string }
  | { kind: 'not_found' }
  | { kind: 'conflict'; estado: string };

function text(value: unknown) {
  return String(value ?? '').trim();
}

function nullableText(value: unknown) {
  const normalized = text(value);
  return normalized || null;
}

function state(value: unknown) {
  return text(value).toUpperCase().replace(/\s+/g, '_');
}

function uniqueIds(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))];
}

function isEligibleState(value: unknown) {
  return (LOCKER_REQUEST_PENDING_STATES as readonly string[]).includes(state(value));
}

function rpcFailed(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return (data as { success?: unknown }).success === false;
}

export async function readLockerRequests(): Promise<LockerRequestView[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('solicitudes_locker')
    .select('id,colaborador_id,locker_id,estado,foto_locker_url,observaciones,created_at,updated_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const rows = (data || []) as RequestRow[];

  const collaboratorIds = uniqueIds(rows.map((row) => row.colaborador_id));
  const lockerIds = uniqueIds(rows.map((row) => row.locker_id));

  const [collaboratorsResult, lockersResult] = await Promise.all([
    collaboratorIds.length
      ? supabase.from('colaboradores').select('id,nombre_completo,dni').in('id', collaboratorIds)
      : Promise.resolve({ data: [] as CollaboratorRow[], error: null }),
    lockerIds.length
      ? supabase.from('lockers').select('id,codigo,local,area,estado').in('id', lockerIds)
      : Promise.resolve({ data: [] as LockerRow[], error: null })
  ]);

  if (collaboratorsResult.error) throw collaboratorsResult.error;
  if (lockersResult.error) throw lockersResult.error;

  const collaboratorsById = new Map(
    ((collaboratorsResult.data || []) as CollaboratorRow[]).map((row) => [text(row.id), row])
  );
  const lockersById = new Map(
    ((lockersResult.data || []) as LockerRow[]).map((row) => [text(row.id), row])
  );

  return rows.map((row) => {
    const colaboradorId = text(row.colaborador_id);
    const lockerId = text(row.locker_id);
    const colaborador = collaboratorsById.get(colaboradorId);
    const locker = lockersById.get(lockerId);

    return {
      id: text(row.id),
      colaboradorId,
      lockerId,
      estado: state(row.estado),
      fotoLockerUrl: nullableText(row.foto_locker_url),
      observaciones: nullableText(row.observaciones),
      createdAt: nullableText(row.created_at),
      updatedAt: nullableText(row.updated_at),
      colaboradorNombre: nullableText(colaborador?.nombre_completo),
      colaboradorDni: nullableText(colaborador?.dni),
      lockerCodigo: nullableText(locker?.codigo),
      local: nullableText(locker?.local),
      area: nullableText(locker?.area),
      lockerEstado: nullableText(locker?.estado)
    } satisfies LockerRequestView;
  });
}

async function readCurrentState(solicitudId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('solicitudes_locker')
    .select('id,estado')
    .eq('id', solicitudId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return state((data as { estado?: unknown }).estado);
}

export async function processLockerRequest(input: {
  solicitudId: string;
  action: LockerRequestAction;
  operadorId: string;
  motivo?: string | null;
}): Promise<LockerRequestProcessResult> {
  const initialState = await readCurrentState(input.solicitudId);
  if (!initialState) return { kind: 'not_found' };
  if (!isEligibleState(initialState)) return { kind: 'conflict', estado: initialState };

  const supabase = getSupabaseAdmin();
  const fn = input.action === 'aprobar' ? 'rpc_aprobar_solicitud' : 'rpc_rechazar_solicitud';
  const args = input.action === 'aprobar'
    ? { p_solicitud_id: input.solicitudId, p_operador_id: input.operadorId }
    : {
        p_solicitud_id: input.solicitudId,
        p_operador_id: input.operadorId,
        p_motivo: nullableText(input.motivo)
      };

  const { data, error } = await supabase.rpc(fn, args);

  if (error || rpcFailed(data)) {
    const latestState = await readCurrentState(input.solicitudId);
    if (latestState && !isEligibleState(latestState)) {
      return { kind: 'conflict', estado: latestState };
    }
    if (error) throw error;
    return { kind: 'conflict', estado: latestState || initialState };
  }

  const latestState = await readCurrentState(input.solicitudId);
  return {
    kind: 'ok',
    estado: latestState || (input.action === 'aprobar' ? 'APROBADA' : 'RECHAZADA')
  };
}
