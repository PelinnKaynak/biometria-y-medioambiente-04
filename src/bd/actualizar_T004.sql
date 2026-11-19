-- ---------------------------------------------------------------
-- actualizar_T004.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Para bases de datos que ya existían: da de alta el sensor del
-- nodo montado (src/arduino), etiqueta
-- «092021011003 110406 O3 2109 -38.11», como si lo hubiera comprado
-- pkaynak@upv.edu.es. No borra nada y se puede importar más de una vez.
-- Diseño en doc/bd_design.md.
-- ---------------------------------------------------------------

USE aeris;

INSERT IGNORE INTO Sensores (numeroSerie, sensibilidad, correoCompra)
VALUES ('092021011003', -38.11, 'pkaynak@upv.edu.es');
