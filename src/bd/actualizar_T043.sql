-- ---------------------------------------------------------------
-- actualizar_T043.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Para bases de datos que ya existían (con la tabla Incidencias de
-- T041): crea la tabla MensajesIncidencia, la conversación de cada
-- incidencia (T043), y pasa a ella las respuestas que ya había.
-- No borra ni modifica nada de lo que ya hay: solo crea la tabla y
-- añade filas. Se puede importar más de una vez (no duplica nada).
-- Si la BD se crea desde cero con usuarios.sql no hace falta.
-- Requiere la tabla Incidencias: si falta, importa antes usuarios.sql
-- o actualizar_T041.sql.
-- Diseño en doc/bd_design.md.
-- ---------------------------------------------------------------

USE aeris;

CREATE TABLE IF NOT EXISTS MensajesIncidencia (
    idMensaje INT NOT NULL AUTO_INCREMENT,
    idIncidencia INT NOT NULL,
    idAutor INT NULL,
    texto TEXT NOT NULL,
    fecha DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (idMensaje),
    INDEX idx_mensajes_incidencia (idIncidencia, fecha, idMensaje),
    CONSTRAINT fk_mensajes_incidencias
        FOREIGN KEY (idIncidencia)
        REFERENCES Incidencias(idIncidencia)
        ON DELETE CASCADE,
    CONSTRAINT fk_mensajes_autor
        FOREIGN KEY (idAutor)
        REFERENCES Usuarios(idUsuario)
        ON DELETE SET NULL
) ENGINE = InnoDB;

-- Las respuestas de antes de T043 (columna Incidencias.respuesta) pasan a ser el
-- primer mensaje del técnico en la conversación. La columna se conserva: la siguen
-- usando la web y el panel para enseñar la última respuesta.
-- El NOT EXISTS evita duplicarlas si el script se importa otra vez.
INSERT INTO MensajesIncidencia (idIncidencia, idAutor, texto, fecha)
SELECT i.idIncidencia, i.idResponsable, i.respuesta, COALESCE(i.fechaRespuesta, i.fechaCreacion)
  FROM Incidencias i
 WHERE i.respuesta IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM MensajesIncidencia m
         WHERE m.idIncidencia = i.idIncidencia
           AND m.texto = i.respuesta
           AND m.fecha = COALESCE(i.fechaRespuesta, i.fechaCreacion));
