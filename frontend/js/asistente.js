/* ============================================================
   asistente.js — RF6/RF7/RF11/RF12
   FIX: tras guardar diagnóstico llama cargarDiagnosticos()
   ============================================================ */

let cultivoActual     = 'Aguacate';
let preguntaActual    = 0;
let preguntasCargadas = [];
let respuestasUsuario = [];

function initAsistente() {
  const ultimo = sessionStorage.getItem('ultimoCultivo');
  if (ultimo) cultivoActual = ultimo;
  actualizarBotonesCultivo();
  cargarSintomasYRenderizar();
}

// ── Selección de cultivo ─────────────────────────────────────
function selectCultivo(c) {
  cultivoActual = c;
  sessionStorage.setItem('ultimoCultivo', c);
  actualizarBotonesCultivo();
  cargarSintomasYRenderizar();
}

function actualizarBotonesCultivo() {
  const agc = document.getElementById('cult-agc');
  const pit = document.getElementById('cult-pit');
  if (agc) agc.className = 'btn' + (cultivoActual === 'Aguacate' ? ' btn-primary' : '');
  if (pit) pit.className = 'btn' + (cultivoActual === 'Pitahaya' ? ' btn-primary' : '');
}

// ── Cargar síntomas ──────────────────────────────────────────
async function cargarSintomasYRenderizar() {
  preguntaActual    = 0;
  respuestasUsuario = [];
  const res = document.getElementById('resultado-asistente');
  if (res) res.style.display = 'none';

  try {
    preguntasCargadas = await apiGet(`/sintomas?cultivo=${cultivoActual}`);
  } catch {
    preguntasCargadas = SINTOMAS_DEMO[cultivoActual] || [];
  }
  renderPregunta();
}

// ── Renderizar pregunta ──────────────────────────────────────
function renderPregunta() {
  const cont = document.getElementById('question-container');
  if (!cont) return;
  renderSteps(preguntasCargadas.length);

  if (preguntaActual >= preguntasCargadas.length) {
    cont.innerHTML = '';
    enviarDiagnostico();
    return;
  }

  const q = preguntasCargadas[preguntaActual];
  cont.innerHTML = `
    <div class="question-card">
      <div class="question-num">Pregunta ${preguntaActual + 1} de ${preguntasCargadas.length} · ${cultivoActual}</div>
      <div class="question-text">${q.descripcion}</div>
      <div class="ans-btns">
        <button class="ans-btn si" onclick="responder(true)">Sí</button>
        <button class="ans-btn no" onclick="responder(false)">No</button>
      </div>
    </div>`;
}

function responder(valor) {
  const q = preguntasCargadas[preguntaActual];
  respuestasUsuario.push({ sintomaId: q.sintomaId, respuesta: valor });
  preguntaActual++;
  renderPregunta();
}

// ── Enviar diagnóstico al backend ────────────────────────────
async function enviarDiagnostico() {
  const cont = document.getElementById('resultado-asistente');
  if (!cont) return;
  cont.style.display = 'block';
  cont.innerHTML = '<div style="padding:16px;color:#5a6b5b;font-size:13px;">Analizando síntomas...</div>';

  const payload = {
    areaId:          App.areaId,
    usuarioId:       App.usuario?.usuarioId || 1,
    cultivoEvaluado: cultivoActual,
    sintomas:        respuestasUsuario,
  };

  let resultado;
  try {
    resultado = await apiPost('/diagnosticos', payload);
  } catch {
    resultado = inferirLocal(respuestasUsuario);
  }

  // ── FIX: refrescar historial de diagnósticos en la BD ──
  cargarDiagnosticos();

  mostrarResultado(resultado);
}

// ── Mostrar resultado ────────────────────────────────────────
function mostrarResultado(res) {
  const cont = document.getElementById('resultado-asistente');
  if (!cont) return;

  if (res.sinAmenaza || !res.nombreComun) {
    cont.innerHTML = `
      <div class="result-card">
        <div class="result-label">Resultado del diagnóstico</div>
        <div class="result-plaga">Sin amenaza detectada</div>
        <div class="result-rec">No se identificaron síntomas compatibles con las amenazas conocidas para ${cultivoActual}. Se recomienda continuar con el monitoreo rutinario.</div>
        <div style="display:flex;gap:10px;margin-top:14px;">
          <button class="btn btn-primary" onclick="cargarSintomasYRenderizar()">Nuevo diagnóstico</button>
          <button class="btn" onclick="goTo('diagnosticos', document.querySelector('[data-page=\\'diagnosticos\\']'))">Ver historial</button>
        </div>
      </div>`;
  } else {
    cont.innerHTML = `
      <div class="result-card">
        <div class="result-label">Plaga identificada</div>
        <div class="result-plaga">${res.nombreComun}</div>
        <div style="font-size:12px;color:#235347;font-style:italic;margin-bottom:10px;">${res.nombreCientifico || ''}</div>
        <div class="result-rec">${res.recomendacion || ''}</div>
        <div style="display:flex;gap:10px;margin-top:14px;">
          <button class="btn btn-primary" onclick="cargarSintomasYRenderizar()">Nuevo diagnóstico</button>
          <button class="btn" onclick="goTo('diagnosticos', document.querySelector('[data-page=\\'diagnosticos\\']'))">Ver historial</button>
        </div>
      </div>`;
  }
}

