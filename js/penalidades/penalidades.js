// Penalidades – módulo completo con: paginación, búsqueda, resumen, evidencias (ojo + contador),
// uploader, animaciones, lightbox en galería y modal-notificación creativo (sin alert()).
// + Buscador de agente (typeahead) con sugerencias en vivo y "Agregar nuevo".
// + NUEVO: Compatibilidad de empresa por sinónimos (CORSEPRI S.A. ≈ CORSEPRISA; VICMER SECURITY ≈ VICMER)
//          Aplica tanto en typeahead (agentes) como en el listado de penalidades (filtros).

const $ = (id) => document.getElementById(id);
let deleteId = null;
let supabase = null;

// Paginación
let currentPage = 1;
let pageSize = 20;
let lastPageHadLess = false;

// Para paginación con filtrado en cliente
let lastFilteredTotal = 0;

// Cache de agentes por empresa_id
const AGENTS_CACHE = new Map(); // empresaId -> [{id, nombre, dni}...]
let taOpen = false; // estado del dropdown typeahead
let taActiveIndex = -1; // índice activo para navegación con teclado
let taCurrentItems = []; // items visibles en la lista
let submitting = false;
const MODULE_KEY = 'penalidades';

/** Sinónimos por nombre visible en UI */
const EMPRESA_SYNONYMS = {
    'CORSEPRI S.A.': ['CORSEPRISA', 'CORSEPRI', 'CORSEPRI S.A.'],
    'VICMER SECURITY': ['VICMER', 'VICMER SECURITY']
};

const SUPABASE_TABLES = [
    'penalidades_aplicadas',
    'penalidades_catalogo',
    'penalidades_evidencias',
    'empresas',
    'agentes_seguridad',
    'v_uit_actual'
];

let TABLES_AVAILABLE = null;

function getSupabaseConfig() {
    const dbKey = window.CONFIG?.SUPABASE?.resolveDbKeyForModule?.(MODULE_KEY) || 'PENALIDADES';
    const db = window.CONFIG?.SUPABASE?.getConfig?.(dbKey) || {};
    return { url: db.url, key: db.anonKey };
}

async function fetchSupabaseTables() {
    if (TABLES_AVAILABLE) return TABLES_AVAILABLE;
    const { url, key } = getSupabaseConfig();
    if (!url || !key) return null;

    try {
        const resp = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
            headers: {
                apikey: key,
                Accept: 'application/openapi+json'
            }
        });
        if (!resp.ok) return null;
        const spec = await resp.json();
        const paths = Object.keys(spec.paths || {});
        const set = new Set(
            paths
                .map(p => p.replace(/^\//, ''))
                .filter(p => p && p !== '/' && !p.startsWith('rpc/'))
        );
        TABLES_AVAILABLE = SUPABASE_TABLES.reduce((acc, name) => {
            acc[name] = set.has(name);
            return acc;
        }, {});
        return TABLES_AVAILABLE;
    } catch (err) {
        console.warn('penalidades: no se pudo leer el esquema de Supabase', err);
        return null;
    }
}

function disablePenalidadesUI(missing) {
    const form = $('formPenalidad');
    if (form) {
        form.querySelectorAll('input, select, textarea, button').forEach(el => {
            if (el.id === 'notifyClose') return;
            el.disabled = true;
        });
    }

    const table = $('tablaPenalidades');
    if (table) {
        const tbody = table.querySelector('tbody');
        if (tbody) tbody.innerHTML = '';
    }

    const empty = $('emptyState');
    if (empty) {
        const list = (missing || []).join(', ');
        empty.textContent = list
            ? `No se puede cargar Penalidades. Faltan tablas en Supabase: ${list}.`
            : 'No se puede cargar Penalidades.';
        empty.classList.remove('hidden');
    }

    notify('warn', 'Base de datos incompleta', 'Faltan tablas en Supabase. Revisa la configuracion del proyecto.');
}

async function ensurePenalidadesBackend() {
    const tables = await fetchSupabaseTables();
    if (!tables) return true;
    const required = ['penalidades_aplicadas'];
    const missing = required.filter(name => !tables[name]);
    if (missing.length) {
        disablePenalidadesUI(missing);
        return false;
    }
    return true;
}

// Debounce helper
function debounce(fn, delay = 300) {
    let t = null;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    };
}

// Bloqueo de scroll de fondo cuando hay modal abierto
let scrollLocked = false;
function lockScroll() {
    if (scrollLocked) return;
    document.body.dataset.prevOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
    scrollLocked = true;
}
function unlockScroll() {
    if (!scrollLocked) return;
    document.body.style.overflow = document.body.dataset.prevOverflow || '';
    delete document.body.dataset.prevOverflow;
    scrollLocked = false;
}
// Elevar z-index del modal por encima de cualquier sticky header
function bringToFront(el, z = 10000) {
    if (el) el.style.zIndex = String(z);
}

