-- ---------------------------------------------------------------
-- actualizar_T046.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Añade la tabla Lugares (T046) a bases de datos ya creadas.
-- No borra ni modifica datos existentes; se puede ejecutar más de una vez.
-- Si se crea la BD desde cero con usuarios.sql no hace falta.
-- ---------------------------------------------------------------

USE aeris;

CREATE TABLE IF NOT EXISTS Lugares (
    idLugar INT NOT NULL AUTO_INCREMENT,
    idUsuario INT NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    ubicacion POINT NOT NULL,
    avisosActivos BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (idLugar),
    KEY ix_lugares_usuario (idUsuario),
    CONSTRAINT fk_lugares_usuarios
        FOREIGN KEY (idUsuario)
        REFERENCES Usuarios(idUsuario)
        ON DELETE CASCADE,
    CONSTRAINT ck_lugares_tipo
        CHECK (tipo IN ('casa', 'trabajo', 'colegio', 'otro'))
) ENGINE = InnoDB;
