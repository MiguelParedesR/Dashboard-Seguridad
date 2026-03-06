import { requireSupabaseClient } from '../../shared/supabaseClient.js';

const LOCALES_TABLE = 'locales';
const LOCKERS_TABLE = 'lockers';
const CREATE_LOCKERS_FN = 'admin_crear_lockers';
const CREATE_LOCKERS_SCHEMA = 'app';
const SYNC_LOCAL_FN = 'sync_lockers_local_nombre';

const ID_COLUMNS = ['id', 'local_id', 'id_local', 'localid'];
const NAME_COLUMNS = ['nombre', 'nombre_local', 'local', 'descripcion'];
const ACTIVE_COLUMNS = ['activo', 'habilitado', 'enabled'];
const STATE_COLUMNS = ['estado', 'status'];
const LOCKER_ID_COLUMNS = ['id', 'locker_id', 'id_locker'];
const LOCKER_CODE_COLUMNS = ['codigo', 'code', 'locker_code', 'numero', 'nro', 'num'];
const LOCKER_LOCAL_COLUMNS = ['local', 'nombre_local', 'local_nombre'];
const LOCKER_LOCAL_ID_COLUMNS = ['local_id', 'id_local', 'localid'];
const LOCKER_AREA_COLUMNS = ['area', 'zona', 'sector'];
const LOCKER_STATE_COLUMNS = ['estado', 'status'];
const LOCKER_ACTIVE_COLUMNS = ['activo', 'habilitado', 'enabled'];
const LOCKER_CREATED_COLUMNS = ['created_at', 'fecha_creacion', 'fecha_registro'];

function normalizeText(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function findExistingColumn(row, candidates) {
  if (!row || typeof row !== 'object') return null;
  return candidates.find((column) => Object.prototype.hasOwnProperty.call(row, column)) || null;
}

function readActiveFromRow(row, activeColumn, stateColumn) {
  if (!row || typeof row !== 'object') return true;

  if (activeColumn) {
    const raw = row[activeColumn];
    if (typeof raw === 'boolean') return raw;
    if (raw === 1 || raw === '1') return true;
    if (raw === 0 || raw === '0') return false;
    const normalized = String(raw ?? '').trim().toLowerCase();
    if (!normalized) return true;
    if (['true', 't', 'si', 'yes', 'activo', 'activa', 'habilitado'].includes(normalized)) return true;
    if (['false', 'f', 'no', 'inactivo', 'inactiva', 'deshabilitado'].includes(normalized)) return false;
  }

  if (stateColumn) {
    const normalized = String(row[stateColumn] ?? '').trim().toLowerCase();
    if (!normalized) return true;
    return !['inactivo', 'inactiva', 'deshabilitado', 'deshabilitada', 'off', '0'].includes(normalized);
  }

  return true;
}

function mapLocalRow(row, index = 0) {
  const idColumn = findExistingColumn(row, ID_COLUMNS) || 'id';
  const nameColumn = findExistingColumn(row, NAME_COLUMNS) || 'nombre';
  const activeColumn = findExistingColumn(row, ACTIVE_COLUMNS);
  const stateColumn = findExistingColumn(row, STATE_COLUMNS);
  const idValue = row?.[idColumn];
  const stableId = idValue ?? `row-${index}`;

  return {
    id: stableId,
    nombre: normalizeText(row?.[nameColumn], 'Sin nombre'),
    activo: readActiveFromRow(row, activeColumn, stateColumn),
    raw: row || {},
    meta: {
      idColumn,
      nameColumn,
      activeColumn,
      stateColumn,
      hasRealId: idValue !== null && idValue !== undefined
    }
  };
}

function sortLocales(rows) {
  return rows.slice().sort((a, b) =>
    String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', {
      sensitivity: 'base'
    })
  );
}