/* ---------- Inicialización (antes estaba en DOMContentLoaded) ----------
   Se encapsula en initPenalidades() y se ejecuta inmediatamente si
   document.readyState !== 'loading', o se registra en DOMContentLoaded.
--------------------------------------------------------------------- */

async function initPenalidades() {
    const dbKey = window.CONFIG?.SUPABASE?.resolveDbKeyForModule?.(MODULE_KEY) || 'PENALIDADES';
    const waiter = window.CONFIG?.SUPABASE?.waitForClient;
    supabase = typeof waiter === 'function' ? await waiter(dbKey) : null;
    if (!supabase) {
        disablePenalidadesUI();
        notify('warn', 'Supabase no disponible', 'No se pudo inicializar la base de datos para Penalidades.');
        return;
    }

    const backendReady = await ensurePenalidadesBackend();
    if (!backendReady) return;
    // Carga inicial
    await cargarEmpresas();
    await cargarPenalidades();
    setupTypeahead(); // <<< inicializa buscador de agentes
    await listar();

    // Panel izquierdo
    $('empresa').addEventListener('change', onEmpresaChange);
    $('penalidad').addEventListener('change', recalcularMontoPreview);
    $('formPenalidad').addEventListener('submit', onSubmit);
    $('btnCancelar').addEventListener('click', resetForm);
    // Limpiar fecha del formulario
    $('fechaClear').addEventListener('click', () => $('fecha').value = '');

    // Filtros / búsqueda / paginación
    $('fBuscar').addEventListener('click', () => { currentPage = 1; listar(); });
    $('pageSize').addEventListener('change', () => { pageSize = parseInt($('pageSize').value, 10) || 20; currentPage = 1; listar(); });
    $('btnPrev').addEventListener('click', () => { if (currentPage > 1) { currentPage--; listar(); } });
    $('btnNext').addEventListener('click', () => { if (!lastPageHadLess) { currentPage++; listar(); } });

    // Búsqueda en vivo (sin Enter)
    const doLiveSearch = debounce(() => { currentPage = 1; listar(); }, 300);
    $('q').addEventListener('input', doLiveSearch);
    $('q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); } }); // evita salto

    // Limpiar fechas de filtros
    $('fDesdeClear').addEventListener('click', () => $('fDesde').value = '');
    $('fHastaClear').addEventListener('click', () => $('fHasta').value = '');

    // Tabla acciones (delegación)
    $('tablaPenalidades').addEventListener('click', onTableClick);
    // Evitar focus/selección rara al presionar el ojo (antes del click)
    $('tablaPenalidades').addEventListener('mousedown', (e) => {
        const eyeBtn = e.target.closest('.eye-badge');
        if (eyeBtn) {
            e.preventDefault(); // evita focus y selección del header
        }
    });

    // Modales (eliminar)
    $('modalCancel').addEventListener('click', closeDeleteModal);
    $('modalOk').addEventListener('click', onConfirmDelete);

    // Galería + lightbox
    $('galleryClose').addEventListener('click', closeGalleryModal);
    $('lightboxClose').addEventListener('click', closeLightbox);

    // Cerrar lightbox sólo cuando se clickea el BACKDROP del lightbox
    $('lightbox').addEventListener('click', (e) => {
        if (e.target.classList.contains('lightbox-backdrop') || e.target.id === 'lightbox') {
            closeLightbox();
        }
    });

    // Notificación (cerrar)
    $('notifyClose').addEventListener('click', hideNotify);

    // Uploader (previews)
    setupUploader();

    // Accesibilidad: cerrar con ESC modales
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!$('modalGallery').classList.contains('hidden')) closeGalleryModal();
            if (!$('modalDelete').classList.contains('hidden')) closeDeleteModal();
            if (!$('lightbox').classList.contains('hidden')) closeLightbox();
        }
    });
}

/* Ejecutar initPenalidades de forma robusta dependiendo del readyState */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPenalidades);
} else {
    // Si el script se inyecta después de DOMContentLoaded, inicializa inmediatamente
    initPenalidades();
}

// =================== UTILS EMPRESA (SINÓNIMOS) ===================

function getSelectedEmpresaName(selectId) {
    const sel = $(selectId);
    if (!sel) return null;
    const opt = sel.options[sel.selectedIndex];
    return (opt?.textContent || '').trim() || null;
}
function getEmpresaSynonymsBySelected(selectId) {
    const name = getSelectedEmpresaName(selectId);
    if (!name) return [];
    return EMPRESA_SYNONYMS[name] || [name];
}
function buildOrEq(field, values) {
    // Construye cadena para .or('field.eq.VAL1,field.eq.VAL2')
    return values.map(v => `${field}.eq.${v}`).join(',');
}

