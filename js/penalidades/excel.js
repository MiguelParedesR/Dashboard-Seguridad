// excel.js — Home (cards) + vistas expandibles Asistencia / Penalidades.
// Requiere: config.js (SUPABASE centralizado)

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

let supabase = null;
const MODULE_KEY = 'excel';

function resolveDbKey() {
    return window.CONFIG?.SUPABASE?.resolveDbKeyForModule?.(MODULE_KEY) || 'PENALIDADES';
}

async function getSupabaseClient() {
    if (supabase) return supabase;
    const waiter = window.CONFIG?.SUPABASE?.waitForClient;
    if (typeof waiter !== 'function') return null;
    supabase = await waiter(resolveDbKey());
    return supabase;
}

// ================== COMPANY MAPPING (UI ↔ ORIGEN) ==================
// Etiquetas visibles en UI -> nombre real en ORIGEN
const UI_TO_ORIGIN = {
    'CORSEPRI S.A.': 'CORSEPRISA',
    'VICMER SECURITY': 'VICMER'
};
// Lista fija para el select Empresa (sin duplicados)
const UI_COMPANIES = ['CORSEPRI S.A.', 'VICMER SECURITY'];

// Estado UI
let activeView = 'home';            // 'home' | 'asis' | 'pen'
let currentPage = 1;
let pageSize = 20;
let rowsCache = [];                 // cache de filas actuales (para paginado y exportación)
let selectedStates = new Set(['puntual', 'tardanza', 'falto']); // asistencia
let multiOpen = false;

// Cabezera estándar (misma para ambas vistas; algunos campos vacíos en Penalidades)
const TABLE_HEADERS = [
    'Fecha', 'Turno', 'Empresa', 'Local', 'Agente', 'Hora de llegada', 'Horas sin cubrir', 'Penalidad (S/.)', 'Observaciones'
];

document.addEventListener('DOMContentLoaded', () => {
    // Home cards
    $('#cardAsis')?.addEventListener('click', () => openView('asis'));
    $('#cardPen')?.addEventListener('click', () => openView('pen'));

    // Back
    $('#btnBack')?.addEventListener('click', () => openView('home'));

    // Botones vista Asistencia
    $('#btnAsisLoad')?.addEventListener('click', loadAsistencia);
    $('#btnAsisDownload')?.addEventListener('click', downloadAsistencia);

    // Botones vista Penalidades
    $('#btnPenLoad')?.addEventListener('click', loadPenalidades);
    $('#btnPenDownload')?.addEventListener('click', downloadPenalidades);

    // Paginación
    $('#pageSize')?.addEventListener('change', () => {
        pageSize = parseInt($('#pageSize').value, 10) || 20;
        currentPage = 1;
        renderTable();
    });
    $('#btnPrev')?.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTable(); }
    });
    $('#btnNext')?.addEventListener('click', () => {
        const total = rowsCache.length;
        if (currentPage * pageSize < total) { currentPage++; renderTable(); }
    });

    // Multiselección (solo Asistencia)
    $('#multiBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleMulti();
    });
    document.addEventListener('click', (e) => {
        if (!$('#estadoBox')?.contains(e.target)) closeMulti();
    });
    $('#multiMenu')?.addEventListener('change', onMultiChange);

    // Empresas (dos fijas, con mapping interno)
    preloadEmpresas();

    // Cabeceras estándar
    $('#theadRow').innerHTML = TABLE_HEADERS.map(h => `<th>${h}</th>`).join('');
});

// ---------- NAV ----------
function openView(view) {
    activeView = view;

    if (view === 'home') {
        $('#home')?.classList.remove('hidden');
        $('#view')?.classList.add('hidden');
        return;
    }

    // Abrimos contenedor de vista y cerramos home
    $('#home')?.classList.add('hidden');
    $('#view')?.classList.remove('hidden');

    // Ajustes por vista
    const isAsis = view === 'asis';
    $('#vhTitle').textContent = isAsis ? 'Reporte Asistencia' : 'Reporte Penalidades';
    $('#vhSub').textContent = isAsis ? 'Tardanzas con penalidad (S/.)' : 'Penalidades aplicadas (S/.)';
    $('#kpiVista').textContent = isAsis ? 'Asistencia' : 'Penalidades';

    // Botones por vista
    $$('.view-only-asis').forEach(el => el.classList.toggle('hidden', !isAsis));
    $$('.view-only-pen').forEach(el => el.classList.toggle('hidden', isAsis));

    // Multiselección de estados solo en Asistencia
    $('#estadoBox')?.classList.toggle('hidden', !isAsis);

    // Limpia preview
    rowsCache = [];
    currentPage = 1;
    $('#kpiRange').textContent = '—';
    $('#kpiCount').textContent = '0';
    $('#totalMonto').textContent = 'S/ 0.00';
    $('#tblPreview tbody').innerHTML = '';
    $('#hint').textContent = isAsis
        ? 'Elige el rango de fechas y presiona “Cargar Asistencia” para ver el preview.'
        : 'Elige el rango de fechas y presiona “Cargar Penalidades” para ver el preview.';
    $('#hint').classList.remove('hidden');
}