// ── Steps ────────────────────────────────────────────────────
function renderSteps(total) {
  const cont = document.getElementById('steps');
  if (!cont) return;
  cont.innerHTML = Array.from({ length: total }, (_, i) => {
    const cls = i < preguntaActual ? 'done' : i === preguntaActual ? 'current' : '';
    return `<div class="step-dot ${cls}"></div>`;
  }).join('');
}

// ── Inferencia local (fallback) ──────────────────────────────
function inferirLocal(respuestas) {
  const positivos = respuestas.filter(r => r.respuesta).map(r => r.sintomaId);
  if (!positivos.length) return { sinAmenaza: true };
  const demo   = SINTOMAS_DEMO[cultivoActual] || [];
  const conteo = {};
  demo.forEach(s => {
    if (positivos.includes(s.sintomaId) && s._plaga)
      conteo[s._plaga] = (conteo[s._plaga] || 0) + 1;
  });
  const top = Object.entries(conteo).sort((a,b) => b[1]-a[1])[0];
  if (!top) return { sinAmenaza: true };
  const info = RECOMENDACIONES_DEMO[top[0]] || {};
  return { sinAmenaza: false, nombreComun: info.comun || top[0], nombreCientifico: info.cientifico || '', recomendacion: info.rec || '' };
}

// ── Datos demo ───────────────────────────────────────────────
const SINTOMAS_DEMO = {
  Aguacate: [
    { sintomaId:1, descripcion:'¿Observa coloración oscura en la base del tallo?',          _plaga:'Phytophthora cinnamomi' },
    { sintomaId:2, descripcion:'¿Las raíces presentan pudrición o coloración café oscura?', _plaga:'Phytophthora cinnamomi' },
    { sintomaId:3, descripcion:'¿Las hojas muestran amarillamiento generalizado?',          _plaga:'Fusarium spp.' },
    { sintomaId:4, descripcion:'¿Hay decoloración vascular al cortar una rama?',            _plaga:'Fusarium spp.' },
    { sintomaId:5, descripcion:'¿Observa manchas amarillas en el haz de las hojas?',       _plaga:'Araña roja' },
    { sintomaId:6, descripcion:'¿Hay telaraña fina en el envés de las hojas?',             _plaga:'Araña roja' },
  ],
  Pitahaya: [
    { sintomaId:1, descripcion:'¿Observa perforaciones circulares en el tallo o fruto?',   _plaga:'Barrenador del hueso' },
    { sintomaId:2, descripcion:'¿Existen galerías visibles al cortar el fruto?',           _plaga:'Barrenador del hueso' },
    { sintomaId:3, descripcion:'¿Las ramas presentan marchitez repentina?',                _plaga:'Fusarium spp.' },
    { sintomaId:4, descripcion:'¿Hay decoloración vascular al cortar una cladoda?',        _plaga:'Fusarium spp.' },
    { sintomaId:5, descripcion:'¿Manchas amarillas en la superficie de las palas?',        _plaga:'Araña roja' },
    { sintomaId:6, descripcion:'¿Hay telaraña fina en las cladodas?',                     _plaga:'Araña roja' },
  ],
};
const RECOMENDACIONES_DEMO = {
  'Phytophthora cinnamomi': { cientifico:'Phytophthora cinnamomi', comun:'Tristeza del Aguacate', rec:'Mejorar drenaje, aplicar fungicidas sistémicos (metalaxil), eliminar material infectado.' },
  'Barrenador del hueso':   { cientifico:'Sternochetus frigidus',  comun:'Barrenador del hueso',  rec:'Trampas de captura, podas sanitarias, insecticida en floración.' },
  'Fusarium spp.':          { cientifico:'Fusarium spp.',          comun:'Fusariosis vascular',   rec:'Eliminar tejido afectado, desinfectar herramientas, aplicar fungicidas preventivos.' },
  'Araña roja':             { cientifico:'Tetranychus urticae',    comun:'Araña roja',            rec:'Aplicar acaricidas, aumentar humedad relativa, liberar depredadores naturales.' },
};
