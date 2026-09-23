import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isApiError, requireApiRole } from '@/lib/auth/api';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('crear_local'), nombre: z.string().trim().min(2).max(80) }),
  z.object({ action: z.literal('crear_lockers'), localId: z.string().uuid(), cantidad: z.number().int().min(1).max(500) }),
  z.object({ action: z.literal('eliminar_local'), localId: z.string().uuid() }),
  z.object({ action: z.literal('actualizar_local'), localId: z.string().uuid(), nombre: z.string().trim().min(2).max(80), activo: z.boolean() }),
  z.object({
    action: z.literal('actualizar_locker'),
    lockerId: z.string().uuid(),
    area: z.string().trim().max(120),
    activo: z.boolean(),
    tieneCandado: z.boolean(),
    tieneDuplicadoLlave: z.boolean()
  })
]);

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin']);
  if (isApiError(auth)) return auth;
  const supabase = getSupabaseAdmin();

  try {
    let locales: Array<Record<string, unknown>> = [];
    const listed = await supabase.schema('app').rpc('admin_listar_locales');
    if (!listed.error && Array.isArray(listed.data)) locales = listed.data as Array<Record<string, unknown>>;
    else {
      const fallback = await supabase.from('locales').select('id,nombre,activo').order('nombre');
      if (fallback.error) throw fallback.error;
      locales = (fallback.data || []) as Array<Record<string, unknown>>;
    }

    const { data: lockers, error } = await supabase
      .from('lockers')
      .select('id,codigo,local_id,local,area,estado,activo,tiene_candado,tiene_duplicado_llave')
      .order('codigo');
    if (error) throw error;
    return json({ locales, lockers: lockers || [] });
  } catch (error) {
    console.error('[admin/lockers:get]', error);
    return json({ error: 'No se pudo cargar la configuración' }, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin']);
  if (isApiError(auth)) return auth;

  try {
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Operación inválida' }, 400);
    const supabase = getSupabaseAdmin();
    let result: { data: unknown; error: { message?: string } | null };

    switch (parsed.data.action) {
      case 'crear_local':
        result = await supabase.schema('app').rpc('admin_crear_local', { p_nombre: parsed.data.nombre });
        break;
      case 'crear_lockers':
        result = await supabase.schema('app').rpc('admin_crear_lockers', { p_local_id: parsed.data.localId, p_cantidad: parsed.data.cantidad });
        break;
      case 'eliminar_local':
        result = await supabase.schema('app').rpc('admin_eliminar_local', { p_local_id: parsed.data.localId });
        break;
      case 'actualizar_local':
        result = await supabase.from('locales').update({ nombre: parsed.data.nombre, activo: parsed.data.activo }).eq('id', parsed.data.localId).select('id').single();
        break;
      case 'actualizar_locker':
        result = await supabase.from('lockers').update({
          area: parsed.data.area || null,
          activo: parsed.data.activo,
          tiene_candado: parsed.data.tieneCandado,
          tiene_duplicado_llave: parsed.data.tieneDuplicadoLlave
        }).eq('id', parsed.data.lockerId).select('id').single();
        break;
    }

    if (result.error) throw result.error;
    return json({ ok: true, data: result.data ?? null });
  } catch (error) {
    console.error('[admin/lockers:post]', error);
    return json({ error: 'No se pudo completar la operación' }, 500);
  }
}
