/* ============================================================
   carga.js — RF2
   NUEVO: acepta .xlsx y .xls del sensor además de .csv
   ============================================================ */

const COLUMNAS_REQ_CSV = [
  'fecha_hora','humedad','temperatura','ph',
  'conductividad','salinidad','nitrogeno','fosforo','potasio'
];

// Columnas que exporta el sensor en Excel
const COLUMNAS_EXCEL_SENSOR = ['time','temp(℃)','hum(%)','conductivity(us/cm)','ph'];

function initCarga() {
  const zona = document.getElementById('dropzone');
  if (!zona) return;

  zona.addEventListener('dragover', e => { e.preventDefault(); zona.style.background='#DBF0DD'; });
  zona.addEventListener('dragleave', () => { zona.style.background=''; });
  zona.addEventListener('drop', e => {
    e.preventDefault(); zona.style.background='';
    const f = e.dataTransfer.files[0];
    if (f) procesarArchivo(f);
  });
  zona.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('csv-file-input').click();
  });

  const inp = document.getElementById('csv-file-input');
  if (inp) {
    inp.addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) { procesarArchivo(f); inp.value = ''; }
    });
  }

  cargarHistorialCargas();
}

// ── Procesar archivo (CSV o Excel) ───────────────────────────
async function procesarArchivo(archivo) {
  const ext = archivo.name.toLowerCase().split('.').pop();
  const esExcel = ['xlsx','xls','xlsm'].includes(ext);
  const esCSV   = ext === 'csv';

  if (!esExcel && !esCSV) {
    mostrarAlertaCarga('Solo se aceptan archivos .xlsx, .xls o .csv', 'error');
    return;
  }
  if (archivo.size > 10 * 1024 * 1024) {
    mostrarAlertaCarga('El archivo supera el límite de 10 MB', 'error');
    return;
  }

  // Validación rápida solo para CSV (Excel se valida en el backend)
  if (esCSV) {
    const texto   = await archivo.text();
    const errorVal = validarCSVCliente(texto);
    if (errorVal) { mostrarAlertaCarga(errorVal, 'error'); return; }
  }

  mostrarProgreso(archivo.name, esExcel);
  animarProgreso(0, 40, 'Calculando huella del archivo...');

  const formData = new FormData();
  formData.append('archivo',   archivo);
  formData.append('areaId',    App.areaId);
  formData.append('usuarioId', App.usuario?.usuarioId || 1);

  try {
    animarProgreso(40, 80, 'Enviando al servidor...');
    const res  = await fetch(`${API_BASE}/cargar-csv`, { method:'POST', body:formData });
    const data = await res.json();

    if (res.status === 409) {
      ocultarProgreso();
      mostrarModalDuplicado(data);
      return;
    }
    if (!res.ok) throw new Error(data.error || 'Error en el servidor');

    animarProgreso(80, 100,
      `✓ ${data.filasInsertadas} filas importadas correctamente.`, true);
    cargarHistorialCargas();

  } catch (e) {
    actualizarProgreso(100, `Error: ${e.message}`, false, true);
  }
}

// ── Validación cliente CSV ───────────────────────────────────
function validarCSVCliente(texto) {
  const lineas = texto.trim().split('\n');
  if (lineas.length < 2) return 'El archivo está vacío.';
  const sep = lineas[0].includes(';') ? ';' : ',';
  const enc = lineas[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g,''));
  const faltantes = COLUMNAS_REQ_CSV.filter(c => !enc.includes(c));
  if (faltantes.length) return `Columnas faltantes: ${faltantes.join(', ')}`;
  return null;
}

