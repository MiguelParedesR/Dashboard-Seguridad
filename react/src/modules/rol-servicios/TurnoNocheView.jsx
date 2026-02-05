import { useEffect } from 'react';
import './turnos.css';

const TURNOS_NOCHE = [
  { id: 1, nombre: 'Mariana Torres', puesto: 'Acceso sur', hora: '18:00 - 02:00', estado: 'Activo' },
  { id: 2, nombre: 'Jose Medina', puesto: 'Patrulla perimetral', hora: '19:00 - 03:00', estado: 'Activo' },
  { id: 3, nombre: 'Andrea Rios', puesto: 'CCTV Nocturno', hora: '20:00 - 04:00', estado: 'Pendiente' }
];

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
          <p className="page-subtitle">Cobertura nocturna y seguimiento de guardias.</p>
        </div>
        <button className="btn">Asignar turno</button>
      </div>

      <div className="card turnos-table">
        <table>
          <thead>
            <tr>
              <th>Agente</th>
              <th>Puesto</th>
              <th>Horario</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {TURNOS_NOCHE.map((turno) => (
              <tr key={turno.id}>
                <td>{turno.nombre}</td>
                <td>{turno.puesto}</td>
                <td>{turno.hora}</td>
                <td><span className={`status ${turno.estado.toLowerCase()}`}>{turno.estado}</span></td>
                <td><button className="btn ghost">Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
