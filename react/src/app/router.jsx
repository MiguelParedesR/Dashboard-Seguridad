import { createHashRouter, Navigate, Outlet } from 'react-router-dom';
import MainLayout from '../layout/MainLayout.jsx';
import RequireSession from './RequireSession.jsx';
import ProtectedUsuarioRoute from '../app-usuario/ProtectedUsuarioRoute.jsx';
import UsuarioLoginView from '../app-usuario/UsuarioLoginView.jsx';
import { UsuarioSessionProvider } from '../app-usuario/context/UsuarioSessionContext.jsx';
import UsuarioAsignacionesView from '../app-usuario/UsuarioAsignacionesView.jsx';
import UsuarioEntregaView from '../app-usuario/UsuarioEntregaView.jsx';
import UsuarioHistorialView from '../app-usuario/UsuarioHistorialView.jsx';
import UsuarioLockersView from '../app-usuario/UsuarioLockersView.jsx';
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

const withSession = (element) => <RequireSession>{element}</RequireSession>;

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
    element: (
      <UsuarioSessionProvider>
        <Outlet />
      </UsuarioSessionProvider>
    ),
    children: [
      {
        path: 'login',
        element: <UsuarioLoginView />
      },
      {
        element: <ProtectedUsuarioRoute />,
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
            path: 'lockers',
            element: <UsuarioLockersView />
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
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/usuario/login" replace />
      },
      {
        path: 'html/base/dashboard.html',
        element: withSession(<DashboardView />)
      },
      {
        path: 'html/actividades-cctv/lockers.html',
        element: withSession(<LockersView />)
      },
      {
        path: 'html/actividades-cctv/incidencias.html',
        element: withSession(<IncidenciasView />)
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
        element: withSession(<AdminView />)
      },
      {
        path: 'html/admin/noticias.html',
        element: withSession(<NoticiasView />)
      },
      {
        path: 'html/penalidades/penalidades.html',
        element: withSession(<PenalidadesView />)
      },
      {
        path: 'html/penalidades/excel.html',
        element: withSession(<ExcelView />)
      },
      {
        path: 'html/rol-servicios/turnos.html',
        element: withSession(<TurnosView />)
      },
      {
        path: 'html/rol-servicios/turnoNoche.html',
        element: withSession(<TurnoNocheView />)
      },
      {
        path: '*',
        element: <Navigate to="/usuario/login" replace />
      }
    ]
  }
]);

export default router;
