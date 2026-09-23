import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export type LockerOverviewRow = {
  id: string;
  codigo: string;
  local: string;
  area: string;
  estado: string;
  activo: boolean;
  tiene_candado: boolean;
  tiene_duplicado_llave: boolean;
  llaves_esperadas: number;
  asignacion_id: string | null;
  colaborador_id: string | null;
  colaborador_nombre: string | null;
  fecha_asignacion: string | null;
  incidencias_pendientes: number;
  tiene_incidencia_llaves: boolean;
};

type LockerRow = {
  id: string;
  codigo?: string | null;
  local?: string | null;
  area?: string | null;
  estado?: string | null;
  activo?: boolean | null;
  tiene_candado?: boolean | null;
  tiene_duplicado_llave?: boolean | null;
};

type AssignmentRow = {
  id: string;
  locker_id?: string | null;
  colaborador_id?: string | null;
  fecha_asignacion?: string | null;
  activa?: boolean | null;
};

type CollaboratorRow = {
  id: string;
  nombre_completo?: string | null;
};

type IncidentRow = {
  id: string;
  asignacion_id?: string | null;
  resuelta?: boolean | null;
};

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeEstado(value: unknown) {
  const normalized = normalizeText(value).toUpperCase().replace(/\s+/g, '_');
  if (!normalized) return 'SE_DESCONOCE';
  if (normalized === 'ASIGNADO') return 'OCUPADO';
  if (normalized === 'DESCONOCIDO' || normalized === 'SE_DESCONOCIDO') return 'SE_DESCONOCE';
  return normalized;
}

function uniqueIds(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function naturalCodeSort(a: LockerOverviewRow, b: LockerOverviewRow) {
  return a.codigo.localeCompare(b.codigo, 'es', { numeric: true, sensitivity: 'base' });
}

export async function readLockersOverview(): Promise<LockerOverviewRow[]> {
  const supabase = getSupabaseAdmin();

  const [lockersResult, activeAssignmentsResult, incidentsResult] = await Promise.all([
    supabase
      .from('lockers')
      .select('id,codigo,local,area,estado,activo,tiene_candado,tiene_duplicado_llave')
      .eq('activo', true),
    supabase
      .from('asignaciones_locker')
      .select('id,locker_id,colaborador_id,fecha_asignacion,activa')
      .eq('activa', true)
      .order('fecha_asignacion', { ascending: false }),
    supabase
      .from('incidencias_llaves')
      .select('id,asignacion_id,resuelta')
      .eq('resuelta', false)
  ]);

  if (lockersResult.error) throw lockersResult.error;
  if (activeAssignmentsResult.error) throw activeAssignmentsResult.error;
  if (incidentsResult.error) throw incidentsResult.error;

  const lockers = (lockersResult.data || []) as LockerRow[];
  const activeAssignments = (activeAssignmentsResult.data || []) as AssignmentRow[];
  const incidents = (incidentsResult.data || []) as IncidentRow[];

  const collaboratorIds = uniqueIds(activeAssignments.map((row) => row.colaborador_id));
  const incidentAssignmentIds = uniqueIds(incidents.map((row) => row.asignacion_id));
  const activeAssignmentIds = new Set(activeAssignments.map((row) => normalizeText(row.id)));
  const missingIncidentAssignmentIds = incidentAssignmentIds.filter((id) => !activeAssignmentIds.has(id));

  const [collaboratorsResult, incidentAssignmentsResult] = await Promise.all([
    collaboratorIds.length
      ? supabase.from('colaboradores').select('id,nombre_completo').in('id', collaboratorIds)
      : Promise.resolve({ data: [] as CollaboratorRow[], error: null }),
    missingIncidentAssignmentIds.length
      ? supabase.from('asignaciones_locker').select('id,locker_id').in('id', missingIncidentAssignmentIds)
      : Promise.resolve({ data: [] as AssignmentRow[], error: null })
  ]);

  if (collaboratorsResult.error) throw collaboratorsResult.error;
  if (incidentAssignmentsResult.error) throw incidentAssignmentsResult.error;

  const collaborators = (collaboratorsResult.data || []) as CollaboratorRow[];
  const incidentAssignments = [
    ...activeAssignments,
    ...((incidentAssignmentsResult.data || []) as AssignmentRow[])
  ];

  const collaboratorById = new Map(
    collaborators.map((row) => [normalizeText(row.id), normalizeText(row.nombre_completo)])
  );

  const activeAssignmentByLocker = new Map<string, AssignmentRow>();
  for (const assignment of activeAssignments) {
    const lockerId = normalizeText(assignment.locker_id);
    if (!lockerId || activeAssignmentByLocker.has(lockerId)) continue;
    activeAssignmentByLocker.set(lockerId, assignment);
  }

  const assignmentToLocker = new Map<string, string>();
  for (const assignment of incidentAssignments) {
    const assignmentId = normalizeText(assignment.id);
    const lockerId = normalizeText(assignment.locker_id);
    if (assignmentId && lockerId) assignmentToLocker.set(assignmentId, lockerId);
  }

  const incidentsByLocker = new Map<string, number>();
  for (const incident of incidents) {
    const lockerId = assignmentToLocker.get(normalizeText(incident.asignacion_id));
    if (!lockerId) continue;
    incidentsByLocker.set(lockerId, (incidentsByLocker.get(lockerId) || 0) + 1);
  }

  return lockers
    .map((locker) => {
      const id = normalizeText(locker.id);
      const assignment = activeAssignmentByLocker.get(id);
      const collaboratorId = normalizeText(assignment?.colaborador_id) || null;
      const incidentCount = incidentsByLocker.get(id) || 0;
      const hasPadlock = Boolean(locker.tiene_candado);
      const hasDuplicateKey = Boolean(locker.tiene_duplicado_llave);

      return {
        id,
        codigo: normalizeText(locker.codigo) || 'SIN-CODIGO',
        local: normalizeText(locker.local),
        area: normalizeText(locker.area),
        estado: normalizeEstado(locker.estado),
        activo: locker.activo !== false,
        tiene_candado: hasPadlock,
        tiene_duplicado_llave: hasDuplicateKey,
        llaves_esperadas: Number(hasPadlock) + Number(hasDuplicateKey),
        asignacion_id: normalizeText(assignment?.id) || null,
        colaborador_id: collaboratorId,
        colaborador_nombre: collaboratorId ? collaboratorById.get(collaboratorId) || null : null,
        fecha_asignacion: normalizeText(assignment?.fecha_asignacion) || null,
        incidencias_pendientes: incidentCount,
        tiene_incidencia_llaves: incidentCount > 0
      } satisfies LockerOverviewRow;
    })
    .sort(naturalCodeSort);
}
