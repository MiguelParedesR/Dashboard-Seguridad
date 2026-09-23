'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Row = Record<string, any>;

async function upload(file: File | null, folder: string) {
  if (!file) return null;
  const body = new FormData(); body.set('file', file); body.set('bucket','mamparas'); body.set('folder', folder);
  const response = await fetch('/api/storage/upload', { method:'POST', body });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo subir evidencia');
  return payload.url as string;
}

export default function MamparasPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState('Mampara');

  async function load(placa = '') {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/mamparas/inspecciones${placa ? `?placa=${encodeURIComponent(placa)}` : ''}`, { cache:'no-store' });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar inspecciones');
      setRows(payload.data || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(''); setSuccess('');
    const form = new FormData(event.currentTarget);
    try {
      const placa = String(form.get('placa') || '').replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
      const esMampara = tipo === 'Mampara';
      const fotoPanoramica = await upload(form.get('fotoPanoramica') as File, `inspecciones/${placa}/panoramica`);
      const fotoAltura = esMampara ? await upload(form.get('fotoAltura') as File, `inspecciones/${placa}/altura`) : null;
      const fotoLateral = esMampara ? await upload(form.get('fotoLateral') as File, `inspecciones/${placa}/lateral`) : null;
      const fotoObservacion = !esMampara ? await upload(form.get('fotoObservacion') as File, `inspecciones/${placa}/observacion`) : null;
      const separacion = esMampara ? Number(form.get('separacion_central') || 0) : null;
      const altura = esMampara ? Number(form.get('altura_mampara') || 0) : null;
      const detalle = esMampara ? {
        tipo:'Mampara', datos:{ separacion_lateral_central: separacion, altura_mampara: altura },
        imagenes:{ foto_panoramica_unidad: fotoPanoramica, foto_altura_mampara: fotoAltura, foto_lateral_central: fotoLateral }, timestamp:new Date().toISOString()
      } : {
        tipo, datos:{ observacion_texto:String(form.get('observacion_texto') || '') },
        imagenes:{ foto_observacion: fotoObservacion || fotoPanoramica }, timestamp:new Date().toISOString()
      };
      const payload = {
        fecha:String(form.get('fecha')), hora:String(form.get('hora')), responsable:String(form.get('responsable') || ''), empresa:String(form.get('empresa') || ''), placa,
        chofer:String(form.get('chofer') || ''), lugar:String(form.get('lugar') || ''), incorreccion:tipo, observaciones:String(form.get('observaciones') || ''),
        separacion_central: separacion, medida_altura: altura !== null ? `${altura} cm` : null, medida_central: separacion !== null ? `${separacion} cm` : null,
        altura_mampara: altura, foto_unidad: esMampara ? fotoPanoramica : null, foto_observacion: esMampara ? fotoAltura : (fotoObservacion || fotoPanoramica), detalle:JSON.stringify(detalle)
      };
      const response = await fetch('/api/mamparas/inspecciones', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'No se pudo registrar inspección');
      setSuccess('Inspección registrada correctamente.'); setShowForm(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setSaving(false); }
  }

  const mamparas = useMemo(() => rows.filter((r) => String(r.incorreccion).toLowerCase() === 'mampara').length, [rows]);
  const now = new Date(); const fecha = now.toISOString().slice(0,10); const hora = now.toTimeString().slice(0,5);

  return <main>
    <div className="page-head"><div><div className="eyebrow">Inspección vehicular</div><h1>Mamparas</h1><p>Flujo migrado desde Formulario-Mamparas: validación, medidas, evidencias y trazabilidad en una sola aplicación.</p></div><button className="btn btn-primary" onClick={() => setShowForm((v)=>!v)}>{showForm?'Cerrar':'Nueva inspección'}</button></div>
    <div className="metric-strip"><div className="metric"><div className="value">{rows.length}</div><div className="label">Registros</div></div><div className="metric"><div className="value">{mamparas}</div><div className="label">Mamparas</div></div><div className="metric"><div className="value">{rows.length-mamparas}</div><div className="label">Otras observaciones</div></div><div className="metric"><div className="value">1.80 m</div><div className="label">Altura estándar</div></div></div>
    {error?<div className="feedback error">{error}</div>:null}{success?<div className="feedback success">{success}</div>:null}
    {showForm?<section className="section"><div className="section-head"><div><h2>Registrar inspección</h2><p>Fotos y detalle se guardan en Supabase Storage y PostgreSQL.</p></div></div><form className="form-grid" onSubmit={submit}>
      <div className="field"><label>Fecha</label><input className="input" type="date" name="fecha" defaultValue={fecha} required/></div><div className="field"><label>Hora</label><input className="input" type="time" name="hora" defaultValue={hora} required/></div>
      <div className="field"><label>Responsable</label><input className="input" name="responsable" required/></div><div className="field"><label>Empresa</label><input className="input" name="empresa" required/></div>
      <div className="field"><label>Placa</label><input className="input" name="placa" maxLength={8} required/></div><div className="field"><label>Chofer</label><input className="input" name="chofer"/></div>
      <div className="field"><label>Lugar</label><input className="input" name="lugar"/></div><div className="field"><label>Incorrección</label><select className="select" value={tipo} onChange={(e)=>setTipo(e.target.value)}><option>Mampara</option><option>Otros</option></select></div>
      {tipo==='Mampara'?<><div className="field"><label>Separación lateral (cm)</label><input className="input" name="separacion_central" type="number" min="0" step="0.01" required/></div><div className="field"><label>Altura mampara (cm)</label><input className="input" name="altura_mampara" type="number" min="0" step="0.01" required/></div><div className="field"><label>Foto panorámica</label><input className="input" type="file" name="fotoPanoramica" accept="image/*" required/></div><div className="field"><label>Foto altura</label><input className="input" type="file" name="fotoAltura" accept="image/*" required/></div><div className="field"><label>Foto lateral</label><input className="input" type="file" name="fotoLateral" accept="image/*" required/></div></>:<><div className="field full"><label>Descripción</label><textarea className="textarea" name="observacion_texto" required/></div><div className="field"><label>Foto observación</label><input className="input" type="file" name="fotoObservacion" accept="image/*" required/></div></>}
      <div className="field full"><label>Observaciones</label><textarea className="textarea" name="observaciones"/></div><div className="full"><button className="btn btn-primary" disabled={saving}>{saving?'Registrando…':'Registrar inspección'}</button></div>
    </form></section>:null}
    <section className="section"><div className="section-head"><div><h2>Histórico</h2><p>Consulta por placa y revisión de últimos registros.</p></div><div className="toolbar"><input className="input" placeholder="Buscar placa" value={query} onChange={(e)=>setQuery(e.target.value.toUpperCase())}/><button className="btn btn-secondary" onClick={()=>load(query)}>Buscar</button><button className="btn btn-secondary" onClick={()=>{setQuery('');load();}}>Limpiar</button></div></div>{loading?<div className="empty">Cargando…</div>:<div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Placa</th><th>Empresa</th><th>Responsable</th><th>Tipo</th><th>Medidas</th></tr></thead><tbody>{rows.map((row)=><tr key={row.id}><td>{row.fecha||'—'}</td><td>{row.hora||'—'}</td><td><strong>{row.placa||'—'}</strong></td><td>{row.empresa||'—'}</td><td>{row.responsable||'—'}</td><td>{row.incorreccion||'—'}</td><td>{row.altura_mampara?`${row.altura_mampara} cm`:''}{row.separacion_central?` · ${row.separacion_central} cm`:''}</td></tr>)}</tbody></table></div>}</section>
  </main>;
}
