import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isApiError, requireApiRole } from '@/lib/auth/api';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('crear_local'), nombre: z.string().trim().min(2).max(80) }),
  z.object({ action: z.literal('crear_lockers'), localId: z.string().uuid(), cantidad: z.number().int().min(1).max(500) }),
  z.object({ action: z.literal('eliminar_local'), localId: z.string().uuid() })
]);

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin']);
  if (isApiError(auth)) return auth;
  const supabase = getSupabaseAdmin();

  let locales: any[] = [];
  const listed = await supabase.schema('app').rpc('admin_listar_locales');
  if (!listed.error && Array.isArray(listed.data)) locales = listed.data;
  else {
    const fallback = await supabase.from('locales').select('id,nombre,activo').order('nombre');
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    locales = fallback.data || [];
  }

  const { data: lockers, error } = await supabase.from('lockers').select('id,codigo,local_id,local,area,estado,activo').order('codigo');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ locales, lockers: lockers || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin']);
  if (isApiError(auth)) return auth;
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Operación inválida' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  let result;

  if (parsed.data.action === 'crear_local') {
    result = await supabase.schema('app').rpc('admin_crear_local', { p_nombre: parsed.data.nombre });
  } else if (parsed.data.action === 'crear_lockers') {
    result = await supabase.schema('app').rpc('admin_crear_lockers', { p_local_id: parsed.data.localId, p_cantidad: parsed.data.cantidad });
  } else {
    result = await supabase.schema('app').rpc('admin_eliminar_local', { p_local_id: parsed.data.localId });
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data: result.data ?? null });
}
