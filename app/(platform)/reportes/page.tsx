'use client';

import { useEffect, useMemo, useState } from 'react';

export default function ReportesPage() {
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [inspecciones, setInspecciones] = useState<any[]>([]);
  const [lockers, setLockers] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/incidencias',{cache:'no-store'}).then(r=>r.json()),
      fetch('/api/mamparas/inspecciones',{cache:'no-store'}).then(r=>r.json()),
      fetch('/api/lockers/overview',{cache:'no-store'}).then(r=>r.json())
    ]).then(([a,b,c])=>{setIncidencias(a.data||[]);setInspecciones(b.data||[]);setLockers(c.data||[]);}).catch((e)=>setError(e.message||'No se pudieron cargar reportes'));
  },[]);

  const libre = useMemo(()=>lockers.filter((x)=>String(x.estado).toUpperCase()==='LIBRE').length,[lockers]);
  const ocupados = useMemo(()=>lockers.filter((x)=>String(x.estado).toUpperCase()==='OCUPADO').length,[lockers]);
  const mamparas = useMemo(()=>inspecciones.filter((x)=>String(x.incorreccion).toLowerCase()==='mampara').length,[inspecciones]);

  function exportCsv() {
    const rows = [
      ['indicador','valor'],
      ['incidencias',incidencias.length],
      ['inspecciones',inspecciones.length],
      ['inspecciones_mampara',mamparas],
      ['lockers_total',lockers.length],
      ['lockers_libres',libre],
      ['lockers_ocupados',ocupados]
    ];
    const csv = rows.map((r)=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=`tpp-reporte-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  }

  return <main>
    <div className="page-head"><div><div className="eyebrow">Analítica</div><h1>Reportes</h1><p>Lectura consolidada sin duplicar fuentes. Cada indicador conserva su tabla canónica.</p></div><button className="btn btn-primary" onClick={exportCsv}>Exportar CSV</button></div>
    {error?<div className="feedback error">{error}</div>:null}
    <div className="metric-strip"><div className="metric"><div className="value">{incidencias.length}</div><div className="label">Incidencias</div></div><div className="metric"><div className="value">{inspecciones.length}</div><div className="label">Inspecciones</div></div><div className="metric"><div className="value">{lockers.length}</div><div className="label">Lockers</div></div><div className="metric"><div className="value">{mamparas}</div><div className="label">Mamparas</div></div></div>
    <section className="section"><div className="section-head"><div><h2>Estado de lockers</h2><p>Distribución operativa actual.</p></div></div><div className="grid-3"><div className="panel"><h3>Libres</h3><p style={{fontSize:34,color:'var(--text)',margin:'10px 0 0',fontWeight:700}}>{libre}</p></div><div className="panel"><h3>Ocupados</h3><p style={{fontSize:34,color:'var(--text)',margin:'10px 0 0',fontWeight:700}}>{ocupados}</p></div><div className="panel"><h3>Otros estados</h3><p style={{fontSize:34,color:'var(--text)',margin:'10px 0 0',fontWeight:700}}>{Math.max(lockers.length-libre-ocupados,0)}</p></div></div></section>
  </main>;
}
