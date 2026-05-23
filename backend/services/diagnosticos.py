# ============================================================
#  services/diagnosticos.py — RF7 Motor de inferencia
#                              RF12 Almacenamiento historial
# ============================================================

from config.db import get_db


# ── Motor de inferencia ──────────────────────────────────────
def inferir_plaga(cultivo: str, sintomas_positivos: list) -> dict:
    """
    Motor SI síntoma = Sí ENTONCES sumar punto a plaga.
    Recibe lista de sintomaIds respondidos con Sí.
    Retorna la plaga con mayor puntaje, o None si no hay.
    """
    if not sintomas_positivos:
        return {"plagaId": None, "sinAmenaza": True, "resultado": "Sin amenaza detectada"}

    with get_db() as (conn, cursor):
        # Obtener qué plaga está asociada a cada síntoma
        placeholders = ','.join(['?'] * len(sintomas_positivos))
        cursor.execute(f"""
            SELECT cs.SintomaID, cp.PlagaID, cp.NombreComun, cp.NombreCientifico, cp.Recomendacion
            FROM dbo.CatalogoSintomas cs
            JOIN dbo.CatalogoPlagas cp
                ON cp.TipoCultivo IN (?, 'Ambos')
            WHERE cs.SintomaID IN ({placeholders})
              AND cs.TipoCultivo IN (?, 'Ambos')
              AND cs.Activo = 1
              AND cp.Activa = 1
        """, cultivo, *sintomas_positivos, cultivo)

        rows = cursor.fetchall()

    if not rows:
        return {"plagaId": None, "sinAmenaza": True, "resultado": "Sin amenaza detectada"}

    # Contar puntos por plaga
    conteo = {}
    info_plaga = {}
    for r in rows:
        pid = r.PlagaID
        conteo[pid] = conteo.get(pid, 0) + 1
        info_plaga[pid] = {
            "plagaId":         pid,
            "nombreComun":     r.NombreComun,
            "nombreCientifico": r.NombreCientifico,
            "recomendacion":   r.Recomendacion,
        }

    # Plaga con mayor puntaje
    top_id = max(conteo, key=lambda k: conteo[k])
    resultado = info_plaga[top_id]
    resultado["puntaje"] = conteo[top_id]
    resultado["sinAmenaza"] = False
    return resultado


# ── Guardar diagnóstico completo ─────────────────────────────
def guardar_diagnostico(area_id: int, usuario_id: int, cultivo: str,
                         sintomas: list) -> dict:
    """
    sintomas: lista de dicts {"sintomaId": int, "respuesta": bool}
    """
    positivos = [s['sintomaId'] for s in sintomas if s.get('respuesta')]
    resultado = inferir_plaga(cultivo, positivos)

    plaga_id    = resultado.get('plagaId')
    sin_amenaza = 1 if resultado.get('sinAmenaza') else 0

    with get_db() as (conn, cursor):
        # Insertar diagnóstico directamente (pyodbc no soporta OUTPUT en EXEC)
        cursor.execute("""
            INSERT INTO dbo.Diagnosticos
                (AreaID, UsuarioID, CultivoEvaluado, PlagaID, SinAmenaza)
            OUTPUT INSERTED.DiagnosticoID
            VALUES (?, ?, ?, ?, ?)
        """, area_id, usuario_id, cultivo, plaga_id, sin_amenaza)
        diag_id = cursor.fetchone()[0]

        # Insertar síntomas asociados
        for s in sintomas:
            cursor.execute("""
                INSERT INTO dbo.SintomasDiagnostico (DiagnosticoID, SintomaID, Respuesta)
                VALUES (?, ?, ?)
            """, diag_id, s['sintomaId'], 1 if s.get('respuesta') else 0)

    resultado['diagnosticoId'] = diag_id
    return resultado


# ── Historial de diagnósticos ────────────────────────────────
def historial_diagnosticos(area_id: int, desde: str = None, hasta: str = None) -> list:
    sql = """
        SELECT DiagnosticoID, FechaHora, Usuario, AreaEstudio,
               CultivoEvaluado, Resultado, NombreCientifico,
               Recomendacion, SinAmenaza
        FROM dbo.VW_HistorialDiagnosticos
        WHERE 1=1
    """
    params = []

    if area_id:
        sql += " AND AreaEstudio IN (SELECT Nombre FROM dbo.AreasEstudio WHERE AreaID = ?)"
        params.append(area_id)
    if desde:
        sql += " AND FechaHora >= ?"
        params.append(desde)
    if hasta:
        sql += " AND FechaHora <= ?"
        params.append(hasta)

    sql += " ORDER BY FechaHora DESC"

    with get_db() as (conn, cursor):
        cursor.execute(sql, *params)
        return [
            {
                "diagnosticoId":   r.DiagnosticoID,
                "fechaHora":       str(r.FechaHora),
                "usuario":         r.Usuario,
                "areaEstudio":     r.AreaEstudio,
                "cultivoEvaluado": r.CultivoEvaluado,
                "resultado":       r.Resultado,
                "nombreCientifico": r.NombreCientifico,
                "recomendacion":   r.Recomendacion,
                "sinAmenaza":      bool(r.SinAmenaza),
            }
            for r in cursor.fetchall()
        ]


# ── Obtener síntomas del catálogo ────────────────────────────
def obtener_sintomas(cultivo: str) -> list:
    with get_db() as (conn, cursor):
        cursor.execute("""
            SELECT SintomaID, Descripcion, TipoCultivo
            FROM dbo.CatalogoSintomas
            WHERE TipoCultivo IN (?, 'Ambos') AND Activo = 1
            ORDER BY SintomaID
        """, cultivo)
        return [
            {"sintomaId": r.SintomaID, "descripcion": r.Descripcion, "tipoCultivo": r.TipoCultivo}
            for r in cursor.fetchall()
        ]
