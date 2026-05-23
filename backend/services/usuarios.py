# ============================================================
#  services/usuarios.py — RF10 Identificación de usuario
# ============================================================

from config.db import get_db


def registrar_o_recuperar(nombre: str) -> dict:
    """
    Si el nombre ya existe lo devuelve.
    Si no existe lo crea y lo devuelve.
    """
    nombre = nombre.strip()
    if not nombre:
        raise ValueError("El nombre no puede estar vacío.")

    with get_db() as (conn, cursor):
        # Buscar si ya existe
        cursor.execute(
            "SELECT UsuarioID, Nombre FROM dbo.Usuarios WHERE Nombre = ? AND Activo = 1",
            nombre
        )
        row = cursor.fetchone()
        if row:
            return {"usuarioId": row.UsuarioID, "nombre": row.Nombre, "nuevo": False}

        # Crear nuevo usuario
        cursor.execute(
            "INSERT INTO dbo.Usuarios (Nombre) OUTPUT INSERTED.UsuarioID VALUES (?)",
            nombre
        )
        nuevo_id = cursor.fetchone()[0]
        return {"usuarioId": nuevo_id, "nombre": nombre, "nuevo": True}


def listar_usuarios() -> list:
    with get_db() as (conn, cursor):
        cursor.execute(
            "SELECT UsuarioID, Nombre, FechaAlta FROM dbo.Usuarios WHERE Activo = 1 ORDER BY Nombre"
        )
        return [
            {"usuarioId": r.UsuarioID, "nombre": r.Nombre, "fechaAlta": str(r.FechaAlta)}
            for r in cursor.fetchall()
        ]
