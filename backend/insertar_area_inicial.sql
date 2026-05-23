-- ============================================================
--  insertar_area_inicial.sql
--  Ejecutar en SSMS si GET /api/areas/1 devuelve 404
--  Esto inserta el Área de Estudio base del proyecto
-- ============================================================

USE MonitoreoAgricola;
GO

-- Solo inserta si no existe ningún área aún
IF NOT EXISTS (SELECT 1 FROM dbo.AreasEstudio)
BEGIN
    INSERT INTO dbo.AreasEstudio
        (Nombre, TipoCultivo, DimensionesM2, FechaInicioMonitoreo, Descripcion, Activa)
    VALUES
        ('Invernadero TecNM', 'Aguacate', 250.00, '2024-09-01',
         'Área experimental para cultivo de aguacate Hass bajo condiciones controladas.', 1);

    PRINT 'Área de estudio insertada correctamente con AreaID = 1';
END
ELSE
BEGIN
    PRINT 'Ya existe al menos un área de estudio registrada:';
    SELECT AreaID, Nombre, TipoCultivo, Activa FROM dbo.AreasEstudio;
END
GO