function mapLockerRow(row, index = 0) {
  const idColumn = findExistingColumn(row, LOCKER_ID_COLUMNS) || 'id';
  const codeColumn = findExistingColumn(row, LOCKER_CODE_COLUMNS) || 'codigo';
  const stateColumn = findExistingColumn(row, LOCKER_STATE_COLUMNS) || 'estado';
  const localColumn = findExistingColumn(row, LOCKER_LOCAL_COLUMNS);
  const areaColumn = findExistingColumn(row, LOCKER_AREA_COLUMNS);
  const activeColumn = findExistingColumn(row, LOCKER_ACTIVE_COLUMNS);
  const createdColumn = findExistingColumn(row, LOCKER_CREATED_COLUMNS);
  const idValue = row?.[idColumn];
  const stableId = idValue ?? `locker-${index}`;

  return {
    id: stableId,
    codigo: normalizeText(row?.[codeColumn], '--'),
    estado: normalizeText(row?.[stateColumn], '--'),
    local: normalizeText(row?.[localColumn], ''),
    area: normalizeText(row?.[areaColumn], ''),
    activo: readActiveFromRow(row, activeColumn, stateColumn),
    creado: createdColumn ? row?.[createdColumn] : null,
    raw: row || {},
    meta: {
      idColumn,
      codeColumn,
      stateColumn,
      localColumn,
      areaColumn,
      activeColumn,
      createdColumn,
      hasRealId: idValue !== null && idValue !== undefined
    }
  };
}

function sortLockers(rows) {
  return rows.slice().sort((a, b) =>
    String(a?.codigo || '').localeCompare(String(b?.codigo || ''), 'es', {
      numeric: true,
      sensitivity: 'base'
    })
  );
}

function cleanArgs(args = {}) {
  return Object.fromEntries(
    Object.entries(args).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function isRpcMissingSignatureError(error) {
  const code = String(error?.code || '');
  const status = Number(error?.status || error?.statusCode || 0);
  const message = String(error?.message || '').toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    status === 404 ||
    message.includes('function') ||
    message.includes('signature') ||
    message.includes('could not find') ||
    message.includes('does not exist')
  );
}

function isMissingColumnError(error) {
  if (!error) return false;
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return (
    code === '42703' ||
    (message.includes('column') && message.includes('does not exist')) ||
    message.includes('unknown column') ||
    message.includes('not found in table')
  );
}

async function callRpcWithCandidates(client, candidates) {
  let lastError = null;

  for (const candidate of candidates) {
    const fn = candidate?.fn;
    if (!fn) continue;

    const args = cleanArgs(candidate.args || {});
    const scoped = candidate.schema ? client.schema(candidate.schema) : client;
    const { data, error } = await scoped.rpc(fn, args);

    if (!error) {
      return {
        data,
        used: {
          schema: candidate.schema || null,
          fn,
          args
        }
      };
    }

    lastError = error;
    if (!isRpcMissingSignatureError(error)) {
      break;
    }
  }

  throw lastError || new Error('No se pudo ejecutar el RPC solicitado.');
}

async function updateLocalNameInTable(client, local, nuevoNombre) {
  const idColumn = local?.meta?.idColumn || 'id';
  const localId = local?.raw?.[idColumn] ?? local?.id;
  if (localId === null || localId === undefined) {
    throw new Error('No se pudo identificar el ID del local para actualizar nombre.');
  }

  const preferredNameColumn = local?.meta?.nameColumn || 'nombre';
  const candidateNameColumns = Array.from(new Set([preferredNameColumn, ...NAME_COLUMNS]));

  let lastError = null;
  for (const nameColumn of candidateNameColumns) {
    const payload = { [nameColumn]: nuevoNombre };
    const { data, error } = await client
      .from(LOCALES_TABLE)
      .update(payload)
      .eq(idColumn, localId)
      .select('*')
      .limit(1);

    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      return mapLocalRow(row || { ...local.raw, [nameColumn]: nuevoNombre });
    }
    lastError = error;
  }

  throw lastError || new Error('No se pudo actualizar el nombre del local.');
}

async function syncLockersLocalName(client, params) {
  const { localId, oldName, newName } = params;
  const candidates = [
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: SYNC_LOCAL_FN,
      args: { p_local_id: localId, p_nuevo_nombre: newName }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: SYNC_LOCAL_FN,
      args: { local_id: localId, nuevo_nombre: newName }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: SYNC_LOCAL_FN,
      args: { id_local: localId, nuevo_nombre: newName }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: SYNC_LOCAL_FN,
      args: { p_local_id: localId }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: SYNC_LOCAL_FN,
      args: { local_id: localId }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: SYNC_LOCAL_FN,
      args: { id_local: localId }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: SYNC_LOCAL_FN,
      args: { nombre_anterior: oldName, nombre_nuevo: newName }
    },
    {
      fn: SYNC_LOCAL_FN,
      args: { p_local_id: localId, p_nuevo_nombre: newName }
    },
    {
      fn: SYNC_LOCAL_FN,
      args: { local_id: localId, nuevo_nombre: newName }
    },
    {
      fn: SYNC_LOCAL_FN,
      args: { id_local: localId, nuevo_nombre: newName }
    },
    {
      fn: SYNC_LOCAL_FN,
      args: { p_local_id: localId }
    },
    {
      fn: SYNC_LOCAL_FN,
      args: { local_id: localId }
    },
    {
      fn: SYNC_LOCAL_FN,
      args: { id_local: localId }
    },
    {
      fn: SYNC_LOCAL_FN,
      args: { nombre_anterior: oldName, nombre_nuevo: newName }
    },
    {
      fn: SYNC_LOCAL_FN,
      args: {}
    }
  ];

  return callRpcWithCandidates(client, candidates);
}

