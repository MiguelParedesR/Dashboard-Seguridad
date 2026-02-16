import { useNavigate } from 'react-router-dom';
import './colaborador.css';

export default function HomeColaborador() {
  const navigate = useNavigate();

  return (
    <main className="colaborador-page">
      <section className="colaborador-card colaborador-card-home">
        <span className="colaborador-kicker">APP COLABORADOR</span>
        <h1>Acciones de colaborador</h1>
        <p>Selecciona una accion para continuar.</p>
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
        </div>
      </section>
    </main>
  );
}
