# ============================================================
#  config/db.py — Conexión a SQL Server
#  Cambia DB_USER y DB_PASSWORD por tus credenciales reales
# ============================================================

import pyodbc
from contextlib import contextmanager

# ── Credenciales ─────────────────────────────────────────────
DB_SERVER   = 'Valo'
DB_NAME     = 'MonitoreoAgricola'
DB_USER     = 'Sa'          
DB_PASSWORD = 'valo' 

# ── Cadena de conexión ───────────────────────────────────────
CONNECTION_STRING = (
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER={DB_SERVER};"
    f"DATABASE={DB_NAME};"
    f"UID={DB_USER};"
    f"PWD={DB_PASSWORD};"
    f"TrustServerCertificate=yes;"
)

# ── Context manager para conexiones ─────────────────────────
@contextmanager
def get_db():
    """
    Uso:
        with get_db() as (conn, cursor):
            cursor.execute("SELECT ...")
            rows = cursor.fetchall()
    """
    conn   = None
    cursor = None
    try:
        conn   = pyodbc.connect(CONNECTION_STRING, timeout=10)
        cursor = conn.cursor()
        yield conn, cursor
        conn.commit()
    except pyodbc.Error as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def test_connection():
    """Verifica que la conexión sea exitosa al iniciar la app."""
    try:
        with get_db() as (conn, cursor):
            cursor.execute("SELECT @@VERSION")
            version = cursor.fetchone()[0]
            print(f"[DB] Conexión exitosa: {version[:60]}...")
            return True
    except Exception as e:
        print(f"[DB] ERROR de conexión: {e}")
        return False