export async function fetchLocales() {
  const client = await requireSupabaseClient();
  const { data, error } = await client.from(LOCALES_TABLE).select('*');
  if (error) throw error;

  const mapped = (Array.isArray(data) ? data : []).map((row, index) => mapLocalRow(row, index));
  return sortLocales(mapped);
}

export async function fetchLockersByLocal(local) {
  const client = await requireSupabaseClient();
  const localId = local?.raw?.[local?.meta?.idColumn || 'id'] ?? local?.id;
  const localNombre = normalizeText(local?.nombre);
  const hasRealId = local?.meta?.hasRealId !== false;
  const candidates = [];

  if (hasRealId && localId !== null && localId !== undefined && localId !== '') {
    LOCKER_LOCAL_ID_COLUMNS.forEach((column) => {
      candidates.push({ column, value: localId });
    });
  }

  if (localNombre) {
    LOCKER_LOCAL_COLUMNS.forEach((column) => {
      candidates.push({ column, value: localNombre });
    });
  }

  if (candidates.length === 0) {
    return [];
  }

  let lastError = null;
  for (const candidate of candidates) {
    const { data, error } = await client
      .from(LOCKERS_TABLE)
      .select('*')
      .eq(candidate.column, candidate.value);

    if (!error) {
      const mapped = (Array.isArray(data) ? data : []).map((row, index) => mapLockerRow(row, index));
      return sortLockers(mapped);
    }

    lastError = error;
    if (!isMissingColumnError(error)) {
      break;
    }
  }

  throw lastError || new Error('No se pudieron cargar los lockers.');
}

export async function createLocal(nombre) {
  const client = await requireSupabaseClient();
  const cleanName = normalizeText(nombre);
  if (!cleanName) {
    throw new Error('Ingresa un nombre de local valido.');
  }

  const payloads = [
    { nombre: cleanName, activo: true },
    { nombre_local: cleanName, activo: true },
    { local: cleanName, activo: true },
    { nombre: cleanName, estado: 'ACTIVO' },
    { nombre_local: cleanName, estado: 'ACTIVO' },
    { local: cleanName, estado: 'ACTIVO' },
    { nombre: cleanName },
    { nombre_local: cleanName },
    { local: cleanName }
  ];

  let lastError = null;
  for (const payload of payloads) {
    const { data, error } = await client.from(LOCALES_TABLE).insert([payload]).select('*').limit(1);
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      return mapLocalRow(row || payload);
    }
    lastError = error;
  }

  throw lastError || new Error('No se pudo crear el local.');
}

export async function setLocalActive(local, nextActive) {
  const client = await requireSupabaseClient();
  const idColumn = local?.meta?.idColumn || 'id';
  const localId = local?.raw?.[idColumn] ?? local?.id;
  if (localId === null || localId === undefined) {
    throw new Error('No se pudo identificar el local a actualizar.');
  }

  const activeColumn = local?.meta?.activeColumn;
  const stateColumn = local?.meta?.stateColumn;
  const payloadCandidates = [];

  if (activeColumn) {
    payloadCandidates.push({ [activeColumn]: Boolean(nextActive) });
  }

  ACTIVE_COLUMNS.forEach((column) => {
    payloadCandidates.push({ [column]: Boolean(nextActive) });
  });

  if (stateColumn) {
    payloadCandidates.push({ [stateColumn]: nextActive ? 'ACTIVO' : 'INACTIVO' });
  }
  payloadCandidates.push({ estado: nextActive ? 'ACTIVO' : 'INACTIVO' });

  let lastError = null;
  for (const payload of payloadCandidates) {
    const { data, error } = await client
      .from(LOCALES_TABLE)
      .update(payload)
      .eq(idColumn, localId)
      .select('*')
      .limit(1);

    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      return mapLocalRow(row || { ...local.raw, ...payload });
    }
    lastError = error;
  }

  throw lastError || new Error('No se pudo actualizar el estado del local.');
}

