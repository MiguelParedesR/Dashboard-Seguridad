import { useEffect } from 'react';
import './turnos.css';

export default function TurnosView() {
  useEffect(() => {
    document.title = 'Turnos Día';
    document.body.dataset.view = 'turnos-dia';
    document.body.classList.remove('view-login');
  }, []);

  return (
    <section className="turnos">
      <div className="page-header">
        <div>
          <h1 className="page-title">Turnos Día</h1>
          <p className="page-subtitle">Programación diurna y cobertura operativa.</p>
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
