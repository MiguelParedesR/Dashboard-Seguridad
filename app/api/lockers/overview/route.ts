import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isApiError, requireApiRole } from '@/lib/auth/api';

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;
  const supabase = getSupabaseAdmin();

  let { data, error } = await supabase.from('v_lockers_actual').select('*').order('codigo', { ascending: true });
  if (error) {
    const fallback = await supabase
      .from('lockers')
      .select('id,codigo,area,estado,activo,local,local_id,tiene_candado,tiene_duplicado_llave,colaborador_nombre,fecha_asignacion')
      .order('codigo', { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: incidencias } = await supabase
    .from('incidencias_llaves')
    .select('id,asignacion_id,resuelta')
    .eq('resuelta', false);
  const assignmentIds = [...new Set((incidencias || []).map((x) => x.asignacion_id).filter(Boolean))];
  let affectedLockerIds = new Set<string>();
  if (assignmentIds.length) {
    const { data: assignments } = await supabase.from('asignaciones_locker').select('id,locker_id').in('id', assignmentIds);
    affectedLockerIds = new Set((assignments || []).map((x) => String(x.locker_id)));
  }

  return NextResponse.json({
    data: (data || []).map((row: any) => ({ ...row, tiene_incidencia_llaves: affectedLockerIds.has(String(row.id)) }))
  });
}