export async function renameLocal(local, nuevoNombre) {
  const client = await requireSupabaseClient();
  const cleanName = normalizeText(nuevoNombre);
  if (!cleanName) {
    throw new Error('El nombre del local no puede quedar vacio.');
  }

  const updatedLocal = await updateLocalNameInTable(client, local, cleanName);
  const idColumn = updatedLocal?.meta?.idColumn || local?.meta?.idColumn || 'id';
  const localId = updatedLocal?.raw?.[idColumn] ?? local?.raw?.[idColumn] ?? local?.id;

  try {
    const syncResult = await syncLockersLocalName(client, {
      localId,
      oldName: local?.nombre,
      newName: cleanName
    });
    return {
      local: updatedLocal,
      sync: {
        ok: true,
        detail: syncResult
      }
    };
  } catch (syncError) {
    return {
      local: updatedLocal,
      sync: {
        ok: false,
        error: syncError
      }
    };
  }
}

export async function generarLockersPorLocal({ local, cantidad, prefijo = '' }) {
  const client = await requireSupabaseClient();

  const localId = local?.raw?.[local?.meta?.idColumn || 'id'] ?? local?.id;
  const localNombre = normalizeText(local?.nombre);
  if (localId === null || localId === undefined) {
    throw new Error('Selecciona un local valido para generar lockers.');
  }

  const parsedCantidad = Number.parseInt(String(cantidad ?? ''), 10);
  const safeCantidad = Number.isFinite(parsedCantidad) && parsedCantidad > 0 ? parsedCantidad : null;
  const safePrefijo = normalizeText(prefijo);
  const first = 1;
  const last = safeCantidad || undefined;

  const candidates = [
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: CREATE_LOCKERS_FN,
      args: { p_local_id: localId, p_cantidad: safeCantidad, p_prefijo: safePrefijo }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: CREATE_LOCKERS_FN,
      args: { local_id: localId, cantidad: safeCantidad, prefijo: safePrefijo }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: CREATE_LOCKERS_FN,
      args: { id_local: localId, cantidad: safeCantidad, prefijo: safePrefijo }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: CREATE_LOCKERS_FN,
      args: { p_local_id: localId, p_desde: first, p_hasta: last, p_prefijo: safePrefijo }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: CREATE_LOCKERS_FN,
      args: { local_id: localId, desde: first, hasta: last, prefijo: safePrefijo }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: CREATE_LOCKERS_FN,
      args: { p_local_id: localId }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: CREATE_LOCKERS_FN,
      args: { local_id: localId }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: CREATE_LOCKERS_FN,
      args: { id_local: localId }
    },
    {
      schema: CREATE_LOCKERS_SCHEMA,
      fn: CREATE_LOCKERS_FN,
      args: { p_local: localNombre, p_cantidad: safeCantidad, p_prefijo: safePrefijo }
    },
    {
      fn: CREATE_LOCKERS_FN,
      args: { p_local_id: localId, p_cantidad: safeCantidad, p_prefijo: safePrefijo }
    },
    {
      fn: CREATE_LOCKERS_FN,
      args: { local_id: localId, cantidad: safeCantidad, prefijo: safePrefijo }
    },
    {
      fn: CREATE_LOCKERS_FN,
      args: { id_local: localId, cantidad: safeCantidad, prefijo: safePrefijo }
    },
    {
      fn: CREATE_LOCKERS_FN,
      args: { p_local_id: localId, p_desde: first, p_hasta: last, p_prefijo: safePrefijo }
    },
    {
      fn: CREATE_LOCKERS_FN,
      args: { local_id: localId, desde: first, hasta: last, prefijo: safePrefijo }
    },
    {
      fn: CREATE_LOCKERS_FN,
      args: { p_local_id: localId }
    },
    {
      fn: CREATE_LOCKERS_FN,
      args: { local_id: localId }
    },
    {
      fn: CREATE_LOCKERS_FN,
      args: { id_local: localId }
    },
    {
      fn: CREATE_LOCKERS_FN,
      args: { p_local: localNombre, p_cantidad: safeCantidad, p_prefijo: safePrefijo }
    }
  ];

  return callRpcWithCandidates(client, candidates);
}
