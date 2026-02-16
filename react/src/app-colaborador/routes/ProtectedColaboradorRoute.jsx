import { Navigate, Outlet } from 'react-router-dom';
import { useColaboradorContext } from '../context/ColaboradorContext.jsx';

export default function ProtectedColaboradorRoute() {
  const { isAuthenticated } = useColaboradorContext();

  if (!isAuthenticated) {
    return <Navigate to="/colaborador" replace />;
  }

  return <Outlet />;
}
