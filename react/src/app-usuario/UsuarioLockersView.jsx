import { useEffect, useMemo, useState } from 'react';
import { getClientOrThrow, normalizeText } from './usuarioApi.js';
import './usuario.css';

const COLUMNS = ['LIBRE', 'OCUPADO', 'MANTENIMIENTO'];

function sortByCode(list) {
  return list
    .slice()
    .sort((a, b) =>
      String(a?.codigo || '').localeCompare(String(b?.codigo || ''), 'es', {
        numeric: true,
        sensitivity: 'base'
      })
    );
}

export default function UsuarioLockersView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lockers, setLockers] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const supabase = await getClientOrThrow();
        const { data, error: queryError } = await supabase
          .from('lockers')
          .select('id,codigo,estado,local,area,tiene_candado,tiene_duplicado_llave')
          .order('local', { ascending: true })
          .order('area', { ascending: true })
          .order('codigo', { ascending: true });

        if (queryError) throw queryError;
        if (!mounted) return;
        setLockers(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!mounted) return;
        setLockers([]);
        setError(err?.message || 'No se pudo cargar estado general de lockers.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const locals = new Map();

    lockers.forEach((locker) => {
      const localKey = normalizeText(locker.local, 'SIN_LOCAL');
      const areaKey = normalizeText(locker.area, 'SIN_AREA');

      if (!locals.has(localKey)) {
        locals.set(localKey, new Map());
      }
      const localMap = locals.get(localKey);

      if (!localMap.has(areaKey)) {
        localMap.set(areaKey, {
          LIBRE: [],
          OCUPADO: [],
          MANTENIMIENTO: []
        });
      }

      const areaBucket = localMap.get(areaKey);
      const estado = String(locker.estado || '').trim().toUpperCase();
      if (COLUMNS.includes(estado)) {
        areaBucket[estado].push(locker);
      }
    });

    return Array.from(locals.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([local, areas]) => ({
        local,
        areas: Array.from(areas.entries())
          .sort(([a], [b]) => a.localeCompare(b, 'es'))
          .map(([area, buckets]) => ({
            area,
            buckets: {
              LIBRE: sortByCode(buckets.LIBRE),
              OCUPADO: sortByCode(buckets.OCUPADO),
              MANTENIMIENTO: sortByCode(buckets.MANTENIMIENTO)
            }
          }))
      }));
  }, [lockers]);

  return (
    <main className="usuario-page">
      <section className="usuario-card">
        <div className="usuario-header">
          <div>
            <h1>Vista general de lockers</h1>
            <p>Solo visualizacion. Estado agrupado por local y area.</p>
          </div>
        </div>

        {error && <p className="usuario-error">{error}</p>}
        {loading && <p className="usuario-subtle">Cargando lockers...</p>}
        {!loading && grouped.length === 0 && <p className="usuario-warning">No hay lockers para mostrar.</p>}
      </section>

      {!loading &&
        grouped.map((group) => (
          <section className="usuario-card" key={group.local}>
            <div className="usuario-header">
              <div>
                <h2>Local {group.local}</h2>
              </div>
            </div>

            <div className="usuario-grid">
              {group.areas.map((areaItem) => (
                <article className="usuario-locker-group" key={`${group.local}-${areaItem.area}`}>
                  <h3>Area {areaItem.area}</h3>
                  <div className="usuario-locker-columns">
                    {COLUMNS.map((estado) => (
                      <div key={estado} className="usuario-locker-column">
                        <h4>{estado}</h4>
                        <div className="usuario-locker-list">
                          {areaItem.buckets[estado].length === 0 && (
                            <p className="usuario-subtle">Sin lockers en esta columna.</p>
                          )}
                          {areaItem.buckets[estado].map((locker) => (
                            <div className="usuario-locker-item" key={locker.id}>
                              <strong>{normalizeText(locker.codigo)}</strong>
                              <div className="usuario-locker-meta">Estado: {normalizeText(locker.estado)}</div>
                              <div className="usuario-locker-meta">
                                Candado: {locker.tiene_candado ? 'SI' : 'NO'}
                              </div>
                              <div className="usuario-locker-meta">
                                Duplicado llave: {locker.tiene_duplicado_llave ? 'SI' : 'NO'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
    </main>
  );
}
