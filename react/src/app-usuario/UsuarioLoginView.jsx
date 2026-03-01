import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClientOrThrow } from './usuarioApi.js';
import { mapUsuarioRow, matchesProfile, normalizeDni, normalizeProfile } from './usuarioAuth.js';
import { setAuthSession } from '../services/sessionAuth.js';
import './usuario-login.css';

const USUARIOS_SELECT = 'id,nombre,correo,dni,rol,activo';

const PROFILE_OPTIONS = [
  {
    id: 'admin',
    title: 'Administrador',
    caption: 'Gestion completa de solicitudes y asignaciones.'
  },
  {
    id: 'cctv',
    title: 'Operador CCTV',
    caption: 'Validacion operativa y control de llaves.'
  }
];

function sortedByName(rows) {
  return rows
    .slice()
    .sort((a, b) =>
      String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', {
        sensitivity: 'base'
      })
    );
}

function asFriendlyLoginError(error, fallbackMessage) {
  const raw = String(error?.message || '').toLowerCase();
  if (raw.includes('infinite recursion') || raw.includes('policy') || String(error?.code || '') === '42P17') {
    return 'Error de seguridad en Supabase (RLS de usuarios). Debes ajustar policies para login.';
  }
  return error?.message || fallbackMessage;
}

function getRouteForRole(role) {
  return role === 'admin' ? '/html/base/dashboard.html' : '/lockers/solicitudes';
}

export default function UsuarioLoginView() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [selectedUsuarioId, setSelectedUsuarioId] = useState('');
  const [dni, setDni] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Ingreso App Usuario';
    document.body.classList.add('view-usuario-login');
    document.body.classList.remove('view-login');
    return () => {
      document.body.classList.remove('view-usuario-login');
    };
  }, []);

  const selectedUsuario = useMemo(
    () => usuarios.find((item) => String(item.id) === String(selectedUsuarioId)) || null,
    [selectedUsuarioId, usuarios]
  );
  const profileLabel = profile === 'admin' ? 'Administrador' : 'CCTV';

  const loadUsuariosByProfile = async (nextProfile) => {
    setLoadingUsuarios(true);
    setError('');
    setUsuarios([]);
    setSelectedUsuarioId('');
    setDni('');

    try {
      const supabase = await getClientOrThrow();
      const { data, error: queryError } = await supabase.from('usuarios').select(USUARIOS_SELECT).eq('activo', true);
      if (queryError) throw queryError;
      const mapped = (Array.isArray(data) ? data : []).map((row) => mapUsuarioRow(row));
      const filtered = sortedByName(mapped.filter((row) => matchesProfile(row, nextProfile)));
      setUsuarios(filtered);

      if (filtered.length === 0) {
        setError('No hay usuarios activos para el perfil seleccionado.');
      }
    } catch (err) {
      setUsuarios([]);
      setError(asFriendlyLoginError(err, 'No se pudo cargar la lista de usuarios.'));
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const handleProfileSelect = (nextProfile) => {
    const normalized = normalizeProfile(nextProfile);
    if (!normalized) return;
    setProfile(normalized);
    loadUsuariosByProfile(normalized);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    if (!profile) {
      setError('Selecciona un perfil para continuar.');
      return;
    }
    if (!selectedUsuario) {
      setError('Selecciona un usuario de la lista.');
      return;
    }

    const typedDni = normalizeDni(dni);
    if (!typedDni) {
      setError('Ingresa un DNI valido.');
      return;
    }
    if (!selectedUsuario.dni) {
      setError('El usuario seleccionado no tiene DNI registrado.');
      return;
    }
    if (typedDni !== selectedUsuario.dni) {
      setError('DNI incorrecto para el usuario seleccionado.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const supabase = await getClientOrThrow();
      const { data, error: queryError } = await supabase
        .from('usuarios')
        .select(USUARIOS_SELECT)
        .eq('id', selectedUsuario.id)
        .maybeSingle();
      if (queryError) throw queryError;
      if (!data) throw new Error('Usuario no disponible.');

      const validatedUsuario = mapUsuarioRow(data);
      if (!validatedUsuario.activo || !matchesProfile(validatedUsuario, profile)) {
        throw new Error('Usuario inactivo o sin rol permitido para este perfil.');
      }
      if (!validatedUsuario.dni) {
        throw new Error('El usuario seleccionado no tiene DNI registrado.');
      }
      if (typedDni !== validatedUsuario.dni) {
        throw new Error('DNI incorrecto para el usuario seleccionado.');
      }

      const role = profile === 'admin' ? 'admin' : 'cctv';
      setAuthSession({
        role,
        user: {
          id: validatedUsuario.id,
          nombre: validatedUsuario.nombre,
          dni: validatedUsuario.dni,
          role
        }
      });

      navigate(getRouteForRole(role), { replace: true });
    } catch (err) {
      setError(asFriendlyLoginError(err, 'No se pudo validar el usuario.'));
      setSubmitting(false);
    }
  };

  return (
    <main className="usuario-login-root">
      <div className="usuario-login-bg" aria-hidden="true"></div>

      <section className="usuario-login-shell">
        <header className="usuario-login-header">
          <h1>Ingreso App Usuario</h1>
          <p>Selecciona perfil, valida nombre activo y confirma DNI.</p>
        </header>

        <div className="usuario-login-role-grid" role="group" aria-label="Seleccion de perfil">
          {PROFILE_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`usuario-role-card ${profile === item.id ? 'is-active' : ''}`}
              onClick={() => handleProfileSelect(item.id)}
            >
              <span className="usuario-role-badge">{item.title}</span>
              <strong>{item.title}</strong>
              <small>{item.caption}</small>
            </button>
          ))}
        </div>

        <form className="usuario-login-form" onSubmit={handleSubmit}>
          <label htmlFor="usuario-select">
            {profile ? `${profileLabel} activo` : 'Usuario activo'}
            <select
              id="usuario-select"
              value={selectedUsuarioId}
              onChange={(event) => setSelectedUsuarioId(event.target.value)}
              disabled={!profile || loadingUsuarios || usuarios.length === 0 || submitting}
              required
            >
              <option value="">
                {loadingUsuarios
                  ? 'Cargando usuarios...'
                  : !profile
                    ? 'Selecciona perfil primero'
                    : 'Selecciona usuario'}
              </option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="usuario-dni">
            DNI
            <input
              id="usuario-dni"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ingresa DNI"
              value={dni}
              onChange={(event) => setDni(event.target.value)}
              disabled={!profile || submitting}
              required
            />
          </label>

          {error && <p className="usuario-login-error">{error}</p>}

          <button className="usuario-login-submit" type="submit" disabled={!profile || submitting || loadingUsuarios}>
            {submitting ? 'Validando...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
}
