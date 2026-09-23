import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isApiError, requireApiRole } from '@/lib/auth/api';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_BYTES = 12 * 1024 * 1024;

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'anexo';
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv']);
  if (isApiError(auth)) return auth;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const incidenciaId = String(form.get('incidenciaId') || '').trim();

    if (!(file instanceof File)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    if (!/^[0-9a-f-]{36}$/i.test(incidenciaId)) return NextResponse.json({ error: 'Incidencia inválida' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Formato no permitido' }, { status: 415 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Archivo excede 12 MB' }, { status: 413 });

    const supabase = getSupabaseAdmin();
    const { data: incident, error: incidentError } = await supabase
      .from('incidencias')
      .select('id')
      .eq('id', incidenciaId)
      .maybeSingle();
    if (incidentError) throw incidentError;
    if (!incident) return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 });

    const path = `${incidenciaId}/anexos/${crypto.randomUUID()}-${safeName(file.name)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await supabase.storage.from('incidencias').upload(path, bytes, {
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;

    const { data } = supabase.storage.from('incidencias').getPublicUrl(path);
    return NextResponse.json({ name: file.name, path, url: data.publicUrl });
  } catch (error) {
    console.error('[incidencias:evidencias]', error);
    return NextResponse.json({ error: 'No se pudo subir la evidencia' }, { status: 500 });
  }
}