function preloadEmpresas() {
    const opts = ['<option value="">Todas las empresas</option>']
        .concat(UI_COMPANIES.map(label => `<option value="${label}">${label}</option>`))
        .join('');
    $('#fEmpresa').innerHTML = opts;
}

// ---------- UTILIDADES ----------
function getFilters() {
    const empresaUI = $('#fEmpresa').value || null;
    const empresaOrigin = empresaUI ? (UI_TO_ORIGIN[empresaUI] || empresaUI) : null;
    const local = $('#fLocal').value || null;
    const desde = $('#fDesde').value || null;
    const hasta = $('#fHasta').value || null;
    return { empresaOrigin, local, desde, hasta };
}
function setLoading(on) { $('#loading').hidden = !on; }
function setRangeKPI(desde, hasta) {
    const d = desde || '—';
    const h = hasta || '—';
    $('#kpiRange').textContent = `${d} → ${h}`;
}
function setTotalMonto(val) {
    const n = Number(val || 0);
    $('#totalMonto').textContent = 'S/ ' + n.toFixed(2);
}
function openHint(on) {
    if (on) $('#hint').classList.remove('hidden');
    else $('#hint').classList.add('hidden');
}
function safe(v) { return (v ?? '').toString().replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s])); }
function dateStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

// ---------- MULTISELECT (Asistencia) ----------
function toggleMulti() { multiOpen = !multiOpen; $('#multiMenu').hidden = !multiOpen; }
function closeMulti() { multiOpen = false; $('#multiMenu').hidden = true; }
function onMultiChange(e) {
    const t = e.target;
    if (t && t.type === 'checkbox') {
        const key = t.getAttribute('data-state');
        if (key === 'all') {
            const checked = t.checked;
            $$('#multiMenu input[type="checkbox"]').forEach(c => { if (c !== t) c.checked = checked; });
            selectedStates = checked ? new Set(['puntual', 'tardanza', 'falto']) : new Set();
        } else {
            if (t.checked) selectedStates.add(key);
            else selectedStates.delete(key);
            const all = $('#multiMenu input[data-state="all"]');
            const rest = ['puntual', 'tardanza', 'falto'].every(s => selectedStates.has(s));
            all.checked = rest;
        }
        if (selectedStates.size === 3) $('#multiBadge').textContent = 'Todos';
        else if (selectedStates.size === 0) $('#multiBadge').textContent = 'Ninguno';
        else $('#multiBadge').textContent = Array.from(selectedStates).join(', ');
    }
}

// ---------- CARGA ASISTENCIA ----------
async function loadAsistencia() {
    try {
        const client = await getSupabaseClient();
        if (!client) {
            setLoading(false);
            console.warn('excel.js: supabase client no disponible para asistencia');
            return;
        }
        const { empresaOrigin, local, desde, hasta } = getFilters();
        setRangeKPI(desde, hasta);
        setLoading(true);

        let q = client.from('asistencias_dashboard_ext')
            .select('fecha,turno,empresa,local,agente,hora_llegada,horas_sin_cubrir,penalidad_monto,observaciones');

        if (empresaOrigin) q = q.eq('empresa', empresaOrigin);  // match a ORIGEN
        if (local) q = q.eq('local', local);
        if (desde) q = q.gte('fecha', desde);
        if (hasta) q = q.lte('fecha', hasta);

        const { data, error } = await q.limit(5000);
        if (error) throw error;

        let rows = data || [];

        // Filtrado por estado (puntual/tardanza/falto)
        rows = rows.filter(r => {
            const obs = (r.observaciones || '').toLowerCase();
            const isTardanza = Number(r.penalidad_monto) > 0 || /penalidad/i.test(obs) || /tardanza/i.test(obs);
            const isPuntual = Number(r.penalidad_monto) === 0 && (r.horas_sin_cubrir === '00:00' || /puntual/i.test(obs));
            const isFalto = /falto/i.test(obs);

            let ok = false;
            if (isTardanza && selectedStates.has('tardanza')) ok = true;
            if (isPuntual && selectedStates.has('puntual')) ok = true;
            if (isFalto && selectedStates.has('falto')) ok = true;

            if (selectedStates.size === 3) ok = true;
            return ok;
        });

        rowsCache = rows;
        currentPage = 1;

        renderTable();
        openHint(false);
        setLoading(false);
    } catch (err) {
        console.error('Asistencia load error', err);
        setLoading(false);
    }
}

