# ============================================================
#  services/areas.py — RF1 Registro del Área de Estudio
# ============================================================

from config.db import get_db


def listar_areas() -> list:
    with get_db() as (conn, cursor):
        cursor.execute("""
            SELECT AreaID, Nombre, TipoCultivo, DimensionesM2,
                   FechaInicioMonitoreo, Descripcion
            FROM dbo.AreasEstudio
            WHERE Activa = 1
            ORDER BY AreaID
        """)
        return [_row_to_dict(r) for r in cursor.fetchall()]


def obtener_area(area_id: int) -> dict:
    with get_db() as (conn, cursor):
        cursor.execute("""
            SELECT AreaID, Nombre, TipoCultivo, DimensionesM2,
                   FechaInicioMonitoreo, Descripcion
            FROM dbo.AreasEstudio
            WHERE AreaID = ? AND Activa = 1
        """, area_id)
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Área {area_id} no encontrada.")
        return _row_to_dict(row)


def crear_area(data: dict) -> dict:
    _validar(data)
    with get_db() as (conn, cursor):
        cursor.execute("""
            INSERT INTO dbo.AreasEstudio
                (Nombre, TipoCultivo, DimensionesM2, FechaInicioMonitoreo, Descripcion)
            OUTPUT INSERTED.AreaID
            VALUES (?, ?, ?, ?, ?)
        """,
            data['nombre'],
            data['tipoCultivo'],
            data.get('dimensionesM2'),
            data['fechaInicioMonitoreo'],
            data.get('descripcion', '')
        )
        nuevo_id = cursor.fetchone()[0]
        return obtener_area(nuevo_id)


def actualizar_area(area_id: int, data: dict) -> dict:
    _validar(data)
    with get_db() as (conn, cursor):
        cursor.execute("""
            UPDATE dbo.AreasEstudio
            SET Nombre = ?, TipoCultivo = ?, DimensionesM2 = ?,
                FechaInicioMonitoreo = ?, Descripcion = ?
            WHERE AreaID = ?
        """,
            data['nombre'],
            data['tipoCultivo'],
            data.get('dimensionesM2'),
            data['fechaInicioMonitoreo'],
            data.get('descripcion', ''),
            area_id
        )
        return obtener_area(area_id)


def _validar(data: dict):
    if not data.get('nombre'):
        raise ValueError("El nombre del área es obligatorio.")
    if data.get('tipoCultivo') not in ('Aguacate', 'Pitahaya'):
        raise ValueError("TipoCultivo debe ser 'Aguacate' o 'Pitahaya'.")
    if not data.get('fechaInicioMonitoreo'):
        raise ValueError("La fecha de inicio es obligatoria.")


def _row_to_dict(r) -> dict:
    return {
        "areaId":               r.AreaID,
        "nombre":               r.Nombre,
        "tipoCultivo":          r.TipoCultivo,
        "dimensionesM2":        float(r.DimensionesM2) if r.DimensionesM2 else None,
        "fechaInicioMonitoreo": str(r.FechaInicioMonitoreo),
        "descripcion":          r.Descripcion or '',
    }
