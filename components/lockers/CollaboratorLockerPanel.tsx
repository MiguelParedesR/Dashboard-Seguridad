'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Locker = {
  id?: string;
  codigo?: string;
  local?: string;
  area?: string;
  estado?: string;
  tiene_candado?: boolean;
  tiene_duplicado_llave?: boolean;
};

type Assignment = {
  id: string;
  locker_id?: string;
  fecha_asignacion?: string;
  lockers?: Locker | Locker[] | null;
};

type RequestRow = {
  id: string;
  estado?: string;
  created_at?: string;
  lockers?: { codigo?: string; local?: string; area?: string } | { codigo?: string; local?: string; area?: string }[] | null;
};

type StatePayload = {
  asignacion?: Assignment | null;
  solicitudes?: RequestRow[];
  error?: string;
};

function one<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value || undefined;
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

async function uploadEvidence(file: File, assignmentId: string) {
  const body = new FormData();
  body.set('file', file);
  body.set('purpose', 'devolucion');
  body.set('assignmentId', assignmentId);
  const response = await fetch('/api/lockers/evidencias', { method: 'POST', body });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo guardar la evidencia');
  return String(payload.url || '');
}

export default function CollaboratorLockerPanel() {
  const [state, setState] = useState<StatePayload>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [declared, setDeclared] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/colaborador/state', { cache: 'no-store' });
      const payload = (await response.json()) as StatePayload;
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el estado del locker');
      setState(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el estado del locker');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const assignment = state.asignacion || null;
  const locker = one(assignment?.lockers);
  const expected = useMemo(
    () => Number(Boolean(locker?.tiene_candado)) + Number(Boolean(locker?.tiene_duplicado_llave)),
    [locker?.tiene_candado, locker?.tiene_duplicado_llave]
  );

  useEffect(() => {
    setDeclared(Number(Boolean(locker?.tiene_candado) || Boolean(locker?.tiene_duplicado_llave)));
  }, [assignment?.id, locker?.tiene_candado, locker?.tiene_duplicado_llave]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignment || working) return;
    if (!photo) {
      setError('Adjunta una foto de las llaves devueltas.');
      return;
    }
    if (!confirmed) {
      setError('Confirma la declaración antes de registrar la devolución.');
      return;
    }

    setWorking(true);
    setError('');
    setSuccess('');
    try {
      const fotoUrl = await uploadEvidence(photo, assignment.id);
      const response = await fetch('/api/lockers/movimientos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'devolucion',
          asignacionId: assignment.id,
          llavesDeclaradas: declared,
          fotoUrl
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo registrar la devolución');

      setSuccess('Devolución registrada correctamente.');
      setPhoto(null);
      setConfirmed(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la devolución');
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="section" aria-labelledby="locker-colaborador-heading">
      <div className="section-head">
        <div>
          <h2 id="locker-colaborador-heading">Mi locker</h2>
          <p>Consulta de asignación activa y devolución con evidencia.</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={load} disabled={loading || working}>Actualizar</button>
      </div>

      {error ? <div className="feedback error" role="alert">{error}</div> : null}
      {success ? <div className="feedback success" role="status">{success}</div> : null}
      {loading ? <div className="empty">Cargando estado…</div> : null}

      {!loading && !assignment ? (
        <div className="empty">
          No tienes una asignación activa.
          {(state.solicitudes || []).length ? ` Tu última solicitud está en estado ${String(state.solicitudes?.[0]?.estado || '—')}.` : ''}
        </div>
      ) : null}

      {!loading && assignment ? (
        <>
          <div className="form-grid">
            <div className="field"><label>Locker</label><div className="input" aria-readonly="true">{locker?.codigo || assignment.locker_id || '—'}</div></div>
            <div className="field"><label>Local / área</label><div className="input" aria-readonly="true">{[locker?.local, locker?.area].filter(Boolean).join(' · ') || '—'}</div></div>
            <div className="field"><label>Asignado</label><div className="input" aria-readonly="true">{formatDate(assignment.fecha_asignacion)}</div></div>
            <div className="field"><label>Llaves esperadas</label><div className="input" aria-readonly="true">{expected}</div></div>
          </div>

          <form className="form-grid" onSubmit={submit} style={{ marginTop: 22 }}>
            <div className="field">
              <label>Foto de llaves devueltas</label>
              <input className="input" type="file" accept="image/*" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] || null)} disabled={working} required />
            </div>
            <div className="field">
              <label>Llaves declaradas</label>
              <input className="input" type="number" min="0" max="10" value={declared} onChange={(event) => setDeclared(Number(event.target.value || 0))} disabled={working} required />
            </div>
            <div className="field full">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={working} />
                Confirmo que la cantidad declarada coincide con las llaves que estoy devolviendo.
              </label>
            </div>
            <div className="full"><button className="btn btn-primary" type="submit" disabled={working}>{working ? 'Registrando…' : 'Registrar devolución'}</button></div>
          </form>
        </>
      ) : null}
    </section>
  );
}
