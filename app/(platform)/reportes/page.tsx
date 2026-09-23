'use client';

import { useEffect, useState } from 'react';

type Summary = {
  incidencias: number;
  incidenciasCompletas: number;
  inspecciones: number;
  inspeccionesMampara: number;
  lockers: number;
  lockersLibres: number;
  lockersOcupados: number;
  lockersConIncidencia: number;
  solicitudesPendientes: number;
  generatedAt: string;
};

export default function ReportesPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/reportes', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el reporte');
      setData(payload.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return <main>
    <div className="page-head">
      <div><div className="eyebrow">Analítica</div><h1>Reportes</h1><p>Consolidado generado en servidor desde las fuentes canónicas de incidencias, inspecciones y lockers.</p></div>
      <div className="toolbar"><button className="btn btn-secondary" onClick={load} disabled={loading}>Actualizar</button><a className="btn btn-primary" href="/api/reportes?format=csv">Exportar CSV</a></div>
    </div>
    {error ? <div className="feedback error">{error}</div> : null}
    {loading ? <div className="empty">Generando reporte…</div> : null}
    {!loading && data ? <>
      <div className="metric-strip">
        <div className="metric"><div className="value">{data.incidencias}</div><div className="label">Incidencias</div></div>
        <div className="metric"><div className="value">{data.inspecciones}</div><div className="label">Inspecciones</div></div>
        <div className="metric"><div className="value">{data.lockers}</div><div className="label">Lockers activos</div></div>
        <div className="metric"><div className="value">{data.solicitudesPendientes}</div><div className="label">Solicitudes pendientes</div></div>
      </div>
      <section className="section"><div className="section-head"><div><h2>Resumen operativo</h2><p>Actualizado {new Date(data.generatedAt).toLocaleString('es-PE')}.</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>
          <tr><td>Incidencias completas</td><td>{data.incidenciasCompletas}</td></tr>
          <tr><td>Inspecciones de mampara</td><td>{data.inspeccionesMampara}</td></tr>
          <tr><td>Lockers libres</td><td>{data.lockersLibres}</td></tr>
          <tr><td>Lockers ocupados</td><td>{data.lockersOcupados}</td></tr>
          <tr><td>Incidencias de llaves pendientes</td><td>{data.lockersConIncidencia}</td></tr>
        </tbody></table></div>
      </section>
    </> : null}
  </main>;
}
