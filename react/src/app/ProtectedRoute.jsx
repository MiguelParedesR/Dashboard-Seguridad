import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  canAccessPath,
  getAuthSession,
  getDefaultRouteForRole,
  normalizeAuthRole
} from '../services/sessionAuth.js';

function normalizeAllowedRoles(allowedRoles) {
  if (!Array.isArray(allowedRoles)) return [];
  return allowedRoles.map((role) => normalizeAuthRole(role)).filter(Boolean);
}

export default function ProtectedRoute({ allowedRoles = null, children }) {
  const location = useLocation();
  const session = getAuthSession();

  if (!session) {
    return <Navigate to="/usuario/login" replace />;
  }

  const role = normalizeAuthRole(session.role);
  if (!role || !session.user?.id) {
    return <Navigate to="/usuario/login" replace />;
  }

  const roleRules = normalizeAllowedRoles(allowedRoles);
  if (roleRules.length > 0 && !roleRules.includes(role)) {
    return <Navigate to={getDefaultRouteForRole(role)} replace />;
  }

  if (!canAccessPath(role, location.pathname)) {
    return <Navigate to={getDefaultRouteForRole(role)} replace />;
  }

  return children || <Outlet />;
}
