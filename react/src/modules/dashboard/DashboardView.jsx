import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    if (error || isMissingTableError(error)) return null;
    return typeof count === 'number' ? count : null;
  } catch {
    return null;
  }
}

const QUICK_ACTIONS = [
  {
    title: 'Incidencias CCTV',
    description: 'Revisar y resolver incidencias de llaves.',
    meta: 'Operación CCTV',
    to: '/incidencias'
  },
  {
    title: 'Lockers',
    description: 'Gestionar solicitudes, asignaciones y estado de lockers.',
    meta: 'Control operativo',
    to: '/lockers/vista'
  },
  {
    title: 'Penalidades',
    description: 'Registrar penalidades, revisar evidencias y consultar históricos.',
    meta: 'Cumplimiento',
    to: '/html/penalidades/penalidades.html'
  },
  {
    title: 'Incidencias y Mamparas',
    description: 'Abrir el sistema de informes, inspecciones y documentos.',
    meta: 'Formulario-Mamparas',
    href: 'https://miguelparedesr.github.io/Formulario-Mamparas/'
  }
];

export default function DashboardView() {
  const navigate = useNavigate();
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

    void loadMetrics();
    return () => { active = false; };
  }, []);

  const metricRows = [
    { key: 'usuarios', label: 'Usuarios', note: 'Personal registrado', to: '/html/admin/admin.html' },
    { key: 'incidencias', label: 'Incidencias', note: 'Eventos en seguimiento', to: '/incidencias' },
    { key: 'penalidades', label: 'Penalidades', note: 'Registros aplicados', to: '/html/penalidades/penalidades.html' },
    { key: 'turnos', label: 'Turnos de hoy', note: 'Cobertura registrada', to: '/html/rol-servicios/turnos.html' }
  ];

  const openAction = (action) => {
    if (action.href) {
      window.location.href = action.href;
      return;
    }
    navigate(action.to);
  };

  return (
    <section className="dashboard">
      <header className="dashboard-hero">
        <div>
          <p className="dashboard-kicker">Terminales Portuarios Peruanos · Seguridad</p>
          <h1>Centro de Control</h1>
          <p>Consulta el estado operativo y entra directamente a la tarea que necesitas gestionar.</p>
        </div>
        <span className="dashboard-health"><i /> Plataforma operativa</span>
      </header>

      <section className="metric-strip" aria-label="Indicadores principales">
        {metricRows.map((item) => (
          <button key={item.key} type="button" className="metric-row" onClick={() => navigate(item.to)}>
            <span className="metric-copy">
              <strong>{item.label}</strong>
              <small>{item.note}</small>
            </span>
            <span className="metric-value">{loading ? '…' : metrics[item.key] ?? '--'}</span>
            <span className="metric-chevron" aria-hidden="true">›</span>
          </button>
        ))}
      </section>

      <div className="dashboard-columns">
        <section className="dashboard-section">
          <div className="dashboard-section-head">
            <div>
              <span>Operación</span>
              <h2>Accesos rápidos</h2>
            </div>
            <small>Todo es interactivo</small>
          </div>

          <div className="operation-list">
            {QUICK_ACTIONS.map((action) => (
              <button key={action.title} type="button" className="operation-row" onClick={() => openAction(action)}>
                <span>
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>
                <span className="operation-meta">{action.meta}<b>›</b></span>
              </button>
            ))}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-head">
            <div>
              <span>Estado</span>
              <h2>Supervisión</h2>
            </div>
          </div>

          <div className="supervision-list">
            <button type="button" onClick={() => navigate('/lockers/solicitudes')}>
              <span className="supervision-dot ok" />
              <span><strong>Solicitudes de locker</strong><small>Revisar pendientes y entregas.</small></span>
              <b>›</b>
            </button>
            <button type="button" onClick={() => navigate('/html/penalidades/excel.html')}>
              <span className="supervision-dot info" />
              <span><strong>Reportes Excel</strong><small>Asistencia y penalidades exportables.</small></span>
              <b>›</b>
            </button>
            <button type="button" onClick={() => navigate('/html/admin/lockers-config.html')}>
              <span className="supervision-dot neutral" />
              <span><strong>Configuración</strong><small>Locales y capacidad de lockers.</small></span>
              <b>›</b>
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
