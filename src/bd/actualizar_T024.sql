-- ---------------------------------------------------------------
-- actualizar_T024.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Para bases de datos creadas ANTES de T024: da de alta el ozono
-- en Contaminantes, que es lo que buscan /miCuenta y /miExposicion.
-- Si se crea la BD desde cero con usuarios.sql no hace falta.
-- Diseño en doc/bd_design.md.
-- Motor: MariaDB (XAMPP)
-- ---------------------------------------------------------------

USE aeris;

INSERT IGNORE INTO Contaminantes (nombre, unidad, umbralModerado, umbralMalo, umbralMuyMalo)
VALUES ('Ozono', 'µg/m³', 100, 180, 240);