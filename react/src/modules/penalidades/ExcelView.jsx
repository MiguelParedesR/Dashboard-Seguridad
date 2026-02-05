import { useEffect } from 'react';
import './excel.css';

const XLSX_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

function loadScript(src) {
  return new Promise((resolve) => {
    const existing = Array.from(document.querySelectorAll('script[src]'))
      .find((script) => script.src === src);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.body.appendChild(script);
  });
}

export default function ExcelView() {
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      await loadScript(XLSX_CDN);
      await import('./excel.js');
      if (cancelled) return;

      document.title = 'Exportar Excel \u2014 Asistencia & Penalidades';
      document.body.dataset.view = 'excel';
      document.body.classList.remove('view-login');

      const event = new CustomEvent('partial:loaded', {
        detail: { href: 'excel' }
      });
      document.dispatchEvent(event);
    };

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="wrap">
      <section id="home" className="home">
        <div className="cards">
          <div id="cardAsis" className="home-card" role="button" tabIndex="0" aria-label="Reporte Asistencia">
            <div className="card-icon">{'\u{1F4CA}'}</div>
            <div className="card-title">Reporte Asistencia</div>
            <div className="card-sub">Preview y Excel de tardanzas con penalidad</div>
          </div>

          <div id="cardPen" className="home-card" role="button" tabIndex="0" aria-label="Reporte Penalidades">
            <div className="card-icon">{'\u{1F4D1}'}</div>
            <div className="card-title">Reporte Penalidades</div>
            <div className="card-sub">Preview y Excel de penalidades aplicadas</div>
          </div>
        </div>
      </section>

      <section id="view" className="view hidden">
        <div className="view-header">
          <div className="vh-titles">
            <h2 id="vhTitle">Reporte</h2>
            <div id="vhSub" className="vh-sub">{'\u2014'}</div>
          </div>
          <div className="vh-actions">
            <button id="btnBack" className="btn back">{'\u2190'} Regresar</button>

            <button id="btnAsisLoad" className="btn view-only-asis">Cargar Asistencia</button>
            <button id="btnAsisDownload" className="btn view-only-asis">Descargar Asistencia (Excel)</button>

            <button id="btnPenLoad" className="btn view-only-pen hidden">Cargar Penalidades</button>
            <button id="btnPenDownload" className="btn view-only-pen hidden">Descargar Penalidades (Excel)</button>
          </div>
        </div>

        <section className="card" style={{ padding: 16 }}>
          <div className="filters">
            <div className="row">
              <label>Empresa</label>
              <select id="fEmpresa"></select>
            </div>
            <div className="row">
              <label>Local</label>
              <select id="fLocal">
                <option value="">Todos los locales</option>
                <option>TPP1</option>
                <option>TPP2</option>
                <option>TPP3</option>
                <option>TPP4</option>
                <option>ANEXO</option>
              </select>
            </div>
            <div className="row">
              <label>Desde</label>
              <input type="date" id="fDesde" />
            </div>
            <div className="row">
              <label>Hasta</label>
              <input type="date" id="fHasta" />
            </div>

            <div className="row grow" id="estadoBox">
              <label>Estado (multiseleccion)</label>
              <div className="multi">
                <button id="multiBtn" className="multi-btn" aria-haspopup="true" aria-expanded="false">
                  Seleccionar estados
                  <span className="multi-badge" id="multiBadge">Todos</span>
                </button>
                <div id="multiMenu" className="multi-menu" role="menu" hidden>
                  <label className="opt"><input type="checkbox" data-state="all" defaultChecked /> Todos</label>
                  <label className="opt"><input type="checkbox" data-state="puntual" defaultChecked /> Puntualidad</label>
                  <label className="opt"><input type="checkbox" data-state="tardanza" defaultChecked /> Tardanza</label>
                  <label className="opt"><input type="checkbox" data-state="falto" defaultChecked /> Faltos</label>
                </div>
              </div>
            </div>
          </div>

          <div className="statebar">
            <div className="kpis">
              <div className="kpi">
                <div className="kpi-label">Rango</div>
                <div className="kpi-value" id="kpiRange">{'\u2014'}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Vista</div>
                <div className="kpi-value" id="kpiVista">{'\u2014'}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Filas</div>
                <div className="kpi-value" id="kpiCount">0</div>
              </div>
            </div>
            <div className="totalbar">
              <div className="total-label">Total Penalidades</div>
              <div className="total-value" id="totalMonto">S/ 0.00</div>
            </div>
          </div>

          <div id="loading" className="loading" hidden></div>

          <div className="table-wrap">
            <table id="tblPreview">
              <thead>
                <tr id="theadRow"></tr>
              </thead>
              <tbody></tbody>
            </table>
            <div id="hint" className="hint">Elige el rango de fechas y presiona "Cargar ..." para ver el preview.</div>
          </div>

          <div className="paginator">
            <div className="left">
              <label className="sr">Tamano de pagina</label>
              <select id="pageSize">
                <option>10</option>
                <option defaultValue>20</option>
                <option>50</option>
              </select>
            </div>
            <div className="right">
              <button id="btnPrev" className="pagebtn">Anterior</button>
              <span id="pageInfo" className="sr">Pagina 1</span>
              <button id="btnNext" className="pagebtn">Siguiente</button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