// ---------- CARGA PENALIDADES ----------
async function loadPenalidades() {
    try {
        const client = await getSupabaseClient();
        if (!client) {
            setLoading(false);
            console.warn('excel.js: supabase client no disponible para penalidades');
            return;
        }
        const { empresaOrigin, local, desde, hasta } = getFilters();
        setRangeKPI(desde, hasta);
        setLoading(true);

        // Traemos penalidades aplicadas + joins para nombres
        let q = client.from('penalidades_aplicadas')
            .select(`
        fecha,
        local,
        observaciones,
        monto_calculado,
        agente_nombre_manual,
        empresas ( nombre ),
        agentes_seguridad ( nombre ),
        penalidades_catalogo ( item, penalidad_nombre )
      `)
            .order('fecha', { ascending: false });

        // Filtros server-side simples
        if (local) q = q.eq('local', local);
        if (desde) q = q.gte('fecha', desde);
        if (hasta) q = q.lte('fecha', hasta);

        const { data, error } = await q.limit(5000);
        if (error) throw error;

        // Filtro por empresa (por nombre ORIGEN) en cliente, usando join
        let rows = (data || []).filter(r => {
            if (!empresaOrigin) return true;
            const emp = r.empresas?.nombre || null;
            return emp === empresaOrigin;
        });

        // Normalizamos a la misma estructura de la tabla
        rows = rows.map(r => {
            const empresa = r.empresas?.nombre || '';
            const agente = r.agentes_seguridad?.nombre || r.agente_nombre_manual || '(sin nombre)';
            const item = r.penalidades_catalogo?.item;
            const penName = r.penalidades_catalogo?.penalidad_nombre;
            const obs = penName ? `${item}. ${penName}` : (r.observaciones || '');

            return {
                fecha: (r.fecha || '').slice(0, 10),
                turno: '',                     // no aplica en penalidades (pedido: dejar la columna)
                empresa,
                local: r.local || '',
                agente,
                hora_llegada: '',              // no aplica
                horas_sin_cubrir: '',          // no aplica
                penalidad_monto: Number(r.monto_calculado || 0),
                observaciones: obs
            };
        });

        rowsCache = rows;
        currentPage = 1;

        renderTable();
        openHint(false);
        setLoading(false);
    } catch (err) {
        console.error('Penalidades load error', err);
        setLoading(false);
    }
}

// ---------- RENDER TABLA + TOTALES ----------
function renderTable() {
    const tbody = $('#tblPreview tbody');
    tbody.innerHTML = '';

    const total = rowsCache.length;
    $('#kpiCount').textContent = String(total);

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const page = rowsCache.slice(start, end);

    tbody.innerHTML = page.map(r => {
        const p = Number(r.penalidad_monto || 0);
        return `<tr>
      <td>${safe(r.fecha)}</td>
      <td>${safe(r.turno)}</td>
      <td>${safe(r.empresa)}</td>
      <td>${safe(r.local)}</td>
      <td>${safe(r.agente)}</td>
      <td>${safe(r.hora_llegada)}</td>
      <td>${safe(r.horas_sin_cubrir)}</td>
      <td>S/ ${p.toFixed(2)}</td>
      <td>${safe(r.observaciones)}</td>
    </tr>`;
    }).join('');

    // Total de toda la consulta (no solo de la página)
    const sumAll = rowsCache.reduce((acc, r) => acc + Number(r.penalidad_monto || 0), 0);
    setTotalMonto(sumAll);

    // Paginador
    $('#btnPrev').disabled = currentPage === 1;
    $('#btnNext').disabled = (currentPage * pageSize >= total);
}

// ---------- EXCEL ----------
function buildWorksheetDataGeneric() {
    // Estructura única para ambas vistas (coincide con tabla)
    const header = TABLE_HEADERS.slice();
    const body = rowsCache.map(r => ([
        r.fecha, r.turno, r.empresa, r.local, r.agente, r.hora_llegada, r.horas_sin_cubrir, Number(r.penalidad_monto || 0), r.observaciones
    ]));
    const totalPen = rowsCache.reduce((acc, r) => acc + Number(r.penalidad_monto || 0), 0);
    body.push([]);
    body.push(['TOTALES', '', '', '', '', '', '', totalPen, '']);
    return { header, body };
}

function stylizeSheet(ws, headerLen) {
    // Estilos básicos de encabezado y bordes
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[addr]) continue;
        ws[addr].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2563EB" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: { bottom: { style: "thin", color: { rgb: "E5E7EB" } } }
        };
    }
    // Ajuste de anchos
    const widths = new Array(headerLen).fill({ wch: 18 });
    ws['!cols'] = widths;
}

function downloadAsistencia() {
    if (rowsCache.length === 0) return;
    const wb = XLSX.utils.book_new();
    const { header, body } = buildWorksheetDataGeneric();
    const data = [header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(data);
    stylizeSheet(ws, header.length);
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
    XLSX.writeFile(wb, `Asistencia_${dateStamp()}.xlsx`);
}

function downloadPenalidades() {
    if (rowsCache.length === 0) return;
    const wb = XLSX.utils.book_new();
    const { header, body } = buildWorksheetDataGeneric();
    const data = [header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(data);
    stylizeSheet(ws, header.length);
    XLSX.utils.book_append_sheet(wb, ws, 'Penalidades');
    XLSX.writeFile(wb, `Penalidades_${dateStamp()}.xlsx`);
}
// excel.js — fin
