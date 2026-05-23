const API_BASE = 'https://hasselecto.onrender.com/api';
 
const App = {
  usuario:     null,
  areaId:      1,
  areaNombre:  'Invernadero TecNM',
  tipoCultivo: 'Aguacate',
};
 
document.addEventListener('DOMContentLoaded', () => {
  const guardado = sessionStorage.getItem('usuario');
  if (guardado) {
    App.usuario = JSON.parse(guardado);
    mostrarApp();
  }
  const inp = document.getElementById('login-input');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
});
 
// ── Login ────────────────────────────────────────────────────
async function doLogin() {
  const input  = document.getElementById('login-input');
  const nombre = input?.value.trim() || '';
  if (!nombre) { if (input) input.style.borderColor = '#e74c3c'; return; }
 
  const btn = document.querySelector('.login-btn');
  if (btn) btn.textContent = 'Ingresando...';
 
  const iniciales = nombre.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
 
  try {
    const res = await apiPost('/usuarios', { nombre });
    App.usuario = { usuarioId: res.usuarioId, nombre: res.nombre, iniciales };
  } catch {
    App.usuario = { usuarioId: null, nombre, iniciales };
  }
 
  sessionStorage.setItem('usuario', JSON.stringify(App.usuario));
  await cargarAreaPorDefecto();
  mostrarApp();
  if (btn) btn.textContent = 'Ingresar al sistema';
}
 
async function cargarAreaPorDefecto() {
  try {
    const areas = await apiGet('/areas');
    if (areas.length > 0) {
      App.areaId      = areas[0].areaId;
      App.areaNombre  = areas[0].nombre;
      App.tipoCultivo = areas[0].tipoCultivo;
    }
  } catch { /* usa valores por defecto */ }
}
 
// ── Mostrar app ──────────────────────────────────────────────
function mostrarApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display     = 'flex';
  document.getElementById('user-avatar').textContent    = App.usuario.iniciales;
  document.getElementById('user-name').textContent      = App.usuario.nombre;
  document.getElementById('topbar-area').textContent    = `${App.areaNombre} · ${App.tipoCultivo}`;
 
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const dashboard = document.getElementById('page-dashboard');
  if (dashboard) dashboard.style.display = 'block';
 
  initDashboard();
  initHistorico();
  initAsistente();
  initCarga();
 
  // FIX: botón "Nuevo diagnóstico" del dashboard usando addEventListener
  // evita problemas con comillas en onclick dentro del HTML
  const btnNuevoDiag = document.getElementById('btn-nuevo-diag-dash');
  if (btnNuevoDiag) {
    btnNuevoDiag.addEventListener('click', () => {
      goTo('asistente', document.querySelector('[data-page="asistente"]'));
    });
  }
}
 
// ── Navegación ───────────────────────────────────────────────
const PAGES = {
  dashboard:    { title: 'Dashboard',              action: 'Exportar CSV' },
  carga:        { title: 'Cargar CSV / Excel',     action: '' },
  historico:    { title: 'Histórico de datos',     action: 'Exportar CSV' },
  asistente:    { title: 'Asistente de síntomas',  action: '' },
  diagnosticos: { title: 'Historial diagnósticos', action: 'Nuevo diagnóstico' },
  area:         { title: 'Área de estudio',        action: '' },
};
 
function goTo(pageId, navEl) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
 
  const page = document.getElementById('page-' + pageId);
  if (page) page.style.display = 'block';
  if (navEl) navEl.classList.add('active');
 
  const cfg = PAGES[pageId] || {};
  document.getElementById('topbar-title').textContent = cfg.title || '';
 
  const btn = document.getElementById('topbar-action');
  if (btn) {
    btn.textContent   = cfg.action || '';
    btn.style.display = cfg.action ? 'inline-block' : 'none';
    btn.onclick = pageId === 'diagnosticos'
      ? () => goTo('asistente', document.querySelector('[data-page="asistente"]'))
      : exportarCSV;
  }
 
  if (pageId === 'diagnosticos') cargarDiagnosticos();
  if (pageId === 'area')         cargarDatosArea();
  if (pageId === 'carga')        cargarHistorialCargas();
}
 
// ── Exportar CSV ─────────────────────────────────────────────
async function exportarCSV() {
  const desde = document.getElementById('f-desde')?.value || fechaOffset(-365);
  const hasta  = document.getElementById('f-hasta')?.value  || fechaOffset(0);
  try {
    const res = await fetch(`${API_BASE}/exportar-csv?areaId=${App.areaId}&desde=${desde}&hasta=${hasta}`);
    if (!res.ok) throw new Error();
    descargarBlob(await res.blob(), `lecturas_${desde}_${hasta}.csv`);
  } catch {
    alert('Conecta el backend para exportar datos reales.');
  }
}
 
