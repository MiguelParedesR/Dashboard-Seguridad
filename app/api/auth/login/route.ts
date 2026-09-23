import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  defaultStaffRoute,
  issueSession,
  normalizeStaffRole,
  SESSION_COOKIE,
  sessionCookieOptions
} from '@/lib/auth/session';

const schema = z.object({ dni: z.string().trim().regex(/^\d{8}$/) });

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'DNI inválido' }, 400);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('usuarios')
      .select('id,nombre,dni,rol,activo')
      .eq('dni', parsed.data.dni)
      .limit(2);

    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length !== 1) return json({ error: 'Credencial no válida' }, 401);

    const user = rows[0] as { id: string; nombre?: string; dni?: string; rol?: string; activo?: boolean };
    const role = normalizeStaffRole(user.rol);
    if (!user.activo || !role) return json({ error: 'Credencial no válida' }, 401);

    const token = await issueSession({
      sub: user.id,
      role,
      nombre: user.nombre,
      dni: user.dni
    });

    const response = json({
      ok: true,
      user: { id: user.id, nombre: user.nombre, role },
      redirectTo: defaultStaffRoute(role)
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error('[auth/login]', error);
    return json({ error: 'No se pudo validar el acceso' }, 500);
  }
}
