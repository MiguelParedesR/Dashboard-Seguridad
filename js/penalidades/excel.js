// excel.js — UI con home (cards) y vistas expansibles. Tema claro.
// Requiere: config.js + supabaseClient.js (ya inicializa window.supabase)

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Estado
let activeView = 'home';            // 'home' | 'asis' | 'pen'
let currentPage = 1;
let pageSize = 20;
let rowsCache = [];                 // cache de filas actuales (para paginado y exportación)
let selectedStates = new Set(['puntual', 'tardanza', 'falto']); // asistencia
let multiOpen = false;

// Init
document.addEventListener('DOMContentLoaded', () => {
    // Home cards
    $('#cardAsis')?.addEventListener('click', () => openView('asis'));
    $('#cardPen')?.addEventListener('click', () => openView('pen'));

    // Back
    $('#btnBack')?.addEventListener('click', () => openView('home'));

    // Botones vista
    $('#btnAsisLoad')?.addEventListener('click', loadAsistencia);
    $('#btnAsisDownload')?.addEventListener('click', downloadAsistencia);

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

    // Cargar combos iniciales
    preloadEmpresas();
});

// Abre vista
function openView(view) {
    activeView = view;

    // Home vs View
    if (view === 'home') {
        $('#home')?.classList.remove('hidden');
        $('#view')?.classList.add('hidden');
        return;
    }

    // Vista expandida
    $('#home')?.classList.add('hidden');
    $('#view')?.classList.remove('hidden');

    // Header dinámico
    if (view === 'asis') {
        $('#vhTitle').textContent = 'Reporte Asistencia';
        $('#vhSub').textContent = 'Tardanzas con penalidad (S/.)';
        $('#btnAsisLoad').classList.remove('hidden');
        $('#btnAsisDownload').classList.remove('hidden');
        $('#btnPenLoad').classList.add('hidden');
        $('#btnPenDownload').classList.add('hidden');
        $('#estadoBox').classList.remove('hidden'); // multiselección visible
    } else {
        $('#vhTitle').textContent = 'Reporte Penalidades';
        $('#vhSub').textContent = 'Penalidades aplicadas (S/.)';
        $('#btnAsisLoad').classList.add('hidden');
        $('#btnAsisDownload').classList.add('hidden');
        $('#btnPenLoad').classList.remove('hidden');
        $('#btnPenDownload').classList.remove('hidden');
        $('#estadoBox').classList.add('hidden'); // ocultar multiselección
    }

    // Limpia preview
    rowsCache = [];
    currentPage = 1;
    $('#kpiRange').textContent = '—';
    $('#kpiCount').textContent = '0';
    $('#totalMonto').textContent = 'S/ 0.00';
    $('#theadRow').innerHTML = '';
    $('#tblPreview tbody').innerHTML = '';
    $('#hint').classList.remove('hidden');
}

// ====== Loaders ======

async function preloadEmpresas() {
    try {
        const { data, error } = await supabase.from('empresas').select('id,nombre').order('nombre');
        if (error) throw error;
        const opts = (data || []).map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
        $('#fEmpresa').innerHTML = `<option value="">Todas las empresas</option>${opts}`;
    } catch (err) { console.error('Empresas load error', err); }
}

function getFilters() {
    const empresaId = $('#fEmpresa').value || null;
    const local = $('#fLocal').value || null;
    const desde = $('#fDesde').value || null;
    const hasta = $('#fHasta').value || null;
    return { empresaId, local, desde, hasta };
}

function setLoading(on) {
    $('#loading').hidden = !on;
}

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

// ====== Multiselect (Asistencia) ======
function toggleMulti() {
    multiOpen = !multiOpen;
    $('#multiMenu').hidden = !multiOpen;
}
function closeMulti() {
    multiOpen = false;
    $('#multiMenu').hidden = true;
}
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
            // Actualiza el "Todos"
            const all = $('#multiMenu input[data-state="all"]');
            const rest = ['puntual', 'tardanza', 'falto'].every(s => selectedStates.has(s));
            all.checked = rest;
        }
        // Badge
        if (selectedStates.size === 3) $('#multiBadge').textContent = 'Todos';
        else if (selectedStates.size === 0) $('#multiBadge').textContent = 'Ninguno';
        else $('#multiBadge').textContent = Array.from(selectedStates).join(', ');
    }
}

