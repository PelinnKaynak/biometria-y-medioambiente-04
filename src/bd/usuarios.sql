-- ---------------------------------------------------------------
-- usuarios.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Crea la base de datos del proyecto y las tablas Roles y Usuarios,
-- según el diseño de la BD del Sprint 1.
-- Motor: MySQL / MariaDB (XAMPP)
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
-- La contraseña NUNCA se guarda en claro: el servidor guarda
-- solo su hash (T016).
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Usuarios (
  IdUsuario        INT           NOT NULL AUTO_INCREMENT,
  IdRol            INT           NOT NULL DEFAULT 3,
  Nombre           VARCHAR(50)   NOT NULL,
  Apellidos        VARCHAR(100)  NOT NULL,
  Email            VARCHAR(255)  NOT NULL,
  HashContrasenya  VARCHAR(255)  NOT NULL,
  FechaRegistro    DATETIME      NOT NULL DEFAULT (UTC_TIMESTAMP()),

  PRIMARY KEY (IdUsuario),
  UNIQUE KEY uk_usuarios_email (Email),
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (IdRol) REFERENCES Roles (IdRol)
) ENGINE = InnoDB;