// =================== DATA LOADERS ===================

async function cargarEmpresas() {
    const tables = TABLES_AVAILABLE || await fetchSupabaseTables();
    if (tables && !tables.empresas) {
        const list = Object.keys(EMPRESA_SYNONYMS);
        const opts = list.map(name => `<option value="${name}">${name}</option>`).join('');
        $('empresa').innerHTML = `<option value="">Seleccionar...</option>${opts}`;
        $('fEmpresa').innerHTML = `<option value="">Todas las empresas</option>${opts}`;
        return;
    }
    const { data, error } = await supabase.from('empresas').select('id,nombre').order('nombre');
    if (error) return console.error(error);
    const opts = (data || []).map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    $('empresa').innerHTML = `<option value="">Seleccionar...</option>${opts}`;
    $('fEmpresa').innerHTML = `<option value="">Todas las empresas</option>${opts}`;
}

/**
 * Carga agentes de una empresa y los cachea por empresa_id (para typeahead).
 * Si no encuentra por empresa_id (mismatch de nombres/ids entre ORIGEN/DESTINO),
 * reintenta por nombre de empresa usando sinónimos (join + or).
 */
async function cargarAgentes(empresaId) {
    if (!empresaId) { return; }
    if (AGENTS_CACHE.has(empresaId)) return; // ya cacheado
    const tables = TABLES_AVAILABLE || await fetchSupabaseTables();
    if (tables && !tables.agentes_seguridad) return;

    // 1) intento por empresa_id (el ideal)
    let { data, error } = await supabase
        .from('agentes_seguridad')
        .select('id,nombre,dni')
        .eq('empresa_id', empresaId)
        .eq('estado', 'activo')
        .order('nombre');

    if (!error && data && data.length > 0) {
        AGENTS_CACHE.set(empresaId, data);
        return;
    }

    // 2) Fallback por nombre de empresa (sinónimos)
    const synonyms = getEmpresaSynonymsBySelected('empresa');
    if (synonyms.length === 0) return;

    // Para filtrar por la tabla relacionada se usa join sintáctico y .or en columna relacionada
    const orExpr = buildOrEq('empresas.nombre', synonyms);

    const res2 = await supabase
        .from('agentes_seguridad')
        .select('id,nombre,dni,empresas!inner(nombre)')
        .eq('estado', 'activo')
        .or(orExpr) // empresas.nombre eq a cualquiera de los sinónimos
        .order('nombre');

    if (res2.error) {
        console.error(res2.error);
        return;
    }
    AGENTS_CACHE.set(empresaId, res2.data || []);
}

async function cargarPenalidades() {
    const tables = TABLES_AVAILABLE || await fetchSupabaseTables();
    if (tables && !tables.penalidades_catalogo) {
        const sel = $('penalidad');
        if (sel) {
            sel.innerHTML = '<option value="">Catálogo no disponible</option>';
            sel.disabled = true;
        }
        return;
    }
    const { data, error } = await supabase
        .from('penalidades_catalogo')
        .select('id,item,categoria,penalidad_nombre,tipo_monto,valor')
        .order('item');
    if (error) return console.error(error);

    $('penalidad').innerHTML = '<option value="">Seleccionar...</option>' + (data || []).map(p => {
        const tag = p.tipo_monto === 'PORCENTAJE_UIT'
            ? `${(p.valor * 100).toFixed(1)}% UIT`
            : `${p.valor} UIT`;
        return `<option value="${p.id}" data-tipo="${p.tipo_monto}" data-valor="${p.valor}" data-cat="${p.categoria}">
      ${p.item}. ${p.penalidad_nombre} (${tag})
    </option>`;
    }).join('');
}

async function obtenerUIT() {
    const tables = TABLES_AVAILABLE || await fetchSupabaseTables();
    if (tables && !tables.v_uit_actual) return null;
    const { data, error } = await supabase.from('v_uit_actual').select('valor').single();
    if (error || !data) return null;
    return Number(data.valor);
}

// =================== TYPEAHEAD UI ===================

