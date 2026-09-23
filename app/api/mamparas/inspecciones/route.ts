import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError, requireApiRole } from '@/lib/auth/api';
import { createInspection, readInspections } from '@/lib/mamparas/inspections';

const inspectionSchema = z.object({
  fecha: z.string().trim().min(1).max(10),
  hora: z.string().trim().min(1).max(8),
  responsable: z.string().trim().min(1).max(160),
  empresa: z.string().trim().min(1).max(160),
  placa: z.string().trim().min(6).max(12),
  chofer: z.string().trim().min(1).max(200),
  lugar: z.string().trim().min(1).max(120),
  incorreccion: z.string().trim().min(1).max(120),
  observaciones: z.string().trim().min(1).max(500),
  separacion_central: z.number().min(0).nullable(),
  medida_altura: z.string().max(80).nullable(),
  medida_central: z.string().max(80).nullable(),
  altura_mampara: z.number().min(0).nullable(),
  foto_unidad: z.string().url().nullable(),
  foto_observacion: z.string().url().nullable(),
  detalle: z.string().min(2).max(20000)
});

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin']);
  if (isApiError(auth)) return auth;
  try {
    const plate = new URL(request.url).searchParams.get('placa') || '';
    const data = await readInspections(plate);
    return json({ data, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[mamparas/inspecciones:get]', error);
    return json({ error: 'No se pudieron cargar las inspecciones' }, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin']);
  if (isApiError(auth)) return auth;
  try {
    const parsed = inspectionSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Datos de inspección inválidos' }, 400);
    const data = await createInspection(parsed.data);
    return json({ data }, 201);
  } catch (error) {
    console.error('[mamparas/inspecciones:post]', error);
    return json({ error: 'No se pudo registrar la inspección' }, 500);
  }
}
