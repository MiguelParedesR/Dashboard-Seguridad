'use client';

import { FormEvent, useMemo, useState } from 'react';

export type InspectionRow = {
  id: string;
  fecha: string;
  hora: string;
  responsable: string;
  empresa: string;
  placa: string;
  chofer: string;
  lugar: string;
  incorreccion: string;
  observaciones: string;
  separacion_central: number | null;
  medida_altura: string | null;
  medida_central: string | null;
  altura_mampara: number | null;
  foto_unidad: string | null;
  foto_observacion: string | null;
  detalle: string;
};

type Detail = {
  tipo?: string;
  datos?: { separacion_lateral_central?: number | string | null; altura_mampara?: number | string | null; observacion_texto?: string };
  imagenes?: { foto_panoramica_unidad?: string | null; foto_altura_mampara?: string | null; foto_lateral_central?: string | null; foto_observacion?: string | null };
  json_storage?: { bucket?: string; path?: string; publicUrl?: string };
};

const COMPANIES = ['RYM','TURICAR','BUEN DIA','HUARIJIRCA','TEAL','BRANDOM','DIOS DA','KAREL','MALEJA','MOTRIL','JK SALAS','TATTUS TRUCK','PR HERMANOS','SCARAMUTTI','GM','TILOPSAC','CHUCAS CARGO','V&B','GAMARRA BERRENECHEA'];
const RESPONSIBLES = ['Carlos Sanchez','Francisco Elescano','Hernan Luna','Roger Castro','Oscar Fernandez','Miguel Paredes','David Echaccaya','Juan Quelopana','Grover Munguia','Ernesto Alfaro'];
const TYPES = ['Mampara', 'Cola de Pato', 'Pernos', 'Otros'];

function nowLocal() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    fecha: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    hora: `${pad(now.getHours())}:${pad(now.getMinutes())}`
  };
}

