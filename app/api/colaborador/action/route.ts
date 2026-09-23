import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isApiError, requireApiRole } from '@/lib/auth/api';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('solicitar'), lockerId: z.string().uuid(), fotoUrl: z.string().url().nullable().optional(), observaciones: z.string().max(500).optional() }),
  z.object({ action: z.literal('devolver'), asignacionId: z.string().uuid(), fotoUrl: z.string().url().nullable().optional(), llavesDeclaradas: z.number().int().min(0).max(10) })
]);

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['colaborador']);
  if (isApiError(auth)) return auth;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Operación inválida' }, { status: 400 });
  const supabase = getSupabaseAdmin();

  if (parsed.data.action === 'solicitar') {
    const [{ data: active }, { data: pending }, { data: locker, error: lockerError }] = await Promise.all([
      supabase.from('asignaciones_locker').select('id').eq('colaborador_id', auth.sub).eq('activa', true).limit(1),
      supabase.from('solicitudes_locker').select('id,estado').eq('colaborador_id', auth.sub).in('estado', ['CREADA','EN_REVISION','APROBADA']).limit(1),
      supabase.from('lockers').select('id,estado,activo').eq('id', parsed.data.lockerId).single()
    ]);
    if (lockerError || !locker) return NextResponse.json({ error: 'Locker no encontrado' }, { status: 404 });
    if (active?.length) return NextResponse.json({ error: 'Ya tienes una asignación activa' }, { status: 409 });
    if (pending?.length) return NextResponse.json({ error: 'Ya tienes una solicitud pendiente' }, { status: 409 });
    if (!locker.activo || String(locker.estado).toUpperCase() !== 'LIBRE') return NextResponse.json({ error: 'El locker ya no está disponible' }, { status: 409 });

    const { data, error } = await supabase.from('solicitudes_locker').insert([{
      colaborador_id: auth.sub,
      locker_id: parsed.data.lockerId,
      estado: 'CREADA',
      foto_locker_url: parsed.data.fotoUrl || null,
      observaciones: parsed.data.observaciones || null
    }]).select('id,estado,created_at').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  }

  const { data: asignacion, error: assignmentError } = await supabase
    .from('asignaciones_locker')
    .select('id,locker_id,colaborador_id,activa,lockers(tiene_candado,tiene_duplicado_llave)')
    .eq('id', parsed.data.asignacionId)
    .eq('colaborador_id', auth.sub)
    .eq('activa', true)
    .single();
  if (assignmentError || !asignacion) return NextResponse.json({ error: 'Asignación activa no encontrada' }, { status: 404 });
  const lockerRaw: any = Array.isArray((asignacion as any).lockers) ? (asignacion as any).lockers[0] : (asignacion as any).lockers;
  const esperadas = Number(Boolean(lockerRaw?.tiene_candado)) + Number(Boolean(lockerRaw?.tiene_duplicado_llave));

  const { data, error } = await supabase.rpc('rpc_registrar_devolucion', {
    p_asignacion_id: parsed.data.asignacionId,
    p_llaves_declaradas: parsed.data.llavesDeclaradas,
    p_llaves_esperadas: esperadas,
    p_foto_url: parsed.data.fotoUrl || null,
    p_operador_id: auth.sub
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data && data.success === false) return NextResponse.json(data, { status: 409 });
  return NextResponse.json(data || { success: true });
}
