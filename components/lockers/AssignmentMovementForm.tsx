'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type AssignmentSummary = {
  id: string;
  lockerCodigo: string | null;
  local: string | null;
  area: string | null;
  colaboradorNombre: string | null;
  colaboradorDni: string | null;
  fechaAsignacion: string | null;
  llavesEsperadas: number;
  llavesDeclaradasDefault: number;
  tieneDuplicadoLlave: boolean;
};

type Props = {
  mode: 'entrega' | 'devolucion';
  assignment: AssignmentSummary;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

async function uploadEvidence(file: File, purpose: 'entrega' | 'respaldo' | 'devolucion', assignmentId: string) {
  const body = new FormData();
  body.set('file', file);
  body.set('purpose', purpose);
  body.set('assignmentId', assignmentId);
  const response = await fetch('/api/lockers/evidencias', { method: 'POST', body });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo guardar la evidencia');
  return String(payload.url || '');
}

export default function AssignmentMovementForm({ mode, assignment }: Props) {
  const router = useRouter();
  const [primaryPhoto, setPrimaryPhoto] = useState<File | null>(null);
  const [backupPhoto, setBackupPhoto] = useState<File | null>(null);
  const [declared, setDeclared] = useState(assignment.llavesDeclaradasDefault);
  const [confirmed, setConfirmed] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    if (!primaryPhoto) {
      setError(mode === 'entrega' ? 'Adjunta la foto de la llave entregada.' : 'Adjunta la foto de las llaves devueltas.');
      return;
    }
    if (mode === 'entrega' && !backupPhoto) {
      setError('Adjunta la foto de las llaves de respaldo.');
      return;
    }
    if (!confirmed || (mode === 'entrega' && !backupConfirmed)) {
      setError('Confirma las declaraciones antes de registrar el movimiento.');
      return;
    }

    setWorking(true);
    setError('');
    setSuccess('');
    try {
      const primaryUrl = await uploadEvidence(primaryPhoto, mode, assignment.id);
      if (mode === 'entrega' && backupPhoto) {
        await uploadEvidence(backupPhoto, 'respaldo', assignment.id);
      }

      const response = await fetch('/api/lockers/movimientos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: mode,
          asignacionId: assignment.id,
          llavesDeclaradas: declared,
          fotoUrl: primaryUrl
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo registrar el movimiento');

      setSuccess(mode === 'entrega' ? 'Entrega registrada correctamente.' : 'Devolución registrada correctamente.');
      setPrimaryPhoto(null);
      setBackupPhoto(null);
      setConfirmed(false);
      setBackupConfirmed(false);
      router.refresh();
      window.setTimeout(() => router.replace(mode === 'entrega' ? '/lockers/solicitudes' : '/lockers'), 350);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el movimiento');
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <section className="section">
        <div className="section-head">
          <div>
            <h2>{mode === 'entrega' ? 'Entrega de llaves' : 'Devolución de llaves'}</h2>
            <p>La cantidad esperada se calcula en servidor desde la configuración del locker.</p>
          </div>
          <span className="badge info">{assignment.lockerCodigo || 'Locker'}</span>
        </div>

        <div className="form-grid">
          <div className="field"><label>Colaborador</label><div className="input" aria-readonly="true">{assignment.colaboradorNombre || 'Sin nombre'}</div></div>
          <div className="field"><label>DNI</label><div className="input" aria-readonly="true">{assignment.colaboradorDni || 'N/D'}</div></div>
          <div className="field"><label>Local / área</label><div className="input" aria-readonly="true">{[assignment.local, assignment.area].filter(Boolean).join(' · ') || '—'}</div></div>
          <div className="field"><label>Asignación</label><div className="input" aria-readonly="true">{formatDate(assignment.fechaAsignacion)}</div></div>
          <div className="field"><label>Llaves esperadas</label><div className="input" aria-readonly="true">{assignment.llavesEsperadas}</div></div>
          <div className="field"><label>Duplicado configurado</label><div className="input" aria-readonly="true">{assignment.tieneDuplicadoLlave ? 'Sí' : 'No'}</div></div>
        </div>
      </section>

      <section className="section">
        <form className="form-grid" onSubmit={submit}>
          <div className="field">
            <label>{mode === 'entrega' ? 'Foto de llave entregada' : 'Foto de llaves devueltas'}</label>
            <input className="input" type="file" accept="image/*" capture="environment" onChange={(event) => setPrimaryPhoto(event.target.files?.[0] || null)} disabled={working} required />
          </div>
          {mode === 'entrega' ? (
            <div className="field">
              <label>Foto de llaves de respaldo</label>
              <input className="input" type="file" accept="image/*" capture="environment" onChange={(event) => setBackupPhoto(event.target.files?.[0] || null)} disabled={working} required />
            </div>
          ) : null}
          <div className="field">
            <label>Llaves declaradas</label>
            <input className="input" type="number" min="0" max="10" value={declared} onChange={(event) => setDeclared(Number(event.target.value || 0))} disabled={working} required />
          </div>
          <div className="field full">
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={working} />
              Confirmo que la cantidad declarada coincide con las llaves físicamente {mode === 'entrega' ? 'entregadas' : 'devueltas'}.
            </label>
          </div>
          {mode === 'entrega' ? (
            <div className="field full">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={backupConfirmed} onChange={(event) => setBackupConfirmed(event.target.checked)} disabled={working} />
                Confirmo que la evidencia de respaldo fue registrada.
              </label>
            </div>
          ) : null}
          {error ? <div className="feedback error full" role="alert">{error}</div> : null}
          {success ? <div className="feedback success full" role="status">{success}</div> : null}
          <div className="full"><button className="btn btn-primary" type="submit" disabled={working}>{working ? 'Registrando…' : mode === 'entrega' ? 'Confirmar entrega' : 'Registrar devolución'}</button></div>
        </form>
      </section>
    </>
  );
}
