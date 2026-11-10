-- ---------------------------------------------------------------
-- actualizar_T010.sql
-- Proyecto AERIS - SenseTech (Equipo 04)
-- Para bases de datos creadas ANTES de T010: añade a Usuarios la
-- columna foto (foto de perfil en base64). Si se crea la BD desde
-- cero con usuarios.sql no hace falta. Diseño en doc/bd_design.md.
-- Motor: MariaDB (XAMPP)
-- ---------------------------------------------------------------

USE aeris;

ALTER TABLE Usuarios
  ADD COLUMN IF NOT EXISTS foto MEDIUMTEXT NULL AFTER premiumHasta;