function parseDetail(value: string): Detail {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export default function InspectionForm({ onSaved, onCancel }: { onSaved: (row: InspectionRow) => void; onCancel: () => void }) {
  const initialTime = useMemo(nowLocal, []);
  const [fecha] = useState(initialTime.fecha);
  const [hora] = useState(initialTime.hora);
  const [responsable, setResponsable] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [empresaOtra, setEmpresaOtra] = useState('');
  const [placa, setPlaca] = useState('');
  const [chofer, setChofer] = useState('');
  const [lugar, setLugar] = useState('');
  const [tipo, setTipo] = useState('Mampara');
  const [observaciones, setObservaciones] = useState('');
  const [separacion, setSeparacion] = useState('');
  const [altura, setAltura] = useState('');
  const [observacionTexto, setObservacionTexto] = useState('');
  const [panoramica, setPanoramica] = useState<File | null>(null);
  const [alturaFoto, setAlturaFoto] = useState<File | null>(null);
  const [lateral, setLateral] = useState<File | null>(null);
  const [observacionFoto, setObservacionFoto] = useState<File | null>(null);
  const [previous, setPrevious] = useState<InspectionRow | null>(null);
  const [previousDetail, setPreviousDetail] = useState<Detail>({});
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function checkPlate(value: string) {
    const normalized = normalizePlate(value);
    setPlaca(normalized);
    setPrevious(null);
    setPreviousDetail({});
    if (normalized.length !== 6) return;
    setChecking(true);
    try {
      const response = await fetch(`/api/mamparas/inspecciones?placa=${encodeURIComponent(normalized)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo validar la placa');
      const last = Array.isArray(payload.data) ? payload.data[0] as InspectionRow | undefined : undefined;
      if (last) {
        setPrevious(last);
        setPreviousDetail(parseDetail(last.detalle));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo validar la placa');
    } finally {
      setChecking(false);
    }
  }

  function reusePrevious() {
    if (!previous) return;
    const detail = previousDetail;
    setResponsable(previous.responsable || '');
    if (COMPANIES.includes(previous.empresa)) { setEmpresa(previous.empresa); setEmpresaOtra(''); }
    else { setEmpresa('__OTRA__'); setEmpresaOtra(previous.empresa || ''); }
    setChofer(previous.chofer || '');
    setLugar(previous.lugar || '');
    setTipo(previous.incorreccion || detail.tipo || 'Mampara');
    setObservaciones(previous.observaciones || '');
    setSeparacion(String(detail.datos?.separacion_lateral_central ?? previous.separacion_central ?? ''));
    setAltura(String(detail.datos?.altura_mampara ?? previous.altura_mampara ?? ''));
    setObservacionTexto(detail.datos?.observacion_texto || '');
  }

  async function upload(file: File, purpose: string) {
    const body = new FormData();
    body.set('file', file);
    body.set('purpose', purpose);
    body.set('placa', placa);
    const response = await fetch('/api/mamparas/evidencias', { method: 'POST', body });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudo subir la evidencia');
    return payload as { bucket: string; path: string; url: string; publicUrl: string };
  }

  async function resolveImage(file: File | null, previousUrl: string | null | undefined, purpose: string) {
    if (file) return (await upload(file, purpose)).url;
    return previousUrl || null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError('');
    if (placa.length !== 6) return setError('La placa debe tener 6 caracteres alfanuméricos.');
    const finalCompany = empresa === '__OTRA__' ? empresaOtra.trim() : empresa;
    if (!finalCompany) return setError('Selecciona o ingresa la empresa.');

    setSaving(true);
    try {
      const isMampara = tipo === 'Mampara';
      const prevImages = previousDetail.imagenes || {};
      let imagenes: Detail['imagenes'];
      let datos: NonNullable<Detail['datos']>;

      if (isMampara) {
        if (!separacion || !altura) throw new Error('Registra separación lateral y altura de mampara.');
        const fotoPanoramica = await resolveImage(panoramica, prevImages.foto_panoramica_unidad, 'panoramica');
        const fotoAltura = await resolveImage(alturaFoto, prevImages.foto_altura_mampara, 'altura');
        const fotoLateral = await resolveImage(lateral, prevImages.foto_lateral_central, 'lateral');
        if (!fotoPanoramica || !fotoAltura || !fotoLateral) throw new Error('Mampara requiere foto panorámica, foto de altura y foto lateral.');
        datos = { separacion_lateral_central: Number(separacion), altura_mampara: Number(altura) };
        imagenes = { foto_panoramica_unidad: fotoPanoramica, foto_altura_mampara: fotoAltura, foto_lateral_central: fotoLateral };
      } else {
        if (!observacionTexto.trim()) throw new Error('Describe la observación encontrada.');
        const foto = await resolveImage(observacionFoto, prevImages.foto_observacion, 'observacion');
        if (!foto) throw new Error('La observación requiere una fotografía.');
        datos = { observacion_texto: observacionTexto.trim() };
        imagenes = { foto_observacion: foto };
      }

      let detail: Detail = { tipo, datos, imagenes, timestamp: new Date().toISOString() };
      const jsonFile = new File([JSON.stringify(detail, null, 2)], `${placa}-detalle.json`, { type: 'application/json' });
      const jsonMeta = await upload(jsonFile, 'detalle');
      detail = { ...detail, json_storage: { bucket: jsonMeta.bucket, path: jsonMeta.path, publicUrl: jsonMeta.publicUrl } };

      const sep = isMampara ? Number(separacion) : null;
      const alt = isMampara ? Number(altura) : null;
      const payload = {
        fecha,
        hora,
        responsable,
        empresa: finalCompany,
        placa,
        chofer,
        lugar,
        incorreccion: tipo,
        observaciones,
        separacion_central: sep,
        medida_altura: alt !== null ? `${alt} cm` : null,
        medida_central: sep !== null ? `${sep} cm` : null,
        altura_mampara: alt,
        foto_unidad: isMampara ? imagenes.foto_panoramica_unidad || null : null,
        foto_observacion: isMampara ? imagenes.foto_altura_mampara || null : imagenes.foto_observacion || null,
        detalle: JSON.stringify(detail)
      };

      const response = await fetch('/api/mamparas/inspecciones', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo registrar la inspección');
      onSaved(result.data as InspectionRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la inspección');
    } finally {
      setSaving(false);
    }
  }

  const previousImages = previousDetail.imagenes || {};

  return (
    <section className="section" aria-labelledby="inspection-form-title">
      <div className="section-head">
        <div>
          <h2 id="inspection-form-title">Registrar inspección</h2>
          <p>Referencia operativa: mampara de 1.80 m y separación de 0.15 m respecto del contenedor. La inspección registra la medida observada, no fuerza el resultado.</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={saving}>Cerrar</button>
      </div>
      {error ? <div className="feedback error" role="alert">{error}</div> : null}
      {previous ? <div className="feedback" role="status">Esta placa tiene un registro previo del {previous.fecha}. <button className="btn btn-secondary" type="button" onClick={reusePrevious}>Reutilizar datos y evidencias</button></div> : null}

      <form className="form-grid" onSubmit={submit}>
        <div className="field"><label>Fecha</label><input className="input" value={fecha} readOnly /></div>
        <div className="field"><label>Hora</label><input className="input" value={hora} readOnly /></div>
        <div className="field"><label>Empresa</label><select className="select" value={empresa} onChange={(e) => setEmpresa(e.target.value)} required><option value="">Seleccione</option><option value="__OTRA__">Agregar otra empresa</option>{COMPANIES.map((item) => <option key={item}>{item}</option>)}</select>{empresa === '__OTRA__' ? <input className="input" style={{ marginTop: 8 }} value={empresaOtra} onChange={(e) => setEmpresaOtra(e.target.value)} placeholder="Nombre de la empresa" required /> : null}</div>
        <div className="field"><label>Placa</label><input className="input" value={placa} onChange={(e) => void checkPlate(e.target.value)} maxLength={6} placeholder="ABC123" required /><span style={{ fontSize: 12, color: 'var(--muted)' }}>{checking ? 'Validando placa…' : '6 caracteres alfanuméricos'}</span></div>
        <div className="field"><label>Chofer</label><input className="input" value={chofer} onChange={(e) => setChofer(e.target.value)} required /></div>
        <div className="field"><label>Lugar</label><select className="select" value={lugar} onChange={(e) => setLugar(e.target.value)} required><option value="">Seleccione</option><option>Tracciones</option><option>Calle</option></select></div>
        <div className="field"><label>Tipo de incorrección</label><select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)} required>{TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="field"><label>Responsable</label><select className="select" value={responsable} onChange={(e) => setResponsable(e.target.value)} required><option value="">Seleccione</option>{RESPONSIBLES.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="field"><label>Observaciones</label><select className="select" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} required><option value="">Seleccione</option><option>Descarga</option><option>Embarque</option><option>Otros</option></select></div>

        {tipo === 'Mampara' ? <>
          <div className="field"><label>Separación lateral (cm)</label><input className="input" type="number" min="0" step="0.01" value={separacion} onChange={(e) => setSeparacion(e.target.value)} required /></div>
          <div className="field"><label>Altura de mampara (cm)</label><input className="input" type="number" min="0" step="0.01" value={altura} onChange={(e) => setAltura(e.target.value)} required /></div>
          <div className="field"><label>Foto panorámica</label><input className="input" type="file" accept="image/*" onChange={(e) => setPanoramica(e.target.files?.[0] || null)} />{previousImages.foto_panoramica_unidad ? <a href={previousImages.foto_panoramica_unidad} target="_blank" rel="noreferrer">Evidencia previa disponible</a> : null}</div>
          <div className="field"><label>Foto de altura</label><input className="input" type="file" accept="image/*" onChange={(e) => setAlturaFoto(e.target.files?.[0] || null)} />{previousImages.foto_altura_mampara ? <a href={previousImages.foto_altura_mampara} target="_blank" rel="noreferrer">Evidencia previa disponible</a> : null}</div>
          <div className="field"><label>Foto lateral</label><input className="input" type="file" accept="image/*" onChange={(e) => setLateral(e.target.files?.[0] || null)} />{previousImages.foto_lateral_central ? <a href={previousImages.foto_lateral_central} target="_blank" rel="noreferrer">Evidencia previa disponible</a> : null}</div>
        </> : <>
          <div className="field full"><label>Descripción de la observación</label><textarea className="textarea" value={observacionTexto} onChange={(e) => setObservacionTexto(e.target.value)} required /></div>
          <div className="field"><label>Foto de observación</label><input className="input" type="file" accept="image/*" onChange={(e) => setObservacionFoto(e.target.files?.[0] || null)} />{previousImages.foto_observacion ? <a href={previousImages.foto_observacion} target="_blank" rel="noreferrer">Evidencia previa disponible</a> : null}</div>
        </>}

        <div className="full toolbar"><button className="btn btn-primary" type="submit" disabled={saving || checking}>{saving ? 'Registrando…' : 'Registrar inspección'}</button></div>
      </form>
    </section>
  );
}
