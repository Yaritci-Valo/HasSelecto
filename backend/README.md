# AgroMonitor TecNM — Backend

## Estructura del proyecto

```
agromonitor_backend/
├── app.py                  ← Punto de entrada, ejecutar este archivo
├── requirements.txt        ← Dependencias Python
├── config/
│   └── db.py               ← Conexión a SQL Server (editar credenciales)
├── routes/
│   └── api.py              ← Todos los endpoints REST
└── services/
    ├── usuarios.py         ← RF10 Identificación de usuario
    ├── areas.py            ← RF1  Área de estudio
    ├── lecturas.py         ← RF2/RF3 Carga CSV e históricos
    ├── diagnosticos.py     ← RF6/RF7/RF12 Asistente y motor de inferencia
    └── reporte.py          ← RF8 Generación de PDF
```

## Instalación paso a paso

### 1. Instalar Python 3.11+
Descarga desde https://python.org y marca la casilla "Add to PATH".

### 2. Instalar el driver ODBC de SQL Server
Descarga "ODBC Driver 17 for SQL Server" desde:
https://aka.ms/downloadmsodbcsql

### 3. Crear entorno virtual y instalar dependencias
Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux

pip install -r requirements.txt
```

### 4. Configurar credenciales de SQL Server
Edita el archivo `config/db.py` y cambia:

```python
DB_SERVER   = 'localhost'
DB_NAME     = 'MonitoreoAgricola'
DB_USER     = 'sa'           # tu usuario de SQL Server
DB_PASSWORD = 'TuPassword1'  # tu contraseña
```

### 5. Ejecutar el script SQL
Abre SQL Server Management Studio (SSMS), carga y ejecuta el archivo
`monitoreo_agricola.sql` para crear la base de datos y tablas.

### 6. Iniciar el servidor

```bash
python app.py
```

El servidor quedará corriendo en: http://localhost:5000

---

## Endpoints disponibles

| Método | Endpoint                | Descripción                        |
|--------|-------------------------|------------------------------------|
| POST   | /api/usuarios           | Registrar/recuperar usuario        |
| GET    | /api/usuarios           | Listar usuarios                    |
| GET    | /api/areas              | Listar áreas de estudio            |
| POST   | /api/areas              | Crear área de estudio              |
| PUT    | /api/areas/:id          | Actualizar área de estudio         |
| POST   | /api/cargar-csv         | Subir y procesar archivo CSV       |
| GET    | /api/lecturas           | Consultar lecturas por fecha       |
| GET    | /api/estadisticos       | Estadísticos del período           |
| GET    | /api/cargas             | Historial de archivos cargados     |
| GET    | /api/exportar-csv       | Descargar lecturas como CSV        |
| GET    | /api/sintomas           | Catálogo de síntomas por cultivo   |
| POST   | /api/diagnosticos       | Guardar diagnóstico con resultado  |
| GET    | /api/diagnosticos       | Historial de diagnósticos          |
| GET    | /api/reporte-pdf        | Descargar reporte PDF              |
| GET    | /health                 | Verificar que el servidor corre    |

---

## Ejemplo de prueba con Postman

**Registrar usuario:**
```
POST http://localhost:5000/api/usuarios
Body (JSON): { "nombre": "Ing. García López" }
```

**Cargar CSV:**
```
POST http://localhost:5000/api/cargar-csv
Form-data:
  archivo  = [seleccionar archivo .csv]
  areaId   = 1
  usuarioId = 1
```

**Obtener lecturas:**
```
GET http://localhost:5000/api/lecturas?areaId=1&desde=2025-03-01&hasta=2025-03-31
```

**Generar reporte PDF:**
```
GET http://localhost:5000/api/reporte-pdf?areaId=1&areaNombre=Invernadero TecNM&cultivo=Aguacate&desde=2025-03-01&hasta=2025-03-31&usuario=Ing. García
```
