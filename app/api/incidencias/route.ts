import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isApiError, requireApiRole } from '@/lib/auth/api';

const incidenteSchema = z.object({
  tipo_incidencia: z.string().trim().min(1).max(80),
  asunto: z.string().trim().min(1).max(240),
  dirigido_a: z.string().trim().max(240).default(''),
  remitente: z.string().trim().max(240).default(''),
  fecha_informe: z.string().nullable().optional(),
  analisis: z.string().default(''),
  conclusiones: z.string().default(''),
  recomendaciones: z.string().default(''),
  campos: z.record(z.any()).default({}),
  progreso: z.number().int().min(0).max(100).default(0),
  estado: z.enum(['BORRADOR', 'COMPLETO']).default('BORRADOR'),
  anexos: z.array(z.record(z.any())).optional()
});

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('incidencias').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;
  const parsed = incidenteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Datos de incidencia inválidos', issues: parsed.error.issues }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('incidencias').insert([parsed.data]).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
