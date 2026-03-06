import { useNavigate } from 'react-router-dom';
import { useColaboradorContext } from './context/ColaboradorContext.jsx';
import './colaborador.css';

export default function HomeColaborador() {
  const navigate = useNavigate();
  const { session, clearSession } = useColaboradorContext();

  return (
    <main className="colaborador-page">
      <section className="colaborador-card colaborador-card-home">
        <span className="colaborador-kicker">APP COLABORADOR</span>
        <h1>Acciones de colaborador</h1>
        <p>Selecciona una accion para continuar.</p>
        <div className="colaborador-session-card">
          <strong>{session?.nombre || 'Colaborador'}</strong>
          <small>
            DNI: {session?.dni || 'N/D'} | Area: {session?.area || 'N/D'} {session?.local ? `| Local: ${session.local}` : ''}
          </small>
        </div>
        <div className="colaborador-actions">
          <button className="colaborador-button" type="button" onClick={() => navigate('/colaborador/solicitar')}>
            SOLICITAR LOCKER
          </button>
          <button className="colaborador-button" type="button" onClick={() => navigate('/colaborador/duplicado')}>
            SOLICITAR DUPLICADO DE LLAVE
          </button>
          <button className="colaborador-button" type="button" onClick={() => navigate('/colaborador/devolver')}>
            DEVOLVER LOCKER
          </button>
          <button
            className="colaborador-button is-secondary"
            type="button"
            onClick={() => {
              clearSession();
              navigate('/colaborador', { replace: true });
            }}
          >
            CERRAR SESION
          </button>
        </div>
      </section>
    </main>
  );
}
