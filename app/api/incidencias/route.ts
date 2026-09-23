import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError, requireApiRole } from '@/lib/auth/api';
import { INCIDENT_TYPES, readIncidents, saveIncident } from '@/lib/incidencias/service';

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(240),
  path: z.string().trim().min(1).max(500),
  url: z.string().url().max(1200)
});

const fieldsSchema = z.object({
  valorExtra: z.object({
    contenedor: z.string().trim().max(80).nullable(),
    placa: z.string().trim().max(20).nullable()
  }),
  introduccion: z.string().max(10000).default(''),
  hechos: z.string().max(20000).default('')
});

const incidentSchema = z.object({
  tipo_incidencia: z.enum(INCIDENT_TYPES),
  asunto: z.string().trim().min(1).max(240),
  dirigido_a: z.string().trim().max(240).default(''),
  remitente: z.string().trim().max(240).default(''),
  fecha_informe: z.string().trim().nullable().optional(),
  analisis: z.string().max(20000).default(''),
  conclusiones: z.string().max(20000).default(''),
  recomendaciones: z.string().max(20000).default(''),
  campos: fieldsSchema,
  anexos: z.array(attachmentSchema).max(30).default([])
});

const updateSchema = incidentSchema.extend({ id: z.string().uuid() });

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;
  try {
    const data = await readIncidents();
    return json({ data, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[incidencias:get]', error);
    return json({ error: 'No se pudieron cargar las incidencias' }, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;
  try {
    const parsed = incidentSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Datos de incidencia inválidos' }, 400);
    const data = await saveIncident(parsed.data);
    return json({ data }, 201);
  } catch (error) {
    console.error('[incidencias:post]', error);
    return json({ error: 'No se pudo guardar la incidencia' }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;
  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Datos de incidencia inválidos' }, 400);
    const { id, ...input } = parsed.data;
    const data = await saveIncident(input, id);
    return json({ data });
  } catch (error) {
    console.error('[incidencias:patch]', error);
    return json({ error: 'No se pudieron guardar los cambios' }, 500);
  }
}
