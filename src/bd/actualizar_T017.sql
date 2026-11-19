-- ---------------------------------------------------------------
-- actualizar_T017.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Para bases de datos que ya existían (T017, mediciones):
--   - el ozono en Contaminantes (las mediciones lo necesitan);
--   - que cada medición se guarde una sola vez aunque la app la
--     reenvíe (mismo sensor, contaminante y segundo).
-- No borra nada y se puede importar más de una vez (MariaDB).
-- Diseño en doc/bd_design.md.
-- ---------------------------------------------------------------

USE aeris;

INSERT IGNORE INTO Contaminantes (nombre, unidad, umbralModerado, umbralMalo, umbralMuyMalo)
VALUES ('O3', 'µg/m³', 100, 180, 240);

ALTER TABLE Mediciones
    ADD UNIQUE KEY IF NOT EXISTS uk_mediciones_unica (idSensor, idContaminante, fechaHora);
