'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Local = { id: string; nombre?: string; activo?: boolean };
type Locker = {
  id: string; codigo?: string; local_id?: string; local?: string; area?: string; estado?: string; activo?: boolean;
  tiene_candado?: boolean; tiene_duplicado_llave?: boolean;
};

export default function AdminPage() {
  const router = useRouter();
  const [locales, setLocales] = useState<Local[]>([]);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [selected, setSelected] = useState('');
  const [editingLocker, setEditingLocker] = useState<Locker | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/lockers', { cache:'no-store' });
      if (response.status === 403) { router.replace('/lockers'); return; }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar configuración');
      setLocales(payload.locales || []); setLockers(payload.lockers || []);
      if (!selected && payload.locales?.[0]?.id) setSelected(payload.locales[0].id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function action(payload: unknown) {
    setWorking(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/admin/lockers', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación');
      setSuccess('Configuración actualizada.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setWorking(false); }
  }

  async function createLocal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const nombre = String(form.get('nombre') || '').trim(); if (!nombre) return;
    await action({ action:'crear_local', nombre }); event.currentTarget.reset();
  }
  async function createLockers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const cantidad = Number(form.get('cantidad') || 0); if (!selected || cantidad < 1) return;
    await action({ action:'crear_lockers', localId:selected, cantidad });
  }
  async function saveLocker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingLocker) return;
    const form = new FormData(event.currentTarget);
    await action({
      action:'actualizar_locker', lockerId: editingLocker.id,
      area:String(form.get('area') || '').trim(),
      activo:form.get('activo') === 'on',
      tieneCandado:form.get('tieneCandado') === 'on',
      tieneDuplicadoLlave:form.get('tieneDuplicadoLlave') === 'on'
    });
    setEditingLocker(null);
  }

  const selectedLocal = locales.find((l) => l.id === selected);
  const visible = useMemo(() => lockers.filter((locker) => String(locker.local_id || '') === String(selected) || (!locker.local_id && locker.local === selectedLocal?.nombre)), [lockers, selected, selectedLocal]);

  return <main>
    <div className="page-head"><div><div className="eyebrow">Administración</div><h1>Configuración de lockers</h1><p>Altas, disponibilidad y configuración física se procesan solo por API administrativa autenticada.</p></div></div>
    {error?<div className="feedback error">{error}</div>:null}{success?<div className="feedback success">{success}</div>:null}
    <div className="grid-2">
      <section className="panel"><h3>Locales</h3><form className="field" onSubmit={createLocal}><label>Nuevo local</label><div className="toolbar"><input className="input" name="nombre" placeholder="Nombre del local" required/><button className="btn btn-primary" disabled={working}>Crear</button></div></form><div className="field"><label>Local</label><select className="select" value={selected} onChange={(e)=>setSelected(e.target.value)}>{locales.map((local)=><option value={local.id} key={local.id}>{local.nombre || local.id}{local.activo===false?' · inactivo':''}</option>)}</select></div>{selected?<div className="toolbar" style={{marginTop:16}}><button className="btn btn-secondary" disabled={working} onClick={()=>{const nombre=prompt('Nuevo nombre del local',selectedLocal?.nombre||''); if(nombre) void action({action:'actualizar_local',localId:selected,nombre,activo:selectedLocal?.activo!==false});}}>Renombrar</button><button className="btn btn-danger" disabled={working} onClick={()=>{if(confirm('¿Eliminar este local?')) void action({action:'eliminar_local',localId:selected});}}>Eliminar</button></div>:null}</section>
      <section className="panel"><h3>Generar lockers</h3><p>Los códigos y relaciones se generan mediante la RPC administrativa existente.</p><form className="field" onSubmit={createLockers}><label>Cantidad</label><div className="toolbar"><input className="input" type="number" name="cantidad" min="1" max="500" defaultValue="10"/><button className="btn btn-primary" disabled={working || !selected}>Generar</button></div></form></section>
    </div>
    {editingLocker?<section className="section"><div className="section-head"><div><h2>Editar {editingLocker.codigo}</h2><p>Configuración física y disponibilidad administrativa.</p></div><button className="btn btn-secondary" onClick={()=>setEditingLocker(null)}>Cerrar</button></div><form className="form-grid" onSubmit={saveLocker}><div className="field"><label>Área</label><input className="input" name="area" defaultValue={editingLocker.area||''}/></div><label><input type="checkbox" name="activo" defaultChecked={editingLocker.activo!==false}/> Activo</label><label><input type="checkbox" name="tieneCandado" defaultChecked={Boolean(editingLocker.tiene_candado)}/> Tiene candado</label><label><input type="checkbox" name="tieneDuplicadoLlave" defaultChecked={Boolean(editingLocker.tiene_duplicado_llave)}/> Tiene duplicado de llave</label><div className="full"><button className="btn btn-primary" disabled={working}>Guardar cambios</button></div></form></section>:null}
    <section className="section"><div className="section-head"><div><h2>Lockers generados</h2><p>{selectedLocal?.nombre || 'Selecciona un local'} · {visible.length} registros</p></div><button className="btn btn-secondary" onClick={load}>Actualizar</button></div>{loading?<div className="empty">Cargando…</div>:<div className="table-wrap"><table><thead><tr><th>Código</th><th>Área</th><th>Estado</th><th>Activo</th><th>Candado</th><th>Duplicado</th><th></th></tr></thead><tbody>{visible.map((locker)=><tr key={locker.id}><td><strong>{locker.codigo || '—'}</strong></td><td>{locker.area || '—'}</td><td><span className="badge info">{locker.estado || '—'}</span></td><td>{locker.activo===false?'No':'Sí'}</td><td>{locker.tiene_candado?'Sí':'No'}</td><td>{locker.tiene_duplicado_llave?'Sí':'No'}</td><td><button className="btn btn-secondary" onClick={()=>setEditingLocker(locker)}>Editar</button></td></tr>)}</tbody></table></div>}</section>
  </main>;
}
