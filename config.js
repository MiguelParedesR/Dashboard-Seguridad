// Configuraci?n global del proyecto (aseguramos que quede en window)
(function () {
  if (window.CONFIG && window.CONFIG.__initialized) {
    return;
  }
  const projectName = "Dashboard Seguridad TPP";
  const version = "1.0.0";
  const SUPABASE_SDK_URL = "https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";

  // Supabase: credenciales centralizadas por modulo/menu.
  const PRIMARY_URL = "https://qjefbngewwthawycvutl.supabase.co";
  const PRIMARY_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZWZibmdld3d0aGF3eWN2dXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMjA2MTUsImV4cCI6MjA2MTY5NjYxNX0.q4J3bF6oC7x9dhW5cwHr-qtqSSqI_8ju7fHvyfO_Sh0";
  const PENALIDADES_URL = "https://iogbjnvgkgchicepnzjq.supabase.co";
  const PENALIDADES_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvZ2JqbnZna2djaGljZXBuempxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzODY2NzksImV4cCI6MjA3MDk2MjY3OX0.wUJULfOQf8BBjW7o88i45dQ8qZGBwX2TI0iqZ5walkc";
  const DATABASES = [
    {
      key: "LOCKERS",
      title: "Lockers / Core",
      url: PRIMARY_URL,
      anonKey: PRIMARY_ANON_KEY,
      modules: ["lockers", "dashboard", "login", "sidebar"]
    },
    {
      key: "PENALIDADES",
      title: "Penalidades",
      url: PENALIDADES_URL,
      anonKey: PENALIDADES_ANON_KEY,
      modules: ["penalidades", "excel"]
    }
  ];

  const DB_ALIASES = {
    DASHBOARD: "LOCKERS",
    LOGIN: "LOCKERS"
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
  MODULE_DB_MAP.default = "LOCKERS";

  const CLIENTS = window.__SUPABASE_CLIENTS || (window.__SUPABASE_CLIENTS = {});
  let sdkWarned = false;

  function getSdk() {
    if (window.supabaseSDK && typeof window.supabaseSDK.createClient === "function") {
      return window.supabaseSDK;
    }
    if (window.supabase && typeof window.supabase.createClient === "function") {
      window.supabaseSDK = window.supabase;
      return window.supabaseSDK;
    }
    return null;
  }

  function loadSupabaseSdk() {
    const existing = getSdk();
    if (existing) return Promise.resolve(existing);
    if (window.__SUPABASE_SDK_LOADING) return window.__SUPABASE_SDK_LOADING;
    window.__SUPABASE_SDK_LOADING = new Promise((resolve) => {
      if (typeof document === "undefined" || !document.head) {
        resolve(null);
        return;
      }
      const script = document.createElement("script");
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

  function getDbConfig(dbKey) {
    const resolved = normalizeDbKey(dbKey);
    return DATABASES_BY_KEY[resolved] || null;
  }

  function getClientKey(db) {
    return `${db.url}::${db.anonKey}`;
  }

  function buildStorageKey(db) {
    const raw = db.key || db.title || db.url || "supabase";
    const normalized = String(raw).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return `sb-${normalized}`;
  }

  function createClient(dbKey) {
    const db = getDbConfig(dbKey);
    if (!db || !db.url || !db.anonKey) return null;
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

  function setDefaultClient(dbKey) {
    const client = createClient(dbKey);
    if (!client) return null;
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
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
    return loadSupabaseSdk().then(() => new Promise((resolve) => {
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
            console.warn("[Supabase] SDK no disponible o DB sin credenciales para", dbKey);
            sdkWarned = true;
          }
          resolve(null);
          return;
        }
        setTimeout(tick, waitMs);
      };
      tick();
    }));
  }

  const defaultDbKey = MODULE_DB_MAP.default;
  waitForClient(defaultDbKey).then(() => setDefaultClient(defaultDbKey));

  window.CONFIG = {
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
      setDefaultClient
    }
  };
})();
// NOTA: en producci?n, considera cargar estas variables desde un endpoint seguro
// o usar variables de entorno en un proceso de build para no exponerlas directamente en el c?digo cliente.
