# ============================================================
#  routes/api.py — Todos los endpoints REST de la aplicación
# ============================================================

from flask import Blueprint, request, jsonify, Response
from services import usuarios, areas, lecturas, diagnosticos, reporte

api = Blueprint('api', __name__, url_prefix='/api')


# ── Helper: respuesta de error ───────────────────────────────
def err(msg, code=400):
    return jsonify({"error": msg}), code


# ════════════════════════════════════════════════════════════
#  RF10 — USUARIOS
# ════════════════════════════════════════════════════════════

@api.route('/usuarios', methods=['POST'])
def post_usuario():
    """Registrar o recuperar usuario por nombre."""
    data = request.get_json() or {}
    nombre = data.get('nombre', '').strip()
    if not nombre:
        return err("El campo 'nombre' es obligatorio.")
    try:
        resultado = usuarios.registrar_o_recuperar(nombre)
        return jsonify(resultado), 201 if resultado['nuevo'] else 200
    except ValueError as e:
        return err(str(e))


@api.route('/usuarios', methods=['GET'])
def get_usuarios():
    """Listar todos los usuarios activos."""
    return jsonify(usuarios.listar_usuarios())


# ════════════════════════════════════════════════════════════
#  RF1 — ÁREAS DE ESTUDIO
# ════════════════════════════════════════════════════════════

@api.route('/areas', methods=['GET'])
def get_areas():
    """Listar todas las áreas activas."""
    return jsonify(areas.listar_areas())


@api.route('/areas/<int:area_id>', methods=['GET'])
def get_area(area_id):
    """Obtener una área por ID."""
    try:
        return jsonify(areas.obtener_area(area_id))
    except ValueError as e:
        return err(str(e), 404)


@api.route('/areas', methods=['POST'])
def post_area():
    """Crear nueva área de estudio."""
    data = request.get_json() or {}
    try:
        nueva = areas.crear_area(data)
        return jsonify(nueva), 201
    except ValueError as e:
        return err(str(e))


@api.route('/areas/<int:area_id>', methods=['PUT'])
def put_area(area_id):
    """Actualizar área de estudio."""
    data = request.get_json() or {}
    try:
        actualizada = areas.actualizar_area(area_id, data)
        return jsonify(actualizada)
    except ValueError as e:
        return err(str(e))


# ════════════════════════════════════════════════════════════
#  RF2 / RF3 — CARGA CSV Y LECTURAS
# ════════════════════════════════════════════════════════════

@api.route('/cargar-csv', methods=['POST'])
def post_cargar_csv():
    archivo   = request.files.get('archivo')
    area_id   = request.form.get('areaId',    type=int)
    usuario_id= request.form.get('usuarioId', type=int)
 
    if not archivo:             return err("Se requiere el archivo CSV.")
    if not area_id:             return err("Se requiere 'areaId'.")
    if not usuario_id:          return err("Se requiere 'usuarioId'.")
 
    try:
        resultado = lecturas.procesar_csv(
            area_id, usuario_id, archivo.filename, archivo.read()
        )
        return jsonify(resultado), 201
 
    except ValueError as e:
        msg = str(e)
        # Detectar error especial de duplicado
        if msg.startswith("DUPLICADO|"):
            partes = msg.split("|")
            return jsonify({
                "error":     "duplicado",
                "archivo":   partes[1] if len(partes) > 1 else "",
                "fechaCarga":partes[2] if len(partes) > 2 else "",
                "usuario":   partes[3] if len(partes) > 3 else "",
            }), 409  # 409 Conflict
 
        return err(msg)


@api.route('/lecturas', methods=['GET'])
def get_lecturas():
    """
    Consultar lecturas por rango de fechas.
    Query params: areaId, desde (YYYY-MM-DD), hasta (YYYY-MM-DD)
    """
    area_id = request.args.get('areaId', type=int)
    desde   = request.args.get('desde', '')
    hasta   = request.args.get('hasta', '')

    if not area_id or not desde or not hasta:
        return err("Se requieren 'areaId', 'desde' y 'hasta'.")

    try:
        data = lecturas.obtener_lecturas(area_id, desde, hasta)
        return jsonify(data)
    except Exception as e:
        return err(str(e), 500)


@api.route('/estadisticos', methods=['GET'])
def get_estadisticos():
    """
    Estadísticos del período (prom/max/min de todas las variables).
    Query params: areaId, desde, hasta
    """
    area_id = request.args.get('areaId', type=int)
    desde   = request.args.get('desde', '')
    hasta   = request.args.get('hasta', '')

    if not area_id or not desde or not hasta:
        return err("Se requieren 'areaId', 'desde' y 'hasta'.")

    try:
        data = lecturas.obtener_estadisticos(area_id, desde, hasta)
        return jsonify(data)
    except Exception as e:
        return err(str(e), 500)


