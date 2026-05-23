/* ============================================================
   diagnosticos.js — Historial + modal de detalle
   FIX: botón "Ver" ahora abre modal con detalle completo
   ============================================================ */

// ── Cargar historial ─────────────────────────────────────────
async function cargarDiagnosticos() {
  const tbody = document.getElementById('diag-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5"
    style="text-align:center;color:#5a6b5b;padding:16px;">Cargando...</td></tr>`;

  try {
    const data = await apiGet(`/diagnosticos?areaId=${App.areaId}`);
    tbody.innerHTML = '';

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5"
        style="text-align:center;color:#5a6b5b;padding:16px;">
        Sin diagnósticos registrados aún.</td></tr>`;
      return;
    }

    data.forEach(d => {
      const badge = d.sinAmenaza
        ? '<span class="badge badge-ok">Sin amenaza</span>'
        : `<span class="badge badge-danger">${d.resultado}</span>`;

      // Guardar datos en atributo data para el modal
      const dataAttr = encodeURIComponent(JSON.stringify(d));

      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${d.fechaHora.slice(0,10)}</td>
          <td>${d.usuario}</td>
          <td>${d.cultivoEvaluado}</td>
          <td>${badge}</td>
          <td>
            <button class="btn" style="font-size:11px;padding:3px 10px;"
              onclick="verDiagnostico('${dataAttr}')">Ver</button>
          </td>
        </tr>`);
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5"
      style="text-align:center;color:#c0392b;padding:16px;">
      No se pudo conectar al servidor.</td></tr>`;
  }
}

// ── Modal de detalle ─────────────────────────────────────────
function verDiagnostico(dataAttr) {
  const d = JSON.parse(decodeURIComponent(dataAttr));

  const prev = document.getElementById('modal-diagnostico');
  if (prev) prev.remove();

  const sinAmenaza = d.sinAmenaza;
  const colorBadge = sinAmenaza ? '#DBF0DD' : '#f8d7da';
  const colorText  = sinAmenaza ? '#173831' : '#721c24';
  const resultado  = d.resultado || 'Sin amenaza detectada';
  const cientifico = d.nombreCientifico ? `<em style="font-size:12px;color:#5a6b5b;">${d.nombreCientifico}</em>` : '';
  const recomendacion = d.recomendacion
    ? `<div style="margin-top:14px;">
         <div style="font-size:11px;font-weight:600;color:#5a6b5b;text-transform:uppercase;
                     letter-spacing:.05em;margin-bottom:6px;">Recomendación</div>
         <div style="font-size:13px;color:#235347;line-height:1.6;background:#DBF0DD;
                     border-radius:8px;padding:12px 14px;border:0.5px solid #8CB79B;">
           ${d.recomendacion}
         </div>
       </div>`
    : '';

  const modal = document.createElement('div');
  modal.id = 'modal-diagnostico';
  modal.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(5,31,32,0.6);z-index:1000;
    display:flex;align-items:center;justify-content:center;
  `;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 32px;
                max-width:500px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);
                max-height:90vh;overflow-y:auto;">

      <!-- Encabezado -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div>
          <div style="font-size:16px;font-weight:700;color:#051F20;">Detalle del diagnóstico</div>
          <div style="font-size:12px;color:#5a6b5b;margin-top:3px;">
            ${d.fechaHora.slice(0,16).replace('T',' ')} · ${d.usuario}
          </div>
        </div>
        <button onclick="document.getElementById('modal-diagnostico').remove()"
          style="background:none;border:none;cursor:pointer;font-size:20px;
                 color:#5a6b5b;line-height:1;padding:0 4px;">✕</button>
      </div>

      <!-- Info básica -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
        <div style="background:#f8fbf8;border-radius:8px;padding:10px 12px;
                    border:0.5px solid #d4e4d6;">
          <div style="font-size:10px;font-weight:600;color:#5a6b5b;text-transform:uppercase;
                      letter-spacing:.05em;margin-bottom:4px;">Cultivo evaluado</div>
          <div style="font-size:14px;font-weight:600;color:#051F20;">${d.cultivoEvaluado}</div>
        </div>
        <div style="background:#f8fbf8;border-radius:8px;padding:10px 12px;
                    border:0.5px solid #d4e4d6;">
          <div style="font-size:10px;font-weight:600;color:#5a6b5b;text-transform:uppercase;
                      letter-spacing:.05em;margin-bottom:4px;">Área de estudio</div>
          <div style="font-size:14px;font-weight:600;color:#051F20;">${d.areaEstudio || App.areaNombre}</div>
        </div>
      </div>

      <!-- Resultado -->
      <div style="background:${colorBadge};border-radius:10px;padding:16px 18px;
                  border:0.5px solid ${sinAmenaza ? '#8CB79B' : '#f5c6cb'};">
        <div style="font-size:10px;font-weight:600;color:${colorText};text-transform:uppercase;
                    letter-spacing:.05em;margin-bottom:6px;">Resultado</div>
        <div style="font-size:18px;font-weight:700;color:${colorText};margin-bottom:4px;">
          ${resultado}
        </div>
        ${cientifico}
      </div>

      <!-- Recomendación -->
      ${recomendacion}

      <!-- Botón cerrar -->
      <button onclick="document.getElementById('modal-diagnostico').remove()"
        style="width:100%;margin-top:20px;padding:10px;background:#173831;
               color:#DBF0DD;border:none;border-radius:8px;
               font-size:14px;font-weight:600;cursor:pointer;">
        Cerrar
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.remove();
  });
}