function setupTypeahead() {
    const input = $('agenteSearch');
    const dd = $('taDropdown');
    const list = $('taList');
    const addBtn = $('taAddBtn');

    // helpers
    const openDD = () => { dd.classList.remove('hidden'); taOpen = true; };
    const closeDD = () => { dd.classList.add('hidden'); taOpen = false; taActiveIndex = -1; };
    const clearChoice = () => { $('agenteId').value = ''; input.dataset.manual = '0'; };

    const renderList = (items, query) => {
        taCurrentItems = items;
        list.innerHTML = '';

        if (!items.length) {
            list.innerHTML = `<div class="ta-empty">Sin resultados para “${escapeHTML(query)}”.</div>`;
            return;
        }

        list.innerHTML = items.map((a, idx) => {
            const label = escapeHTML(a.nombre);
            const dni = a.dni ? `<span class="dni">${escapeHTML(a.dni)}</span>` : '';
            return `<div class="ta-item" role="option" data-idx="${idx}" tabindex="-1">${label}${dni}</div>`;
        }).join('');

        // wire click
        Array.from(list.querySelectorAll('.ta-item')).forEach(el => {
            el.addEventListener('click', () => {
                const i = Number(el.getAttribute('data-idx'));
                pickItem(i);
            });
        });
    };

    const pickItem = (i) => {
        const item = taCurrentItems[i];
        if (!item) return;
        input.value = item.nombre;
        $('agenteId').value = item.id;
        input.dataset.manual = '0';
        closeDD();
    };

    const doSearch = async () => {
        const q = input.value.trim().toLowerCase();
        clearChoice();

        const empresaId = $('empresa').value;
        if (!empresaId) { closeDD(); return; }

        if (q.length < 2) { closeDD(); return; }

        // asegura cache
        await cargarAgentes(empresaId);
        const src = AGENTS_CACHE.get(empresaId) || [];

        // filtra por nombre o dni
        const matches = src.filter(a => {
            const n = (a.nombre || '').toLowerCase();
            const d = (a.dni || '').toLowerCase();
            return n.includes(q) || d.includes(q);
        }).slice(0, 50);

        renderList(matches, q);
        openDD();
    };

    // eventos
    input.addEventListener('input', debounce(doSearch, 180));
    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) doSearch();
    });

    // Teclado ↑/↓/Enter/Escape
    input.addEventListener('keydown', (e) => {
        if (!taOpen) return;

        const max = taCurrentItems.length - 1;
        if (['ArrowDown', 'ArrowUp'].includes(e.key)) e.preventDefault();

        if (e.key === 'ArrowDown') {
            taActiveIndex = Math.min(max, taActiveIndex + 1);
            updateActiveItem();
        } else if (e.key === 'ArrowUp') {
            taActiveIndex = Math.max(0, taActiveIndex - 1);
            updateActiveItem();
        } else if (e.key === 'Enter') {
            if (taActiveIndex >= 0) {
                e.preventDefault();
                pickItem(taActiveIndex);
            }
        } else if (e.key === 'Escape') {
            closeDD();
        }
    });

    function updateActiveItem() {
        const items = list.querySelectorAll('.ta-item');
        items.forEach((el, idx) => {
            el.classList.toggle('active', idx === taActiveIndex);
            if (idx === taActiveIndex) {
                el.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    // Click fuera cierra
    document.addEventListener('click', (e) => {
        const ta = $('agenteTA');
        if (!ta.contains(e.target)) closeDD();
    });

    // Agregar nuevo (manual)
    addBtn.addEventListener('click', () => {
        const name = input.value.trim();
        if (!name) {
            notify('warn', 'Agente', 'Escribe un nombre para agregar.');
            return;
        }
        $('agenteId').value = '';         // sin id => manual
        input.dataset.manual = '1';       // marcador manual
        input.value = name;               // tal cual lo escribió
        closeDD();
        notify('info', 'Agente manual', 'Se usará el nombre ingresado tal cual.');
    });

    // Si cambian la empresa, limpiamos selección
    $('empresa').addEventListener('change', () => {
        input.value = '';
        clearChoice();
        closeDD();
    });
}

function onEmpresaChange(e) {
    // precarga cache para UX ágil (no bloqueante)
    const empresaId = e.target.value;
    if (empresaId) cargarAgentes(empresaId).catch(console.error);
}

async function recalcularMontoPreview() {
    const opt = $('penalidad').selectedOptions[0];
    if (!opt) { $('monto').value = ''; return; }
    const valor = Number(opt.getAttribute('data-valor'));
    const uit = await obtenerUIT();
    if (!uit) { $('monto').value = ''; return; }
    $('monto').value = (Math.round(uit * valor * 100) / 100).toFixed(2);
}

function getFilters() {
    const empresaId = $('fEmpresa').value || null;
    const local = $('fLocal').value || null;
    const desde = $('fDesde').value ? new Date($('fDesde').value) : null;
    const hasta = $('fHasta').value ? new Date($('fHasta').value) : null;
    const search = ($('q').value || '').trim();
    const timeMin = desde ? new Date(Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate(), 0, 0, 0)).toISOString() : null;
    const timeMax = hasta ? new Date(Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), 23, 59, 59)).toISOString() : null;
    return { empresaId, local, timeMin, timeMax, search };
}

function buildRange() {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize - 1;
    return { start, end };
}

