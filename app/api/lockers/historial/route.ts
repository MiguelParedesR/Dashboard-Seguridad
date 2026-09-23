import { NextRequest, NextResponse } from 'next/server';
import { isApiError, requireApiRole } from '@/lib/auth/api';
import { readLockerHistory } from '@/lib/lockers/history';

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;

  try {
    const data = await readLockerHistory();
    return json({ data, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[lockers/historial:get]', error);
    return json({ error: 'No se pudo cargar el historial de lockers' }, 500);
  }
}
