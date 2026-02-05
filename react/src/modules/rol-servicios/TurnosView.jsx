import { useEffect } from 'react';
import './turnos.css';

const TURNOS_DIA = [
  { id: 1, nombre: 'Carlos Diaz', puesto: 'Acceso norte', hora: '06:00 - 14:00', estado: 'Activo' },
  { id: 2, nombre: 'Rosa Silva', puesto: 'Patrulla interior', hora: '07:00 - 15:00', estado: 'Activo' },
  { id: 3, nombre: 'Luis Vega', puesto: 'CCTV Central', hora: '08:00 - 16:00', estado: 'Pendiente' }
];

export default function TurnosView() {
  useEffect(() => {
    document.title = 'Turnos Dia';
    document.body.dataset.view = 'turnos-dia';
    document.body.classList.remove('view-login');
  }, []);

  return (
    <section className="turnos">
      <div className="page-header">
        <div>
          <h1 className="page-title">Turnos Dia</h1>
          <p className="page-subtitle">Planificacion diaria y cobertura operativa.</p>
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
            {TURNOS_DIA.map((turno) => (
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
