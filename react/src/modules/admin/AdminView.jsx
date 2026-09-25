import { useEffect, useMemo, useState } from 'react';
import './admin.css';

function downloadCsv(rows) {
  const headers = ['Nombre', 'Rol', 'Estado'];
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [
    headers.map(escape).join(','),
    ...rows.map((row) => [row.nombre, row.rol, row.estado].map(escape).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `usuarios_tpp_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdminView() {
  const [usuarios, setUsuarios] = useState([]);
  const [query, setQuery] = useState('');
  const [rol, setRol] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Usuarios';
    document.body.dataset.view = 'admin';
    document.body.classList.remove('view-login');

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const waiter = window.CONFIG?.SUPABASE?.waitForClient;
        if (typeof waiter !== 'function') {
          throw new Error('La fuente de usuarios no está disponible.');
        }

        const client = await waiter('LOCKERS');
        if (!client) throw new Error('No se pudo conectar con la fuente de usuarios.');

        const { data, error: queryError } = await client
          .from('usuarios')
          .select('id,nombre,nombre_completo,rol,estado')
          .order('id', { ascending: true });

        if (queryError) throw queryError;

        setUsuarios(
          (data || []).map((row, index) => ({
            id: row.id ?? index + 1,
            nombre: row.nombre ?? row.nombre_completo ?? 'Sin nombre',
            rol: row.rol ?? 'Sin rol',
            estado: row.estado ?? 'Activo'
          }))
        );
      } catch (err) {
        setUsuarios([]);
        setError(err?.message || 'No se pudieron cargar los usuarios.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filtered = useMemo(() => {
    return usuarios.filter((user) => {
      const matchesQuery = !query || user.nombre.toLowerCase().includes(query.toLowerCase());
      const matchesRole = !rol || user.rol === rol;
      return matchesQuery && matchesRole;
    });
  }, [usuarios, query, rol]);

  return (
    <section className="admin">
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-subtitle">Consulta accesos y roles registrados. Las altas y ediciones se revisarán con Supabase.</p>
        </div>
        <span className="status">Solo lectura</span>
      </div>

      <div className="card admin-toolbar">
        <input
          className="input"
          type="search"
          placeholder="Buscar por nombre"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className="input" value={rol} onChange={(event) => setRol(event.target.value)}>
          <option value="">Todos los roles</option>
          <option>Administrador</option>
          <option>Operador CCTV</option>
          <option>Agente</option>
        </select>
        <button className="btn ghost" type="button" onClick={() => downloadCsv(filtered)} disabled={!filtered.length}>
          Exportar CSV
        </button>
      </div>

      {error && <p className="usuario-error" role="alert">{error}</p>}

      <div className="card admin-table">
        {loading ? (
          <p className="muted" style={{ padding: 18 }}>Cargando usuarios…</p>
        ) : (
          <table>
            <thead>
              <tr><th>Nombre</th><th>Rol</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td>{user.nombre}</td>
                  <td>{user.rol}</td>
                  <td><span className={`status ${String(user.estado).toLowerCase()}`}>{user.estado}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && !error && (
                <tr><td colSpan="3" className="muted">No hay usuarios para los filtros seleccionados.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
