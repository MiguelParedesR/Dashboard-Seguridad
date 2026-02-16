import { createContext, useContext, useMemo, useState } from 'react';
import {
  clearUsuarioSessionStorage,
  normalizeUsuarioSession,
  readUsuarioSession,
  writeUsuarioSession
} from '../usuarioAuth.js';

const UsuarioSessionContext = createContext(null);

export function UsuarioSessionProvider({ children }) {
  const [session, setSessionState] = useState(() => readUsuarioSession());

  const setSession = (payload) => {
    const normalized = normalizeUsuarioSession(payload);
    if (!normalized) {
      clearUsuarioSessionStorage();
      setSessionState(null);
      return;
    }
    writeUsuarioSession(normalized);
    setSessionState(normalized);
  };

  const clearSession = () => {
    clearUsuarioSessionStorage();
    setSessionState(null);
  };

  const value = useMemo(
    () => ({
      session,
      isAuthenticated: Boolean(session?.id && session?.profile),
      setSession,
      clearSession
    }),
    [session]
  );

  return <UsuarioSessionContext.Provider value={value}>{children}</UsuarioSessionContext.Provider>;
}

export function useUsuarioSession() {
  const context = useContext(UsuarioSessionContext);
  if (!context) {
    throw new Error('useUsuarioSession must be used within UsuarioSessionProvider.');
  }
  return context;
}
