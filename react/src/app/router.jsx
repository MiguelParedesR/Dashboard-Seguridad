import { createHashRouter, Navigate, Outlet } from 'react-router-dom';
import MainLayout from '../layout/MainLayout.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import UsuarioLoginView from '../app-usuario/UsuarioLoginView.jsx';
import UsuarioAsignacionesView from '../app-usuario/UsuarioAsignacionesView.jsx';
import UsuarioEntregaView from '../app-usuario/UsuarioEntregaView.jsx';
import UsuarioHistorialView from '../app-usuario/UsuarioHistorialView.jsx';
import UsuarioSolicitudesView from '../app-usuario/UsuarioSolicitudesView.jsx';
import DevolverLocker from '../app-colaborador/DevolverLocker.jsx';
import HomeColaborador from '../app-colaborador/HomeColaborador.jsx';
import LoginColaborador from '../app-colaborador/LoginColaborador.jsx';
import SolicitarDuplicado from '../app-colaborador/SolicitarDuplicado.jsx';
import SolicitarLocker from '../app-colaborador/SolicitarLocker.jsx';
import { ColaboradorProvider } from '../app-colaborador/context/ColaboradorContext.jsx';
import ProtectedColaboradorRoute from '../app-colaborador/routes/ProtectedColaboradorRoute.jsx';
import IncidenciasView from '../modules/actividades-cctv/IncidenciasView.jsx';
import AdminView from '../modules/admin/AdminView.jsx';
import NoticiasView from '../modules/admin/NoticiasView.jsx';
import DashboardView from '../modules/dashboard/DashboardView.jsx';
import LockersView from '../modules/lockers/LockersView.jsx';
import ExcelView from '../modules/penalidades/ExcelView.jsx';
import PenalidadesView from '../modules/penalidades/PenalidadesView.jsx';
import TurnoNocheView from '../modules/rol-servicios/TurnoNocheView.jsx';
import TurnosView from '../modules/rol-servicios/TurnosView.jsx';
import { getAuthSession, getDefaultRouteForRole } from '../services/sessionAuth.js';

function RoleHomeRedirect() {
  const session = getAuthSession();
  return <Navigate to={getDefaultRouteForRole(session?.role)} replace />;
}

const router = createHashRouter([
  {
    path: '/html/login-general/login.html',
    element: <Navigate to="/usuario/login" replace />
  },
  {
    path: '/login',
    element: <Navigate to="/usuario/login" replace />
  },
  {
    path: '/usuario',
    element: <Outlet />,
    children: [
      {
        index: true,
        element: <Navigate to="login" replace />
      },
      {
        path: 'login',
        element: <UsuarioLoginView />
      },
      {
        path: 'solicitudes',
        element: <Navigate to="/lockers/solicitudes" replace />
      },
      {
        path: 'solicitudes/entrega/:asignacionId',
        element: <Navigate to="/lockers/solicitudes" replace />
      },
      {
        path: 'lockers',
        element: <Navigate to="/lockers/vista" replace />
      },
      {
        path: 'asignaciones',
        element: <Navigate to="/lockers/asignaciones" replace />
      },
      {
        path: 'historial',
        element: <Navigate to="/lockers/historial" replace />
      },
      {
        path: '*',
        element: <Navigate to="/usuario/login" replace />
      }
    ]
  },
  {
    path: '/colaborador',
    element: (
      <ColaboradorProvider>
        <Outlet />
      </ColaboradorProvider>
    ),
    children: [
      {
        index: true,
        element: <LoginColaborador />
      },
      {
        element: <ProtectedColaboradorRoute />,
        children: [
          {
            path: 'home',
            element: <HomeColaborador />
          },
          {
            path: 'solicitar',
            element: <SolicitarLocker />
          },
          {
            path: 'duplicado',
            element: <SolicitarDuplicado />
          },
          {
            path: 'devolver',
            element: <DevolverLocker />
          }
        ]
      },
      {
        path: '*',
        element: <Navigate to="/colaborador" replace />
      }
    ]
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <RoleHomeRedirect />
      },
      {
        path: 'incidencias',
        element: <IncidenciasView />
      },
      {
        path: 'lockers',
        element: <Outlet />,
        children: [
          {
            index: true,
            element: <Navigate to="solicitudes" replace />
          },
          {
            path: 'solicitudes',
            element: <UsuarioSolicitudesView />
          },
          {
            path: 'solicitudes/entrega/:asignacionId',
            element: <UsuarioEntregaView />
          },
          {
            path: 'vista',
            element: <LockersView />
          },
          {
            path: 'asignaciones',
            element: <UsuarioAsignacionesView />
          },
          {
            path: 'historial',
            element: <UsuarioHistorialView />
          }
        ]
      },
      {
        path: 'html/base/dashboard.html',
        element: <DashboardView />
      },
      {
        path: 'html/actividades-cctv/lockers.html',
        element: <Navigate to="/lockers/vista" replace />
      },
      {
        path: 'html/actividades-cctv/incidencias.html',
        element: <Navigate to="/incidencias" replace />
      },
      {
        path: 'html/login-general/login.html',
        element: <Navigate to="/usuario/login" replace />
      },
      {
        path: 'login',
        element: <Navigate to="/usuario/login" replace />
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
        element: <RoleHomeRedirect />
      }
    ]
  }
]);

export default router;