function buildListadoSelect() {
    const fields = [
        'id',
        'fecha',
        'local',
        'monto_calculado',
        'observaciones',
        'agente_nombre_manual',
        'agente_id',
        'empresa_id',
        'penalidad_id'
    ];
    if (TABLES_AVAILABLE?.empresas) fields.push('empresas (nombre)');
    if (TABLES_AVAILABLE?.agentes_seguridad) fields.push('agentes_seguridad (nombre, dni)');
    if (TABLES_AVAILABLE?.penalidades_catalogo) fields.push('penalidades_catalogo (item, categoria, penalidad_nombre)');
    if (TABLES_AVAILABLE?.penalidades_evidencias) fields.push('penalidades_evidencias (url)');
    return fields.join(',\n      ');
}

// =================== CRUD LIST & RENDER ===================

async function listar() {
    const tables = TABLES_AVAILABLE || await fetchSupabaseTables();
    if (tables && !tables.penalidades_aplicadas) {
        disablePenalidadesUI(['penalidades_aplicadas']);
        return;
    }
    const { empresaId, local, timeMin, timeMax, search } = getFilters();
    const { start, end } = buildRange();

    // Cuando hay texto de búsqueda, filtramos en cliente para evitar problemas de filtros sobre relaciones
    const useClientFilter = !!search;
    const selectFields = buildListadoSelect();

    // ---- Consulta base
    let q = supabase.from('penalidades_aplicadas')
        .select(selectFields)
        .order('fecha', { ascending: false });

    if (empresaId) q = q.eq('empresa_id', empresaId);
    if (local) q = q.eq('local', local);
    if (timeMin) q = q.gte('fecha', timeMin);
    if (timeMax) q = q.lte('fecha', timeMax);

    if (useClientFilter) {
        // Traemos "muchos" y filtramos en cliente
        q = q.limit(1000);
    } else {
        // Paginación server-side normal
        q = q.range(start, end);
    }

    let { data, error } = await q;
    if (error) { console.error(error); return; }

    // Fallback por nombre (sinónimos) si filtraste por empresa y no hubo data
    if ((data || []).length === 0 && empresaId && TABLES_AVAILABLE?.empresas) {
        // Quitamos el filtro estricto por empresa_id y reintentamos por nombre de empresa usando sinónimos
        const synonyms = getEmpresaSynonymsBySelected('fEmpresa');
        if (synonyms.length > 0) {
            const orExpr = buildOrEq('empresas.nombre', synonyms);
            let q2 = supabase.from('penalidades_aplicadas')
                .select(selectFields)
                .order('fecha', { ascending: false })
                .or(orExpr); // match por nombre de empresa

            if (local) q2 = q2.eq('local', local);
            if (timeMin) q2 = q2.gte('fecha', timeMin);
            if (timeMax) q2 = q2.lte('fecha', timeMax);
            if (useClientFilter) q2 = q2.limit(1000); else q2 = q2.range(start, end);

            const res2 = await q2;
            if (!res2.error) data = res2.data || [];
        }
    }

    let rows = data || [];

    if (useClientFilter) {
        const term = search.toLowerCase();
        rows = rows.filter(r => {
            const n1 = (TABLES_AVAILABLE?.agentes_seguridad ? (r.agentes_seguridad?.nombre || '') : '').toLowerCase();
            const n2 = (r.agente_nombre_manual || '').toLowerCase();
            const obs = (r.observaciones || '').toLowerCase();
            const loc = (r.local || '').toLowerCase();
            const emp = (TABLES_AVAILABLE?.empresas ? (r.empresas?.nombre || '') : (r.empresa_id || '')).toLowerCase();
            return n1.includes(term) || n2.includes(term) || obs.includes(term) || loc.includes(term) || emp.includes(term);
        });
        lastFilteredTotal = rows.length;

        // Paginar en cliente
        const s = (currentPage - 1) * pageSize;
        const e = s + pageSize;
        const pageSlice = rows.slice(s, e);
        renderTabla(pageSlice);
        // Botones prev/next según total filtrado
        const reachedEnd = e >= lastFilteredTotal;
        updatePaginatorInfo(pageSlice.length, lastFilteredTotal, reachedEnd);
        return;
    }

    // Modo normal (sin búsqueda): render directo + paginator basado en pageSize
    renderTabla(rows);
    updatePaginatorInfo(rows.length);
}

function badge(cat) {
    return `<span class="badge"><span class="dot"></span>${escapeHTML(cat || '')}</span>`;
}

