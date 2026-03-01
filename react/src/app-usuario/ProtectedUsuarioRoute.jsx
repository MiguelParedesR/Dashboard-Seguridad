import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getAuthSession } from '../services/sessionAuth.js';

export default function ProtectedUsuarioRoute() {
  const location = useLocation();
  const session = getAuthSession();
  const isAuthenticated = Boolean(session?.user?.id && session?.role);

  if (!isAuthenticated) {
    return <Navigate to="/usuario/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
