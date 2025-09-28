// Dependencias cargadas en el HTML:
// - Supabase (usa credenciales de config.js + supabaseClient.js)
// - SheetJS (XLSX)

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
    await cargarEmpresas();
    $('btnPreview').addEventListener('click', onPreview);
    $('btnExport').addEventListener('click', onExportXLSX);
    // $('btnCSV').addEventListener('click', onExportCSV);
});

async function cargarEmpresas() {
    const sel = $('empresa');
    const { data, error } = await supabase.from('empresas').select('id,nombre').order('nombre');
    if (error) { console.error(error); return; }
    sel.innerHTML = '<option value="">Todas</option>' + (data || []).map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
}

function getFilters() {
    const empresaId = $('empresa').value || null;
    const desde = $('desde').value ? new Date($('desde').value) : null;
    const hasta = $('hasta').value ? new Date($('hasta').value) : null;

    // Normaliza a ISO (hasta fin de día)
    const timeMin = desde ? new Date(Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate(), 0, 0, 0)).toISOString() : null;
    const timeMax = hasta ? new Date(Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), 23, 59, 59)).toISOString() : null;

    return { empresaId, timeMin, timeMax };
}

// Consulta base: une tablas para traer todo lo necesario
async function fetchPenalidades(limit = null) {
    const { empresaId, timeMin, timeMax } = getFilters();

    let query = supabase
        .from('penalidades_aplicadas')
        .select(`
      id,
      fecha,
      observaciones,
      monto_calculado,
      empresas (nombre),
      agentes_seguridad (nombre, dni),
      penalidades_catalogo (item, penalidad_nombre),
      penalidades_evidencias (url)
    `)
        .order('fecha', { ascending: false });

    if (empresaId) query = query.eq('empresa_id', empresaId);
    if (timeMin) query = query.gte('fecha', timeMin);
    if (timeMax) query = query.lte('fecha', timeMax);
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) { console.error(error); return []; }
    return data || [];
}

function toPreviewRows(rows) {
    return rows.map(r => {
        const empresa = r.empresas?.nombre || '';
        const agenteNombre = r.agentes_seguridad?.nombre || '(manual)';
        const agenteDNI = r.agentes_seguridad?.dni || '';
        const pen = r.penalidades_catalogo
            ? `${r.penalidades_catalogo.item}. ${r.penalidades_catalogo.penalidad_nombre}`
            : '';
        const evids = (r.penalidades_evidencias || []).map(ev => ev.url).join('\n');

        return {
            Fecha: new Date(r.fecha).toLocaleString('es-PE'),
            Empresa: empresa,
            Agente: agenteNombre,
            DNI: agenteDNI,
            Penalidad: pen,
            'Monto (S/.)': Number(r.monto_calculado || 0).toFixed(2),
            Observaciones: r.observaciones || '',
            'Evidencias (URLs)': evids
        };
    });
}

function renderPreview(rows) {
    const tbody = document.querySelector('#tablaPreview tbody');
    tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${esc(r['Fecha'])}</td>
      <td>${esc(r['Empresa'])}</td>
      <td>${esc(r['Agente'])}</td>
      <td>${esc(r['DNI'])}</td>
      <td>${multiLine(esc(r['Penalidad']))}</td>
      <td style="text-align:right;">${esc(r['Monto (S/.)'])}</td>
      <td>${multiLine(esc(r['Observaciones']))}</td>
      <td>${linkify(r['Evidencias (URLs)'])}</td>
    </tr>
  `).join('');
}

function esc(v) { return (v ?? '').toString().replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s])); }
function multiLine(v) { return (v || '').replace(/\n/g, '<br>'); }
function linkify(text) {
    const t = (text || '').split('\n').filter(Boolean);
    if (t.length === 0) return '';
    return t.map(u => `<a href="${esc(u)}" target="_blank">evidencia</a>`).join(' | ');
}

async function onPreview() {
    const data = await fetchPenalidades(100); // preview máx. 100
    const rows = toPreviewRows(data);
    renderPreview(rows);
}

// ============== EXPORTS ==============

function autoFitWidths(wsData) {
    // calcula width por columna según longitud del contenido
    const colWidths = [];
    wsData.forEach(row => {
        Object.values(row).forEach((val, idx) => {
            const len = (val ? val.toString() : '').length;
            colWidths[idx] = Math.max(colWidths[idx] || 10, Math.min(len + 2, 60)); // límite razonable
        });
    });
    return colWidths.map(w => ({ wch: w }));
}

async function onExportXLSX() {
    const data = await fetchPenalidades(); // sin límite
    const rows = toPreviewRows(data);

    if (rows.length === 0) {
        alert('No hay datos para exportar con los filtros seleccionados.');
        return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = autoFitWidths(rows);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Penalidades');

    const { empresaId, timeMin, timeMax } = getFilters();
    const sufEmp = empresaId ? '_empresa' : '';
    const sufDesde = timeMin ? `_desde_${timeMin.slice(0, 10)}` : '';
    const sufHasta = timeMax ? `_hasta_${timeMax.slice(0, 10)}` : '';
    const filename = `penalidades${sufEmp}${sufDesde}${sufHasta}.xlsx`;

    XLSX.writeFile(wb, filename);
}

/* Si quisieras CSV:
async function onExportCSV() {
  const data = await fetchPenalidades();
  const rows = toPreviewRows(data);
  if (rows.length === 0) { alert('No hay datos.'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ',', RS: '\n' });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'penalidades.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
*/
