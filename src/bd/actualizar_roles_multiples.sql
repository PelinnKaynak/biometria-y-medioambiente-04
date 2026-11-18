
-- ---------------------------------------------------------
-- AERIS - Migracion a roles multiples
-- Mantiene temporalmente la columna role antigua
-- No elimina usuarios ni datos existentes
-- ---------------------------------------------------------

USE aeris;

-- 1. Añadir los tres roles como booleanos

ALTER TABLE Usuarios
    ADD COLUMN IF NOT EXISTS
        esAdministrador BOOLEAN NOT NULL DEFAULT FALSE
        AFTER role,

    ADD COLUMN IF NOT EXISTS
        esTecnico BOOLEAN NOT NULL DEFAULT FALSE
        AFTER esAdministrador,

    ADD COLUMN IF NOT EXISTS
        esPortador BOOLEAN NOT NULL DEFAULT TRUE
        AFTER esTecnico;


-- 2. Convertir los roles antiguos a los nuevos
-- Ejecutar esta migracion solo una vez

UPDATE Usuarios
SET
    esAdministrador = CASE
        WHEN role = 'administrador' THEN TRUE
        ELSE FALSE
    END,

    esTecnico = CASE
        WHEN role = 'tecnico' THEN TRUE
        ELSE FALSE
    END,

    esPortador = TRUE;


-- 3. Comprobar los resultados

SELECT
    idUsuario,
    role,
    esAdministrador,
    esTecnico,
    esPortador
FROM Usuarios;
