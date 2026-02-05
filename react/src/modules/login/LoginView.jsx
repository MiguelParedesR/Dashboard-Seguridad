import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './login.css';

export default function LoginView() {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [operadorClave, setOperadorClave] = useState('');
  const [operadores, setOperadores] = useState([]);
  const [selectedOperador, setSelectedOperador] = useState('');
  const [loadingOperadores, setLoadingOperadores] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    document.title = 'Login - Agentes TPP';
    document.body.dataset.view = 'login';
    document.body.classList.add('view-login');
    return () => document.body.classList.remove('view-login');
  }, []);

  const loadOperadores = async () => {
    const config = window.CONFIG;
    const waiter = config?.SUPABASE?.waitForClient;
    if (typeof waiter !== 'function') return;
    setLoadingOperadores(true);
    const supabase = await waiter('LOCKERS');
    if (!supabase) {
      setLoadingOperadores(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('operadores')
        .select('id, nombre')
        .order('nombre', { ascending: true });
      if (error) throw error;
      setOperadores(data || []);
    } catch (err) {
      setErrorMessage('No se pudo cargar operadores.');
    } finally {
      setLoadingOperadores(false);
    }
  };

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setErrorMessage('');
    if (nextRole === 'operador') {
      loadOperadores();
    }
  };

  const handleAdminSubmit = (event) => {
    event.preventDefault();
    if (adminPassword === 'admin123') {
      navigate('/html/base/dashboard.html');
    } else {
      setErrorMessage('Contrasena incorrecta.');
    }
  };

  const handleOperadorSubmit = (event) => {
    event.preventDefault();
    if (operadorClave === 'claveCorrecta') {
      navigate('/html/actividades-cctv/incidencias.html');
    } else {
      setErrorMessage('Clave incorrecta.');
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-header">
          <h1>Acceso Agentes TPP</h1>
          <p>Autenticacion segura para operaciones criticas.</p>
        </div>

        <div className="login-role-grid">
          <button
            className={`role-btn ${role === 'admin' ? 'active' : ''}`}
            type="button"
            onClick={() => handleRoleChange('admin')}
          >
            Administrador
          </button>
          <button
            className={`role-btn ${role === 'operador' ? 'active' : ''}`}
            type="button"
            onClick={() => handleRoleChange('operador')}
          >
            Operador CCTV
          </button>
          <button
            className={`role-btn ${role === 'agente' ? 'active' : ''}`}
            type="button"
            onClick={() => handleRoleChange('agente')}
          >
            Agente
          </button>
        </div>

        {role === 'admin' && (
          <form className="login-form" onSubmit={handleAdminSubmit}>
            <label htmlFor="adminPassword">Contrasena</label>
            <input
              id="adminPassword"
              className="input"
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              placeholder="Ingresa tu contrasena"
            />
            <button className="btn" type="submit">Ingresar</button>
          </form>
        )}

        {role === 'operador' && (
          <form className="login-form" onSubmit={handleOperadorSubmit}>
            <label htmlFor="operadorSelect">Seleccione su nombre</label>
            <select
              id="operadorSelect"
              className="input"
              value={selectedOperador}
              onChange={(event) => setSelectedOperador(event.target.value)}
            >
              <option value="">Seleccione su nombre</option>
              {operadores.map((operador) => (
                <option key={operador.id} value={operador.nombre}>
                  {operador.nombre}
                </option>
              ))}
            </select>

            <label htmlFor="operadorClave">Clave</label>
            <input
              id="operadorClave"
              className="input"
              type="password"
              value={operadorClave}
              onChange={(event) => setOperadorClave(event.target.value)}
              placeholder="Ingresa tu clave"
            />

            <button className="btn" type="submit" disabled={loadingOperadores}>
              {loadingOperadores ? 'Cargando...' : 'Ingresar'}
            </button>
          </form>
        )}

        {role === 'agente' && (
          <div className="login-iframe">
            <iframe
              src="https://manualdefunciones.netlify.app/identificacion.html"
              width="100%"
              height="500"
              frameBorder="0"
              allow="camera"
              title="Identificacion"
            ></iframe>
          </div>
        )}

        {errorMessage && <p className="login-error">{errorMessage}</p>}
      </div>
    </div>
  );
}
