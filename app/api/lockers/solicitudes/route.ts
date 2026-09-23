import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError, requireApiRole } from '@/lib/auth/api';
import { processLockerRequest, readLockerRequests } from '@/lib/lockers/solicitudes';

const actionSchema = z.object({
  solicitudId: z.string().uuid(),
  action: z.enum(['aprobar', 'rechazar']),
  motivo: z.string().trim().max(500).optional()
});

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;

  try {
    const data = await readLockerRequests();
    return json({ data, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[lockers/solicitudes:get]', error);
    return json({ error: 'No se pudieron cargar las solicitudes' }, 500);
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
      return json({ error: 'Solicitud inválida' }, 400);
    }

    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return json({ error: 'Solicitud inválida' }, 400);

    const result = await processLockerRequest({
      solicitudId: parsed.data.solicitudId,
      action: parsed.data.action,
      operadorId: auth.sub,
      motivo: parsed.data.motivo
    });

    if (result.kind === 'not_found') {
      return json({ error: 'Solicitud no encontrada' }, 404);
    }

    if (result.kind === 'conflict') {
      return json({
        error: 'La solicitud ya fue procesada o ya no está disponible para esta acción.',
        estado: result.estado
      }, 409);
    }

    return json({
      success: true,
      action: parsed.data.action,
      estado: result.estado
    });
  } catch (error) {
    console.error('[lockers/solicitudes:post]', error);
    return json({ error: 'No se pudo procesar la solicitud' }, 500);
  }
}
