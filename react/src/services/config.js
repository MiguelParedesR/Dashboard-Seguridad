const projectName = 'Dashboard Seguridad TPP';
const version = '2.0.0';

const ENV = import.meta.env || {};

function readEnv(name, fallback = '') {
  const value = ENV[name];
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

const SUPABASE_SDK_URL =
  readEnv('VITE_SUPABASE_SDK_URL') || 'https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

const PRIMARY_URL = readEnv('VITE_SUPABASE_LOCKERS_URL') || readEnv('VITE_SUPABASE_URL');
const PRIMARY_ANON_KEY = readEnv('VITE_SUPABASE_LOCKERS_ANON_KEY') || readEnv('VITE_SUPABASE_ANON_KEY');
const PENALIDADES_URL = readEnv('VITE_SUPABASE_PENALIDADES_URL') || PRIMARY_URL;
const PENALIDADES_ANON_KEY = readEnv('VITE_SUPABASE_PENALIDADES_ANON_KEY') || PRIMARY_ANON_KEY;

const DATABASES = [
  {
    key: 'LOCKERS',
    title: 'Lockers / Core',
    url: PRIMARY_URL,
    anonKey: PRIMARY_ANON_KEY,
    modules: ['lockers', 'dashboard', 'login', 'sidebar']
  },
  {
    key: 'PENALIDADES',
    title: 'Penalidades',
    url: PENALIDADES_URL,
    anonKey: PENALIDADES_ANON_KEY,
    modules: ['penalidades', 'excel']
  }
];

const DB_ALIASES = {
  DASHBOARD: 'LOCKERS',
  LOGIN: 'LOCKERS'
};

const DATABASES_BY_KEY = DATABASES.reduce((acc, db) => {
  acc[db.key] = db;
  return acc;
}, {});

const MODULE_DB_MAP = DATABASES.reduce((acc, db) => {
  (db.modules || []).forEach((moduleName) => {
    acc[moduleName] = db.key;
  });
  return acc;
}, {});
MODULE_DB_MAP.default = 'LOCKERS';

const TABLE_DB_MAP = {
  agentes_seguridad: 'PENALIDADES',
  penalidades_aplicadas: 'PENALIDADES',
  penalidades_catalogo: 'PENALIDADES',
  penalidades_evidencias: 'PENALIDADES',
  empresas: 'PENALIDADES',
  v_uit_actual: 'PENALIDADES',
  tardanzas_importadas: 'PENALIDADES',
  lockers: 'LOCKERS',
  usuarios: 'LOCKERS',
  operadores: 'LOCKERS',
  v_operadores_cctv: 'LOCKERS'
};

const CLIENTS = window.__SUPABASE_CLIENTS || (window.__SUPABASE_CLIENTS = {});
let sdkWarned = false;
const dbConfigWarnings = new Set();

function getSdk() {
  if (window.supabaseSDK && typeof window.supabaseSDK.createClient === 'function') {
    return window.supabaseSDK;
  }
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabaseSDK = window.supabase;
    return window.supabaseSDK;
  }
  return null;
}

function warnMissingDbConfig(dbKey) {
  const resolved = normalizeDbKey(dbKey) || dbKey;
  if (!resolved || dbConfigWarnings.has(resolved)) return;
  const db = DATABASES_BY_KEY[resolved];
  if (db && db.url && db.anonKey) return;
  dbConfigWarnings.add(resolved);
  console.warn(`[Supabase] missing configuration for database "${resolved}". Check VITE_SUPABASE_* variables.`);
}

function loadSupabaseSdk() {
  const existing = getSdk();
  if (existing) return Promise.resolve(existing);
  if (window.__SUPABASE_SDK_LOADING) return window.__SUPABASE_SDK_LOADING;
  window.__SUPABASE_SDK_LOADING = new Promise((resolve) => {
    if (typeof document === 'undefined' || !document.head) {
      resolve(null);
      return;
    }
    const script = document.createElement('script');
    script.src = SUPABASE_SDK_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(getSdk());
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return window.__SUPABASE_SDK_LOADING;
}

function normalizeDbKey(dbKey) {
  if (!dbKey) return dbKey;
  return DB_ALIASES[dbKey] || dbKey;
}

function normalizeTableName(tableName) {
  return String(tableName || '').trim().toLowerCase();
}

function resolveDbKeyFromInput(input) {
  if (!input) return null;
  const normalized = normalizeDbKey(input);
  if (DATABASES_BY_KEY[normalized]) return normalized;
  return resolveDbKeyForModule(input);
}

function resolveDbKeyForTable(tableName, moduleName) {
  const normalized = normalizeTableName(tableName);
  const mapped = TABLE_DB_MAP[normalized];
  if (mapped) return mapped;
  return resolveDbKeyFromInput(moduleName) || MODULE_DB_MAP.default;
}

function getDbConfig(dbKey) {
  const resolved = normalizeDbKey(dbKey);
  return DATABASES_BY_KEY[resolved] || null;
}

function getClientKey(db) {
  return `${db.url}::${db.anonKey}`;
}

function buildStorageKey(db) {
  const raw = db.key || db.title || db.url || 'supabase';
  const normalized = String(raw).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `sb-${normalized}`;
}

function createClient(dbKey) {
  const db = getDbConfig(dbKey);
  if (!db || !db.url || !db.anonKey) {
    warnMissingDbConfig(dbKey);
    return null;
  }
  const clientKey = getClientKey(db);
  if (CLIENTS[clientKey]) return CLIENTS[clientKey];
  const sdk = getSdk();
  if (!sdk) return null;
  CLIENTS[clientKey] = sdk.createClient(db.url, db.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: buildStorageKey(db)
    }
  });
  return CLIENTS[clientKey];
}

