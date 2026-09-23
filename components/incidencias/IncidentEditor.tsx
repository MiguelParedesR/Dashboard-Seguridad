'use client';

import { FormEvent, useMemo, useState } from 'react';

export type IncidentAttachment = { name: string; path: string; url: string };
export type IncidentRow = {
  id: string;
  tipo_incidencia: 'CABLE' | 'MERCADERIA' | 'CHOQUE' | 'SINIESTRO';
  asunto: string;
  dirigido_a: string;
  remitente: string;
  fecha_informe: string | null;
  analisis: string;
  conclusiones: string;
  recomendaciones: string;
  campos: { valorExtra: { contenedor: string | null; placa: string | null }; introduccion: string; hechos: string };
  anexos: IncidentAttachment[];
  progreso: number;
  estado: 'BORRADOR' | 'COMPLETO';
};

const TYPES = [
  ['CABLE', 'SUSTRACCIÓN DE CABLE RH'],
  ['MERCADERIA', 'SUSTRACCIÓN DE MERCADERÍA'],
  ['CHOQUE', 'CHOQUE DE UNIDAD'],
  ['SINIESTRO', 'SINIESTRO']
] as const;

type Draft = {
  tipo: IncidentRow['tipo_incidencia'];
  asunto: string;
  dirigido: string;
  remitente: string;
  fecha: string;
  introduccion: string;
  hechos: string;
  analisis: string;
  conclusiones: string;
  recomendaciones: string;
  contenedor: string;
  placa: string;
};

function makeDraft(row?: IncidentRow | null): Draft {
  const tipo = row?.tipo_incidencia || 'CABLE';
  return {
    tipo,
    asunto: row?.asunto || TYPES.find(([key]) => key === tipo)?.[1] || '',
    dirigido: row?.dirigido_a || '',
    remitente: row?.remitente || '',
    fecha: row?.fecha_informe || new Date().toISOString().slice(0, 10),
    introduccion: row?.campos?.introduccion || '',
    hechos: row?.campos?.hechos || '',
    analisis: row?.analisis || '',
    conclusiones: row?.conclusiones || '',
    recomendaciones: row?.recomendaciones || '',
    contenedor: row?.campos?.valorExtra?.contenedor || '',
    placa: row?.campos?.valorExtra?.placa || ''
  };
}

function filled(value: unknown) {
  return String(value ?? '').trim().length > 0;
}

function previewProgress(draft: Draft, attachmentCount: number) {
  const values: unknown[] = [draft.asunto, draft.dirigido, draft.remitente, draft.fecha, draft.hechos, draft.analisis, draft.conclusiones, draft.recomendaciones];
  if (draft.tipo === 'CABLE' || draft.tipo === 'MERCADERIA') values.push(draft.contenedor);
  if (draft.tipo === 'CHOQUE') values.push(draft.placa);
  if (draft.tipo === 'SINIESTRO') values.push(draft.contenedor, draft.placa);
  let complete = values.filter(filled).length;
  let total = values.length;
  if (attachmentCount > 0) { complete += 1; total += 1; }
  return total ? Math.round((complete / total) * 100) : 0;
}

