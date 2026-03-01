const SESSION_KEY = 'dashboard:auth:session';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const ROLE_ALIASES = {
  admin: 'admin',
  administrador: 'admin',
  cctv: 'cctv',
  operador: 'cctv',
  operador_cctv: 'cctv',
  'operador cctv': 'cctv'
};

const DEFAULT_ROUTE_BY_ROLE = {
  admin: '/html/base/dashboard.html',
  cctv: '/lockers/solicitudes'
};

const ALLOWED_ROUTE_PREFIXES_BY_ROLE = {
  admin: null,
  cctv: [
    '/incidencias',
    '/lockers',
    '/html/actividades-cctv/incidencias.html',
    '/html/actividades-cctv/lockers.html'
  ]
};

function normalizePath(pathname) {
  const raw = String(pathname || '').trim();
  if (!raw) return '/';
  const normalized = raw.replace(/\/+$/, '');
  return normalized || '/';
}

export function normalizeAuthRole(role) {
  const normalized = String(role || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return ROLE_ALIASES[normalized] || normalized;
}

function hasAllowedPrefix(pathname, prefix) {
  const target = normalizePath(prefix);
  if (!target || target === '/') return pathname === '/';
  return pathname === target || pathname.startsWith(`${target}/`);
}

export function setAuthSession(session) {
  if (typeof window === 'undefined') return;
  const payload = {
    role: normalizeAuthRole(session?.role),
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
  const normalized = normalizeAuthRole(role);
  return DEFAULT_ROUTE_BY_ROLE[normalized] || '/usuario/login';
}

export function canAccessPath(role, pathname) {
  const normalizedRole = normalizeAuthRole(role);
  const normalizedPath = normalizePath(pathname);

  const rules = ALLOWED_ROUTE_PREFIXES_BY_ROLE[normalizedRole];
  if (rules === null) return true;
  if (!Array.isArray(rules) || rules.length === 0) return false;
  return rules.some((prefix) => hasAllowedPrefix(normalizedPath, prefix));
}
