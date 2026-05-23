# ============================================================
#  config/db.py — Conexión a SQL Server
#  Cambia DB_USER y DB_PASSWORD por tus credenciales reales
# ============================================================

from contextlib import contextmanager


# ─────────────────────────────────────────────────────────────
# CONFIGURACIÓN TEMPORAL SIN BASE DE DATOS PARA RENDER
# ─────────────────────────────────────────────────────────────

DB_SERVER = ''
DB_NAME = ''
DB_USER = ''
DB_PASSWORD = ''

CONNECTION_STRING = ''


def test_connection():
    """
    Verifica conexión simulada.
    """
    print("[DB] Base de datos deshabilitada temporalmente en Render.")
    return False


@contextmanager
def get_db():
    """
    Context manager temporal sin SQL Server.
    """
    raise Exception(
        "Base de datos deshabilitada temporalmente en Render"
    )
