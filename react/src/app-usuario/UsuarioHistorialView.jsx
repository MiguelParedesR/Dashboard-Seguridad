import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchLockersByIds,
  formatDateOnly,
  formatDateTime,
  getClientOrThrow,
  normalizeText
} from './usuarioApi.js';
import './usuario.css';

const TIMELINE_EVENT_LABELS = {
  ASIGNACION_CREADA: 'Asignacion creada',
  ENTREGA_LLAVES: 'Entrega de llaves',
  DEVOLUCION: 'Devolucion',
  INCIDENCIA_GENERADA: 'Incidencia generada',
  LOCKER_BLOQUEADO: 'Locker bloqueado',
  LOCKER_LIBERADO: 'Locker liberado'
};

const TIMELINE_EVENT_ORDER = [
  TIMELINE_EVENT_LABELS.ASIGNACION_CREADA,
  TIMELINE_EVENT_LABELS.ENTREGA_LLAVES,
  TIMELINE_EVENT_LABELS.DEVOLUCION,
  TIMELINE_EVENT_LABELS.INCIDENCIA_GENERADA,
  TIMELINE_EVENT_LABELS.LOCKER_BLOQUEADO,
  TIMELINE_EVENT_LABELS.LOCKER_LIBERADO
];

const EVENT_ALIASES = {
  ASIGNACION: 'ASIGNACION_CREADA',
  ASIGNACION_CREADA: 'ASIGNACION_CREADA',
  CREACION_ASIGNACION: 'ASIGNACION_CREADA',
  ENTREGA: 'ENTREGA_LLAVES',
  ENTREGA_LLAVES: 'ENTREGA_LLAVES',
  ENTREGA_DE_LLAVES: 'ENTREGA_LLAVES',
  LLAVES_ENTREGADAS: 'ENTREGA_LLAVES',
  DEVOLUCION: 'DEVOLUCION',
  INCIDENCIA: 'INCIDENCIA_GENERADA',
  INCIDENCIA_GENERADA: 'INCIDENCIA_GENERADA',
  LOCKER_BLOQUEADO: 'LOCKER_BLOQUEADO',
  BLOQUEADO: 'LOCKER_BLOQUEADO',
  MANTENIMIENTO: 'LOCKER_BLOQUEADO',
  LOCKER_LIBERADO: 'LOCKER_LIBERADO',
  LIBERADO: 'LOCKER_LIBERADO',
  REACTIVADO: 'LOCKER_LIBERADO'
};

async function fetchHistorialLocker(supabase) {
  const ordered = await supabase
    .from('historial_locker')
    .select('*')
    .order('created_at', { ascending: false });

  if (!ordered.error) {
    return ordered.data || [];
  }

  const fallback = await supabase
    .from('historial_locker')
    .select('*');

  if (fallback.error) throw fallback.error;
  return fallback.data || [];
}

function normalizeEventKey(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_');
}

function parseDetalle(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') return value;
  return {};
}

function pickDetailValue(detalle, keys) {
  for (const key of keys) {
    const value = detalle?.[key];
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }
  return undefined;
}

function resolveEntityName(value, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') {
    return normalizeText(value, fallback);
  }
  if (Array.isArray(value)) {
    const joined = value.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
    return normalizeText(joined, fallback);
  }
  if (typeof value === 'object') {
    const name =
      value.nombre ||
      value.nombre_completo ||
      value.name ||
      value.full_name ||
      value.usuario ||
      value.email ||
      value.dni;
    if (name) return normalizeText(name, fallback);
    const id = value.id || value.uuid || value.uid;
    if (id) return normalizeText(id, fallback);
  }
  return fallback;
}

function resolveTipoEvento(detalle, evento) {
  const tipo = pickDetailValue(detalle, ['tipo_evento', 'tipoEvento', 'tipo', 'evento', 'accion', 'action']);
  if (tipo === null || tipo === undefined || tipo === '') return evento ?? '';
  if (typeof tipo === 'string' || typeof tipo === 'number') return tipo;
  if (Array.isArray(tipo)) return tipo.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
  if (typeof tipo === 'object') {
    const label = tipo.label || tipo.nombre || tipo.name || tipo.tipo;
    if (label) return label;
  }
  return evento ?? '';
}

