import { createHashRouter, Navigate } from 'react-router-dom';
import MainLayout from '../layout/MainLayout.jsx';
import IncidenciasView from '../modules/actividades-cctv/IncidenciasView.jsx';
import AdminView from '../modules/admin/AdminView.jsx';
import NoticiasView from '../modules/admin/NoticiasView.jsx';
import DashboardView from '../modules/dashboard/DashboardView.jsx';
import LockersView from '../modules/lockers/LockersView.jsx';
import LoginView from '../modules/login/LoginView.jsx';
import ExcelView from '../modules/penalidades/ExcelView.jsx';
import PenalidadesView from '../modules/penalidades/PenalidadesView.jsx';
import TurnoNocheView from '../modules/rol-servicios/TurnoNocheView.jsx';
import TurnosView from '../modules/rol-servicios/TurnosView.jsx';

const router = createHashRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="html/base/dashboard.html" replace />
      },
      {
        path: 'html/base/dashboard.html',
        element: <DashboardView />
      },
      {
        path: 'html/actividades-cctv/lockers.html',
        element: <LockersView />
      },
      {
        path: 'html/actividades-cctv/incidencias.html',
        element: <IncidenciasView />
      },
      {
        path: 'html/login-general/login.html',
        element: <LoginView />
      },
      {
        path: 'html/admin/admin.html',
        element: <AdminView />
      },
      {
        path: 'html/admin/noticias.html',
        element: <NoticiasView />
      },
      {
        path: 'html/penalidades/penalidades.html',
        element: <PenalidadesView />
      },
      {
        path: 'html/penalidades/excel.html',
        element: <ExcelView />
      },
      {
        path: 'html/rol-servicios/turnos.html',
        element: <TurnosView />
      },
      {
        path: 'html/rol-servicios/turnoNoche.html',
        element: <TurnoNocheView />
      },
      {
        path: '*',
        element: <Navigate to="html/base/dashboard.html" replace />
      }
    ]
  }
]);

export default router;
