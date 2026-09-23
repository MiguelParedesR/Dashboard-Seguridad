import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isApiError, requireApiRole } from '@/lib/auth/api';

const ALLOWED_BUCKETS = new Set(['mamparas', 'incidencias', 'lockers']);
const MAX_BYTES = 12 * 1024 * 1024;

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'archivo';
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;

  const form = await request.formData();
  const file = form.get('file');
  const bucket = String(form.get('bucket') || '');
  const folder = String(form.get('folder') || 'general').replace(/[^a-zA-Z0-9/_-]/g, '-');

  if (!(file instanceof File)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  if (!ALLOWED_BUCKETS.has(bucket)) return NextResponse.json({ error: 'Bucket no permitido' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Archivo excede 12 MB' }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ path, url: data.publicUrl });
}