function resolveLlavesInfo(detalle) {
  let declaradas = pickDetailValue(detalle, [
    'llaves_declaradas',
    'llavesDeclaradas',
    'llaves_entregadas',
    'llavesEntregadas'
  ]);
  let esperadas = pickDetailValue(detalle, ['llaves_esperadas', 'llavesEsperadas', 'llaves_respaldo', 'llavesRespaldo']);
  const raw = pickDetailValue(detalle, ['llaves', 'llaves_info', 'llavesInfo', 'keys', 'llave', 'llaves_detalle']);

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    declaradas = declaradas ?? raw.declaradas ?? raw.entregadas ?? raw.llaves_declaradas ?? raw.cantidad;
    esperadas = esperadas ?? raw.esperadas ?? raw.respaldo ?? raw.llaves_esperadas;
  }

  let resumen = '';
  if (Array.isArray(raw)) {
    const values = raw.map((item) => String(item ?? '').trim()).filter(Boolean);
    if (values.length) resumen = values.join(', ');
  } else if (raw !== null && raw !== undefined && typeof raw !== 'object') {
    resumen = String(raw);
  }

  return { declaradas, esperadas, resumen };
}

function resolveLlavesLabel(detalle) {
  const { declaradas, esperadas, resumen } = resolveLlavesInfo(detalle);
  if (resumen) return resumen;
  if (declaradas !== null && declaradas !== undefined && esperadas !== null && esperadas !== undefined) {
    return `${declaradas} / ${esperadas}`;
  }
  if (declaradas !== null && declaradas !== undefined) return String(declaradas);
  if (esperadas !== null && esperadas !== undefined) return String(esperadas);
  return '';
}

function resolveTimelineLabel(evento, tipoEvento) {
  const normalized = normalizeEventKey(evento || tipoEvento);
  const mappedKey = EVENT_ALIASES[normalized] || normalized;
  return TIMELINE_EVENT_LABELS[mappedKey] || normalizeText(tipoEvento || evento, '--');
}

