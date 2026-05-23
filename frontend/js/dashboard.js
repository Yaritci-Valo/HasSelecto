/* ============================================================
   dashboard.js — RF4 Dashboard
   FIX: rango de 2 años atrás para capturar cualquier dato
   ============================================================ */

const DASH_VARS = [
  { name: 'Humedad',       unit: '%',     color: '#8CB79B', key: 'humedad' },
  { name: 'Temperatura',   unit: '°C',    color: '#235347', key: 'temperatura' },
  { name: 'pH',            unit: '',      color: '#173831', key: 'pH' },
  { name: 'Conductividad', unit: 'µS/cm', color: '#5DCAA5', key: 'conductividad' },
  { name: 'Nitrógeno',     unit: 'ppm',   color: '#3B6D11', key: 'nitrogeno' },
  { name: 'Fósforo',       unit: 'ppm',   color: '#639922', key: 'fosforo' },
  { name: 'Potasio',       unit: 'ppm',   color: '#C0DD97', key: 'potasio' },
];

let dashChart     = null;
let nutChart      = null;
let activeVars    = [0, 1, 2];
let datosActuales = [];
let muestraDash   = [];

function initDashboard() {
  renderPills();
  const hoy = new Date();
  const hasta = hoy.toISOString().slice(0, 10);
  const desdeDate = new Date(hoy);
  desdeDate.setFullYear(desdeDate.getFullYear() - 2);
  const desde = desdeDate.toISOString().slice(0, 10);
  cargarDashboard(desde, hasta);
}

async function cargarDashboard(desde, hasta) {
  try {
    const lecturas = await apiGet(
      `/lecturas?areaId=${App.areaId}&desde=${desde}&hasta=${hasta}`
    );

    if (!lecturas || lecturas.length === 0) {
      datosActuales = generarDatosDemo(20);
      muestraDash   = datosActuales;
      renderDashChart(muestraDash);
      renderNutChart(null);
      mostrarBanner('No hay lecturas cargadas aún. Ve a <b>Cargar CSV</b> para importar datos del sensor.', 'warn');
      return;
    }

    mostrarBanner(null);
    datosActuales = lecturas;

    const stats = calcularStatsLocal(lecturas);
    actualizarTarjetas(stats);

    const paso  = Math.max(1, Math.floor(lecturas.length / 30));
    muestraDash = lecturas.filter((_, i) => i % paso === 0);

    renderDashChart(muestraDash);
    renderNutChart(stats);
    actualizarUltimoDiag();

  } catch (e) {
    console.warn('Dashboard error:', e);
    datosActuales = generarDatosDemo(20);
    muestraDash   = datosActuales;
    renderDashChart(muestraDash);
    renderNutChart(null);
  }
}

function calcularStatsLocal(lecturas) {
  const mapa = {
    humedad:       ['Humedad_Prom','Humedad_Max','Humedad_Min'],
    temperatura:   ['Temp_Prom','Temp_Max','Temp_Min'],
    pH:            ['pH_Prom','pH_Max','pH_Min'],
    conductividad: ['CE_Prom','CE_Max','CE_Min'],
    salinidad:     ['Sal_Prom','Sal_Max','Sal_Min'],
    nitrogeno:     ['N_Prom','N_Max','N_Min'],
    fosforo:       ['P_Prom','P_Max','P_Min'],
    potasio:       ['K_Prom','K_Max','K_Min'],
  };
  const stats = {};
  Object.entries(mapa).forEach(([campo, [promKey, maxKey, minKey]]) => {
    const vals = lecturas.map(l => parseFloat(l[campo])).filter(v => !isNaN(v));
    if (!vals.length) return;
    stats[promKey] = vals.reduce((a, b) => a + b, 0) / vals.length;
    stats[maxKey]  = Math.max(...vals);
    stats[minKey]  = Math.min(...vals);
  });
  return stats;
}

function actualizarTarjetas(stats) {
  const mapa = {
    'stat-humedad': { prom: stats.Humedad_Prom, max: stats.Humedad_Max, min: stats.Humedad_Min, unit: '%' },
    'stat-temp':    { prom: stats.Temp_Prom,    max: stats.Temp_Max,    min: stats.Temp_Min,    unit: '°C' },
    'stat-ph':      { prom: stats.pH_Prom,      max: stats.pH_Max,      min: stats.pH_Min,      unit: '' },
    'stat-ce':      { prom: stats.CE_Prom,      max: stats.CE_Max,      min: stats.CE_Min,      unit: ' µS' },
  };
  Object.entries(mapa).forEach(([id, v]) => {
    const card = document.getElementById(id);
    if (!card || v.prom == null) return;
    card.querySelector('.stat-val').textContent = `${(+v.prom).toFixed(1)}${v.unit}`;
    const sub = card.querySelectorAll('.stat-sub span');
    if (sub[0]) sub[0].textContent = `Máx ${(+v.max).toFixed(1)}`;
    if (sub[1]) sub[1].textContent = `Mín ${(+v.min).toFixed(1)}`;
  });
}

