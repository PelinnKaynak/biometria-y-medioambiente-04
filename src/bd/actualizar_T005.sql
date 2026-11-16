-- ---------------------------------------------------------------
-- actualizar_T005.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Para bases de datos que ya existían: deja la tabla Sensores como
-- en usuarios.sql (vinculación del sensor confirmada por correo,
-- T005) sin borrar nada.
--   1. Importar antes usuarios.sql (crea las tablas que falten).
--   2. Importar este fichero.
-- Si se crea la BD desde cero con usuarios.sql no hace falta.
-- Diseño en doc/bd_design.md.
-- Motor: MariaDB (XAMPP). Usa ADD COLUMN IF NOT EXISTS, que MySQL no tiene.
-- ---------------------------------------------------------------

USE aeris;

-- Valores para las filas antiguas que tenían estas columnas vacías
UPDATE Sensores SET sensibilidad = -44.75 WHERE sensibilidad IS NULL;
UPDATE Sensores SET nombre = 'Sensor AERIS' WHERE nombre IS NULL;
UPDATE Sensores SET estado = 'inactivo' WHERE estado IS NULL;

ALTER TABLE Sensores
    ADD COLUMN IF NOT EXISTS correoCompra VARCHAR(255) NOT NULL DEFAULT '' AFTER sensibilidad,
    ADD COLUMN IF NOT EXISTS idSolicitante INT NULL,
    ADD COLUMN IF NOT EXISTS estadoSolicitud VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS fechaSolicitud DATETIME NULL,
    MODIFY numeroSerie VARCHAR(100) NOT NULL,
    MODIFY sensibilidad DOUBLE NOT NULL,
    MODIFY idUsuario INT NULL,
    MODIFY nombre VARCHAR(100) NOT NULL DEFAULT 'Sensor AERIS',
    MODIFY estado VARCHAR(20) NOT NULL DEFAULT 'inactivo';

ALTER TABLE Sensores MODIFY correoCompra VARCHAR(255) NOT NULL;

ALTER TABLE Sensores
    ADD FOREIGN KEY IF NOT EXISTS fk_sensores_solicitante (idSolicitante)
        REFERENCES Usuarios (idUsuario) ON DELETE SET NULL;

ALTER TABLE Sensores
    ADD CONSTRAINT IF NOT EXISTS ck_sensores_estado_solicitud
        CHECK (estadoSolicitud IN ('pendiente', 'confirmada', 'rechazada'));

-- Sensor de prueba (en la app no hay compra)
INSERT IGNORE INTO Sensores (numeroSerie, sensibilidad, correoCompra)
VALUES ('092021010920', -44.75, 'pkaynak@upv.edu.es');
UPDATE Sensores SET correoCompra = 'pkaynak@upv.edu.es' WHERE numeroSerie = '092021010920';
