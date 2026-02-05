import { useEffect, useState } from 'react';
import './incidencias.css';

const STORAGE_KEY = 'routeHistory';

function readHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

export default function IncidenciasView() {
  const [instruction, setInstruction] = useState('');
  const [history, setHistory] = useState(() => readHistory());

  useEffect(() => {
    document.title = 'RouteCheck - Control de Ruta';
    document.body.dataset.view = 'incidencias';
    document.body.classList.remove('view-login');
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      // ignore storage issues
    }
  }, [history]);

  const sendInstruction = () => {
    const text = instruction.trim();
    if (!text) return;
    const entry = {
      text,
      timestamp: new Date().toLocaleString()
    };
    setHistory((prev) => [entry, ...prev]);
    setInstruction('');
  };

  return (
    <section className="incidencias">
      <div className="page-header">
        <div>
          <h1 className="page-title">RouteCheck</h1>
          <p className="page-subtitle">Panel de resguardo y control de ruta.</p>
        </div>
        <button className="btn ghost">Sincronizar</button>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Enviar instruccion</h3>
          <p className="muted">Comunica acciones inmediatas al conductor.</p>
          <div className="form-stack">
            <input
              className="input"
              placeholder="Ej: Doble en Av. Carlos Izaguirre"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
            />
            <button type="button" className="btn" onClick={sendInstruction}>
              Enviar instruccion
            </button>
          </div>
        </div>

        <div className="card soft">
          <h3>Estado en ruta</h3>
          <div className="status-grid">
            <div>
              <span className="status-label">Ultima comunicacion</span>
              <strong>Hace 3 min</strong>
            </div>
            <div>
              <span className="status-label">Ultima posicion</span>
              <strong>TPP4 - Acceso norte</strong>
            </div>
            <div>
              <span className="status-label">Nivel de riesgo</span>
              <strong className="status-risk">Controlado</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Historial de instrucciones</h3>
        <ul className="history-list">
          {history.length === 0 && <li className="muted">Sin instrucciones registradas.</li>}
          {history.map((entry, index) => (
            <li key={`${entry.timestamp}-${index}`}>
              <span className="history-time">{entry.timestamp}</span>
              <span className="history-text">{entry.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
