import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export type ReportSummary = {
  incidencias: number;
  incidenciasCompletas: number;
  inspecciones: number;
  inspeccionesMampara: number;
  lockers: number;
  lockersLibres: number;
  lockersOcupados: number;
  lockersConIncidencia: number;
  solicitudesPendientes: number;
  generatedAt: string;
};

function upper(value: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

export async function readReportSummary(): Promise<ReportSummary> {
  const supabase = getSupabaseAdmin();
  const [incidencias, inspecciones, lockers, solicitudes, keyIncidents] = await Promise.all([
    supabase.from('incidencias').select('id,estado'),
    supabase.from('inspecciones').select('id,incorreccion'),
    supabase.from('lockers').select('id,estado,activo').eq('activo', true),
    supabase.from('solicitudes_locker').select('id,estado'),
    supabase.from('incidencias_llaves').select('id,resuelta').eq('resuelta', false)
  ]);

  for (const result of [incidencias, inspecciones, lockers, solicitudes, keyIncidents]) {
    if (result.error) throw result.error;
  }

  const incidentRows = incidencias.data || [];
  const inspectionRows = inspecciones.data || [];
  const lockerRows = lockers.data || [];
  const requestRows = solicitudes.data || [];

  return {
    incidencias: incidentRows.length,
    incidenciasCompletas: incidentRows.filter((row) => upper(row.estado) === 'COMPLETO').length,
    inspecciones: inspectionRows.length,
    inspeccionesMampara: inspectionRows.filter((row) => upper(row.incorreccion) === 'MAMPARA').length,
    lockers: lockerRows.length,
    lockersLibres: lockerRows.filter((row) => upper(row.estado) === 'LIBRE').length,
    lockersOcupados: lockerRows.filter((row) => ['OCUPADO', 'ASIGNADO'].includes(upper(row.estado))).length,
    lockersConIncidencia: (keyIncidents.data || []).length,
    solicitudesPendientes: requestRows.filter((row) => ['CREADA', 'EN_REVISION'].includes(upper(row.estado))).length,
    generatedAt: new Date().toISOString()
  };
}

export function reportSummaryToCsv(summary: ReportSummary) {
  const rows: Array<[string, string | number]> = [
    ['indicador', 'valor'],
    ['incidencias', summary.incidencias],
    ['incidencias_completas', summary.incidenciasCompletas],
    ['inspecciones', summary.inspecciones],
    ['inspecciones_mampara', summary.inspeccionesMampara],
    ['lockers_total', summary.lockers],
    ['lockers_libres', summary.lockersLibres],
    ['lockers_ocupados', summary.lockersOcupados],
    ['lockers_con_incidencia_llaves', summary.lockersConIncidencia],
    ['solicitudes_pendientes', summary.solicitudesPendientes],
    ['generado_en', summary.generatedAt]
  ];
  return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
}
