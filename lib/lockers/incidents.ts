import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export type KeyIncidentView = {
  id: string;
  assignmentId: string | null;
  movementId: string | null;
  tipo: string | null;
  descripcion: string | null;
  estado: 'PENDIENTE' | 'RESUELTA';
  resuelta: boolean;
  createdAt: string | null;
  resolvedAt: string | null;
  lockerCodigo: string | null;
  local: string | null;
  area: string | null;
  colaboradorNombre: string | null;
  colaboradorDni: string | null;
  llavesEsperadas: number | null;
  llavesDeclaradas: number | null;
};

type IncidentRow = {
  id: string;
  asignacion_id?: string | null;
  movimiento_id?: string | null;
  tipo?: string | null;
  descripcion?: string | null;
  resuelta?: boolean | null;
  created_at?: string | null;
  resolved_at?: string | null;
};

type AssignmentRow = { id: string; locker_id?: string | null; colaborador_id?: string | null; llaves_devueltas?: number | null };
type MovementRow = { id: string; llaves_declaradas?: number | null; llaves_esperadas?: number | null };
type LockerRow = { id: string; codigo?: string | null; local?: string | null; area?: string | null };
type CollaboratorRow = { id: string; nombre_completo?: string | null; dni?: string | null };

function text(value: unknown) { return String(value ?? '').trim(); }
function nullableText(value: unknown) { const normalized = text(value); return normalized || null; }
function uniqueIds(values: Array<string | null | undefined>) { return [...new Set(values.map(text).filter(Boolean))]; }

export async function readKeyIncidents(): Promise<KeyIncidentView[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('incidencias_llaves')
    .select('id,asignacion_id,movimiento_id,tipo,descripcion,resuelta,created_at,resolved_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const incidents = (data || []) as IncidentRow[];
  const assignmentIds = uniqueIds(incidents.map((row) => row.asignacion_id));
  const movementIds = uniqueIds(incidents.map((row) => row.movimiento_id));

  const [assignmentsResult, movementsResult] = await Promise.all([
    assignmentIds.length
      ? supabase.from('asignaciones_locker').select('id,locker_id,colaborador_id,llaves_devueltas').in('id', assignmentIds)
      : Promise.resolve({ data: [] as AssignmentRow[], error: null }),
    movementIds.length
      ? supabase.from('llaves_movimientos').select('id,llaves_declaradas,llaves_esperadas').in('id', movementIds)
      : Promise.resolve({ data: [] as MovementRow[], error: null })
  ]);
  if (assignmentsResult.error) throw assignmentsResult.error;
  if (movementsResult.error) throw movementsResult.error;

  const assignments = (assignmentsResult.data || []) as AssignmentRow[];
  const movements = (movementsResult.data || []) as MovementRow[];
  const assignmentById = new Map(assignments.map((row) => [text(row.id), row]));
  const movementById = new Map(movements.map((row) => [text(row.id), row]));

  const lockerIds = uniqueIds(assignments.map((row) => row.locker_id));
  const collaboratorIds = uniqueIds(assignments.map((row) => row.colaborador_id));

  const [lockersResult, collaboratorsResult] = await Promise.all([
    lockerIds.length
      ? supabase.from('lockers').select('id,codigo,local,area').in('id', lockerIds)
      : Promise.resolve({ data: [] as LockerRow[], error: null }),
    collaboratorIds.length
      ? supabase.from('colaboradores').select('id,nombre_completo,dni').in('id', collaboratorIds)
      : Promise.resolve({ data: [] as CollaboratorRow[], error: null })
  ]);
  if (lockersResult.error) throw lockersResult.error;
  if (collaboratorsResult.error) throw collaboratorsResult.error;

  const lockerById = new Map(((lockersResult.data || []) as LockerRow[]).map((row) => [text(row.id), row]));
  const collaboratorById = new Map(((collaboratorsResult.data || []) as CollaboratorRow[]).map((row) => [text(row.id), row]));

  return incidents.map((incident) => {
    const assignment = assignmentById.get(text(incident.asignacion_id));
    const movement = movementById.get(text(incident.movimiento_id));
    const locker = lockerById.get(text(assignment?.locker_id));
    const collaborator = collaboratorById.get(text(assignment?.colaborador_id));
    const resolved = incident.resuelta === true;

    return {
      id: text(incident.id),
      assignmentId: nullableText(incident.asignacion_id),
      movementId: nullableText(incident.movimiento_id),
      tipo: nullableText(incident.tipo),
      descripcion: nullableText(incident.descripcion),
      estado: resolved ? 'RESUELTA' : 'PENDIENTE',
      resuelta: resolved,
      createdAt: nullableText(incident.created_at),
      resolvedAt: nullableText(incident.resolved_at),
      lockerCodigo: nullableText(locker?.codigo),
      local: nullableText(locker?.local),
      area: nullableText(locker?.area),
      colaboradorNombre: nullableText(collaborator?.nombre_completo),
      colaboradorDni: nullableText(collaborator?.dni),
      llavesEsperadas: movement?.llaves_esperadas ?? null,
      llavesDeclaradas: movement?.llaves_declaradas ?? assignment?.llaves_devueltas ?? null
    } satisfies KeyIncidentView;
  });
}

export async function resolveKeyIncident(id: string): Promise<'ok' | 'not_found' | 'conflict'> {
  const supabase = getSupabaseAdmin();
  const { data: current, error: currentError } = await supabase
    .from('incidencias_llaves')
    .select('id,resuelta')
    .eq('id', id)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) return 'not_found';
  if ((current as { resuelta?: boolean }).resuelta === true) return 'conflict';

  const { data, error } = await supabase.rpc('fn_resolver_incidencias_llaves', { p_incidencia_id: id });
  if (error) throw error;
  if (data && typeof data === 'object' && !Array.isArray(data) && (data as { success?: unknown }).success === false) return 'conflict';
  return 'ok';
}
