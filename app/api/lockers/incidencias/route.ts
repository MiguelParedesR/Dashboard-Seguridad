import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isApiError, requireApiRole } from '@/lib/auth/api';

const resolveSchema = z.object({ incidenciaId: z.string().uuid() });

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;

  const supabase = getSupabaseAdmin();
  const { data: incidencias, error } = await supabase
    .from('incidencias_llaves')
    .select('id,asignacion_id,movimiento_id,tipo,descripcion,resuelta,created_at,resolved_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const scoped = auth.role === 'cctv' ? (incidencias || []).filter((row) => !row.resuelta) : (incidencias || []);
  const asignacionIds = [...new Set(scoped.map((row) => row.asignacion_id).filter(Boolean))];
  const movimientoIds = [...new Set(scoped.map((row) => row.movimiento_id).filter(Boolean))];

  const [{ data: asignaciones }, { data: movimientos }] = await Promise.all([
    asignacionIds.length
      ? supabase.from('asignaciones_locker').select('id,locker_id,colaborador_id,llaves_entregadas,llaves_devueltas,activa,colaboradores(nombre_completo,dni),lockers(codigo,local,area,tiene_candado,tiene_duplicado_llave)').in('id', asignacionIds)
      : Promise.resolve({ data: [] as unknown[] }),
    movimientoIds.length
      ? supabase.from('llaves_movimientos').select('id,llaves_declaradas,llaves_esperadas,tipo,created_at').in('id', movimientoIds)
      : Promise.resolve({ data: [] as unknown[] })
  ]);

  const asignacionMap = new Map((asignaciones || []).map((row: any) => [String(row.id), row]));
  const movimientoMap = new Map((movimientos || []).map((row: any) => [String(row.id), row]));

  const data = scoped.map((row: any) => {
    const asignacion = asignacionMap.get(String(row.asignacion_id)) as any;
    const movimiento = movimientoMap.get(String(row.movimiento_id)) as any;
    const locker = Array.isArray(asignacion?.lockers) ? asignacion.lockers[0] : asignacion?.lockers;
    const colaborador = Array.isArray(asignacion?.colaboradores) ? asignacion.colaboradores[0] : asignacion?.colaboradores;
    return {
      ...row,
      estado: row.resuelta ? 'RESUELTA' : 'PENDIENTE',
      locker: locker || null,
      colaborador: colaborador || null,
      llaves_esperadas: movimiento?.llaves_esperadas ?? null,
      llaves_declaradas: movimiento?.llaves_declaradas ?? null,
      llaves_devueltas: asignacion?.llaves_devueltas ?? null
    };
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;
  const parsed = resolveSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Incidencia inválida' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('fn_resolver_incidencias_llaves', {
    p_incidencia_id: parsed.data.incidenciaId
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { success: true });
}