// ── Modal de duplicado ───────────────────────────────────────
function mostrarModalDuplicado(data) {
  const prev = document.getElementById('modal-duplicado');
  if (prev) prev.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-duplicado';
  modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(5,31,32,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;`;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 32px;max-width:440px;
                width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="width:40px;height:40px;border-radius:50%;background:#fef3cd;
                    display:flex;align-items:center;justify-content:center;flex-shrink:0;
                    font-size:20px;">⚠️</div>
        <div>
          <div style="font-size:15px;font-weight:600;color:#051F20;">Archivo duplicado</div>
          <div style="font-size:12px;color:#5a6b5b;">Este archivo ya fue cargado anteriormente</div>
        </div>
      </div>
      <div style="background:#f8fbf8;border-radius:8px;padding:12px 14px;
                  border:0.5px solid #d4e4d6;margin-bottom:20px;font-size:13px;">
        <div style="margin-bottom:6px;">
          <span style="color:#5a6b5b;">Archivo:</span>
          <strong style="color:#051F20;margin-left:6px;">${data.archivo}</strong>
        </div>
        <div style="margin-bottom:6px;">
          <span style="color:#5a6b5b;">Cargado el:</span>
          <strong style="color:#051F20;margin-left:6px;">${data.fechaCarga}</strong>
        </div>
        <div>
          <span style="color:#5a6b5b;">Por:</span>
          <strong style="color:#051F20;margin-left:6px;">${data.usuario}</strong>
        </div>
      </div>
      <div style="font-size:13px;color:#5a6b5b;margin-bottom:20px;line-height:1.5;">
        El contenido de este archivo es idéntico a una carga anterior.
        La carga ha sido <strong>bloqueada</strong> para evitar datos duplicados.
      </div>
      <button onclick="document.getElementById('modal-duplicado').remove()"
        style="width:100%;padding:10px;background:#173831;color:#DBF0DD;border:none;
               border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
        Entendido
      </button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
}

// ── Historial de cargas ──────────────────────────────────────
async function cargarHistorialCargas() {
  const tbody = document.getElementById('hist-cargas');
  if (!tbody) return;
  try {
    const data = await apiGet(`/cargas?areaId=${App.areaId}`);
    if (!data.length) return;
    tbody.innerHTML = '';
    data.forEach(c => {
      const ext   = c.nombreArchivo.toLowerCase().split('.').pop();
      const icono = ['xlsx','xls'].includes(ext) ? '📊' : '📄';
      const badge = c.estado === 'Procesado'
        ? '<span class="badge badge-ok">Procesado</span>'
        : c.estado === 'Rechazado'
          ? '<span class="badge badge-danger">Rechazado</span>'
          : '<span class="badge badge-warn">Pendiente</span>';
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${icono} ${c.nombreArchivo}</td>
          <td>${c.fechaCarga.slice(0,10)}</td>
          <td>${c.filasProcesadas ?? '—'}</td>
          <td>${c.usuario}</td>
          <td>${badge}</td>
        </tr>`);
    });
  } catch { /* mantiene demo */ }
}

// ── UI de progreso ───────────────────────────────────────────
function mostrarProgreso(nombre, esExcel=false) {
  const wrap = document.getElementById('upload-progress');
  if (wrap) wrap.style.display = 'block';
  const fn = document.getElementById('upload-filename');
  if (fn) fn.textContent = (esExcel ? '📊 ' : '📄 ') + nombre;
  const bar = document.getElementById('pbar');
  if (bar) { bar.style.width='0%'; bar.style.background='#173831'; }
  const pct = document.getElementById('upload-pct');
  if (pct) pct.textContent='0%';
  const st = document.getElementById('upload-status');
  if (st) { st.textContent=''; st.style.color=''; }
  const prev = document.getElementById('carga-alerta');
  if (prev) prev.remove();
}
function ocultarProgreso(){
  const w=document.getElementById('upload-progress');
  if(w) w.style.display='none';
}
function animarProgreso(desde,hasta,mensaje,exito=false){
  const bar=document.getElementById('pbar'),pct=document.getElementById('upload-pct'),
        st=document.getElementById('upload-status');
  let actual=desde;
  const iv=setInterval(()=>{
    actual=Math.min(actual+3,hasta);
    if(bar) bar.style.width=actual+'%';
    if(pct) pct.textContent=actual+'%';
    if(actual>=hasta){
      clearInterval(iv);
      if(st){st.textContent=mensaje;st.style.color=exito?'#173831':'#5a6b5b';}
      if(exito&&bar) bar.style.background='#235347';
    }
  },40);
}
function actualizarProgreso(pct,mensaje,exito,error=false){
  const bar=document.getElementById('pbar'),pctEl=document.getElementById('upload-pct'),
        st=document.getElementById('upload-status');
  if(bar){bar.style.width=pct+'%';bar.style.background=error?'#c0392b':'#173831';}
  if(pctEl) pctEl.textContent=pct+'%';
  if(st){st.textContent=mensaje;st.style.color=error?'#c0392b':'#173831';}
}
function mostrarAlertaCarga(msg,tipo){
  const prev=document.getElementById('carga-alerta');
  if(prev) prev.remove();
  const div=document.createElement('div');
  div.id='carga-alerta';
  div.className=`alert alert-${tipo==='error'?'error':'ok'}`;
  div.textContent=msg;
  const zona=document.getElementById('dropzone');
  if(zona) zona.insertAdjacentElement('afterend',div);
}