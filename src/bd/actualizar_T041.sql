-- ---------------------------------------------------------------
-- actualizar_T041.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Para bases de datos que ya existían: crea la tabla Incidencias
-- (la usa la API de incidencias, T041) sin borrar nada.
-- Si se crea la BD desde cero con usuarios.sql no hace falta.
-- Si ya habías importado una versión anterior de este fichero (sin
-- asunto ni idResponsable), borra antes la tabla: DROP TABLE Incidencias;
-- Diseño en doc/bd_design.md.
-- ---------------------------------------------------------------

USE aeris;

CREATE TABLE IF NOT EXISTS Incidencias (
    idIncidencia INT NOT NULL AUTO_INCREMENT,
    idUsuario INT NOT NULL,
    idSensor INT NULL,
    tipo VARCHAR(10) NOT NULL,
    asunto VARCHAR(120) NOT NULL,
    descripcion TEXT NOT NULL,
    estado VARCHAR(10) NOT NULL DEFAULT 'abierta',
    respuesta TEXT NULL,
    idResponsable INT NULL,
    fechaCreacion DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
    fechaRespuesta DATETIME NULL,
    PRIMARY KEY (idIncidencia),
    CONSTRAINT fk_incidencias_usuarios
        FOREIGN KEY (idUsuario)
        REFERENCES Usuarios(idUsuario)
        ON DELETE CASCADE,
    CONSTRAINT fk_incidencias_sensores
        FOREIGN KEY (idSensor)
        REFERENCES Sensores(idSensor)
        ON DELETE SET NULL,
    CONSTRAINT fk_incidencias_responsable
        FOREIGN KEY (idResponsable)
        REFERENCES Usuarios(idUsuario)
        ON DELETE SET NULL,
    CONSTRAINT ck_incidencias_tipo
        CHECK (tipo IN ('sensor', 'datos', 'cuenta', 'otra')),
    CONSTRAINT ck_incidencias_estado
        CHECK (estado IN ('abierta', 'en curso', 'resuelta'))
) ENGINE = InnoDB;
