export const USUARIO_SESSION_KEY = 'app-usuario:session';

const ROLE_ALIAS = {
  admin: 'admin',
  administrador: 'admin',
  cctv: 'operador',
  operador: 'operador',
  operador_cctv: 'operador',
  'operador cctv': 'operador'
};

function sanitizeText(value) {
  return String(value || '').trim();
}

function parseActiveValue(value) {
  if (value === null || value === undefined) return true;
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;

  const normalized = sanitizeText(value).toLowerCase();
  if (!normalized) return true;
  if (['true', 't', 'activo', 'activa', 'habilitado', 'enabled'].includes(normalized)) return true;
  if (['false', 'f', 'inactivo', 'deshabilitado', 'disabled'].includes(normalized)) return false;
  return true;
}

export function normalizeRole(value) {
  const normalized = sanitizeText(value).toLowerCase().replace(/\s+/g, ' ');
  return ROLE_ALIAS[normalized] || normalized;
}

export function normalizeProfile(value) {
  const normalized = sanitizeText(value).toLowerCase();
  return normalized === 'admin' ? 'admin' : normalized === 'operador' ? 'operador' : '';
}

export function normalizeDni(value) {
  return sanitizeText(value).replace(/\D+/g, '');
}

export function mapUsuarioRow(row) {
  return {
    id: row?.id,
    nombre: sanitizeText(row?.nombre || row?.nombre_completo || row?.email || row?.correo || 'Sin nombre'),
    dni: normalizeDni(row?.dni),
    rolRaw: sanitizeText(row?.rol || row?.role || row?.profile),
    profile: normalizeRole(row?.rol || row?.role || row?.profile),
    activo: parseActiveValue(row?.activo ?? row?.estado)
  };
}

export function matchesProfile(row, profile) {
  const mapped = mapUsuarioRow(row);
  return mapped.activo && mapped.profile === normalizeProfile(profile);
}

export function normalizeUsuarioSession(input) {
  if (!input || typeof input !== 'object') return null;
  const id = input.id ?? input.usuario_id;
  const profile = normalizeProfile(input.profile || input.rol || input.role);
  if (!id || !profile) return null;

  return {
    id,
    nombre: sanitizeText(input.nombre),
    dni: normalizeDni(input.dni),
    profile
  };
}

export function readUsuarioSession() {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(USUARIO_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeUsuarioSession(parsed);
    if (!normalized) {
      window.sessionStorage.removeItem(USUARIO_SESSION_KEY);
      return null;
    }
    return normalized;
  } catch (err) {
    window.sessionStorage.removeItem(USUARIO_SESSION_KEY);
    return null;
  }
}

export function writeUsuarioSession(session) {
  if (typeof window === 'undefined') return null;
  const normalized = normalizeUsuarioSession(session);
  if (!normalized) {
    window.sessionStorage.removeItem(USUARIO_SESSION_KEY);
    return null;
  }
  window.sessionStorage.setItem(USUARIO_SESSION_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearUsuarioSessionStorage() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(USUARIO_SESSION_KEY);
}
