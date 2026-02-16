import { createContext, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'app-colaborador:session';
const ColaboradorContext = createContext(null);

function sanitizeText(value) {
  return String(value ?? '').trim();
}

function normalizeSession(input) {
  if (!input || typeof input !== 'object') return null;

  const collaboratorId = input.colaborador_id ?? input.id;
  if (collaboratorId === null || collaboratorId === undefined || collaboratorId === '') {
    return null;
  }

  const nombre = sanitizeText(input.nombre ?? input.nombre_completo);

  return {
    colaborador_id: collaboratorId,
    nombre,
    nombre_completo: nombre,
    dni: sanitizeText(input.dni),
    area: sanitizeText(input.area),
    local: sanitizeText(input.local)
  };
}

function readStoredSession() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return normalizeSession(JSON.parse(raw));
  } catch (err) {
    return null;
  }
}

export function ColaboradorProvider({ children }) {
  const [session, setSessionState] = useState(() => readStoredSession());

  const setSession = (payload) => {
    const normalized = normalizeSession(payload);
    setSessionState(normalized);

    if (typeof window === 'undefined') return;
    if (!normalized) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  };

  const clearSession = () => setSession(null);

  const value = useMemo(
    () => ({
      session,
      isAuthenticated: Boolean(session?.colaborador_id),
      setSession,
      clearSession
    }),
    [session]
  );

  return <ColaboradorContext.Provider value={value}>{children}</ColaboradorContext.Provider>;
}

export function useColaboradorContext() {
  const context = useContext(ColaboradorContext);
  if (!context) {
    throw new Error('useColaboradorContext must be used within ColaboradorProvider.');
  }
  return context;
}
