import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export type AppRole = 'admin' | 'cctv' | 'colaborador';
export type AppSession = {
  sub: string;
  role: AppRole;
  nombre?: string;
  dni?: string;
  colaboradorId?: string;
};

export const SESSION_COOKIE = 'tpp_session';
const MAX_AGE_SECONDS = 8 * 60 * 60;

function secret() {
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 32) throw new Error('SESSION_SECRET must have at least 32 characters');
  return new TextEncoder().encode(raw);
}

export async function issueSession(payload: AppSession) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function readSessionToken(token?: string | null): Promise<AppSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || !payload.role) return null;
    return {
      sub: String(payload.sub),
      role: payload.role as AppRole,
      nombre: payload.nombre ? String(payload.nombre) : undefined,
      dni: payload.dni ? String(payload.dni) : undefined,
      colaboradorId: payload.colaboradorId ? String(payload.colaboradorId) : undefined
    };
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS
  };
}

export function canAccess(role: AppRole, pathname: string) {
  if (role === 'admin') return true;
  if (role === 'cctv') {
    return pathname.startsWith('/lockers') || pathname.startsWith('/incidencias');
  }
  return pathname.startsWith('/colaborador');
}
