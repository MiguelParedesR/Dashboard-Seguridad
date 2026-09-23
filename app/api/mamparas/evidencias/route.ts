import { NextRequest, NextResponse } from 'next/server';
import { isApiError, requireApiRole } from '@/lib/auth/api';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const IMAGE_PURPOSES = new Set(['panoramica', 'altura', 'lateral', 'observacion']);
const MAX_BYTES = 12 * 1024 * 1024;

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'archivo';
}

function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin']);
  if (isApiError(auth)) return auth;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const purpose = String(form.get('purpose') || '').trim().toLowerCase();
    const plate = normalizePlate(String(form.get('placa') || ''));

    if (!(file instanceof File)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    if (plate.length !== 6) return NextResponse.json({ error: 'Placa inválida' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Archivo excede 12 MB' }, { status: 413 });

    const isJson = purpose === 'detalle';
    if (!isJson && !IMAGE_PURPOSES.has(purpose)) return NextResponse.json({ error: 'Propósito no permitido' }, { status: 400 });
    if (isJson && file.type !== 'application/json') return NextResponse.json({ error: 'El detalle debe ser JSON' }, { status: 415 });
    if (!isJson && !file.type.startsWith('image/')) return NextResponse.json({ error: 'Solo se permiten imágenes' }, { status: 415 });

    const supabase = getSupabaseAdmin();
    const folder = isJson ? 'detalles' : 'imagenes';
    const path = `${folder}/${plate}-${purpose}-${crypto.randomUUID()}-${safeName(file.name)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await supabase.storage.from('mamparas').upload(path, bytes, {
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;

    const { data } = supabase.storage.from('mamparas').getPublicUrl(path);
    return NextResponse.json({ bucket: 'mamparas', path, url: data.publicUrl, publicUrl: data.publicUrl });
  } catch (error) {
    console.error('[mamparas:evidencias]', error);
    return NextResponse.json({ error: 'No se pudo guardar la evidencia' }, { status: 500 });
  }
}