// ── Generar reporte PDF con observaciones ────────────────────
async function generarReportePDF() {
  const desde = document.getElementById('f-desde')?.value || fechaOffset(-365);
  const hasta  = document.getElementById('f-hasta')?.value  || fechaOffset(0);
 
  // Leer observaciones del campo de texto
  const observaciones = document.getElementById('obs-reporte')?.value?.trim() || '';
 
  const btn = document.getElementById('btn-reporte-pdf');
  if (btn) { btn.textContent = 'Generando...'; btn.disabled = true; }
 
  try {
    const params = new URLSearchParams({
      areaId:        App.areaId,
      areaNombre:    App.areaNombre,
      cultivo:       App.tipoCultivo,
      desde,
      hasta,
      usuario:       App.usuario?.nombre || 'Sistema',
      observaciones,
    });
    const res = await fetch(`${API_BASE}/reporte-pdf?${params}`);
    if (!res.ok) throw new Error('Error al generar PDF');
    descargarBlob(await res.blob(), `reporte_${desde}_${hasta}.pdf`);
  } catch {
    alert('Error al generar el PDF. Verifica que el backend esté corriendo.');
  } finally {
    if (btn) { btn.textContent = 'Generar reporte PDF'; btn.disabled = false; }
  }
}
 
// ── Diagnósticos ─────────────────────────────────────────────
async function cargarDiagnosticos() {
  const tbody = document.getElementById('diag-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#5a6b5b;padding:16px;">Cargando...</td></tr>';
  try {
    const data = await apiGet(`/diagnosticos?areaId=${App.areaId}`);
    tbody.innerHTML = '';
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#5a6b5b;padding:16px;">Sin diagnósticos registrados aún.</td></tr>';
      return;
    }
    data.forEach(d => {
      const badge = d.sinAmenaza
        ? '<span class="badge badge-ok">Sin amenaza</span>'
        : `<span class="badge badge-danger">${d.resultado}</span>`;
      const dataAttr = encodeURIComponent(JSON.stringify(d));
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${d.fechaHora.slice(0,10)}</td>
          <td>${d.usuario}</td>
          <td>${d.cultivoEvaluado}</td>
          <td>${badge}</td>
          <td><button class="btn" style="font-size:11px;padding:3px 10px;"
            onclick="verDiagnostico('${dataAttr}')">Ver</button></td>
        </tr>`);
    });
  } catch {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#c0392b;padding:16px;">No se pudo conectar al servidor.</td></tr>';
  }
}
 
// ── Área de estudio ──────────────────────────────────────────
async function cargarDatosArea() {
  try {
    const a = await apiGet(`/areas/${App.areaId}`);
    document.getElementById('area-nombre').value  = a.nombre        || '';
    document.getElementById('area-cultivo').value = a.tipoCultivo   || 'Aguacate';
    document.getElementById('area-m2').value      = a.dimensionesM2 || '';
    document.getElementById('area-fecha').value   = (a.fechaInicioMonitoreo || '').slice(0,10);
    document.getElementById('area-desc').value    = a.descripcion   || '';
  } catch { /* mantiene los valores actuales */ }
}
 
async function guardarArea() {
  const msg  = document.getElementById('area-msg');
  const data = {
    nombre:               document.getElementById('area-nombre').value,
    tipoCultivo:          document.getElementById('area-cultivo').value,
    dimensionesM2:        parseFloat(document.getElementById('area-m2').value) || null,
    fechaInicioMonitoreo: document.getElementById('area-fecha').value,
    descripcion:          document.getElementById('area-desc').value,
  };
  try {
    await apiPut(`/areas/${App.areaId}`, data);
    App.areaNombre  = data.nombre;
    App.tipoCultivo = data.tipoCultivo;
    document.getElementById('topbar-area').textContent = `${App.areaNombre} · ${App.tipoCultivo}`;
    mostrarMsg(msg, 'Cambios guardados correctamente.', 'ok');
  } catch (e) {
    mostrarMsg(msg, `Error: ${e.message}`, 'error');
  }
}
 
// ── Helpers API ──────────────────────────────────────────────
async function apiGet(endpoint) {
  const res = await fetch(API_BASE + endpoint);
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}
async function apiPost(endpoint, body) {
  const res = await fetch(API_BASE + endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}
async function apiPut(endpoint, body) {
  const res = await fetch(API_BASE + endpoint, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}
 
// ── Utilidades ───────────────────────────────────────────────
function fechaOffset(dias) {
  const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0,10);
}
function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function mostrarMsg(el, texto, tipo) {
  if (!el) return;
  el.className   = `alert alert-${tipo === 'ok' ? 'ok' : 'error'}`;
  el.textContent = texto;
  setTimeout(() => { el.textContent = ''; el.className = ''; }, 3500);
}
function generarDatosDemo(n = 15) {
  const base = new Date('2025-03-01');
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base); d.setDate(d.getDate() + Math.floor(i * 28 / n));
    return {
      fechaHora:     d.toISOString().slice(0,16).replace('T',' '),
      humedad:       +((65 + Math.random()*10).toFixed(1)),
      temperatura:   +((21 + Math.random()*6).toFixed(1)),
      pH:            +((6.4 + Math.random()*0.9).toFixed(2)),
      conductividad: Math.round(950 + Math.random()*350),
      salinidad:     +((0.6 + Math.random()*0.5).toFixed(2)),
      nitrogeno:     Math.round(25 + Math.random()*16),
      fosforo:       Math.round(12 + Math.random()*12),
      potasio:       Math.round(128 + Math.random()*34),
    };
  });
}
 
