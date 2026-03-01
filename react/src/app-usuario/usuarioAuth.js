const ROLE_ALIAS = {
  admin: 'admin',
  administrador: 'admin',
  cctv: 'cctv',
  operador: 'cctv',
  operador_cctv: 'cctv',
  'operador cctv': 'cctv'
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
  if (!normalized) return '';
  if (normalized === 'admin' || normalized === 'administrador') return 'admin';
  if (['cctv', 'operador', 'operador_cctv', 'operador cctv'].includes(normalized)) return 'cctv';
  return '';
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
