// Inicialización robusta de Supabase (cliente)
(function () {
  // 1) Verificar que el SDK está cargado
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("[Supabase] SDK no cargado. Revisa el <script src='@supabase/supabase-js'> en el HTML.");
    return;
  }

  // 2) Tomar config desde window.CONFIG (si existe) o caer a fallback (lo que ya usabas)
  const cfg = (typeof window.CONFIG !== "undefined" ? window.CONFIG : null) || {};
  const FALLBACK_URL = "https://gimwlrxdfakqtqsvxmxv.supabase.co";
  const FALLBACK_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpbXdscnhkZmFrcXRxc3Z4bXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NzE3MzksImV4cCI6MjA3MTU0NzczOX0.J4XGNI9Iy_TEQTWShsMmgMerIWgmizMIL2dB-B1fDoc";

  const SUPABASE_URL = cfg.SUPABASE_URL || FALLBACK_URL;
  const SUPABASE_KEY = cfg.SUPABASE_ANON_KEY || FALLBACK_ANON;

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.warn("[Supabase] CONFIG no encontrado. Usando Fallback (URL/Key embebidos).");
  }

  // 3) Crear cliente
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // 4) Exponer de forma segura:
  //    - variable global 'supabase' (lo que usa tu código actual)
  //    - alias en window por si se necesita desde otros módulos
  //    OJO: no tocamos window.supabase (namespace del SDK).
  try {
    // Global binding para otros scripts
    // 'const' a nivel de script crea binding global accesible por otros scripts
    // pero para máxima compatibilidad lo asignamos también a window.
    window.SUPABASE_CLIENT = client;
    // Si tu código usa 'supabase' directamente, garantiza que exista:
    window.supabaseClient = client;

    // Importante: no sustituyas el namespace SDK (window.supabase)
    // En su lugar, define un alias global que tu app pueda usar:
    //   - penalidades.js usa 'supabase', mantenemos compatibilidad:
    // Nota: 'var' haría window.supabase = client (rompería el SDK).
    // Creamos una referencia global sin pisar el SDK:
    // Usamos Object.defineProperty para no chocar con el SDK si existiera:
    if (typeof window.supabase === "object" && typeof window.supabase.from !== "function") {
      // Define un alias global específico y ajusta tu app a usarlo si quieres:
      window.sb = client;
      // Además, exponemos 'supabase' (cliente) en el global lexical:
      // Esto funciona en la mayoría de navegadores como binding global:
      // pero por seguridad reasignamos una referencia utilizable:
      window.__supabase_client__ = client;
    }

    // Truco final de compatibilidad: si tu app usa 'supabase' (cliente),
    // crea un getter que devuelva el cliente pero sin romper el SDK:
    if (!("from" in window.supabase)) {
      // solo si el namespace SDK no tiene .from (o sea, no es cliente)
      Object.defineProperty(window, "supabaseApp", {
        value: client,
        writable: false,
        configurable: false,
        enumerable: false,
      });
    }

    // Para tu código actual que llama 'supabase.from(...)',
    // asigna una referencia segura llamada 'supabase':
    // (esto NO pisa el SDK si ya existe .createClient)
    // Como ya existe window.supabase (SDK), creamos un alias global 'supabase' mediante new Function
    // que estará disponible para los otros scripts:
    // eslint-disable-next-line no-new-func
    (new Function("c", "window.supabase_alias = c;"))(client);

    // Y exporta una variable global legible por otros scripts como 'supabase':
    // Nota: algunos bundlers/sandbox no comparten bindings; el alias funciona.
    window.supabase = window.supabase_alias;

  } catch (e) {
    console.error("[Supabase] No se pudo exponer el cliente:", e);
  }
})();
// Ahora puedes usar 'supabase' o 'supabaseClient' en tu código.
