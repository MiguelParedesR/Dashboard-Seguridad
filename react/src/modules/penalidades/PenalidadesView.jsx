import { useEffect } from 'react';
import './penalidades.css';

export default function PenalidadesView() {
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      await import('./penalidades.js');
      if (cancelled) return;

      document.title = 'Penalidades - TPP';
      document.body.dataset.view = 'penalidades';
      document.body.classList.remove('view-login');

      const event = new CustomEvent('partial:loaded', {
        detail: { href: 'penalidades' }
      });
      document.dispatchEvent(event);
    };

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div id="penalidades-root">
      <main className="wrap">
        <aside className="panel">
          <h1>Penalidades</h1>
          <form id="formPenalidad" className="card">
            <input type="hidden" id="editId" />

            <div className="row">
              <label>Empresa</label>
              <select id="empresa" required></select>
            </div>

            <div className="row">
              <label>Local</label>
              <select id="local" required>
                <option value="">Seleccionar...</option>
                <option>TPP1</option>
                <option>TPP2</option>
                <option>TPP3</option>
                <option>TPP4</option>
                <option>TPP4 - ANEXO</option>
              </select>
            </div>

            <div className="row" id="agenteTA">
              <label>Agente</label>
              <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                <input
                  type="text"
                  id="agenteSearch"
                  placeholder="Escribe para buscar... (min. 2 letras)"
                  autoComplete="off"
                />
                <input type="hidden" id="agenteId" />
                <div
                  id="taDropdown"
                  className="modal hidden"
                  style={{ inset: 'auto', top: 'unset', left: 'unset' }}
                >
                  <div className="modal-box" style={{ maxWidth: 520, padding: 8, borderRadius: 10 }}>
                    <div id="taList" style={{ maxHeight: 360, overflow: 'auto' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button type="button" id="taAddBtn" className="ghost">Agregar nuevo</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="row">
              <label>Penalidad</label>
              <select id="penalidad" required></select>
            </div>

            <div className="row">
              <label>Monto (S/.)</label>
              <input type="text" id="monto" readOnly />
            </div>

            <div className="row">
              <label>Observaciones</label>
              <textarea id="observaciones" rows="3" placeholder="(opcional)"></textarea>
            </div>

            <div className="row">
              <label>Fecha</label>
              <div className="date-field fancy-date">
                <span className="date-leading-icon" aria-hidden="true">{'\u{1F4C5}'}</span>
                <input type="date" id="fecha" />
                <span className="date-trailing-clear" id="fechaClear" title="Limpiar">{'\u2715'}</span>
              </div>
            </div>

            <div className="row">
              <label>Evidencias</label>
              <div className="uploader" id="uploader">
                <input type="file" id="evidencias" multiple accept="image/*" />
                <div className="uploader-cta">
                  <div className="uploader-icon">{'\u2B06'}</div>
                  <div>
                    <strong>Subir imagenes</strong>
                    <div className="muted">Arrastra y suelta o haz clic para seleccionar (hasta 5)</div>
                  </div>
                </div>
              </div>
            </div>
            <div id="previewList" className="previews"></div>

            <div className="actions">
              <button type="submit" id="btnGuardar">Aplicar penalidad</button>
              <button type="button" id="btnCancelar" className="secondary hidden">Cancelar edicion</button>
            </div>
          </form>
        </aside>

        <section className="grid">
          <div className="card stretch">
            <div className="toolbar">
              <h2>Registros</h2>
              <div className="filters">
                <select id="fEmpresa">
                  <option value="">Todas las empresas</option>
                  <option value="ui:CORSEPRI S.A.">CORSEPRI S.A.</option>
                  <option value="ui:VICMER SECURITY">VICMER SECURITY</option>
                </select>

                <select id="fLocal">
                  <option value="">Todos los locales</option>
                  <option>TPP1</option>
                  <option>TPP2</option>
                  <option>TPP3</option>
                  <option>TPP4</option>
                  <option>TPP4 - ANEXO</option>
                </select>

                <div className="date-field fancy-date">
                  <span className="date-leading-icon" aria-hidden="true">{'\u{1F4C5}'}</span>
                  <input type="date" id="fDesde" />
                  <span className="date-trailing-clear" id="fDesdeClear" title="Limpiar">{'\u2715'}</span>
                </div>
                <div className="date-field fancy-date">
                  <span className="date-leading-icon" aria-hidden="true">{'\u{1F4C5}'}</span>
                  <input type="date" id="fHasta" />
                  <span className="date-trailing-clear" id="fHastaClear" title="Limpiar">{'\u2715'}</span>
                </div>

                <div className="search-field">
                  <input type="text" id="q" placeholder="Buscar (agente / observaciones)" />
                  <span className="search-icon">{'\u{1F50E}'}</span>
                </div>
                <button id="fBuscar" className="ghost">Filtrar</button>
              </div>
            </div>

            <div id="summaryBar" className="summary card-ghost hidden">
              <div className="summary-left">
                <div className="kpi">
                  <div className="kpi-label">Suma filtrada</div>
                  <div className="kpi-value" id="sumMontos">S/ 0.00</div>
                </div>
              </div>
              <div className="summary-right" id="catBadges"></div>
            </div>

            <div className="table-wrap">
              <table id="tablaPenalidades">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Empresa</th>
                    <th>Local</th>
                    <th>Agente</th>
                    <th>Penalidad</th>
                    <th>Monto (S/.)</th>
                    <th style={{ textAlign: 'center' }}>Evidencia</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
              <div id="emptyState" className="empty hidden">No hay resultados con los filtros aplicados.</div>
            </div>

            <div className="paginator">
              <div className="left">
                <label>Tamano de pagina</label>
                <select id="pageSize">
                  <option>10</option>
                  <option defaultValue>20</option>
                  <option>50</option>
                </select>
              </div>
              <div className="right">
                <button id="btnPrev" className="ghost">Anterior</button>
                <span id="pageInfo">Pagina 1</span>
                <button id="btnNext" className="ghost">Siguiente</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div id="modalDelete" className="modal hidden">
        <div className="modal-box">
          <h3>Eliminar registro</h3>
          <p>Estas seguro que deseas eliminar esta penalidad?</p>
          <div className="modal-actions">
            <button id="modalCancel" className="secondary">Cancelar</button>
            <button id="modalOk" className="danger">Eliminar</button>
          </div>
        </div>
      </div>

      <div id="modalGallery" className="modal hidden">
        <div className="modal-box gallery">
          <div className="gallery-header">
            <h3>Evidencias</h3>
            <button id="galleryClose" className="secondary">Cerrar</button>
          </div>
          <div id="galleryGrid" className="gallery-grid"></div>

          <div id="lightbox" className="lightbox hidden">
            <div className="lightbox-backdrop"></div>
            <div className="lightbox-content">
              <button id="lightboxClose" className="lightbox-close" title="Cerrar">{'\u2715'}</button>
              <img id="lightboxImg" src="" alt="Evidencia ampliada" />
            </div>
          </div>
        </div>
      </div>

      <div id="notifyModal" className="notify hidden">
        <div className="notify-box">
          <div className="notify-icon" id="notifyIcon">{'\u2705'}</div>
          <div className="notify-text">
            <div className="notify-title" id="notifyTitle">Hecho</div>
            <div className="notify-msg" id="notifyMsg">Operacion completada.</div>
          </div>
          <button id="notifyClose" className="notify-close" title="Cerrar">{'\u2715'}</button>
        </div>
      </div>
    </div>
  );
}
