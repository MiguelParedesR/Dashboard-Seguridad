import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  canAccessPath,
  clearAuthSession,
  getAuthSession,
  getDefaultRouteForRole
} from '../services/sessionAuth.js';

const ADMIN_RPC = String(import.meta.env.VITE_AUTH_RPC_IS_ADMIN || 'es_admin').trim();

function isTruthy(value) {
  if (value === true || value === 1 || value === '1') return true;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === 't';
}

function isAdminResult(data) {
  if (Array.isArray(data)) {
    if (data.length === 0) return false;
    return data.some((item) => isAdminResult(item));
  }
  if (isTruthy(data)) return true;
  if (!data || typeof data !== 'object') return false;

  const candidateValues = [
    data.es_admin,
    data.is_admin,
    data.admin,
    data.rol,
    data.role
  ];

  return candidateValues.some((value) => {
    if (isTruthy(value)) return true;
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'admin' || normalized === 'administrador';
  });
}

export default function RequireSession({ children }) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [redirectTo, setRedirectTo] = useState(null);

  useEffect(() => {
    let active = true;

    const validate = async () => {
      setLoading(true);
      setRedirectTo(null);

      const session = getAuthSession();
      if (!session) {
        if (!active) return;
        setRedirectTo('/usuario/login');
        setLoading(false);
        return;
      }

      if (!canAccessPath(session.role, location.pathname)) {
        if (!active) return;
        setRedirectTo(getDefaultRouteForRole(session.role));
        setLoading(false);
        return;
      }

      if (session.role !== 'admin') {
        if (!active) return;
        setLoading(false);
        return;
      }

      try {
        const waiter = window.CONFIG?.SUPABASE?.waitForClient;
        if (typeof waiter !== 'function') {
          clearAuthSession();
          if (!active) return;
          setRedirectTo('/usuario/login');
          setLoading(false);
          return;
        }

        const client = await waiter('LOCKERS', { maxAttempts: 4, waitMs: 120 });
        if (!client) {
          clearAuthSession();
          if (!active) return;
          setRedirectTo('/usuario/login');
          setLoading(false);
          return;
        }

        const { data: authData } = await client.auth.getSession();
        if (!authData?.session) {
          clearAuthSession();
          if (!active) return;
          setRedirectTo('/usuario/login');
          setLoading(false);
          return;
        }

        const { data: adminData, error: adminError } = await client.rpc(ADMIN_RPC);
        if (adminError || !isAdminResult(adminData)) {
          clearAuthSession();
          await client.auth.signOut();
          if (!active) return;
          setRedirectTo('/usuario/login');
          setLoading(false);
          return;
        }

        if (!active) return;
        setLoading(false);
      } catch (err) {
        clearAuthSession();
        if (!active) return;
        setRedirectTo('/usuario/login');
        setLoading(false);
      }
    };

    validate();

    return () => {
      active = false;
    };
  }, [location.pathname]);

  if (loading) {
    return <p className="muted">Validando sesion...</p>;
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
