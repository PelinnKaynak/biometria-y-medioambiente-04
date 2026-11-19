USE aeris;

CREATE TABLE IF NOT EXISTS EstadoAlertaPersonal (
    idUsuario INT NOT NULL,
    ultimoEnvio DATETIME(3) NULL,
    PRIMARY KEY (idUsuario),
    CONSTRAINT fk_estado_alerta_personal_usuario
        FOREIGN KEY (idUsuario) REFERENCES Usuarios(idUsuario)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS EstadoAlertaLugar (
    idLugar INT NOT NULL,
    ultimoNivel VARCHAR(20) NULL,
    ultimoEnvio DATETIME(3) NULL,
    PRIMARY KEY (idLugar),
    CONSTRAINT fk_estado_alerta_lugar
        FOREIGN KEY (idLugar) REFERENCES Lugares(idLugar)
        ON DELETE CASCADE
) ENGINE = InnoDB;

-- T020: avisos que cada usuario puede consultar desde la app.
CREATE TABLE IF NOT EXISTS Avisos (
    idAviso INT NOT NULL AUTO_INCREMENT,
    idUsuario INT NOT NULL,
    tipo VARCHAR(10) NOT NULL,
    contaminante VARCHAR(50) NOT NULL,
    valor DOUBLE NOT NULL,
    unidad VARCHAR(20) NOT NULL,
    zona VARCHAR(400) NOT NULL,
    latitud DOUBLE NOT NULL,
    longitud DOUBLE NOT NULL,
    fechaCreacion DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (idAviso),
    KEY ix_avisos_usuario (idUsuario, idAviso),
    CONSTRAINT fk_avisos_usuario
        FOREIGN KEY (idUsuario) REFERENCES Usuarios(idUsuario)
        ON DELETE CASCADE,
    CONSTRAINT ck_avisos_tipo CHECK (tipo IN ('personal', 'lugar'))
) ENGINE = InnoDB;