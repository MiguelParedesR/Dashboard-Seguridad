import { NextRequest, NextResponse } from 'next/server';
import { readSessionToken, SESSION_COOKIE, type AppRole, type AppSession } from './session';

export async function sessionFromRequest(request: NextRequest) {
  return readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function requireApiRole(request: NextRequest, roles: AppRole[]): Promise<AppSession | NextResponse> {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!roles.includes(session.role)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  return session;
}

export function isApiError(value: AppSession | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