function renderTabla(rows) {
    const tbody = $('tablaPenalidades').querySelector('tbody');
    const empty = $('emptyState');

    if (rows.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        renderSummary([]); // limpia resumen
        return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = rows.map(r => {
        const empresa = (TABLES_AVAILABLE?.empresas ? r.empresas?.nombre : null) || r.empresa_id || '';
        const agente = (TABLES_AVAILABLE?.agentes_seguridad ? r.agentes_seguridad?.nombre : null) || r.agente_nombre_manual || '(sin nombre)';
        const pen = r.penalidades_catalogo
            ? `${r.penalidades_catalogo.item}. ${r.penalidades_catalogo.penalidad_nombre}`
            : (r.penalidad_id ? `ID ${r.penalidad_id}` : '');
        const cat = r.penalidades_catalogo?.categoria || '';
        const evids = Array.isArray(r.penalidades_evidencias) ? r.penalidades_evidencias.length : 0;

        return `<tr class="added" data-id="${r.id}">
      <td>${new Date(r.fecha).toLocaleString('es-PE')}</td>
      <td>${empresa}</td>
      <td>${r.local || ''}</td>
      <td>${escapeHTML(agente)}</td>
      <td>${badge(cat)}&nbsp;${escapeHTML(pen)}</td>
      <td style="text-align:right;">${Number(r.monto_calculado || 0).toFixed(2)}</td>
      <td style="text-align:center;">
        <button class="eye-badge" data-eye="${r.id}" title="Ver evidencias">
          ${iconEye()}
          <span class="eye-count">${evids}</span>
        </button>
      </td>
      <td class="actions">
        <button class="icon-btn edit" title="Editar">${iconEdit()}</button>
        <button class="icon-btn del"  title="Eliminar">${iconTrash()}</button>
      </td>
    </tr>`;
    }).join('');

    renderSummary(rows);
}

function iconEye() { return `<svg class="icon-eye"  width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>`; }
function iconEdit() { return `<svg class="icon-edit" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke="currentColor"/><path d="M20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" stroke="currentColor"/></svg>`; }
function iconTrash() { return `<svg class="icon-del"  width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 6h18" stroke="currentColor"/><path d="M8 6V4h8v2" stroke="currentColor"/><path d="M6 6l1 14h10l1-14" stroke="currentColor"/></svg>`; }

function updatePaginatorInfo(returned, total = null, reachedEnd = null) {
    if (total !== null) {
        // Paginación cliente
        lastPageHadLess = reachedEnd === true || (currentPage * pageSize >= total);
    } else {
        // Paginación server
        lastPageHadLess = returned < pageSize;
    }
    $('pageInfo').textContent = `Página ${currentPage}`;
    $('btnPrev').disabled = currentPage === 1;
    $('btnNext').disabled = lastPageHadLess;
}

function renderSummary(rows) {
    const bar = $('summaryBar');
    const sumEl = $('sumMontos');
    const catEl = $('catBadges');

    if (!rows || rows.length === 0) {
        bar.classList.add('hidden');
        sumEl.textContent = 'S/ 0.00';
        catEl.innerHTML = '';
        return;
    }

    // Suma filtrada (de esta página)
    const total = rows.reduce((acc, r) => acc + (Number(r.monto_calculado) || 0), 0);
    sumEl.textContent = 'S/ ' + total.toFixed(2);

    // Totales por categoría (de esta página)
    const map = new Map();
    rows.forEach(r => {
        const cat = r.penalidades_catalogo?.categoria || 'Sin categoria';
        const v = Number(r.monto_calculado) || 0;
        map.set(cat, (map.get(cat) || 0) + v);
    });

    catEl.innerHTML = Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cat, val]) => `<span class="badge"><span class="dot"></span>${escapeHTML(cat)}: S/ ${val.toFixed(2)}</span>`)
        .join('');

    bar.classList.remove('hidden');
}

// =================== FORM / UPLOAD ===================

function escapeHTML(v) { return (v ?? '').toString().replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s])); }

function resetForm() {
    $('formPenalidad').reset();
    // limpia typeahead
    $('agenteSearch').value = '';
    $('agenteId').value = '';
    $('agenteSearch').dataset.manual = '0';

    $('btnGuardar').textContent = 'Aplicar penalidad';
    $('btnCancelar').classList.add('hidden');
    $('editId').value = '';
    $('monto').value = '';
    $('previewList').innerHTML = '';
}

function setupUploader() {
    const up = $('uploader');
    const input = $('evidencias');
    const preview = $('previewList');

    const openPicker = () => input.click();

    up.addEventListener('click', openPicker);
    up.addEventListener('dragover', (e) => { e.preventDefault(); up.classList.add('drag'); });
    up.addEventListener('dragleave', () => up.classList.remove('drag'));
    up.addEventListener('drop', (e) => {
        e.preventDefault();
        up.classList.remove('drag');
        if (e.dataTransfer?.files?.length) {
            input.files = e.dataTransfer.files;
            renderPreviews(input.files, preview);
        }
    });

    input.addEventListener('change', () => renderPreviews(input.files, preview));
}

