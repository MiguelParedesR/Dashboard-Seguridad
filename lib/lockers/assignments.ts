import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export type AssignmentActorRole = 'admin' | 'cctv' | 'colaborador';
export type AssignmentMovementAction = 'entrega' | 'devolucion';

export type LockerAssignmentView = {
  id: string;
  solicitudId: string | null;
  colaboradorId: string;
  lockerId: string;
  activa: boolean;
  cerrada: boolean;
  fechaAsignacion: string | null;
  fechaLiberacion: string | null;
  llavesEntregadas: number | null;
  llavesDevueltas: number | null;
  colaboradorNombre: string | null;
  colaboradorDni: string | null;
  lockerCodigo: string | null;
  local: string | null;
  area: string | null;
  lockerEstado: string | null;
  tieneCandado: boolean;
  tieneDuplicadoLlave: boolean;
  llavesEsperadas: number;
  llavesDeclaradasDefault: number;
};

type AssignmentRow = {
  id: string;
  solicitud_id?: string | null;
  colaborador_id?: string | null;
  locker_id?: string | null;
  activa?: boolean | null;
  cerrada?: boolean | null;
  fecha_asignacion?: string | null;
  fecha_liberacion?: string | null;
  llaves_entregadas?: number | null;
  llaves_devueltas?: number | null;
};

type LockerRow = {
  id: string;
  codigo?: string | null;
  local?: string | null;
  area?: string | null;
  estado?: string | null;
  tiene_candado?: boolean | null;
  tiene_duplicado_llave?: boolean | null;
};

type CollaboratorRow = {
  id: string;
  nombre_completo?: string | null;
  dni?: string | null;
};

export type AssignmentMovementResult =
  | { kind: 'ok'; llavesEsperadas: number }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'conflict' };

function text(value: unknown) {
  return String(value ?? '').trim();
}

function nullableText(value: unknown) {
  const valueText = text(value);
  return valueText || null;
}

function rpcFailed(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return (data as { success?: unknown }).success === false;
}

async function hydrateAssignment(row: AssignmentRow): Promise<LockerAssignmentView | null> {
  const colaboradorId = text(row.colaborador_id);
  const lockerId = text(row.locker_id);
  if (!colaboradorId || !lockerId) return null;

  const supabase = getSupabaseAdmin();
  const [lockerResult, collaboratorResult] = await Promise.all([
    supabase
      .from('lockers')
      .select('id,codigo,local,area,estado,tiene_candado,tiene_duplicado_llave')
      .eq('id', lockerId)
      .maybeSingle(),
    supabase
      .from('colaboradores')
      .select('id,nombre_completo,dni')
      .eq('id', colaboradorId)
      .maybeSingle()
  ]);

  if (lockerResult.error) throw lockerResult.error;
  if (collaboratorResult.error) throw collaboratorResult.error;

  const locker = lockerResult.data as LockerRow | null;
  const collaborator = collaboratorResult.data as CollaboratorRow | null;
  const hasPadlock = Boolean(locker?.tiene_candado);
  const hasDuplicate = Boolean(locker?.tiene_duplicado_llave);

  return {
    id: text(row.id),
    solicitudId: nullableText(row.solicitud_id),
    colaboradorId,
    lockerId,
    activa: row.activa !== false,
    cerrada: Boolean(row.cerrada),
    fechaAsignacion: nullableText(row.fecha_asignacion),
    fechaLiberacion: nullableText(row.fecha_liberacion),
    llavesEntregadas: row.llaves_entregadas ?? null,
    llavesDevueltas: row.llaves_devueltas ?? null,
    colaboradorNombre: nullableText(collaborator?.nombre_completo),
    colaboradorDni: nullableText(collaborator?.dni),
    lockerCodigo: nullableText(locker?.codigo),
    local: nullableText(locker?.local),
    area: nullableText(locker?.area),
    lockerEstado: nullableText(locker?.estado),
    tieneCandado: hasPadlock,
    tieneDuplicadoLlave: hasDuplicate,
    llavesEsperadas: Number(hasPadlock) + Number(hasDuplicate),
    llavesDeclaradasDefault: Number(hasPadlock || hasDuplicate)
  };
}

export async function readAssignmentById(id: string): Promise<LockerAssignmentView | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('asignaciones_locker')
    .select('id,solicitud_id,colaborador_id,locker_id,activa,cerrada,fecha_asignacion,fecha_liberacion,llaves_entregadas,llaves_devueltas')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return hydrateAssignment(data as AssignmentRow);
}

export async function readActiveAssignmentForCollaborator(colaboradorId: string): Promise<LockerAssignmentView | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('asignaciones_locker')
    .select('id,solicitud_id,colaborador_id,locker_id,activa,cerrada,fecha_asignacion,fecha_liberacion,llaves_entregadas,llaves_devueltas')
    .eq('colaborador_id', colaboradorId)
    .eq('activa', true)
    .order('fecha_asignacion', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return hydrateAssignment(data as AssignmentRow);
}

export async function processAssignmentMovement(input: {
  assignmentId: string;
  action: AssignmentMovementAction;
  actorId: string;
  actorRole: AssignmentActorRole;
  llavesDeclaradas: number;
  fotoUrl: string;
}): Promise<AssignmentMovementResult> {
  const assignment = await readAssignmentById(input.assignmentId);
  if (!assignment) return { kind: 'not_found' };
  if (!assignment.activa || assignment.cerrada) return { kind: 'conflict' };

  if (input.actorRole === 'colaborador') {
    if (input.action !== 'devolucion') return { kind: 'forbidden' };
    if (assignment.colaboradorId !== input.actorId) return { kind: 'forbidden' };
  }

  const supabase = getSupabaseAdmin();
  const fn = input.action === 'entrega' ? 'rpc_registrar_entrega' : 'rpc_registrar_devolucion';
  const { data, error } = await supabase.rpc(fn, {
    p_asignacion_id: assignment.id,
    p_llaves_declaradas: input.llavesDeclaradas,
    p_llaves_esperadas: assignment.llavesEsperadas,
    p_foto_url: input.fotoUrl,
    p_operador_id: input.actorId
  });

  if (error) throw error;
  if (rpcFailed(data)) return { kind: 'conflict' };
  return { kind: 'ok', llavesEsperadas: assignment.llavesEsperadas };
}
