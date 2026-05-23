from flask import Flask, request, jsonify
from flask_cors import CORS
import os

from routes.api import api
from config.db import test_connection


def create_app():
    app = Flask(__name__)

    # ── CORS: permite peticiones desde el frontend ───────────
    # En producción cambia origins por la URL real de tu app
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # ── Registrar rutas ──────────────────────────────────────
    app.register_blueprint(api)

    # ── Ruta de verificación ─────────────────────────────────
    @app.route('/health')
    def health():
        return {
            "status": "ok",
            "app": "AgroMonitor TecNM"
        }, 200

    return app


# ESTA LÍNEA ES LA IMPORTANTE PARA RENDER/GUNICORN
app = create_app()


if __name__ == '__main__':

    print("=" * 50)
    print("  AgroMonitor TecNM — Backend Flask")
    print("=" * 50)

    # Verificar conexión a SQL Server al arrancar
    if not test_connection():
        print("[ADVERTENCIA] No se pudo conectar a SQL Server.")
        print("  Revisa las credenciales en config/db.py")
        print("  El servidor seguirá corriendo en modo sin BD.\n")
    else:
        print("[OK] Conexión a SQL Server establecida.\n")

    print("  Servidor corriendo en: http://localhost:5000")
    print("  Presiona Ctrl+C para detener.\n")

    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True  # Cambiar a False en producción
    )