function renderPreviews(fileList, container) {
    container.innerHTML = '';
    const files = Array.from(fileList || []);
    files.slice(0, 5).forEach(f => {
        const url = URL.createObjectURL(f);
        const el = document.createElement('div');
        el.className = 'preview-thumb';
        el.innerHTML = `<img src="${url}" alt="${escapeHTML(f.name)}" />`;
        container.appendChild(el);
    });
}

async function subirEvidencias(penalidadAplicadaId) {
    const tables = TABLES_AVAILABLE || await fetchSupabaseTables();
    if (tables && !tables.penalidades_evidencias) return;
    const files = $('evidencias').files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < Math.min(files.length, 5); i++) {
        const f = files[i];
        const path = `${penalidadAplicadaId}/${Date.now()}_${i}_${f.name}`;
        const { error } = await supabase.storage.from('penalidades').upload(path, f);
        if (error) { console.error('Upload error', error); continue; }
        const { data: pub } = supabase.storage.from('penalidades').getPublicUrl(path);
        const url = pub?.publicUrl;
        if (url) {
            await supabase.from('penalidades_evidencias').insert([{ penalidad_aplicada_id: penalidadAplicadaId, url }]);
        }
    }
}

// =================== SUBMIT / EDIT / DELETE ===================

async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    submitting = true;

    try {
        const tables = TABLES_AVAILABLE || await fetchSupabaseTables();
        if (tables && !tables.penalidades_aplicadas) {
            notify('error', 'Error', 'La tabla penalidades_aplicadas no esta disponible.');
            return;
        }
        const editId = $('editId').value || null;

        const empresa_id = $('empresa').value;
        const local = $('local').value;
        const penalidad_id = $('penalidad').value;
        const fechaStr = $('fecha').value;
        const observaciones = $('observaciones').value || null;

        const agente_id = $('agenteId').value || null;
        const inputNombre = ($('agenteSearch').value || '').trim();
        const isManual = (!agente_id && !!inputNombre);
        const agente_nombre_manual = isManual ? inputNombre : null;

        if (!empresa_id || !local || !penalidad_id || (!agente_id && !agente_nombre_manual)) {
            notify('warn', 'Campos incompletos', 'Completa Empresa, Local, Penalidad y Agente (o escribe uno nuevo).');
            return;
        }

        const payload = {
            empresa_id, local, penalidad_id, observaciones,
            fecha: fechaStr ? new Date(fechaStr).toISOString() : new Date().toISOString(),
            agente_id, agente_nombre_manual
        };

        if (!editId) {
            const { data, error } = await supabase
                .from('penalidades_aplicadas')
                .insert([payload])
                .select('id')
                .single();
            if (error || !data) { console.error(error); notify('error', 'Error', 'No se pudo aplicar la penalidad.'); return; }
            await subirEvidencias(data.id);
            resetForm();
            await listar();
            notify('success', 'Registrado', 'La penalidad se registró correctamente.');
        } else {
            const { error } = await supabase
                .from('penalidades_aplicadas')
                .update(payload)
                .eq('id', editId);
            if (error) { console.error(error); notify('error', 'Error', 'No se pudo actualizar.'); return; }
            await subirEvidencias(editId);
            resetForm();
            await listar();
            notify('success', 'Actualizado', 'La penalidad se actualizó correctamente.');
        }
    } finally {
        submitting = false;
    }
}

function onTableClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tr = e.target.closest('tr');
    const id = tr?.getAttribute('data-id');
    if (!id) return;

    if (btn.classList.contains('eye-badge') || btn.hasAttribute('data-eye')) {
        // Evita enfoque/selección rara del header al abrir galería
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        if (window.getSelection) {
            const sel = window.getSelection();
            if (sel && sel.removeAllRanges) sel.removeAllRanges();
        }
        openGallery(id);
    } else if (btn.classList.contains('edit')) {
        editarFila(id);
    } else if (btn.classList.contains('del')) {
        deleteId = id;
        openDeleteModal();
    }
}