// ====== Asistencia ======
async function loadAsistencia() {
    try {
        const { empresaId, local, desde, hasta } = getFilters();
        setRangeKPI(desde, hasta);
        setLoading(true);

        // Trae data desde la vista nueva
        let q = supabase.from('asistencias_dashboard_ext')
            .select('fecha,turno,empresa,local,agente,hora_llegada,horas_sin_cubrir,penalidad_monto,observaciones');

        if (empresaId) q = q.eq('empresa', (await getEmpresaNameById(empresaId)));
        if (local) q = q.eq('local', local);
        if (desde) q = q.gte('fecha', desde);
        if (hasta) q = q.lte('fecha', hasta);

        // Filtros estado (si no están todos, filtramos por observaciones/tardanza o por monto)
        const { data, error } = await q.limit(2000);
        if (error) throw error;

        let rows = data || [];

        // Estado: puntual/tardanza/falto
        // - puntual: penalidad_monto = 0 y observaciones incluye "TARDANZA"? no. Puntual viene como 'TARDANZA' en algunos orígenes,
        //   así que aquí usamos regla más robusta: puntual si penalidad_monto = 0 y (horas_sin_cubrir = '00:00' o minutos 0 en origen).
        rows = rows.filter(r => {
            const obs = (r.observaciones || '').toLowerCase();
            const isTardanza = r.penalidad_monto > 0 || /penalidad mayor a/i.test(obs) || /tardanza/i.test(obs);
            const isPuntual = Number(r.penalidad_monto) === 0 && (r.horas_sin_cubrir === '00:00' || /puntual/i.test(obs));
            const isFalto = /falto/i.test(obs) || /cubre falto/i.test(obs);

            let ok = false;
            if (isTardanza && selectedStates.has('tardanza')) ok = true;
            if (isPuntual && selectedStates.has('puntual')) ok = true;
            if (isFalto && selectedStates.has('falto')) ok = true;

            // Si están todos seleccionados, no filtra
            if (selectedStates.size === 3) ok = true;
            return ok;
        });

        rowsCache = rows;
        currentPage = 1;

        // Render headers Asistencia
        $('#theadRow').innerHTML = [
            'Fecha', 'Turno', 'Empresa', 'Local', 'Agente', 'Hora de llegada', 'Horas sin cubrir', 'Penalidad (S/.)', 'Observaciones'
        ].map(h => `<th>${h}</th>`).join('');

        renderTable();
        openHint(false);
        setLoading(false);
    } catch (err) {
        console.error('Asistencia load error', err);
        setLoading(false);
    }
}

async function getEmpresaNameById(id) {
    // Intento directo de encontrar en el select ya cargado
    const opt = $(`#fEmpresa option[value="${id}"]`);
    if (opt) return opt.textContent;
    // Fallback
    const { data } = await supabase.from('empresas').select('nombre').eq('id', id).single();
    return data?.nombre || null;
}

// ====== Penalidades ======
async function loadPenalidades() {
    try {
        const { empresaId, local, desde, hasta } = getFilters();
        setRangeKPI(desde, hasta);
        setLoading(true);

        // v_penalidades_export ya está creada (sin errores) y trae monto_calculado, empresa_nombre, etc.
        let q = supabase.from('v_penalidades_export').select(`
      fecha, empresa_nombre, local_norm, agente, monto_calculado, observaciones_calc
    `);

        if (empresaId) {
            const empName = await getEmpresaNameById(empresaId);
            if (empName) q = q.eq('empresa_nombre', empName);
        }
        if (local) q = q.eq('local_norm', local);
        if (desde) q = q.gte('fecha', desde);
        if (hasta) q = q.lte('fecha', hasta);

        const { data, error } = await q.limit(2000);
        if (error) throw error;

        // Normaliza columnas al formato destino
        const rows = (data || []).map(r => ({
            fecha: r.fecha,
            empresa: r.empresa_nombre,
            local: r.local_norm,
            agente: r.agente,
            penalidad_monto: Number(r.monto_calculado || 0),
            observaciones: r.observaciones_calc || ''
        }));

        rowsCache = rows;
        currentPage = 1;

        // Render headers Penalidades
        $('#theadRow').innerHTML = [
            'Fecha', 'Empresa', 'Local', 'Agente', 'Penalidad (S/.)', 'Observaciones'
        ].map(h => `<th>${h}</th>`).join('');

        renderTable();
        openHint(false);
        setLoading(false);
    } catch (err) {
        console.error('Penalidades load error', err);
        setLoading(false);
    }
}

