-- ---------------------------------------------------------------
-- usuarios.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Crea la base de datos del proyecto y las tablas Usuarios y Sensores.
-- Sigue el diagrama de la BD en Figma. Diseño en doc/bd_design.md.
-- Motor: MySQL / MariaDB (XAMPP)
-- ---------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS aeris
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE aeris;

-- ---------------------------------------------------------------
-- Tabla: Usuarios
-- Personas registradas en la plataforma (app y web).
-- La contraseña NUNCA se guarda en claro: solo su hash.
-- Quien se registra desde la app es 'portador'.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Usuarios (
  idUsuario     INT           NOT NULL AUTO_INCREMENT,
  role          VARCHAR(20)   NOT NULL DEFAULT 'portador',
  nombre        VARCHAR(50)   NOT NULL,
  apellidos     VARCHAR(100)  NOT NULL,
  email         VARCHAR(255)  NOT NULL,
  passwordHash  VARCHAR(255)  NOT NULL,
  fechaAlta     DATETIME      NOT NULL DEFAULT (UTC_TIMESTAMP()),
  alertas       BOOLEAN       NOT NULL DEFAULT TRUE,
  estado        VARCHAR(20)   NOT NULL DEFAULT 'activo',
  umbralAlerta  DOUBLE        NULL,
  premiumHasta  DATETIME      NULL,
  foto          MEDIUMTEXT    NULL,   -- foto de perfil: JPEG 256x256 en base64 (T010)

  PRIMARY KEY (idUsuario),
  UNIQUE KEY uk_usuarios_email (email),
  CONSTRAINT ck_usuarios_role
    CHECK (role IN ('administrador', 'tecnico', 'portador', 'ciudadano'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------
-- Tabla: Sensores                                         (T005)
-- Los sensores AERIS. Cada sensor está ligado al correo de quien
-- lo compró (correoCompra). En la app no hay compra: los sensores
-- se dan de alta aquí con un correo fijo.
-- Para vincular un sensor a una cuenta, el servidor manda un correo
-- a correoCompra; mientras tanto la petición se guarda en las
-- columnas *Solicitud (sin tabla aparte).
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Sensores (
  idSensor             INT           NOT NULL AUTO_INCREMENT,
  numeroSerie          VARCHAR(20)   NOT NULL,          -- 12 cifras de la etiqueta
  sensibilidad         DOUBLE        NULL,              -- nA/ppm, se guarda al vincular
  correoCompra         VARCHAR(255)  NOT NULL,          -- quien lo compró: confirma la vinculación
  idUsuario            INT           NULL,              -- dueño (NULL = sin vincular)
  nombre               VARCHAR(50)   NULL,
  estado               VARCHAR(20)   NULL,
  bateria              INT           NULL,
  ultimaConexion       DATETIME      NULL,
  necesitaCalibracion  BOOLEAN       NOT NULL DEFAULT FALSE,
  luzActiva            BOOLEAN       NOT NULL DEFAULT FALSE,
  idSolicitante        INT           NULL,              -- quien ha pedido vincularlo
  estadoSolicitud      VARCHAR(20)   NULL,              -- pendiente | confirmada | rechazada
  fechaSolicitud       DATETIME      NULL,              -- cuándo se envió el último correo (UTC)

  PRIMARY KEY (idSensor),
  UNIQUE KEY uk_sensores_numero_serie (numeroSerie),
  CONSTRAINT fk_sensores_usuario
    FOREIGN KEY (idUsuario) REFERENCES Usuarios (idUsuario) ON DELETE SET NULL,
  CONSTRAINT fk_sensores_solicitante
    FOREIGN KEY (idSolicitante) REFERENCES Usuarios (idUsuario) ON DELETE SET NULL,
  CONSTRAINT ck_sensores_estado_solicitud
    CHECK (estadoSolicitud IN ('pendiente', 'confirmada', 'rechazada'))
) ENGINE = InnoDB;

-- Sensor de la demo: el de la etiqueta de pruebas, «comprado» con el correo del equipo
INSERT IGNORE INTO Sensores (numeroSerie, correoCompra) VALUES ('092021010920', 'pkaynak@upv.edu.es');
