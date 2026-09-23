'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

const TIPOS = [
  ['CABLE','SUSTRACCIÓN DE CABLE RH'],
  ['MERCADERIA','SUSTRACCIÓN DE MERCADERÍA'],
  ['CHOQUE','CHOQUE DE UNIDAD'],
  ['SINIESTRO','SINIESTRO']
] as const;

type Row = Record<string, any>;

export default function IncidenciasPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState('CABLE');
  const [anexos, setAnexos] = useState<any[]>([]);

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/incidencias', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar incidencias');
      setRows(payload.data || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    const uploaded: any[] = [];
    for (const file of Array.from(files).slice(0, 30)) {
      const body = new FormData();
      body.set('file', file); body.set('bucket', 'incidencias'); body.set('folder', 'informes');
      const response = await fetch('/api/storage/upload', { method: 'POST', body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `No se pudo subir ${file.name}`);
      uploaded.push({ name: file.name, path: payload.path, url: payload.url });
    }
    setAnexos((current) => [...current, ...uploaded]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(''); setSuccess('');
    const form = new FormData(event.currentTarget);
    const asunto = TIPOS.find(([key]) => key === tipo)?.[1] || tipo;
    const extra: Record<string,string> = {};
    const contenedor = String(form.get('contenedor') || '').trim();
    const placa = String(form.get('placa') || '').trim().toUpperCase();
    if (contenedor) extra.contenedor = contenedor;
    if (placa) extra.placa = placa;
    const payload = {
      tipo_incidencia: tipo,
      asunto,
      dirigido_a: String(form.get('dirigido_a') || ''),
      remitente: String(form.get('remitente') || ''),
      fecha_informe: String(form.get('fecha_informe') || '') || null,
      analisis: String(form.get('analisis') || ''),
      conclusiones: String(form.get('conclusiones') || ''),
      recomendaciones: String(form.get('recomendaciones') || ''),
      campos: { valorExtra: extra, introduccion: String(form.get('introduccion') || ''), hechos: String(form.get('hechos') || '') },
      progreso: 100,
      estado: String(form.get('estado') || 'BORRADOR'),
      anexos
    };
    try {
      const response = await fetch('/api/incidencias', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar');
      setSuccess('Informe guardado correctamente.'); setAnexos([]); setShowForm(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setSaving(false); }
  }

  const completos = useMemo(() => rows.filter((r) => String(r.estado).toUpperCase() === 'COMPLETO').length, [rows]);

  return (
    <main>
      <div className="page-head"><div><div className="eyebrow">Incidencias</div><h1>Gestión integral</h1><p>El dominio general de incidencias vuelve a estar separado de las incidencias de llaves y ahora vive dentro de la plataforma moderna.</p></div><button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cerrar formulario' : 'Nueva incidencia'}</button></div>
      <div className="metric-strip"><div className="metric"><div className="value">{rows.length}</div><div className="label">Total</div></div><div className="metric"><div className="value">{completos}</div><div className="label">Completas</div></div><div className="metric"><div className="value">{rows.length-completos}</div><div className="label">Borradores</div></div><div className="metric"><div className="value">{TIPOS.length}</div><div className="label">Tipos estándar</div></div></div>
      {error ? <div className="feedback error">{error}</div> : null}{success ? <div className="feedback success">{success}</div> : null}
      {showForm ? <section className="section"><div className="section-head"><div><h2>Nuevo informe</h2><p>Campos migrados del proyecto Formulario-Mamparas.</p></div></div><form onSubmit={submit} className="form-grid">
        <div className="field"><label>Tipo</label><select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className="field"><label>Fecha</label><input className="input" type="date" name="fecha_informe" defaultValue={new Date().toISOString().slice(0,10)} /></div>
        <div className="field"><label>Dirigido a</label><input className="input" name="dirigido_a" /></div><div className="field"><label>Remitente</label><input className="input" name="remitente" /></div>
        {(tipo === 'CABLE' || tipo === 'MERCADERIA' || tipo === 'SINIESTRO') ? <div className="field"><label>Contenedor</label><input className="input" name="contenedor" /></div> : null}
        {(tipo === 'CHOQUE' || tipo === 'SINIESTRO') ? <div className="field"><label>Placa</label><input className="input" name="placa" maxLength={12} /></div> : null}
        <div className="field full"><label>Introducción</label><textarea className="textarea" name="introduccion" /></div><div className="field full"><label>Hechos</label><textarea className="textarea" name="hechos" /></div><div className="field full"><label>Análisis</label><textarea className="textarea" name="analisis" /></div><div className="field full"><label>Conclusiones</label><textarea className="textarea" name="conclusiones" /></div><div className="field full"><label>Recomendaciones</label><textarea className="textarea" name="recomendaciones" /></div>
        <div className="field"><label>Evidencias</label><input className="input" type="file" multiple accept="image/*,.pdf" onChange={(e) => { uploadFiles(e.target.files).catch((err) => setError(err.message)); }} /><span style={{color:'var(--muted)',fontSize:12}}>{anexos.length} archivo(s) subidos</span></div>
        <div className="field"><label>Estado</label><select className="select" name="estado"><option>BORRADOR</option><option>COMPLETO</option></select></div>
        <div className="full toolbar"><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar informe'}</button></div>
      </form></section> : null}
      <section className="section"><div className="section-head"><div><h2>Registros</h2><p>Fuente: public.incidencias.</p></div><button className="btn btn-secondary" onClick={load}>Actualizar</button></div>{loading ? <div className="empty">Cargando…</div> : <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Asunto</th><th>Remitente</th><th>Progreso</th><th>Estado</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.fecha_informe || (row.created_at ? new Date(row.created_at).toLocaleDateString('es-PE') : '—')}</td><td>{row.tipo_incidencia || '—'}</td><td><strong>{row.asunto || '—'}</strong></td><td>{row.remitente || '—'}</td><td>{row.progreso ?? 0}%</td><td><span className={`badge ${String(row.estado).toUpperCase()==='COMPLETO'?'success':'warning'}`}>{row.estado || '—'}</span></td></tr>)}</tbody></table></div>}</section>
    </main>
  );
}
