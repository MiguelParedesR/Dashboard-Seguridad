'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ColaboradorLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function redirectTarget(basePath: string) {
    const params = new URLSearchParams();
    const local = String(searchParams.get('local') || '').trim();
    const area = String(searchParams.get('area') || '').trim();
    if (local) params.set('local', local);
    if (area) params.set('area', area);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/colaborador', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dni })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo iniciar sesión');
      router.replace(redirectTarget(payload.redirectTo || '/colaborador'));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-mark">TPP</div>
        <h1>Acceso de colaborador</h1>
        <p>Ingresa tu DNI. La identidad se valida en el servidor y la sesión queda protegida en una cookie HttpOnly.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="colaborador-dni">DNI</label>
            <input
              className="input"
              id="colaborador-dni"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              placeholder="Ingresa 8 dígitos"
              type="password"
              value={dni}
              onChange={(event) => setDni(event.target.value.replace(/\D/g, '').slice(0, 8))}
              disabled={loading}
              required
            />
          </div>
          {error ? <div className="feedback error">{error}</div> : null}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 22 }} disabled={loading || dni.length !== 8} type="submit">
            {loading ? 'Validando…' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
}
