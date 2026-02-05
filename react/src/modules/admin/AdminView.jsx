import { useEffect, useMemo, useState } from 'react';
import './admin.css';

const FALLBACK_USERS = [
  { id: 1, nombre: 'Juan Perez', rol: 'Administrador', estado: 'Activo' },
  { id: 2, nombre: 'Rosa Silva', rol: 'Operador CCTV', estado: 'Activo' },
  { id: 3, nombre: 'Carlos Diaz', rol: 'Agente', estado: 'Pendiente' }
];

export default function AdminView() {
  const [usuarios, setUsuarios] = useState([]);
  const [query, setQuery] = useState('');
  const [rol, setRol] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Usuarios';
    document.body.dataset.view = 'admin';
    document.body.classList.remove('view-login');

    const load = async () => {
      const config = window.CONFIG;
      const waiter = config?.SUPABASE?.waitForClient;
      if (typeof waiter !== 'function') {
        setUsuarios(FALLBACK_USERS);
        setLoading(false);
        return;
      }
      const client = await waiter('LOCKERS');
      if (!client) {
        setUsuarios(FALLBACK_USERS);
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await client.from('usuarios').select('*').order('id', { ascending: true });
        if (error) throw error;
        setUsuarios((data || []).map((row, index) => ({
          id: row.id ?? index + 1,
          nombre: row.nombre ?? row.nombre_completo ?? 'Sin nombre',
          rol: row.rol ?? 'Sin rol',
          estado: row.estado ?? 'Activo'
        })));
      } catch (err) {
        setUsuarios(FALLBACK_USERS);
      } finally {
        setLoading(false);
      }
    };

    load();
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
          <p className="page-subtitle">Gestiona accesos y roles en tiempo real.</p>
        </div>
        <button className="btn">Nuevo usuario</button>
      </div>

      <div className="card admin-toolbar">
        <input
          className="input"
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
        <button className="btn ghost">Exportar</button>
      </div>

      <div className="card admin-table">
        {loading ? (
          <p className="muted">Cargando usuarios...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td>{user.nombre}</td>
                  <td>{user.rol}</td>
                  <td><span className={`status ${user.estado.toLowerCase()}`}>{user.estado}</span></td>
                  <td>
                    <button className="btn ghost">Editar</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="4" className="muted">Sin resultados.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