export default function IncidentEditor({ initial, onCancel, onSaved }: {
  initial?: IncidentRow | null;
  onCancel: () => void;
  onSaved: (row: IncidentRow) => void;
}) {
  const [draft, setDraft] = useState(() => makeDraft(initial));
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const existing = initial?.anexos || [];
  const progress = useMemo(() => previewProgress(draft, existing.length + files.length), [draft, existing.length, files.length]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function changeType(value: IncidentRow['tipo_incidencia']) {
    update('tipo', value);
    update('asunto', TYPES.find(([key]) => key === value)?.[1] || value);
  }

  function payload(anexos: IncidentAttachment[]) {
    return {
      tipo_incidencia: draft.tipo,
      asunto: draft.asunto.trim(),
      dirigido_a: draft.dirigido.trim(),
      remitente: draft.remitente.trim(),
      fecha_informe: draft.fecha || null,
      analisis: draft.analisis,
      conclusiones: draft.conclusiones,
      recomendaciones: draft.recomendaciones,
      campos: {
        valorExtra: {
          contenedor: draft.contenedor.trim() || null,
          placa: draft.placa.trim().toUpperCase() || null
        },
        introduccion: draft.introduccion,
        hechos: draft.hechos
      },
      anexos
    };
  }

  async function persist(body: ReturnType<typeof payload>, id?: string) {
    const response = await fetch('/api/incidencias', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(id ? { id, ...body } : body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar la incidencia');
    return result.data as IncidentRow;
  }

  async function uploadEvidence(incidenciaId: string, file: File) {
    const body = new FormData();
    body.set('incidenciaId', incidenciaId);
    body.set('file', file);
    const response = await fetch('/api/incidencias/evidencias', { method: 'POST', body });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `No se pudo subir ${file.name}`);
    return result as IncidentAttachment;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (existing.length + files.length > 30) {
      setError('Solo se permiten 30 evidencias por informe.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let saved = await persist(payload(existing), initial?.id);
      if (files.length) {
        const uploaded: IncidentAttachment[] = [];
        for (const file of files) uploaded.push(await uploadEvidence(saved.id, file));
        saved = await persist(payload([...saved.anexos, ...uploaded]), saved.id);
      }
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la incidencia');
    } finally {
      setSaving(false);
    }
  }

  const needsContainer = draft.tipo === 'CABLE' || draft.tipo === 'MERCADERIA' || draft.tipo === 'SINIESTRO';
  const needsPlate = draft.tipo === 'CHOQUE' || draft.tipo === 'SINIESTRO';

  return (
    <section className="section" aria-labelledby="incident-editor-title">
      <div className="section-head">
        <div>
          <h2 id="incident-editor-title">{initial ? 'Editar incidencia' : 'Nueva incidencia'}</h2>
          <p>El progreso se calcula con el mismo criterio estandarizado de Formulario-Mamparas y se valida nuevamente en servidor.</p>
        </div>
        <div className="toolbar">
          <span className={`badge ${progress === 100 ? 'success' : 'warning'}`}>{progress}% · {progress === 100 ? 'COMPLETO' : 'BORRADOR'}</span>
          <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={saving}>Cerrar</button>
        </div>
      </div>

      {error ? <div className="feedback error" role="alert">{error}</div> : null}
      <form className="form-grid" onSubmit={submit}>
        <div className="field"><label>Tipo</label><select className="select" value={draft.tipo} onChange={(e) => changeType(e.target.value as Draft['tipo'])}>{TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className="field"><label>Fecha</label><input className="input" type="date" value={draft.fecha} onChange={(e) => update('fecha', e.target.value)} /></div>
        <div className="field full"><label>Asunto</label><input className="input" value={draft.asunto} onChange={(e) => update('asunto', e.target.value)} /></div>
        <div className="field"><label>Dirigido a</label><input className="input" value={draft.dirigido} onChange={(e) => update('dirigido', e.target.value)} /></div>
        <div className="field"><label>Remitente</label><input className="input" value={draft.remitente} onChange={(e) => update('remitente', e.target.value)} /></div>
        {needsContainer ? <div className="field"><label>Contenedor</label><input className="input" value={draft.contenedor} onChange={(e) => update('contenedor', e.target.value.toUpperCase())} /></div> : null}
        {needsPlate ? <div className="field"><label>Placa</label><input className="input" value={draft.placa} onChange={(e) => update('placa', e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase())} /></div> : null}
        <div className="field full"><label>Introducción</label><textarea className="textarea" value={draft.introduccion} onChange={(e) => update('introduccion', e.target.value)} /></div>
        <div className="field full"><label>Hechos</label><textarea className="textarea" value={draft.hechos} onChange={(e) => update('hechos', e.target.value)} /></div>
        <div className="field full"><label>Análisis</label><textarea className="textarea" value={draft.analisis} onChange={(e) => update('analisis', e.target.value)} /></div>
        <div className="field full"><label>Conclusiones</label><textarea className="textarea" value={draft.conclusiones} onChange={(e) => update('conclusiones', e.target.value)} /></div>
        <div className="field full"><label>Recomendaciones</label><textarea className="textarea" value={draft.recomendaciones} onChange={(e) => update('recomendaciones', e.target.value)} /></div>
        <div className="field full">
          <label>Evidencias ({existing.length + files.length}/30)</label>
          <input className="input" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, Math.max(0, 30 - existing.length)))} />
          {existing.length ? <div className="toolbar" style={{ marginTop: 8 }}>{existing.map((item) => <a key={item.path} href={item.url} target="_blank" rel="noreferrer">{item.name}</a>)}</div> : null}
        </div>
        <div className="full toolbar"><button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Guardar incidencia'}</button></div>
      </form>
    </section>
  );
}
