// Configuraci?n global del proyecto (aseguramos que quede en window)
(function () {
  const projectName = "Dashboard Seguridad TPP";
  const version = "1.0.0";

  // Supabase: credenciales centralizadas por modulo/menu.
  const PRIMARY_URL = "https://qjefbngewwthawycvutl.supabase.co";
  const PRIMARY_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZWZibmdld3d0aGF3eWN2dXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMjA2MTUsImV4cCI6MjA2MTY5NjYxNX0.q4J3bF6oC7x9dhW5cwHr-qtqSSqI_8ju7fHvyfO_Sh0";
  const PENALIDADES_URL = "https://iogbjnvgkgchicepnzjq.supabase.co";
  const PENALIDADES_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvZ2JqbnZna2djaGljZXBuempxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzODY2NzksImV4cCI6MjA3MDk2MjY3OX0.wUJULfOQf8BBjW7o88i45dQ8qZGBwX2TI0iqZ5walkc";
  const DATABASES = [
    {
      key: "LOCKERS",
      title: "Lockers",
      url: PRIMARY_URL,
      anonKey: PRIMARY_ANON_KEY
    },
    {
      key: "PENALIDADES",
      title: "Penalidades",
      url: PENALIDADES_URL,
      anonKey: PENALIDADES_ANON_KEY
    },
    {
      key: "DASHBOARD",
      title: "Dashboard",
      url: PRIMARY_URL,
      anonKey: PRIMARY_ANON_KEY
    },
    {
      key: "LOGIN",
      title: "Login",
      url: PRIMARY_URL,
      anonKey: PRIMARY_ANON_KEY
    }
  ];

  const DATABASES_BY_KEY = DATABASES.reduce((acc, db) => {
    acc[db.key] = db;
    return acc;
  }, {});

  const MODULE_DB_MAP = {
    lockers: "LOCKERS",
    penalidades: "PENALIDADES",
    excel: "PENALIDADES",
    dashboard: "DASHBOARD",
    login: "LOGIN",
    sidebar: "DASHBOARD",
    default: "LOCKERS"
  };

  const CLIENTS = {};
  let sdkWarned = false;

  function getSdk() {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      if (!window.supabaseSDK) window.supabaseSDK = window.supabase;
      return window.supabaseSDK;
    }
    if (window.supabaseSDK && typeof window.supabaseSDK.createClient === "function") {
      return window.supabaseSDK;
    }
    return null;
  }

  function getDbConfig(dbKey) {
    return DATABASES_BY_KEY[dbKey] || null;
  }

  function createClient(dbKey) {
    const db = getDbConfig(dbKey);
    if (!db || !db.url || !db.anonKey) return null;
    if (CLIENTS[dbKey]) return CLIENTS[dbKey];
    const sdk = getSdk();
    if (!sdk) return null;
    CLIENTS[dbKey] = sdk.createClient(db.url, db.anonKey);
    return CLIENTS[dbKey];
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
    window.supabase = client;
    window.supabaseClient = client;
    window.SUPABASE_CLIENT = client;
    window.__supabase_client__ = client;
    return client;
  }

  function waitForClient(dbKey, options = {}) {
    const maxAttempts = options.maxAttempts ?? 40;
    const waitMs = options.waitMs ?? 250;
    return new Promise((resolve) => {
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
    });
  }

  const defaultDbKey = MODULE_DB_MAP.default;
  waitForClient(defaultDbKey).then(() => setDefaultClient(defaultDbKey));

  window.CONFIG = {
    projectName,
    version,
    SUPABASE_URL: PRIMARY_URL,
    SUPABASE_ANON_KEY: PRIMARY_ANON_KEY,
    DATABASES,
    DATABASES_BY_KEY,
    MODULE_DB_MAP,
    SUPABASE: {
      getClient,
      waitForClient,
      getConfig: getDbConfig,
      resolveDbKeyForModule,
      setDefaultClient
    }
  };
})();
// NOTA: en producci?n, considera cargar estas variables desde un endpoint seguro
// o usar variables de entorno en un proceso de build para no exponerlas directamente en el c?digo cliente.
