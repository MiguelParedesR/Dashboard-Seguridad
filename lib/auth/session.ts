import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export type StaffRole = 'admin' | 'cctv';
export type AppRole = StaffRole | 'colaborador';
export type AppSession = {
  sub: string;
  role: AppRole;
  nombre?: string;
  dni?: string;
  colaboradorId?: string;
};

export const SESSION_COOKIE = 'tpp_session';
const MAX_AGE_SECONDS = 8 * 60 * 60;
const SESSION_ISSUER = 'tpp-seguridad-platform';
const SESSION_AUDIENCE = 'tpp-web';
const APP_ROLES = new Set<AppRole>(['admin', 'cctv', 'colaborador']);
const STAFF_ROLE_ALIASES: Record<string, StaffRole> = {
  admin: 'admin',
  administrador: 'admin',
  cctv: 'cctv',
  operador: 'cctv',
  operador_cctv: 'cctv',
  'operador cctv': 'cctv'
};

function secret() {
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 32) throw new Error('SESSION_SECRET must have at least 32 characters');
  return new TextEncoder().encode(raw);
}

export function normalizeStaffRole(role: unknown): StaffRole | null {
  const normalized = String(role || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return STAFF_ROLE_ALIASES[normalized] || null;
}

export function isStaffRole(role: unknown): role is StaffRole {
  return role === 'admin' || role === 'cctv';
}

export function defaultStaffRoute(role: StaffRole) {
  return role === 'admin' ? '/dashboard' : '/lockers/solicitudes';
}

export async function issueSession(payload: AppSession) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function readSessionToken(token?: string | null): Promise<AppSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ['HS256'],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE
    });
    const role = String(payload.role || '') as AppRole;
    if (!payload.sub || !APP_ROLES.has(role)) return null;
    return {
      sub: String(payload.sub),
      role,
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
