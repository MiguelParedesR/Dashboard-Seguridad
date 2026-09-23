import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isApiError, requireApiRole } from '@/lib/auth/api';

const inspeccionSchema = z.object({
  fecha: z.string().min(1),
  hora: z.string().min(1),
  responsable: z.string().default(''),
  empresa: z.string().default(''),
  placa: z.string().trim().min(1).max(12).transform((v) => v.toUpperCase()),
  chofer: z.string().default(''),
  lugar: z.string().default(''),
  incorreccion: z.string().default(''),
  observaciones: z.string().default(''),
  separacion_central: z.number().nullable().optional(),
  medida_altura: z.string().nullable().optional(),
  medida_central: z.string().nullable().optional(),
  altura_mampara: z.number().nullable().optional(),
  foto_unidad: z.string().url().nullable().optional(),
  foto_observacion: z.string().url().nullable().optional(),
  detalle: z.string().default('')
});

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;

  const url = new URL(request.url);
  const placa = String(url.searchParams.get('placa') || '').trim().toUpperCase();
  const supabase = getSupabaseAdmin();
  let query = supabase.from('inspecciones').select('*').order('fecha', { ascending: false }).order('hora', { ascending: false });
  if (placa) query = query.ilike('placa', `%${placa}%`);
  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;
  const parsed = inspeccionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Datos de inspección inválidos', issues: parsed.error.issues }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('inspecciones').insert([parsed.data]).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
