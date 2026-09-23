import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isApiError, requireApiRole } from '@/lib/auth/api';

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['colaborador']);
  if (isApiError(auth)) return auth;
  const supabase = getSupabaseAdmin();
  const url = new URL(request.url);
  const local = String(url.searchParams.get('local') || '').trim();
  const area = String(url.searchParams.get('area') || '').trim();

  const [{ data: asignaciones }, { data: solicitudes }] = await Promise.all([
    supabase
      .from('asignaciones_locker')
      .select('id,solicitud_id,locker_id,fecha_asignacion,llaves_entregadas,llaves_devueltas,activa,cerrada,lockers(id,codigo,local,area,estado,tiene_candado,tiene_duplicado_llave)')
      .eq('colaborador_id', auth.sub)
      .eq('activa', true)
      .limit(1),
    supabase
      .from('solicitudes_locker')
      .select('id,locker_id,estado,created_at,observaciones,lockers(codigo,local,area)')
      .eq('colaborador_id', auth.sub)
      .order('created_at', { ascending: false })
      .limit(10)
  ]);

  let availableQuery = supabase.from('lockers').select('id,codigo,local,area,estado,tiene_candado,tiene_duplicado_llave').eq('estado', 'LIBRE').eq('activo', true);
  if (local) availableQuery = availableQuery.eq('local', local);
  if (area) availableQuery = availableQuery.eq('area', area);
  const { data: disponibles, error } = await availableQuery.order('codigo');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    session: { colaboradorId: auth.sub, nombre: auth.nombre, dni: auth.dni },
    asignacion: asignaciones?.[0] || null,
    solicitudes: solicitudes || [],
    disponibles: disponibles || []
  });
}