// ====== Render tabla + totales ======
function renderTable() {
    const tbody = $('#tblPreview tbody');
    tbody.innerHTML = '';

    const total = rowsCache.length;
    $('#kpiCount').textContent = String(total);

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const page = rowsCache.slice(start, end);

    let sumPen = 0;

    if (activeView === 'asis') {
        // Fecha, Turno, Empresa, Local, Agente, Hora de llegada, Horas sin cubrir, Penalidad (S/.), Observaciones
        tbody.innerHTML = page.map(r => {
            const p = Number(r.penalidad_monto || 0);
            sumPen += p;
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
    } else if (activeView === 'pen') {
        // Fecha, Empresa, Local, Agente, Penalidad (S/.), Observaciones
        tbody.innerHTML = page.map(r => {
            const p = Number(r.penalidad_monto || 0);
            sumPen += p;
            return `<tr>
        <td>${safe(r.fecha)}</td>
        <td>${safe(r.empresa)}</td>
        <td>${safe(r.local)}</td>
        <td>${safe(r.agente)}</td>
        <td>S/ ${p.toFixed(2)}</td>
        <td>${safe(r.observaciones)}</td>
      </tr>`;
        }).join('');
    }

    // Total de toda la consulta (no solo de la página)
    const sumAll = rowsCache.reduce((acc, r) => acc + Number(r.penalidad_monto || 0), 0);
    setTotalMonto(sumAll);

    // Paginador
    $('#btnPrev').disabled = currentPage === 1;
    $('#btnNext').disabled = (currentPage * pageSize >= total);
}

// ====== Exportar Excel ======

function buildWorksheetData() {
    if (activeView === 'asis') {
        // Encabezados + filas
        const header = ['Fecha', 'Turno', 'Empresa', 'Local', 'Agente', 'Hora de llegada', 'Horas sin cubrir', 'Penalidad (S/.)', 'Observaciones'];
        const body = rowsCache.map(r => ([
            r.fecha, r.turno, r.empresa, r.local, r.agente, r.hora_llegada, r.horas_sin_cubrir, Number(r.penalidad_monto || 0), r.observaciones
        ]));
        // Totales al final
        const totalPen = rowsCache.reduce((acc, r) => acc + Number(r.penalidad_monto || 0), 0);
        body.push([]);
        body.push(['TOTALES', '', '', '', '', '', '', totalPen, '']);
        return { header, body, title: 'Reporte Asistencia' };
    } else {
        const header = ['Fecha', 'Empresa', 'Local', 'Agente', 'Penalidad (S/.)', 'Observaciones'];
        const body = rowsCache.map(r => ([
            r.fecha, r.empresa, r.local, r.agente, Number(r.penalidad_monto || 0), r.observaciones
        ]));
        const totalPen = rowsCache.reduce((acc, r) => acc + Number(r.penalidad_monto || 0), 0);
        body.push([]);
        body.push(['TOTALES', '', '', '', totalPen, '']);
        return { header, body, title: 'Reporte Penalidades' };
    }
}

function stylizeSheet(ws, headerLen) {
    // Estilos básicos de encabezado y bordes
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[addr]) continue;
        ws[addr].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2563EB" } }, // brand azul
            alignment: { horizontal: "center", vertical: "center" },
            border: { bottom: { style: "thin", color: { rgb: "E5E7EB" } } }
        };
    }
    // Ajuste de anchos
    const widths = new Array(headerLen).fill({ wch: 18 });
    ws['!cols'] = widths;
}

function downloadAsistencia() {
    if (activeView !== 'asis' || rowsCache.length === 0) return;
    const wb = XLSX.utils.book_new();
    const { header, body, title } = buildWorksheetData();
    const data = [header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(data);
    stylizeSheet(ws, header.length);
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
    XLSX.writeFile(wb, `Asistencia_${dateStamp()}.xlsx`);
}

function downloadPenalidades() {
    if (activeView !== 'pen' || rowsCache.length === 0) return;
    const wb = XLSX.utils.book_new();
    const { header, body, title } = buildWorksheetData();
    const data = [header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(data);
    stylizeSheet(ws, header.length);
    XLSX.utils.book_append_sheet(wb, ws, 'Penalidades');
    XLSX.writeFile(wb, `Penalidades_${dateStamp()}.xlsx`);
}

// ====== Utils ======
function safe(v) { return (v ?? '').toString().replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s])); }
function dateStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}
    