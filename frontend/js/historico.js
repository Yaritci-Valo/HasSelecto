/* ============================================================
   historico.js — RF5 Histórico de datos
   Consume: GET /api/lecturas
   ============================================================ */

const HIST_VARS = [
  { name: 'Humedad (%)',      color: '#8CB79B', key: 'humedad' },
  { name: 'Temperatura (°C)', color: '#235347', key: 'temperatura' },
  { name: 'pH',               color: '#173831', key: 'pH' },
  { name: 'Conductividad',    color: '#5DCAA5', key: 'conductividad' },
  { name: 'Nitrógeno (ppm)',  color: '#3B6D11', key: 'nitrogeno' },
  { name: 'Fósforo (ppm)',    color: '#639922', key: 'fosforo' },
  { name: 'Potasio (ppm)',    color: '#C0DD97', key: 'potasio' },
];

let histChart = null;

function initHistorico() {
  const desde = document.getElementById('f-desde');
  const hasta  = document.getElementById('f-hasta');
  if (desde && !desde.value) desde.value = fechaOffset(-30);
  if (hasta  && !hasta.value)  hasta.value  = fechaOffset(0);
}

// ── Cargar lecturas — GET /api/lecturas ──────────────────────
async function cargarHistorico() {
  const desde = document.getElementById('f-desde')?.value || fechaOffset(-30);
  const hasta  = document.getElementById('f-hasta')?.value  || fechaOffset(0);

  try {
    const datos = await apiGet(`/lecturas?areaId=${App.areaId}&desde=${desde}&hasta=${hasta}`);
    renderHistChart(datos);
    renderHistTabla(datos);
  } catch {
    const datos = generarDatosDemo(15);
    renderHistChart(datos);
    renderHistTabla(datos);
  }
}

function updateHistChart() { cargarHistorico(); }

// ── Gráfica ──────────────────────────────────────────────────
function renderHistChart(datos) {
  const ctx = document.getElementById('histChart');
  if (!ctx) return;
  const varIdx = parseInt(document.getElementById('f-var')?.value || '0');
  const v      = HIST_VARS[Math.min(varIdx, HIST_VARS.length - 1)];

  if (histChart) histChart.destroy();
  histChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: datos.map(d => d.fechaHora.slice(5,10)),
      datasets: [{
        label: v.name, data: datos.map(d => d[v.key]),
        borderColor: v.color, backgroundColor: v.color + '18',
        tension: 0.4, pointRadius: 4, borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font:{size:11}, color:'#5a6b5b', maxRotation:45, autoSkip: false }, grid:{color:'#e8f0ea'} },
        y: { ticks: { font:{size:11}, color:'#5a6b5b' }, grid:{color:'#e8f0ea'} },
      },
    },
  });
}

// ── Tabla ────────────────────────────────────────────────────
function renderHistTabla(datos) {
  const tbody = document.getElementById('hist-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!datos.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#5a6b5b;">Sin datos para el período seleccionado.</td></tr>';
    return;
  }

  datos.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.fechaHora}</td>
      <td>${(+r.humedad).toFixed(1)}</td>
      <td>${(+r.temperatura).toFixed(1)}</td>
      <td>${(+r.pH).toFixed(2)}</td>
      <td>${Math.round(r.conductividad)}</td>
      <td>${(+r.salinidad).toFixed(2)}</td>
      <td>${Math.round(r.nitrogeno)}</td>
      <td>${Math.round(r.fosforo)}</td>
      <td>${Math.round(r.potasio)}</td>
    `;
    tbody.appendChild(tr);
  });
}
