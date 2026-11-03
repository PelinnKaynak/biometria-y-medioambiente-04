-- ---------------------------------------------------------------
-- usuarios.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Crea la base de datos del proyecto y las tablas de usuarios:
-- Roles, Usuarios, Sesiones y RecuperacionesContrasenya.
-- Diseño en doc/bd_design.md. Motor: MySQL / MariaDB (XAMPP)
-- ---------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS aeris
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE aeris;

-- ---------------------------------------------------------------
-- Tabla: Roles
-- Tipos de usuario definidos en el enunciado.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Roles (
  IdRol   INT          NOT NULL,
  Nombre  VARCHAR(20)  NOT NULL,

  PRIMARY KEY (IdRol),
  UNIQUE KEY uk_roles_nombre (Nombre),
  CONSTRAINT ck_roles_nombre
    CHECK (Nombre IN ('administrador', 'portador', 'ciudadano', 'premium', 'tecnico'))
) ENGINE = InnoDB;

INSERT IGNORE INTO Roles (IdRol, Nombre) VALUES
  (1, 'administrador'),
  (2, 'portador'),
  (3, 'ciudadano'),
  (4, 'premium'),
  (5, 'tecnico');

-- ---------------------------------------------------------------
-- Tabla: Usuarios
-- Personas registradas en la plataforma (app y web).
-- La contraseña NUNCA se guarda en claro: solo su hash.
-- Quien se registra desde la app es 'portador' (IdRol = 2).
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Usuarios (
  IdUsuario        INT           NOT NULL AUTO_INCREMENT,
  IdRol            INT           NOT NULL DEFAULT 2,
  Nombre           VARCHAR(50)   NOT NULL,
  Apellidos        VARCHAR(100)  NOT NULL,
  Email            VARCHAR(255)  NOT NULL,
  HashContrasenya  VARCHAR(255)  NOT NULL,
  FechaRegistro    DATETIME      NOT NULL DEFAULT (UTC_TIMESTAMP()),

  PRIMARY KEY (IdUsuario),
  UNIQUE KEY uk_usuarios_email (Email),
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (IdRol) REFERENCES Roles (IdRol)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------
-- Tabla: Sesiones
-- Una fila por sesión abierta (app o web). Se guarda el hash
-- SHA-256 del token, nunca el token.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Sesiones (
  HashToken        CHAR(64)  NOT NULL,
  IdUsuario        INT       NOT NULL,
  FechaCaducidad   DATETIME  NOT NULL,

  PRIMARY KEY (HashToken),
  KEY ix_sesiones_usuario (IdUsuario),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (IdUsuario)
    REFERENCES Usuarios (IdUsuario) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------
-- Tabla: RecuperacionesContrasenya
-- Enlaces de recuperación de contraseña (válidos 1 hora, un solo uso).
-- Se guarda el hash SHA-256 del token, nunca el token.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS RecuperacionesContrasenya (
  HashToken        CHAR(64)  NOT NULL,
  IdUsuario        INT       NOT NULL,
  FechaCaducidad   DATETIME  NOT NULL,
  Usada            BOOLEAN   NOT NULL DEFAULT FALSE,

  PRIMARY KEY (HashToken),
  KEY ix_recuperaciones_usuario (IdUsuario),
  CONSTRAINT fk_recuperaciones_usuario FOREIGN KEY (IdUsuario)
    REFERENCES Usuarios (IdUsuario) ON DELETE CASCADE
) ENGINE = InnoDB;
