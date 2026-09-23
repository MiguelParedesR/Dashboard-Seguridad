import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { issueSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';

const schema = z.object({ dni: z.string().trim().regex(/^\d{8}$/) });

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Solicitud inválida' }, 400);
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) return json({ error: 'DNI inválido' }, 400);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('colaboradores')
      .select('id,nombre_completo,dni,activo')
      .eq('dni', parsed.data.dni)
      .limit(2);

    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length !== 1) return json({ error: 'Credencial no válida' }, 401);

    const colaborador = rows[0] as {
      id: string;
      nombre_completo?: string | null;
      dni?: string | null;
      activo?: boolean | null;
    };

    if (!colaborador.activo) return json({ error: 'Credencial no válida' }, 401);

    const token = await issueSession({
      sub: colaborador.id,
      role: 'colaborador',
      nombre: colaborador.nombre_completo || undefined,
      dni: colaborador.dni || parsed.data.dni
    });

    const response = json({ ok: true, redirectTo: '/colaborador' });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error('[auth/colaborador]', error);
    return json({ error: 'No se pudo validar el acceso' }, 500);
  }
}
