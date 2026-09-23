import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const INCIDENT_TYPES = ['CABLE', 'MERCADERIA', 'CHOQUE', 'SINIESTRO'] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export type IncidentAttachment = {
  name: string;
  path: string;
  url: string;
};

export type IncidentFields = {
  valorExtra: {
    contenedor: string | null;
    placa: string | null;
  };
  introduccion: string;
  hechos: string;
};

export type IncidentInput = {
  tipo_incidencia: IncidentType;
  asunto: string;
  dirigido_a: string;
  remitente: string;
  fecha_informe: string | null;
  analisis: string;
  conclusiones: string;
  recomendaciones: string;
  campos: IncidentFields;
  anexos: IncidentAttachment[];
};

export type IncidentView = IncidentInput & {
  id: string;
  progreso: number;
  estado: 'BORRADOR' | 'COMPLETO';
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function nullableText(value: unknown) {
  const valueText = text(value);
  return valueText || null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeAttachment(value: unknown): IncidentAttachment | null {
  const raw = record(value);
  const name = text(raw.name);
  const path = text(raw.path);
  const url = text(raw.url);
  return name && path && url ? { name, path, url } : null;
}

function normalizeFields(value: unknown): IncidentFields {
  const raw = record(value);
  const extra = record(raw.valorExtra);
  return {
    valorExtra: {
      contenedor: nullableText(extra.contenedor ?? raw.contenedor),
      placa: nullableText(extra.placa ?? raw.placa)?.toUpperCase() || null
    },
    introduccion: text(raw.introduccion),
    hechos: text(raw.hechos)
  };
}

function normalizeInput(value: IncidentInput): IncidentInput {
  return {
    tipo_incidencia: value.tipo_incidencia,
    asunto: text(value.asunto),
    dirigido_a: text(value.dirigido_a),
    remitente: text(value.remitente),
    fecha_informe: nullableText(value.fecha_informe),
    analisis: text(value.analisis),
    conclusiones: text(value.conclusiones),
    recomendaciones: text(value.recomendaciones),
    campos: normalizeFields(value.campos),
    anexos: (value.anexos || []).map(normalizeAttachment).filter((item): item is IncidentAttachment => Boolean(item))
  };
}

export function calculateIncidentProgress(input: IncidentInput) {
  const data = normalizeInput(input);
  const values: Array<unknown> = [
    data.asunto,
    data.dirigido_a,
    data.remitente,
    data.fecha_informe,
    data.campos.hechos,
    data.analisis,
    data.conclusiones,
    data.recomendaciones
  ];

  if (data.tipo_incidencia === 'CABLE' || data.tipo_incidencia === 'MERCADERIA') {
    values.push(data.campos.valorExtra.contenedor);
  } else if (data.tipo_incidencia === 'CHOQUE') {
    values.push(data.campos.valorExtra.placa);
  } else if (data.tipo_incidencia === 'SINIESTRO') {
    values.push(data.campos.valorExtra.contenedor, data.campos.valorExtra.placa);
  }

  let completed = values.filter((value) => text(value)).length;
  let total = values.length;
  if (data.anexos.length > 0) {
    completed += 1;
    total += 1;
  }

  const progreso = total ? Math.round((completed / total) * 100) : 0;
  return {
    progreso,
    estado: (progreso === 100 ? 'COMPLETO' : 'BORRADOR') as 'BORRADOR' | 'COMPLETO'
  };
}

function normalizeRow(row: Record<string, unknown>): IncidentView {
  const tipo = text(row.tipo_incidencia).toUpperCase();
  const tipoSeguro = (INCIDENT_TYPES as readonly string[]).includes(tipo) ? tipo as IncidentType : 'SINIESTRO';
  const input = normalizeInput({
    tipo_incidencia: tipoSeguro,
    asunto: text(row.asunto),
    dirigido_a: text(row.dirigido_a),
    remitente: text(row.remitente),
    fecha_informe: nullableText(row.fecha_informe),
    analisis: text(row.analisis),
    conclusiones: text(row.conclusiones),
    recomendaciones: text(row.recomendaciones),
    campos: normalizeFields(row.campos),
    anexos: Array.isArray(row.anexos) ? row.anexos.map(normalizeAttachment).filter((item): item is IncidentAttachment => Boolean(item)) : []
  });
  const progress = calculateIncidentProgress(input);
  return { id: text(row.id), ...input, ...progress };
}

const SELECT_FIELDS = 'id,tipo_incidencia,asunto,dirigido_a,remitente,fecha_informe,analisis,conclusiones,recomendaciones,campos,progreso,estado,anexos';

export async function readIncidents(): Promise<IncidentView[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('incidencias')
    .select(SELECT_FIELDS)
    .order('fecha_informe', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data || []).map((row) => normalizeRow(row as Record<string, unknown>));
}

export async function saveIncident(input: IncidentInput, id?: string): Promise<IncidentView> {
  const supabase = getSupabaseAdmin();
  const normalized = normalizeInput(input);
  const progress = calculateIncidentProgress(normalized);
  const payload = { ...normalized, ...progress };

  const query = id
    ? supabase.from('incidencias').update(payload).eq('id', id)
    : supabase.from('incidencias').insert([payload]);

  const { data, error } = await query.select(SELECT_FIELDS).single();
  if (error) throw error;
  return normalizeRow(data as Record<string, unknown>);
}
