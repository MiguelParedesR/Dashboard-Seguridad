import { NextRequest, NextResponse } from 'next/server';
import { isApiError, requireApiRole } from '@/lib/auth/api';
import { readAssignmentById } from '@/lib/lockers/assignments';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const PURPOSES = new Set(['entrega', 'respaldo', 'devolucion']);
const MAX_BYTES = 8 * 1024 * 1024;

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'imagen';
}

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin', 'cctv', 'colaborador']);
  if (isApiError(auth)) return auth;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const purpose = String(form.get('purpose') || '').trim().toLowerCase();
    const assignmentId = String(form.get('assignmentId') || '').trim();

    if (!(file instanceof File)) return json({ error: 'Imagen requerida' }, 400);
    if (!PURPOSES.has(purpose)) return json({ error: 'Tipo de evidencia no permitido' }, 400);
    if (!/^[0-9a-fA-F-]{36}$/.test(assignmentId)) return json({ error: 'Asignación inválida' }, 400);
    if (!file.type.startsWith('image/')) return json({ error: 'Solo se permiten imágenes' }, 415);
    if (file.size <= 0 || file.size > MAX_BYTES) return json({ error: 'La imagen debe pesar hasta 8 MB' }, 413);

    const assignment = await readAssignmentById(assignmentId);
    if (!assignment) return json({ error: 'Asignación no encontrada' }, 404);
    if (!assignment.activa || assignment.cerrada) return json({ error: 'La asignación ya no está activa' }, 409);

    if (auth.role === 'colaborador') {
      if (purpose !== 'devolucion') return json({ error: 'Tipo de evidencia no autorizado' }, 403);
      if (assignment.colaboradorId !== auth.sub) return json({ error: 'No autorizado para esta asignación' }, 403);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${purpose}/${assignment.id}/${auth.role}-${auth.sub}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from('lockers').upload(path, bytes, {
      contentType: file.type,
      upsert: false
    });

    if (error) throw error;
    const { data } = supabase.storage.from('lockers').getPublicUrl(path);
    return json({ path, url: data.publicUrl });
  } catch (error) {
    console.error('[lockers/evidencias]', error);
    return json({ error: 'No se pudo guardar la evidencia' }, 500);
  }
}
