import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUsuarioSession } from './context/UsuarioSessionContext.jsx';

export default function ProtectedUsuarioRoute() {
  const location = useLocation();
  const { isAuthenticated } = useUsuarioSession();

  if (!isAuthenticated) {
    return <Navigate to="/usuario/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