export default function UsuarioHistorialView({ embedded = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({
    local: 'ALL',
    area: 'ALL',
    tipo: 'ALL',
    fecha: ''
  });
  const ContainerTag = embedded ? 'section' : 'main';

  const loadHistorial = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const supabase = await getClientOrThrow();
      const historial = await fetchHistorialLocker(supabase);
      const lockersMap = await fetchLockersByIds(
        supabase,
        historial.map((item) => item.locker_id)
      );

      const hydrated = historial.map((evento) => {
        const detalle = parseDetalle(evento.detalle);
        const locker = lockersMap.get(String(evento.locker_id));
        const lockerDetalle = pickDetailValue(detalle, ['locker', 'locker_detalle', 'lockerDetalle']);
        const tipoEventoRaw = resolveTipoEvento(detalle, evento.evento);
        const eventoLabel = resolveTimelineLabel(evento.evento, tipoEventoRaw);
        const operadorRaw = pickDetailValue(detalle, [
          'operador',
          'operador_nombre',
          'operadorNombre',
          'usuario',
          'usuario_nombre',
          'responsable',
          'actor'
        ]);
        const colaboradorRaw = pickDetailValue(detalle, [
          'colaborador',
          'colaborador_nombre',
          'colaboradorNombre',
          'empleado',
          'asignado_a',
          'persona'
        ]);
        const lockerCodigo =
          locker?.codigo ||
          lockerDetalle?.codigo ||
          pickDetailValue(detalle, ['locker_codigo', 'lockerCodigo', 'codigo']);
        const local =
          locker?.local ||
          lockerDetalle?.local ||
          pickDetailValue(detalle, ['local', 'locker_local', 'lockerLocal']);
        const area =
          locker?.area ||
          lockerDetalle?.area ||
          pickDetailValue(detalle, ['area', 'locker_area', 'lockerArea']);
        const llavesLabel = resolveLlavesLabel(detalle);

        return {
          ...evento,
          evento_label: eventoLabel,
          tipo_evento: normalizeText(tipoEventoRaw, '--'),
          operador_nombre: resolveEntityName(operadorRaw, '--'),
          colaborador_nombre: resolveEntityName(colaboradorRaw, '--'),
          locker_codigo: normalizeText(lockerCodigo),
          local: normalizeText(local),
          area: normalizeText(area),
          llaves_text: normalizeText(llavesLabel, '--')
        };
      });

      setRecords(hydrated);
    } catch (err) {
      setRecords([]);
      setError(err?.message || 'No se pudo cargar el historial de auditoria.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistorial();
  }, [loadHistorial]);

  const localOptions = useMemo(() => {
    const values = Array.from(new Set(records.map((item) => item.local).filter((value) => value && value !== '--')));
    return values.sort((a, b) => a.localeCompare(b, 'es'));
  }, [records]);

  const areaOptions = useMemo(() => {
    const values = Array.from(new Set(records.map((item) => item.area).filter((value) => value && value !== '--')));
    return values.sort((a, b) => a.localeCompare(b, 'es'));
  }, [records]);

  const tipoOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    TIMELINE_EVENT_ORDER.forEach((label) => {
      if (!seen.has(label)) {
        seen.add(label);
        options.push(label);
      }
    });
    records.forEach((item) => {
      if (item.evento_label && item.evento_label !== '--' && !seen.has(item.evento_label)) {
        seen.add(item.evento_label);
        options.push(item.evento_label);
      }
    });
    return options;
  }, [records]);

  const filtered = useMemo(
    () =>
      records.filter((item) => {
        if (filters.local !== 'ALL' && item.local !== filters.local) return false;
        if (filters.area !== 'ALL' && item.area !== filters.area) return false;
        if (filters.tipo !== 'ALL' && item.evento_label !== filters.tipo) return false;
        if (filters.fecha) {
          const currentDate = formatDateOnly(item.created_at);
          if (currentDate !== filters.fecha) return false;
        }
        return true;
      }),
    [filters.area, filters.fecha, filters.local, filters.tipo, records]
  );

  return (
    <ContainerTag className={`usuario-page${embedded ? ' usuario-page--embedded' : ''}`}>
      <section className="usuario-card">
        <div className="usuario-header">
          <div>
            <h1>Historial</h1>
            <p>Consulta de auditoria del sistema (solo lectura).</p>
          </div>
          <button className="usuario-ghost-button" type="button" onClick={loadHistorial} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {error && <p className="usuario-error">{error}</p>}

        <div className="usuario-filters">
          <div className="usuario-filter">
            <label htmlFor="historial-local">Local</label>
            <select
              id="historial-local"
              value={filters.local}
              onChange={(event) => setFilters((current) => ({ ...current, local: event.target.value }))}
            >
              <option value="ALL">Todos</option>
              {localOptions.map((local) => (
                <option key={local} value={local}>
                  {local}
                </option>
              ))}
            </select>
          </div>

          <div className="usuario-filter">
            <label htmlFor="historial-area">Area</label>
            <select
              id="historial-area"
              value={filters.area}
              onChange={(event) => setFilters((current) => ({ ...current, area: event.target.value }))}
            >
              <option value="ALL">Todas</option>
              {areaOptions.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div className="usuario-filter">
            <label htmlFor="historial-fecha">Fecha</label>
            <input
              id="historial-fecha"
              type="date"
              value={filters.fecha}
              onChange={(event) => setFilters((current) => ({ ...current, fecha: event.target.value }))}
            />
          </div>

          <div className="usuario-filter">
            <label htmlFor="historial-tipo">Evento</label>
            <select
              id="historial-tipo"
              value={filters.tipo}
              onChange={(event) => setFilters((current) => ({ ...current, tipo: event.target.value }))}
            >
              <option value="ALL">Todos</option>
              {tipoOptions.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="usuario-card">
        {loading && <p className="usuario-subtle">Cargando historial...</p>}
        {!loading && filtered.length === 0 && <p className="usuario-warning">No hay eventos para los filtros seleccionados.</p>}

        {!loading && filtered.length > 0 && (
          <div className="usuario-table-wrap">
            <table className="usuario-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>Tipo evento</th>
                  <th>Operador</th>
                  <th>Colaborador</th>
                  <th>Locker</th>
                  <th>Local</th>
                  <th>Area</th>
                  <th>Llaves</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id || `${item.locker_id}-${item.created_at}`}>
                    <td data-label="Fecha">{formatDateTime(item.created_at)}</td>
                    <td data-label="Evento">{item.evento_label}</td>
                    <td data-label="Tipo evento">{item.tipo_evento}</td>
                    <td data-label="Operador">{item.operador_nombre}</td>
                    <td data-label="Colaborador">{item.colaborador_nombre}</td>
                    <td data-label="Locker">{item.locker_codigo}</td>
                    <td data-label="Local">{item.local}</td>
                    <td data-label="Area">{item.area}</td>
                    <td data-label="Llaves">{item.llaves_text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ContainerTag>
  );
}

