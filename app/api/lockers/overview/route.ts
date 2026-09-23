import { NextRequest, NextResponse } from 'next/server';
import { isApiError, requireApiRole } from '@/lib/auth/api';
import { readLockersOverview } from '@/lib/lockers/overview';

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;

  try {
    const data = await readLockersOverview();
    const summary = {
      total: data.length,
      libres: data.filter((row) => row.estado === 'LIBRE').length,
      ocupados: data.filter((row) => row.estado === 'OCUPADO').length,
      conIncidencia: data.filter((row) => row.tiene_incidencia_llaves).length
    };

    return json({
      data,
      summary,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[lockers/overview]', error);
    return json({ error: 'No se pudo cargar la vista general de lockers' }, 500);
  }
}