@api.route('/cargas', methods=['GET'])
def get_cargas():
    """Historial de archivos CSV cargados para un área."""
    area_id = request.args.get('areaId', type=int)
    if not area_id:
        return err("Se requiere 'areaId'.")
    return jsonify(lecturas.historial_cargas(area_id))


# ════════════════════════════════════════════════════════════
#  RF9 — EXPORTAR CSV
# ════════════════════════════════════════════════════════════

@api.route('/exportar-csv', methods=['GET'])
def get_exportar_csv():
    """
    Descarga un CSV con todas las lecturas del período.
    Query params: areaId, desde, hasta
    """
    area_id = request.args.get('areaId', type=int)
    desde   = request.args.get('desde', '')
    hasta   = request.args.get('hasta', '')

    if not area_id or not desde or not hasta:
        return err("Se requieren 'areaId', 'desde' y 'hasta'.")

    try:
        contenido = lecturas.exportar_csv(area_id, desde, hasta)
        return Response(
            contenido,
            mimetype='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename=lecturas_{desde}_{hasta}.csv'
            }
        )
    except Exception as e:
        return err(str(e), 500)


# ════════════════════════════════════════════════════════════
#  RF6 / RF7 / RF11 / RF12 — ASISTENTE Y DIAGNÓSTICOS
# ════════════════════════════════════════════════════════════

@api.route('/sintomas', methods=['GET'])
def get_sintomas():
    """
    Obtener catálogo de síntomas por cultivo.
    Query param: cultivo (Aguacate | Pitahaya)
    """
    cultivo = request.args.get('cultivo', 'Aguacate')
    if cultivo not in ('Aguacate', 'Pitahaya'):
        return err("Cultivo debe ser 'Aguacate' o 'Pitahaya'.")
    return jsonify(diagnosticos.obtener_sintomas(cultivo))


@api.route('/diagnosticos', methods=['POST'])
def post_diagnostico():
    """
    Guardar diagnóstico con síntomas y obtener resultado del motor.
    Body JSON:
    {
      "areaId": 1,
      "usuarioId": 2,
      "cultivoEvaluado": "Aguacate",
      "sintomas": [
        {"sintomaId": 1, "respuesta": true},
        {"sintomaId": 2, "respuesta": false}
      ]
    }
    """
    data = request.get_json() or {}

    area_id    = data.get('areaId')
    usuario_id = data.get('usuarioId')
    cultivo    = data.get('cultivoEvaluado', '')
    sintomas   = data.get('sintomas', [])

    if not area_id or not usuario_id:
        return err("Se requieren 'areaId' y 'usuarioId'.")
    if cultivo not in ('Aguacate', 'Pitahaya'):
        return err("'cultivoEvaluado' debe ser 'Aguacate' o 'Pitahaya'.")
    if not sintomas:
        return err("Se requiere al menos un síntoma.")

    try:
        resultado = diagnosticos.guardar_diagnostico(
            area_id, usuario_id, cultivo, sintomas
        )
        return jsonify(resultado), 201
    except Exception as e:
        return err(str(e), 500)


@api.route('/diagnosticos', methods=['GET'])
def get_diagnosticos():
    """
    Historial de diagnósticos.
    Query params: areaId, desde (opcional), hasta (opcional)
    """
    area_id = request.args.get('areaId', type=int)
    desde   = request.args.get('desde', None)
    hasta   = request.args.get('hasta', None)

    if not area_id:
        return err("Se requiere 'areaId'.")

    try:
        data = diagnosticos.historial_diagnosticos(area_id, desde, hasta)
        return jsonify(data)
    except Exception as e:
        return err(str(e), 500)


# ============================================================
#  Reemplaza SOLO la función get_reporte_pdf en routes/api.py
# ============================================================

@api.route('/reporte-pdf', methods=['GET'])
def get_reporte_pdf():
    area_id      = request.args.get('areaId',       type=int)
    area_nombre  = request.args.get('areaNombre',   'Invernadero')
    cultivo      = request.args.get('cultivo',      'Aguacate')
    desde        = request.args.get('desde',        '')
    hasta        = request.args.get('hasta',        '')
    usuario      = request.args.get('usuario',      'Sistema')
    observaciones= request.args.get('observaciones','')   # <-- NUEVO

    if not area_id or not desde or not hasta:
        return err("Se requieren 'areaId', 'desde' y 'hasta'.")

    try:
        pdf_bytes = reporte.generar_pdf(
            area_id, area_nombre, cultivo,
            desde, hasta, usuario,
            observaciones          # <-- NUEVO
        )
        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Disposition':
                    f'attachment; filename=reporte_{desde}_{hasta}.pdf'
            }
        )
    except Exception as e:
        return err(str(e), 500)