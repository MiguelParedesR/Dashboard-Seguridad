import { useEffect, useState } from 'react';
import './dashboard.css';

const MODULE_KEY = 'dashboard';

function isMissingTableError(error) {
  if (!error) return false;
  const status = error.status || error.statusCode || error.code;
  if (status === 404) return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('does not exist') || message.includes('relation') || message.includes('not found');
}

async function countTableRows(client, table, filters = {}) {
  if (!client) return null;
  try {
    let query = client.from(table).select('*', { count: 'exact', head: true });
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    const { count, error } = await query;
    if (error) {
      if (isMissingTableError(error)) return null;
      return null;
    }
    return typeof count === 'number' ? count : null;
  } catch (err) {
    return null;
  }
}

export default function DashboardView() {
  const [metrics, setMetrics] = useState({
    usuarios: null,
    incidencias: null,
    penalidades: null,
    turnos: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadMetrics = async () => {
      setLoading(true);
      const config = window.CONFIG;
      if (!config?.SUPABASE) {
        setLoading(false);
        return;
      }

      const waitForClient = config.SUPABASE.waitForClient;
      if (typeof waitForClient === 'function') {
        await Promise.all([waitForClient('LOCKERS'), waitForClient('PENALIDADES')]);
      }

      const getClientForTable = config.SUPABASE.getClientForTable;
      const usuariosClient = getClientForTable?.('agentes_seguridad', MODULE_KEY);
      const penalidadesClient = getClientForTable?.('penalidades_aplicadas', MODULE_KEY);
      const incidenciasClient = getClientForTable?.('tardanzas_importadas', MODULE_KEY);

      const [usuarios, penalidades, incidencias] = await Promise.all([
        countTableRows(usuariosClient, 'agentes_seguridad'),
        countTableRows(penalidadesClient, 'penalidades_aplicadas'),
        countTableRows(incidenciasClient, 'tardanzas_importadas')
      ]);

      let turnos = null;
      if (incidenciasClient) {
        const today = new Date().toISOString().slice(0, 10);
        turnos = await countTableRows(incidenciasClient, 'tardanzas_importadas', {
          fecha_servicio: today
        });
      }

      if (!active) return;
      setMetrics({ usuarios, incidencias, penalidades, turnos });
      setLoading(false);
    };

    loadMetrics();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Integral</h1>
          <p className="page-subtitle">Vision de seguridad en tiempo real y control operativo.</p>
        </div>
        <button className="btn">Nuevo reporte</button>
      </div>

      <div className="grid cols-4">
        <div className="metric-card">
          <span className="metric-label">Usuarios activos</span>
          <strong className="metric-value">{loading ? '...' : metrics.usuarios ?? '--'}</strong>
          <span className="metric-note">Personal operativo actual</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Incidencias CCTV</span>
          <strong className="metric-value">{loading ? '...' : metrics.incidencias ?? '--'}</strong>
          <span className="metric-note">Eventos en seguimiento</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Penalidades</span>
          <strong className="metric-value">{loading ? '...' : metrics.penalidades ?? '--'}</strong>
          <span className="metric-note">Casos registrados</span>
        </div>
        <div className="metric-card accent">
          <span className="metric-label">Turnos activos</span>
          <strong className="metric-value">{loading ? '...' : metrics.turnos ?? '--'}</strong>
          <span className="metric-note">Hoy en curso</span>
        </div>
      </div>

      <div className="grid cols-2 dashboard-panels">
        <div className="card panel-hero">
          <h2>Resumen Diario</h2>
          <p>Supervisa tendencias, picos y cumplimiento por unidad.</p>
          <div className="sparkline">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        <div className="card panel-alerts">
          <h2>Alertas y notificaciones</h2>
          <ul>
            <li>Sin alertas criticas en las ultimas 6 horas.</li>
            <li>Penalidades pendientes de validacion: 3.</li>
            <li>Canal CCTV estable y sin caidas.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
