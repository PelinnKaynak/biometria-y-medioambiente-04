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
