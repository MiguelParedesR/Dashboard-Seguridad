import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isApiError, requireApiRole } from '@/lib/auth/api';

const actionSchema = z.object({
  solicitudId: z.string().uuid(),
  action: z.enum(['aprobar', 'rechazar']),
  motivo: z.string().trim().max(500).optional()
});

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('solicitudes_locker')
    .select('id,colaborador_id,locker_id,estado,foto_locker_url,observaciones,created_at,updated_at,colaboradores(nombre_completo,dni),lockers(codigo,local,area,estado,tiene_candado,tiene_duplicado_llave)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;

  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const fn = parsed.data.action === 'aprobar' ? 'rpc_aprobar_solicitud' : 'rpc_rechazar_solicitud';
  const args = parsed.data.action === 'aprobar'
    ? { p_solicitud_id: parsed.data.solicitudId, p_operador_id: auth.sub }
    : { p_solicitud_id: parsed.data.solicitudId, p_operador_id: auth.sub, p_motivo: parsed.data.motivo || null };

  const { data, error } = await supabase.rpc(fn, args);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data && data.success === false) return NextResponse.json(data, { status: 409 });
  return NextResponse.json(data || { success: true });
}
