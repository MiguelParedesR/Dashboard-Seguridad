import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isApiError, requireApiRole } from '@/lib/auth/api';

const ALLOWED_BUCKETS = new Set(['mamparas', 'incidencias', 'lockers']);
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/json']);

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'archivo';
}

function safeFolder(value: unknown) {
  return String(value || 'general').replace(/[^a-zA-Z0-9/_-]/g, '-').replace(/\.{2,}/g, '-').replace(/^\/+/, '').slice(0, 180) || 'general';
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const bucket = String(form.get('bucket') || '');
    const folder = safeFolder(form.get('folder'));

    if (!(file instanceof File)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    if (!ALLOWED_BUCKETS.has(bucket)) return NextResponse.json({ error: 'Destino no permitido' }, { status: 400 });
    if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: 'Formato no permitido' }, { status: 415 });
    if (file.size < 1) return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Archivo excede 12 MB' }, { status: 413 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType: file.type,
      upsert: false,
      cacheControl: '3600'
    });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ path, url: data.publicUrl });
  } catch (error) {
    console.error('[storage/upload]', error);
    return NextResponse.json({ error: 'No se pudo almacenar el archivo' }, { status: 500 });
  }
}
