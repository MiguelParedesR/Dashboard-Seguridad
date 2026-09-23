'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dni })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo iniciar sesión');
      router.replace(payload.redirectTo || '/dashboard');
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
        <h1>Centro de Control</h1>
        <p>Acceso protegido para administradores y operadores CCTV. La sesión se valida en el servidor y no depende del almacenamiento del navegador.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="dni">DNI</label>
            <input
              className="input"
              id="dni"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              placeholder="Ingresa 8 dígitos"
              type="password"
              value={dni}
              onChange={(event) => setDni(event.target.value.replace(/\D/g, '').slice(0, 8))}
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
