'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Local = { id: string; nombre?: string; activo?: boolean };
type Locker = { id: string; codigo?: string; local_id?: string; local?: string; area?: string; estado?: string; activo?: boolean };

export default function AdminPage() {
  const router = useRouter();
  const [locales, setLocales] = useState<Local[]>([]);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/lockers', { cache:'no-store' });
      if (response.status === 403) { router.replace('/lockers'); return; }
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'No se pudo cargar configuración');
      setLocales(payload.locales || []); setLockers(payload.lockers || []);
      if (!selected && payload.locales?.[0]?.id) setSelected(payload.locales[0].id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function action(payload: any) {
    setWorking(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/admin/lockers', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación');
      setSuccess('Operación completada.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setWorking(false); }
  }

  async function createLocal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const nombre = String(form.get('nombre') || '').trim(); if (!nombre) return;
    await action({ action:'crear_local', nombre }); (event.currentTarget as HTMLFormElement).reset();
  }
  async function createLockers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const cantidad = Number(form.get('cantidad') || 0); if (!selected || cantidad < 1) return;
    await action({ action:'crear_lockers', localId:selected, cantidad });
  }

  const selectedLocal = locales.find((l) => l.id === selected);
  const visible = useMemo(() => lockers.filter((locker) => String(locker.local_id || '') === String(selected) || (!locker.local_id && locker.local === selectedLocal?.nombre)), [lockers, selected, selectedLocal]);

  return <main>
    <div className="page-head"><div><div className="eyebrow">Administración</div><h1>Configuración</h1><p>Altas y generación de lockers pasan por RPC administrativas; la UI ya no adivina columnas ni escribe estructuras sensibles directamente.</p></div></div>
    {error?<div className="feedback error">{error}</div>:null}{success?<div className="feedback success">{success}</div>:null}
    <div className="grid-2">
      <section className="panel"><h3>Locales</h3><p>Crear o seleccionar un local operativo.</p><form className="field" onSubmit={createLocal}><label>Nuevo local</label><div className="toolbar"><input className="input" name="nombre" placeholder="Nombre del local"/><button className="btn btn-primary" disabled={working}>Crear</button></div></form><div className="field"><label>Local activo</label><select className="select" value={selected} onChange={(e)=>setSelected(e.target.value)}>{locales.map((local)=><option value={local.id} key={local.id}>{local.nombre || local.id}</option>)}</select></div>{selected?<button className="btn btn-danger" style={{marginTop:16}} disabled={working} onClick={()=>{ if(confirm('¿Eliminar este local?')) action({action:'eliminar_local',localId:selected}); }}>Eliminar local</button>:null}</section>
      <section className="panel"><h3>Generar lockers</h3><p>Los códigos y relaciones se generan en PostgreSQL mediante app.admin_crear_lockers.</p><form className="field" onSubmit={createLockers}><label>Cantidad</label><div className="toolbar"><input className="input" type="number" name="cantidad" min="1" max="500" defaultValue="10"/><button className="btn btn-primary" disabled={working || !selected}>Generar</button></div></form></section>
    </div>
    <section className="section"><div className="section-head"><div><h2>Lockers generados</h2><p>{selectedLocal?.nombre || 'Selecciona un local'} · {visible.length} registros</p></div><button className="btn btn-secondary" onClick={load}>Actualizar</button></div>{loading?<div className="empty">Cargando…</div>:<div className="table-wrap"><table><thead><tr><th>Código</th><th>Área</th><th>Estado</th><th>Activo</th></tr></thead><tbody>{visible.map((locker)=><tr key={locker.id}><td><strong>{locker.codigo || '—'}</strong></td><td>{locker.area || '—'}</td><td><span className="badge info">{locker.estado || '—'}</span></td><td>{locker.activo===false?'No':'Sí'}</td></tr>)}</tbody></table></div>}</section>
  </main>;
}
