-- ---------------------------------------------------------------
-- usuarios.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Crea la base de datos del proyecto y la tabla Usuarios.
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
