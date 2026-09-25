import { useEffect } from 'react';
import './turnos.css';

export default function TurnoNocheView() {
  useEffect(() => {
    document.title = 'Turnos Noche';
    document.body.dataset.view = 'turnos-noche';
    document.body.classList.remove('view-login');
  }, []);

  return (
    <section className="turnos">
      <div className="page-header">
        <div>
          <h1 className="page-title">Turnos Noche</h1>
          <p className="page-subtitle">Programación nocturna y cobertura operativa.</p>
        </div>
        <span className="status pendiente">Fuente pendiente</span>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <p className="muted">
          No se muestran turnos de demostración. La fuente real de programación se conectará y validará durante la revisión de Supabase.
        </p>
      </div>
    </section>
  );
}
