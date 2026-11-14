-- ---------------------------------------------------------------
-- actualizar_T005.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Para bases de datos creadas ANTES de la vinculación por correo
-- (T005): crea la tabla Sensores y el sensor de la demo. Si se crea
-- la BD desde cero con usuarios.sql no hace falta.
-- Diseño en doc/bd_design.md.
-- Motor: MariaDB (XAMPP)
-- ---------------------------------------------------------------

USE aeris;

CREATE TABLE IF NOT EXISTS Sensores (
  idSensor             INT           NOT NULL AUTO_INCREMENT,
  numeroSerie          VARCHAR(20)   NOT NULL,
  sensibilidad         DOUBLE        NULL,
  correoCompra         VARCHAR(255)  NOT NULL,
  idUsuario            INT           NULL,
  nombre               VARCHAR(50)   NULL,
  estado               VARCHAR(20)   NULL,
  bateria              INT           NULL,
  ultimaConexion       DATETIME      NULL,
  necesitaCalibracion  BOOLEAN       NOT NULL DEFAULT FALSE,
  luzActiva            BOOLEAN       NOT NULL DEFAULT FALSE,
  idSolicitante        INT           NULL,
  estadoSolicitud      VARCHAR(20)   NULL,
  fechaSolicitud       DATETIME      NULL,

  PRIMARY KEY (idSensor),
  UNIQUE KEY uk_sensores_numero_serie (numeroSerie),
  CONSTRAINT fk_sensores_usuario
    FOREIGN KEY (idUsuario) REFERENCES Usuarios (idUsuario) ON DELETE SET NULL,
  CONSTRAINT fk_sensores_solicitante
    FOREIGN KEY (idSolicitante) REFERENCES Usuarios (idUsuario) ON DELETE SET NULL,
  CONSTRAINT ck_sensores_estado_solicitud
    CHECK (estadoSolicitud IN ('pendiente', 'confirmada', 'rechazada'))
) ENGINE = InnoDB;

INSERT IGNORE INTO Sensores (numeroSerie, correoCompra) VALUES ('092021010920', 'pkaynak@upv.edu.es');