function getClient(dbKey) {
  return createClient(dbKey);
}

function resolveDbKeyForModule(moduleName) {
  return MODULE_DB_MAP[moduleName] || MODULE_DB_MAP.default;
}

const TABLE_LIST_CACHE = {};

async function listTables(dbKey, options = {}) {
  const resolved = resolveDbKeyFromInput(dbKey);
  if (!resolved) return null;
  if (!options.force && TABLE_LIST_CACHE[resolved]) return TABLE_LIST_CACHE[resolved];
  const db = getDbConfig(resolved);
  if (!db || !db.url || !db.anonKey) {
    warnMissingDbConfig(resolved);
    return null;
  }
  try {
    const base = String(db.url).replace(/\/$/, '');
    const resp = await fetch(`${base}/rest/v1/`, {
      headers: {
        apikey: db.anonKey,
        Accept: 'application/openapi+json'
      }
    });
    if (!resp.ok) return null;
    const spec = await resp.json();
    const paths = Object.keys(spec.paths || {});
    const set = new Set(
      paths
        .map((p) => p.replace(/^\//, ''))
        .filter((p) => p && !p.startsWith('rpc/'))
    );
    TABLE_LIST_CACHE[resolved] = set;
    return set;
  } catch (err) {
    console.warn('[Supabase] unable to list tables for', resolved, err);
    return null;
  }
}

async function hasTable(dbKey, tableName, options = {}) {
  const tables = await listTables(dbKey, options);
  if (!tables) return false;
  return tables.has(normalizeTableName(tableName));
}

async function hasTableFor(tableName, moduleName, options = {}) {
  const dbKey = resolveDbKeyForTable(tableName, moduleName);
  return hasTable(dbKey, tableName, options);
}

function getClientForTable(tableName, moduleName) {
  const dbKey = resolveDbKeyForTable(tableName, moduleName);
  return getClient(dbKey);
}

function setDefaultClient(dbKey) {
  const client = createClient(dbKey);
  if (!client) return null;
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    window.supabase = client;
  }
  window.supabaseClient = client;
  window.SUPABASE_CLIENT = client;
  window.__supabase_client__ = client;
  return client;
}

function waitForClient(dbKey, options = {}) {
  const maxAttempts = options.maxAttempts ?? 40;
  const waitMs = options.waitMs ?? 250;
  return loadSupabaseSdk().then(
    () =>
      new Promise((resolve) => {
        let attempts = 0;
        const tick = () => {
          const client = createClient(dbKey);
          if (client) {
            resolve(client);
            return;
          }
          attempts += 1;
          if (attempts >= maxAttempts) {
            if (!sdkWarned) {
              console.warn('[Supabase] SDK unavailable or DB missing credentials for', dbKey);
              sdkWarned = true;
            }
            resolve(null);
            return;
          }
          setTimeout(tick, waitMs);
        };
        tick();
      })
  );
}

const defaultDbKey = MODULE_DB_MAP.default;
waitForClient(defaultDbKey).then(() => setDefaultClient(defaultDbKey));

const CONFIG = {
  __initialized: true,
  projectName,
  version,
  SUPABASE_SDK_URL,
  SUPABASE_URL: PRIMARY_URL,
  SUPABASE_ANON_KEY: PRIMARY_ANON_KEY,
  DATABASES,
  DATABASES_BY_KEY,
  DB_ALIASES,
  MODULE_DB_MAP,
  SUPABASE: {
    getClient,
    waitForClient,
    loadSdk: loadSupabaseSdk,
    getConfig: getDbConfig,
    resolveDbKeyForModule,
    resolveDbKeyForTable,
    getClientForTable,
    listTables,
    hasTable,
    hasTableFor,
    setDefaultClient
  }
};

export function initConfig() {
  if (window.CONFIG && window.CONFIG.__initialized) return window.CONFIG;
  window.CONFIG = CONFIG;
  return CONFIG;
}

initConfig();

export default CONFIG;
