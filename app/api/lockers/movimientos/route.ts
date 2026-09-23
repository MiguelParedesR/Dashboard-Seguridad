import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError, requireApiRole } from '@/lib/auth/api';
import { processAssignmentMovement } from '@/lib/lockers/assignments';

const schema = z.object({
  action: z.enum(['entrega', 'devolucion']),
  asignacionId: z.string().uuid(),
  llavesDeclaradas: z.number().int().min(0).max(10),
  fotoUrl: z.string().url()
});

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv', 'colaborador']);
  if (isApiError(auth)) return auth;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Operación inválida' }, 400);
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) return json({ error: 'Operación inválida' }, 400);

    const result = await processAssignmentMovement({
      assignmentId: parsed.data.asignacionId,
      action: parsed.data.action,
      actorId: auth.sub,
      actorRole: auth.role,
      llavesDeclaradas: parsed.data.llavesDeclaradas,
      fotoUrl: parsed.data.fotoUrl
    });

    if (result.kind === 'not_found') return json({ error: 'Asignación no encontrada' }, 404);
    if (result.kind === 'forbidden') return json({ error: 'No autorizado para esta asignación' }, 403);
    if (result.kind === 'conflict') return json({ error: 'La asignación ya no admite esta operación' }, 409);

    return json({ success: true, action: parsed.data.action, llavesEsperadas: result.llavesEsperadas });
  } catch (error) {
    console.error('[lockers/movimientos]', error);
    return json({ error: 'No se pudo registrar el movimiento de llaves' }, 500);
  }
}
