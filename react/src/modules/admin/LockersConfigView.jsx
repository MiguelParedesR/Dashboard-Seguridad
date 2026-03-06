import { useEffect, useMemo, useState } from 'react';
import {
  createLocal,
  fetchLocales,
  fetchLockersByLocal,
  generarLockersPorLocal,
  renameLocal,
  setLocalActive
} from './lockersConfigApi.js';
import './lockers-config.css';

function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return String(error.message || fallback);
}

function isPositiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0;
}

export default function LockersConfigView() {
  const [locales, setLocales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);

  const [newLocalName, setNewLocalName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState('');
  const [editingName, setEditingName] = useState('');
  const [savingId, setSavingId] = useState('');
  const [togglingId, setTogglingId] = useState('');

  const [generateLocalId, setGenerateLocalId] = useState('');
  const [generateCantidad, setGenerateCantidad] = useState('24');
  const [generatePrefijo, setGeneratePrefijo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lockers, setLockers] = useState([]);
  const [lockersLoading, setLockersLoading] = useState(false);
  const [lockersError, setLockersError] = useState('');

  useEffect(() => {
    document.title = 'Configuracion de Lockers';
    document.body.dataset.view = 'admin-lockers-config';
    document.body.classList.remove('view-login');
  }, []);

  const selectedLocal = useMemo(
    () => locales.find((item) => String(item.id) === String(generateLocalId)) || null,
    [generateLocalId, locales]
  );

  const loadLocales = async (options = {}) => {
    const { silent = false } = options;
    if (!silent) {
      setLoading(true);
    }
    setError('');

    try {
      const rows = await fetchLocales();
      setLocales(rows);
      setGenerateLocalId((prev) => {
        if (prev && rows.some((item) => String(item.id) === String(prev))) return prev;
        return rows.length > 0 ? String(rows[0].id) : '';
      });
    } catch (err) {
      setLocales([]);
      setGenerateLocalId('');
      setError(getErrorMessage(err, 'No se pudieron cargar los locales.'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadLockers = async (options = {}) => {
    const { silent = false } = options;
    if (!selectedLocal) {
      setLockers([]);
      setLockersError('');
      setLockersLoading(false);
      return;
    }
    if (!silent) {
      setLockersLoading(true);
    }
    setLockersError('');

    try {
      const rows = await fetchLockersByLocal(selectedLocal);
      setLockers(rows);
    } catch (err) {
      setLockers([]);
      setLockersError(getErrorMessage(err, 'No se pudieron cargar los lockers.'));
    } finally {
      if (!silent) setLockersLoading(false);
    }
  };

  useEffect(() => {
    loadLocales();
  }, []);

  useEffect(() => {
    if (!selectedLocal) {
      setLockers([]);
      setLockersError('');
      return;
    }
    loadLockers({ silent: true });
  }, [selectedLocal?.id, selectedLocal?.nombre]);

  const handleCreateLocal = async (event) => {
    event.preventDefault();
    if (creating) return;

    const cleanName = String(newLocalName || '').trim();
    if (!cleanName) {
      setFeedback({
        type: 'warn',
        message: 'Ingresa un nombre para crear el local.'
      });
      return;
    }

    setCreating(true);
    setFeedback(null);
    try {
      await createLocal(cleanName);
      setNewLocalName('');
      await loadLocales({ silent: true });
      setFeedback({
        type: 'success',
        message: 'Local creado correctamente.'
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(err, 'No se pudo crear el local.')
      });
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (local) => {
    setEditingId(String(local.id));
    setEditingName(local.nombre || '');
    setFeedback(null);
  };

  const cancelEdit = () => {
    setEditingId('');
    setEditingName('');
  };

  const handleSaveName = async (local) => {
    if (savingId) return;

    const cleanName = String(editingName || '').trim();
    if (!cleanName) {
      setFeedback({
        type: 'warn',
        message: 'El nombre del local no puede quedar vacio.'
      });
      return;
    }

    setSavingId(String(local.id));
    setFeedback(null);
    try {
      const result = await renameLocal(local, cleanName);
      await loadLocales({ silent: true });
      cancelEdit();

      if (result?.sync?.ok) {
        setFeedback({
          type: 'success',
          message: 'Nombre del local actualizado y sincronizado con lockers.'
        });
      } else {
        setFeedback({
          type: 'warn',
          message:
            'Nombre actualizado en locales, pero fallo sync_lockers_local_nombre. Revisa permisos/firmas RPC.'
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(err, 'No se pudo actualizar el nombre del local.')
      });
    } finally {
      setSavingId('');
    }
  };

  const handleToggleActive = async (local) => {
    if (togglingId) return;

    setTogglingId(String(local.id));
    setFeedback(null);
    try {
      await setLocalActive(local, !local.activo);
      await loadLocales({ silent: true });
      setFeedback({
        type: 'success',
        message: local.activo ? 'Local desactivado.' : 'Local activado.'
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(err, 'No se pudo actualizar el estado del local.')
      });
    } finally {
      setTogglingId('');
    }
  };

  const handleGenerateLockers = async (event) => {
    event.preventDefault();
    if (generating) return;

    if (!selectedLocal) {
      setFeedback({
        type: 'warn',
        message: 'Selecciona un local para generar lockers.'
      });
      return;
    }

    if (!isPositiveInteger(generateCantidad)) {
      setFeedback({
        type: 'warn',
        message: 'La cantidad de lockers debe ser un numero mayor a 0.'
      });
      return;
    }

    setGenerating(true);
    setFeedback(null);
    try {
      await generarLockersPorLocal({
        local: selectedLocal,
        cantidad: generateCantidad,
        prefijo: generatePrefijo
      });
      await loadLockers({ silent: true });
      setFeedback({
        type: 'success',
        message: 'RPC app.admin_crear_lockers ejecutado correctamente.'
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(err, 'No se pudo ejecutar app.admin_crear_lockers.')
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="admin-lockers-config">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuracion Lockers</h1>
          <p className="page-subtitle">
            Administra locales y genera lockers usando funciones de base de datos.
          </p>
        </div>
        <button className="btn ghost" type="button" onClick={() => loadLocales()} disabled={loading}>
          Recargar
        </button>
      </div>

      {feedback && <div className={`config-feedback ${feedback.type}`}>{feedback.message}</div>}
      {error && <div className="config-feedback error">{error}</div>}

      <div className="grid cols-2">
        <form className="card config-create-card" onSubmit={handleCreateLocal}>
          <h3>Nuevo local</h3>
          <p className="muted">Crea registros en tabla `locales`.</p>
          <div className="config-inline-row">
            <input
              className="input"
              placeholder="Nombre del local"
              value={newLocalName}
              onChange={(event) => setNewLocalName(event.target.value)}
              disabled={creating}
            />
            <button className="btn" type="submit" disabled={creating}>
              {creating ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>

        <form className="card config-create-card" onSubmit={handleGenerateLockers}>
          <h3>Generacion de lockers</h3>
          <p className="muted">Usa RPC `app.admin_crear_lockers` y no inserta manualmente en `lockers`.</p>
          <div className="config-stack">
            <label htmlFor="config-local-select">Local</label>
            <select
              id="config-local-select"
              className="input"
              value={generateLocalId}
              onChange={(event) => setGenerateLocalId(event.target.value)}
              disabled={generating || locales.length === 0}
            >
              {locales.length === 0 && <option value="">Sin locales disponibles</option>}
              {locales.map((local) => (
                <option key={local.id} value={local.id}>
                  {local.nombre}
                </option>
              ))}
            </select>

            <label htmlFor="config-cantidad">Cantidad</label>
            <input
              id="config-cantidad"
              type="number"
              min="1"
              step="1"
              className="input"
              value={generateCantidad}
              onChange={(event) => setGenerateCantidad(event.target.value)}
              disabled={generating}
            />

            <label htmlFor="config-prefijo">Prefijo (opcional)</label>
            <input
              id="config-prefijo"
              type="text"
              className="input"
              value={generatePrefijo}
              onChange={(event) => setGeneratePrefijo(event.target.value)}
              disabled={generating}
              placeholder="Ej: TPP1-"
            />

            <button className="btn" type="submit" disabled={generating || locales.length === 0}>
              {generating ? 'Ejecutando...' : 'Ejecutar RPC'}
            </button>
          </div>
        </form>
      </div>

      <div className="card config-table-card">
        <div className="config-table-header">
          <h3>Locales</h3>
          <span className="muted">{loading ? 'Cargando...' : `${locales.length} registros`}</span>
        </div>

        {loading ? (
          <p className="muted">Cargando locales...</p>
        ) : locales.length === 0 ? (
          <p className="muted">No hay locales configurados.</p>
        ) : (
          <div className="config-table-wrap">
            <table className="config-table">
              <thead>
                <tr>
                  <th>Local</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {locales.map((local) => {
                  const localId = String(local.id);
                  const isEditing = editingId === localId;
                  const rowBusy =
                    savingId === localId ||
                    togglingId === localId ||
                    (generating && generateLocalId === localId);

                  return (
                    <tr key={localId}>
                      <td>
                        {isEditing ? (
                          <input
                            className="input"
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            disabled={rowBusy}
                          />
                        ) : (
                          <strong>{local.nombre}</strong>
                        )}
                      </td>
                      <td>
                        <span className={`status ${local.activo ? 'activo' : 'inactivo'}`}>
                          {local.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="config-actions">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="btn"
                                onClick={() => handleSaveName(local)}
                                disabled={rowBusy}
                              >
                                Guardar
                              </button>
                              <button type="button" className="btn ghost" onClick={cancelEdit} disabled={rowBusy}>
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() => startEdit(local)}
                              disabled={rowBusy}
                            >
                              Editar nombre
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => handleToggleActive(local)}
                            disabled={rowBusy}
                          >
                            {local.activo ? 'Desactivar' : 'Activar'}
                          </button>

                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => setGenerateLocalId(localId)}
                            disabled={rowBusy}
                          >
                            Seleccionar para generar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card config-table-card">
        <div className="config-table-header">
          <div>
            <h3>Lockers generados</h3>
            <p className="muted">
              {selectedLocal ? `Local seleccionado: ${selectedLocal.nombre}` : 'Selecciona un local para ver lockers.'}
            </p>
          </div>
          <div className="config-actions">
            <span className="muted">{lockersLoading ? 'Cargando...' : `${lockers.length} lockers`}</span>
            <button
              className="btn ghost"
              type="button"
              onClick={() => loadLockers()}
              disabled={lockersLoading || !selectedLocal}
            >
              {lockersLoading ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {lockersError && <div className="config-feedback error">{lockersError}</div>}

        {!selectedLocal ? (
          <p className="muted">Selecciona un local para ver lockers.</p>
        ) : lockersLoading ? (
          <p className="muted">Cargando lockers...</p>
        ) : lockers.length === 0 ? (
          <p className="muted">No hay lockers para este local.</p>
        ) : (
          <div className="config-table-wrap">
            <table className="config-table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Estado</th>
                  <th>Area</th>
                  <th>Local</th>
                  <th>Activo</th>
                </tr>
              </thead>
              <tbody>
                {lockers.map((locker) => (
                  <tr key={locker.id}>
                    <td><strong>{locker.codigo || '--'}</strong></td>
                    <td>{locker.estado || '--'}</td>
                    <td>{locker.area || '--'}</td>
                    <td>{locker.local || selectedLocal?.nombre || '--'}</td>
                    <td>
                      <span className={`status ${locker.activo ? 'activo' : 'inactivo'}`}>
                        {locker.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
