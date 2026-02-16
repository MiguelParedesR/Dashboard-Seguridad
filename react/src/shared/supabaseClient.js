import CONFIG from '../services/config.js';

const ENV = import.meta.env || {};
const LOCKERS_URL = String(ENV.VITE_SUPABASE_LOCKERS_URL || ENV.VITE_SUPABASE_URL || '').trim();
const LOCKERS_ANON_KEY = String(ENV.VITE_SUPABASE_LOCKERS_ANON_KEY || ENV.VITE_SUPABASE_ANON_KEY || '').trim();

let clientPromise = null;

function setGlobalClient(client) {
  if (!client || typeof window === 'undefined') return;
  window.supabaseClient = client;
  window.__supabase_client__ = client;
  window.SUPABASE_CLIENT = client;
}

function getGlobalClient() {
  if (typeof window === 'undefined') return null;
  return window.supabaseClient || window.__supabase_client__ || window.SUPABASE_CLIENT || null;
}

function hasLockersCredentials() {
  return Boolean(LOCKERS_URL && LOCKERS_ANON_KEY);
}

function hasSupabaseSdk() {
  if (typeof window === 'undefined') return false;
  if (window.supabaseSDK && typeof window.supabaseSDK.createClient === 'function') return true;
  if (window.supabase && typeof window.supabase.createClient === 'function') return true;
  return false;
}

function getConfiguredClient() {
  const getClient = CONFIG?.SUPABASE?.getClient;
  if (typeof getClient !== 'function') return null;
  return getClient('LOCKERS');
}

function getWaitForClient() {
  const waitForClient = CONFIG?.SUPABASE?.waitForClient;
  if (typeof waitForClient !== 'function') return null;
  return waitForClient;
}

export async function getSupabaseClient() {
  if (typeof window === 'undefined') return null;

  const existing = getGlobalClient();
  if (existing) return existing;

  const directClient = getConfiguredClient();
  if (directClient) {
    setGlobalClient(directClient);
    return directClient;
  }

  const waitForClient = getWaitForClient();
  if (!waitForClient) return null;

  if (!clientPromise) {
    clientPromise = waitForClient('LOCKERS', { maxAttempts: 60, waitMs: 120 });
  }

  const client = await clientPromise;
  if (client) {
    setGlobalClient(client);
  }
  return client;
}

export async function requireSupabaseClient() {
  const client = await getSupabaseClient();
  if (client) return client;

  if (!hasLockersCredentials()) {
    throw new Error(
      'No se pudo inicializar Supabase: faltan VITE_SUPABASE_LOCKERS_URL y/o VITE_SUPABASE_LOCKERS_ANON_KEY en el build.'
    );
  }

  if (!hasSupabaseSdk()) {
    throw new Error(
      'No se pudo inicializar Supabase: no se cargo el SDK. Revisa acceso a CDN o VITE_SUPABASE_SDK_URL.'
    );
  }

  throw new Error('No se pudo inicializar el cliente Supabase.');
}

export default getSupabaseClient;
