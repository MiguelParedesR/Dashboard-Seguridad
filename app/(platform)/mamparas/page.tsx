'use client';

import { useEffect, useMemo, useState } from 'react';
import InspectionForm, { type InspectionRow } from '@/components/mamparas/InspectionForm';

function parseDetail(value: string) {
  try { return value ? JSON.parse(value) as Record<string, any> : {}; } catch { return {}; }
}

function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export default function MamparasPage() {
  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('TODOS');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<InspectionRow | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/mamparas/inspecciones', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las inspecciones');
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las inspecciones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const plate = normalizePlate(query);
    return rows.filter((row) => {
      if (typeFilter !== 'TODOS' && row.incorreccion !== typeFilter) return false;
      return !plate || normalizePlate(row.placa).includes(plate);
    });
  }, [rows, query, typeFilter]);

  const mamparas = rows.filter((row) => row.incorreccion === 'Mampara').length;
  const detail = selected ? parseDetail(selected.detalle) : null;
  const images = detail?.imagenes && typeof detail.imagenes === 'object' ? Object.entries(detail.imagenes).filter(([, value]) => Boolean(value)) : [];

  function saved(row: InspectionRow) {
    setRows((current) => [row, ...current]);
    setShowForm(false);
    setSuccess('Inspección registrada correctamente.');
    setSelected(row);
  }

  return (
    <main>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inspección vehicular</div>
          <h1>Mamparas</h1>
          <p>Flujo migrado desde Formulario-Mamparas con validación de placa existente, detalle obligatorio, medidas y evidencias trazables.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => { setShowForm(true); setSuccess(''); }}>Nueva inspección</button>
      </div>

      <div className="metric-strip" aria-label="Resumen de inspecciones">
        <div className="metric"><div className="value">{rows.length}</div><div className="label">Registros</div></div>
        <div className="metric"><div className="value">{mamparas}</div><div className="label">Mamparas</div></div>
        <div className="metric"><div className="value">{rows.length - mamparas}</div><div className="label">Otras incorrecciones</div></div>
        <div className="metric"><div className="value">1.80 m / 0.15 m</div><div className="label">Referencia operativa</div></div>
      </div>

      {error ? <div className="feedback error" role="alert">{error}</div> : null}
      {success ? <div className="feedback success" role="status">{success}</div> : null}
      {showForm ? <InspectionForm onCancel={() => setShowForm(false)} onSaved={saved} /> : null}

      <section className="section">
        <div className="section-head">
          <div><h2>Histórico</h2><p>{loading ? 'Cargando inspecciones…' : `${filtered.length} registros visibles`}</p></div>
          <div className="toolbar">
            <input className="input" placeholder="Buscar placa" value={query} onChange={(e) => setQuery(normalizePlate(e.target.value))} maxLength={6} />
            <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="TODOS">Todos los tipos</option><option>Mampara</option><option>Cola de Pato</option><option>Pernos</option><option>Otros</option></select>
            <button className="btn btn-secondary" type="button" onClick={load} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</button>
          </div>
        </div>

        {loading ? <div className="empty">Cargando…</div> : null}
        {!loading && filtered.length === 0 ? <div className="empty">No hay inspecciones para los filtros seleccionados.</div> : null}
        {!loading && filtered.length > 0 ? <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Placa</th><th>Empresa</th><th>Responsable</th><th>Tipo</th><th>Medidas</th><th>Acción</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}>
          <td>{row.fecha || '—'}</td><td>{row.hora || '—'}</td><td><strong>{row.placa || '—'}</strong></td><td>{row.empresa || '—'}</td><td>{row.responsable || '—'}</td><td>{row.incorreccion || '—'}</td><td>{row.incorreccion === 'Mampara' ? `${row.altura_mampara ?? '—'} cm · ${row.separacion_central ?? '—'} cm` : '—'}</td><td><button className="btn btn-secondary" type="button" onClick={() => setSelected(row)}>Ver detalle</button></td>
        </tr>)}</tbody></table></div> : null}
      </section>

      {selected ? <section className="section" aria-labelledby="inspection-detail-title">
        <div className="section-head"><div><h2 id="inspection-detail-title">Detalle · {selected.placa}</h2><p>{selected.fecha} {selected.hora} · {selected.empresa}</p></div><button className="btn btn-secondary" type="button" onClick={() => setSelected(null)}>Cerrar</button></div>
        <div className="form-grid">
          <div className="field"><label>Chofer</label><div className="input" aria-readonly="true">{selected.chofer || '—'}</div></div>
          <div className="field"><label>Lugar</label><div className="input" aria-readonly="true">{selected.lugar || '—'}</div></div>
          <div className="field"><label>Observaciones</label><div className="input" aria-readonly="true">{selected.observaciones || '—'}</div></div>
          <div className="field"><label>Tipo</label><div className="input" aria-readonly="true">{selected.incorreccion || '—'}</div></div>
          {detail?.datos?.observacion_texto ? <div className="field full"><label>Descripción</label><div className="input" aria-readonly="true">{String(detail.datos.observacion_texto)}</div></div> : null}
          <div className="field full"><label>Evidencias</label><div className="toolbar">{images.length ? images.map(([key, value]) => <a key={key} href={String(value)} target="_blank" rel="noreferrer">{key.replace(/_/g, ' ')}</a>) : 'Sin evidencias'}</div></div>
          {detail?.json_storage?.publicUrl ? <div className="field full"><label>Detalle JSON</label><a href={String(detail.json_storage.publicUrl)} target="_blank" rel="noreferrer">Abrir evidencia estructurada</a></div> : null}
        </div>
      </section> : null}
    </main>
  );
}
