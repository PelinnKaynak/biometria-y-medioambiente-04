-- ---------------------------------------------------------------
-- usuarios.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Crea la base de datos del proyecto y sus tablas: Usuarios,
-- Contaminantes, Sensores, Mediciones e Incidencias.
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
-- Tabla: Contaminantes
-- Almacena los contaminantes que puede medir AERIS.
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Contaminantes (
    idContaminante INT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    unidad VARCHAR(20) NOT NULL,
    umbralModerado DOUBLE NULL,
    umbralMalo DOUBLE NULL,
    umbralMuyMalo DOUBLE NULL,

    PRIMARY KEY (idContaminante),
    UNIQUE KEY uk_contaminantes_nombre (nombre)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------
-- Tabla: Sensores
-- Cada sensor está ligado al correo de quien lo compró
-- (correoCompra). No tiene dueño (idUsuario NULL) hasta que ese
-- correo confirma la vinculación (T005). La solicitud se guarda en
-- la misma fila: quién la pide, su estado y cuándo.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Sensores (
    idSensor INT NOT NULL AUTO_INCREMENT,
    numeroSerie VARCHAR(100) NOT NULL,
    sensibilidad DOUBLE NOT NULL,
    correoCompra VARCHAR(255) NOT NULL,
    idUsuario INT NULL,
    nombre VARCHAR(100) NOT NULL DEFAULT 'Sensor AERIS',
    estado VARCHAR(20) NOT NULL DEFAULT 'inactivo',
    bateria INT NULL,
    ultimaConexion DATETIME NULL,
    necesitaCalibracion BOOLEAN NOT NULL DEFAULT FALSE,
    luzActiva BOOLEAN NOT NULL DEFAULT FALSE,
    idSolicitante INT NULL,
    estadoSolicitud VARCHAR(20) NULL,
    fechaSolicitud DATETIME NULL,
    PRIMARY KEY (idSensor),
    CONSTRAINT uk_sensores_numero_serie
        UNIQUE (numeroSerie),
    CONSTRAINT fk_sensores_usuarios
        FOREIGN KEY (idUsuario)
        REFERENCES Usuarios(idUsuario)
        ON DELETE RESTRICT,
    CONSTRAINT fk_sensores_solicitante
        FOREIGN KEY (idSolicitante)
        REFERENCES Usuarios(idUsuario)
        ON DELETE SET NULL,
    CONSTRAINT ck_sensores_bateria
        CHECK (bateria BETWEEN 0 AND 100),
    CONSTRAINT ck_sensores_estado_solicitud
        CHECK (estadoSolicitud IN ('pendiente', 'confirmada', 'rechazada'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------
-- Tabla: Mediciones
-- Guarda las mediciones de los sensores ambientales.
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Mediciones (
    idMedicion INT NOT NULL AUTO_INCREMENT,
    idSensor INT NOT NULL,
    idUsuario INT NOT NULL,
    idContaminante INT NOT NULL,
    valorMedicion DOUBLE NOT NULL,
    ubicacion POINT NOT NULL,
    fechaHora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (idMedicion),

    CONSTRAINT fk_mediciones_sensores
        FOREIGN KEY (idSensor)
        REFERENCES Sensores(idSensor)
        ON DELETE RESTRICT,

    CONSTRAINT fk_mediciones_usuarios
        FOREIGN KEY (idUsuario)
        REFERENCES Usuarios(idUsuario)
        ON DELETE RESTRICT,

    CONSTRAINT fk_mediciones_contaminantes
        FOREIGN KEY (idContaminante)
        REFERENCES Contaminantes(idContaminante)
        ON DELETE RESTRICT,

    -- Una medición se guarda una sola vez aunque la app la reenvíe (T017)
    CONSTRAINT uk_mediciones_unica
        UNIQUE (idSensor, idContaminante, fechaHora)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------
-- Tabla: Incidencias (T036/T041)
-- Las que el usuario envía desde Ayuda (app y web). Las reciben y
-- las responden los técnicos y los administradores.
-- idSensor puede ser NULL (por ejemplo, una incidencia de la cuenta).
-- idResponsable es el técnico o administrador que respondió (sale
-- su nombre junto a la respuesta); NULL mientras no hay respuesta.
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- Contaminantes (T017). Los nodos AERIS miden ozono. Umbrales en
-- µg/m³: valor guía de la OMS (100), umbral de información (180) y
-- umbral de alerta (240), los mismos que el mapa y la app.
-- ---------------------------------------------------------------
INSERT IGNORE INTO Contaminantes (nombre, unidad, umbralModerado, umbralMalo, umbralMuyMalo)
VALUES ('O3', 'µg/m³', 100, 180, 240);

-- ---------------------------------------------------------------
-- Sensores de prueba (T005, T004). En la app no hay compra: se dan
-- de alta como si los hubiera comprado pkaynak@upv.edu.es.
-- Número de serie y sensibilidad del código de su etiqueta.
-- 092021011003 es el sensor del nodo montado (src/arduino).
-- ---------------------------------------------------------------
INSERT IGNORE INTO Sensores (numeroSerie, sensibilidad, correoCompra)
VALUES ('092021010920', -44.75, 'pkaynak@upv.edu.es'),
       ('092021011003', -38.11, 'pkaynak@upv.edu.es');
