import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { issueSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';

const schema = z.object({ dni: z.string().trim().regex(/^\d{8}$/) });

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'DNI inválido' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('usuarios')
      .select('id,nombre,dni,rol,activo')
      .eq('dni', parsed.data.dni)
      .limit(2);

    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length !== 1) return NextResponse.json({ error: 'Credencial no válida' }, { status: 401 });

    const user = rows[0] as { id: string; nombre?: string; dni?: string; rol?: string; activo?: boolean };
    const role = String(user.rol || '').trim().toLowerCase();
    if (!user.activo || (role !== 'admin' && role !== 'cctv')) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const token = await issueSession({
      sub: user.id,
      role: role as 'admin' | 'cctv',
      nombre: user.nombre,
      dni: user.dni
    });

    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, nombre: user.nombre, role },
      redirectTo: role === 'admin' ? '/dashboard' : '/lockers/solicitudes'
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error('[auth/login]', error);
    return NextResponse.json({ error: 'No se pudo validar el acceso' }, { status: 500 });
  }
}