function mostrarBanner(html, tipo) {
  let b = document.getElementById('dash-banner');
  if (!html) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement('div');
    b.id = 'dash-banner';
    const grid = document.querySelector('#page-dashboard .stat-grid');
    if (grid) grid.insertAdjacentElement('beforebegin', b);
  }
  b.innerHTML = html;
  b.style.cssText = tipo === 'warn'
    ? 'background:#fef3cd;color:#856404;border:0.5px solid #ffeeba;padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:13px;'
    : 'background:#DBF0DD;color:#173831;border:0.5px solid #8CB79B;padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:13px;';
}

async function actualizarUltimoDiag() {
  try {
    const data = await apiGet(`/diagnosticos?areaId=${App.areaId}`);
    const el   = document.getElementById('dash-ultimo-diag');
    const bdg  = document.getElementById('dash-ultimo-badge');
    if (!el || !data.length) return;
    const d = data[0];
    el.textContent = `${d.fechaHora.slice(0,10)} · ${d.usuario}`;
    if (bdg) bdg.innerHTML = d.sinAmenaza
      ? '<span class="badge badge-ok">Sin amenaza</span>'
      : `<span class="badge badge-danger">${d.resultado}</span>`;
  } catch { /* silencioso */ }
}

function renderPills() {
  const cont = document.getElementById('dash-pills');
  if (!cont) return;
  cont.innerHTML = '';
  DASH_VARS.forEach((v, i) => {
    const pill = document.createElement('span');
    pill.className = 'vpill' + (activeVars.includes(i) ? ' on' : '');
    if (activeVars.includes(i)) pill.style.background = v.color;
    pill.textContent = v.name;
    pill.onclick = () => {
      const idx = activeVars.indexOf(i);
      if (idx >= 0) { activeVars.splice(idx,1); pill.classList.remove('on'); pill.style.background=''; }
      else           { activeVars.push(i);       pill.classList.add('on');    pill.style.background=v.color; }
      if (dashChart) { dashChart.data.datasets = buildDatasets(muestraDash); dashChart.update(); }
    };
    cont.appendChild(pill);
  });
}

function renderDashChart(muestra) {
  const ctx = document.getElementById('dashChart');
  if (!ctx) return;
  if (dashChart) dashChart.destroy();
  dashChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels:   muestra.map(l => l.fechaHora.slice(5, 13)),
      datasets: buildDatasets(muestra),
    },
    options: chartOpts(),
  });
}

function buildDatasets(muestra) {
  return activeVars.map(i => {
    const v = DASH_VARS[i];
    return {
      label:           v.name,
      data:            muestra.map(l => parseFloat(l[v.key]) || 0),
      borderColor:     v.color,
      backgroundColor: v.color + '18',
      tension:         0.4,
      pointRadius:     3,
      borderWidth:     2,
    };
  });
}

function renderNutChart(stats) {
  const ctx = document.getElementById('nutChart');
  if (!ctx) return;
  if (nutChart) nutChart.destroy();
  const nData = stats
    ? [+((stats.N_Prom||0).toFixed(1)), +((stats.P_Prom||0).toFixed(1)), +((stats.K_Prom||0).toFixed(1))]
    : [32, 18, 145];
  nutChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels:   ['Nitrógeno','Fósforo','Potasio'],
      datasets: [{ data: nData, backgroundColor:['#173831','#235347','#8CB79B'], borderRadius:5 }],
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{
        x:{ ticks:{font:{size:11},color:'#5a6b5b'}, grid:{display:false} },
        y:{ ticks:{font:{size:11},color:'#5a6b5b'}, grid:{color:'#e8f0ea'} },
      },
    },
  });
}

function chartOpts() {
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{display:false} },
    scales:{
      x:{ ticks:{font:{size:10},color:'#5a6b5b',maxRotation:45,autoSkip:true,maxTicksLimit:12}, grid:{color:'#e8f0ea'} },
      y:{ ticks:{font:{size:11},color:'#5a6b5b'}, grid:{color:'#e8f0ea'} },
    },
  };
}