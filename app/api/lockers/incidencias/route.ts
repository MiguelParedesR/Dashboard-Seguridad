import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError, requireApiRole } from '@/lib/auth/api';
import { readKeyIncidents, resolveKeyIncident } from '@/lib/lockers/incidents';

const resolveSchema = z.object({ incidenciaId: z.string().uuid() });

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;

  try {
    const data = await readKeyIncidents();
    return json({ data, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[lockers/incidencias:get]', error);
    return json({ error: 'No se pudieron cargar las incidencias de llaves' }, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Incidencia inválida' }, 400);
    }

    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) return json({ error: 'Incidencia inválida' }, 400);

    const result = await resolveKeyIncident(parsed.data.incidenciaId);
    if (result === 'not_found') return json({ error: 'Incidencia no encontrada' }, 404);
    if (result === 'conflict') return json({ error: 'La incidencia ya fue resuelta o cambió de estado' }, 409);
    return json({ success: true });
  } catch (error) {
    console.error('[lockers/incidencias:post]', error);
    return json({ error: 'No se pudo resolver la incidencia' }, 500);
  }
}