async function editarFila(id) {
    const { data, error } = await supabase
        .from('penalidades_aplicadas')
        .select('id, empresa_id, local, agente_id, agente_nombre_manual, penalidad_id, observaciones, fecha')
        .eq('id', id)
        .single();
    if (error || !data) { console.error(error); notify('error', 'Error', 'No se pudo cargar el registro.'); return; }

    $('editId').value = data.id;
    $('empresa').value = data.empresa_id;

    // Precarga cache para el typeahead y setea el nombre
    if (data.empresa_id) {
        await cargarAgentes(data.empresa_id);
        const list = AGENTS_CACHE.get(data.empresa_id) || [];
        if (data.agente_id) {
            const f = list.find(a => a.id === data.agente_id);
            if (f) {
                $('agenteSearch').value = f.nombre;
                $('agenteId').value = f.id;
                $('agenteSearch').dataset.manual = '0';
            } else {
                $('agenteSearch').value = '';
                $('agenteId').value = data.agente_id;
                $('agenteSearch').dataset.manual = '0';
            }
        } else {
            $('agenteSearch').value = data.agente_nombre_manual || '';
            $('agenteId').value = '';
            $('agenteSearch').dataset.manual = data.agente_nombre_manual ? '1' : '0';
        }
    }

    $('local').value = data.local || '';
    $('penalidad').value = data.penalidad_id;
    await recalcularMontoPreview();
    $('observaciones').value = data.observaciones || '';
    $('fecha').value = data.fecha ? new Date(data.fecha).toISOString().slice(0, 10) : '';

    $('btnGuardar').textContent = 'Actualizar';
    $('btnCancelar').classList.remove('hidden');
    notify('info', 'Edición', 'Estás editando un registro.');
}

// ==== Modal eliminar ====
function openDeleteModal() {
    bringToFront($('modalDelete'));
    $('modalDelete').classList.remove('hidden');
    lockScroll();
}
function closeDeleteModal() {
    $('modalDelete').classList.add('hidden');
    deleteId = null;
    unlockScroll();
}

async function onConfirmDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from('penalidades_aplicadas').delete().eq('id', deleteId);
    if (error) { console.error(error); notify('error', 'Error', 'No se pudo eliminar.'); return; }
    closeDeleteModal();
    await listar();
    notify('success', 'Eliminado', 'El registro fue eliminado.');
}

// ==== Galería evidencias + LIGHTBOX ====

async function openGallery(penalidadId) {
    const tables = TABLES_AVAILABLE || await fetchSupabaseTables();
    if (tables && !tables.penalidades_evidencias) {
        notify('warn', 'Evidencias', 'La tabla de evidencias no esta disponible.');
        return;
    }
    const { data, error } = await supabase
        .from('penalidades_evidencias')
        .select('url')
        .eq('penalidad_aplicada_id', penalidadId)
        .order('subido_en', { ascending: false });
    if (error) { console.error(error); notify('error', 'Error', 'No se pudieron cargar las evidencias.'); return; }

    const grid = $('galleryGrid');
    const rows = data || [];
    if (!rows.length) {
        grid.innerHTML = `<div class="muted" style="padding:10px;">No hay evidencias para este registro.</div>`;
    } else {
        grid.innerHTML = rows.map((r, idx) => (
            `<button class="thumb" data-src="${r.url}" aria-label="Ver evidencia ${idx + 1}">
        <img src="${r.url}" alt="evidencia" />
      </button>`
        )).join('');
    }

    // Listeners para abrir lightbox
    grid.querySelectorAll('.thumb').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation(); // evita burbujeo indeseado
            const src = btn.getAttribute('data-src');
            openLightbox(src);
        });
    });

    // Forzar superposición por encima de sticky header y bloquear scroll de fondo
    bringToFront($('modalGallery'));
    $('modalGallery').classList.remove('hidden');
    lockScroll();
}

function closeGalleryModal() {
    $('modalGallery').classList.add('hidden');
    closeLightbox(true);
    unlockScroll();
}

function openLightbox(src) {
    // Asegurar que el lightbox también quede por encima
    bringToFront($('lightbox'), 11000);
    $('lightboxImg').src = src;
    $('lightbox').classList.remove('hidden');
}

function closeLightbox(onlyHide) {
    $('lightbox').classList.add('hidden');
    if (!onlyHide) $('lightboxImg').src = '';
}

// =================== NOTIFY MODAL ===================

let notifyTimer = null;

function notify(type = 'info', title = 'Info', msg = '') {
    const modal = $('notifyModal');
    const icon = $('notifyIcon');
    const ttl = $('notifyTitle');
    const txt = $('notifyMsg');

    // Icono por tipo
    const map = {
        success: '✅',
        error: '❌',
        warn: '⚠️',
        info: 'ℹ️'
    };
    icon.textContent = map[type] || 'ℹ️';
    ttl.textContent = title;
    txt.textContent = msg || '';

    // Elevar y bloquear scroll por si aparece sobre contenido sticky
    bringToFront(modal, 12000);

    // Reset animación
    modal.classList.add('hidden');
    void modal.offsetWidth; // reflow
    modal.classList.remove('hidden');
    modal.classList.add('show'); // clase animada (defínela en CSS)

    // Autocierre
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => hideNotify(), 2800);
}

function hideNotify() {
    const modal = $('notifyModal');
    modal.classList.remove('show');
    modal.classList.add('hidden');
}
// =================== FIN ===================
