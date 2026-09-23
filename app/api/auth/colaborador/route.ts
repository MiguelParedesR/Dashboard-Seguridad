import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { issueSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';

const schema = z.object({ dni: z.string().trim().regex(/^\d{8}$/) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'DNI inválido' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('colaboradores')
    .select('id,nombre_completo,dni,activo')
    .eq('dni', parsed.data.dni)
    .eq('activo', true)
    .limit(2);
  if (error) return NextResponse.json({ error: 'No se pudo validar el acceso' }, { status: 500 });
  const rows = data || [];
  if (rows.length !== 1) return NextResponse.json({ error: 'Colaborador no registrado o inactivo' }, { status: 401 });
  const colaborador = rows[0];
  const token = await issueSession({
    sub: colaborador.id,
    colaboradorId: colaborador.id,
    role: 'colaborador',
    nombre: colaborador.nombre_completo,
    dni: colaborador.dni
  });
  const response = NextResponse.json({ ok: true, redirectTo: '/colaborador' });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
