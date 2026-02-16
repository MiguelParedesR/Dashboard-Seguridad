const SESSION_KEY = 'dashboard:auth:session';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const DEFAULT_ROUTE_BY_ROLE = {
  admin: '/html/base/dashboard.html',
  operador: '/html/actividades-cctv/incidencias.html'
};

const ALLOWED_ROUTES_BY_ROLE = {
  admin: null,
  operador: new Set([
    '/html/actividades-cctv/incidencias.html',
    '/html/actividades-cctv/lockers.html'
  ])
};

function normalizePath(pathname) {
  const raw = String(pathname || '').trim();
  if (!raw) return '/';
  const normalized = raw.replace(/\/+$/, '');
  return normalized || '/';
}

export function setAuthSession(session) {
  if (typeof window === 'undefined') return;
  const payload = {
    role: String(session?.role || '').trim().toLowerCase(),
    user: session?.user || null,
    createdAt: Date.now()
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}

export function getAuthSession() {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.role || !parsed.createdAt) {
      clearAuthSession();
      return null;
    }

    if (Date.now() - Number(parsed.createdAt) > SESSION_MAX_AGE_MS) {
      clearAuthSession();
      return null;
    }

    return parsed;
  } catch (err) {
    clearAuthSession();
    return null;
  }
}

export function getDefaultRouteForRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  return DEFAULT_ROUTE_BY_ROLE[normalized] || '/usuario/login';
}

export function canAccessPath(role, pathname) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const normalizedPath = normalizePath(pathname);

  const rules = ALLOWED_ROUTES_BY_ROLE[normalizedRole];
  if (rules === null) return true;
  if (!rules) return false;
  return rules.has(normalizedPath);
}
