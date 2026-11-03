# Diseño de la base de datos (bd)

Motor: **MySQL / MariaDB** (XAMPP en local).
Base de datos: `aeris` (codificación `utf8mb4`).
Script: [`src/bd/usuarios.sql`](../src/bd/usuarios.sql)

Sigue el diseño de la BD entregado en el Sprint 1. En esta tarea se crean
solo las tablas `Roles` y `Usuarios`; el resto (Sensores, Mediciones,
TiposMedicion, Umbrales, Incidencias, EstacionesOficiales,
MedicionesOficiales, Mapas) se añadirá en las tareas correspondientes.

## Tabla `Roles`

Tipos de usuario definidos en el enunciado.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `IdRol` | INT | PK | Identificador del rol |
| `Nombre` | VARCHAR(20) | NOT NULL, UNIQUE, CHECK | 'administrador', 'portador', 'ciudadano', 'premium', 'tecnico' |

Filas iniciales: 1 administrador · 2 portador · 3 ciudadano · 4 premium · 5 tecnico.

## Tabla `Usuarios`

Personas registradas en la plataforma (app y web).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `IdUsuario` | INT | PK, AUTO_INCREMENT | Identificador del usuario |
| `IdRol` | INT | FK → Roles, NOT NULL, DEFAULT 3 | Rol. Al registrarse desde la app es 'ciudadano' (3) |
| `Nombre` | VARCHAR(50) | NOT NULL | Nombre |
| `Apellidos` | VARCHAR(100) | NOT NULL | Apellidos |
| `Email` | VARCHAR(255) | NOT NULL, UNIQUE | Correo en minúsculas. Se usa para iniciar sesión |
| `HashContrasenya` | VARCHAR(255) | NOT NULL | Hash de la contraseña, nunca la contraseña en claro |
| `FechaRegistro` | DATETIME | NOT NULL, DEFAULT UTC_TIMESTAMP | Fecha de creación de la cuenta (UTC) |

## Aclaraciones

- `Email` es UNIQUE: si se intenta registrar un correo que ya existe, la BD
  lo rechaza y el servidor responde **409** a la app (ver `doc/app_design.md`).
- La app envía el JSON con las claves `nombre`, `apellidos`, `correo` y
  `contrasena`. El servidor (T016) las guarda en `Nombre`, `Apellidos`,
  `Email` y calcula `HashContrasenya`.
- Premium es un rol (`IdRol = 4`), no una columna aparte.

## Cómo crear las tablas

1. Abrir XAMPP Control Panel y pulsar **Start** en Apache y MySQL.
2. Abrir `http://localhost/phpmyadmin`.
3. Pestaña **Importar** → seleccionar `src/bd/usuarios.sql` → **Importar**.
4. Debe aparecer la base de datos `aeris` con las tablas `Roles` (5 filas) y `Usuarios`.
