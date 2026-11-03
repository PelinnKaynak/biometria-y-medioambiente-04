# Diseño de la base de datos (bd)

Motor: **MySQL / MariaDB** (XAMPP en local).
Base de datos: `aeris` (codificación `utf8mb4`).
Script: [`src/bd/usuarios.sql`](../src/bd/usuarios.sql)

Sigue el diseño de la BD entregado en el Sprint 1. Por ahora están las tablas de usuarios: `Roles` y `Usuarios` (del diseño) y `Sesiones` y `RecuperacionesContrasenya` (nuevas, para la autenticación de T016). El resto (Sensores, Mediciones, TiposMedicion, Umbrales, Incidencias, EstacionesOficiales, MedicionesOficiales, Mapas) se añadirá en las tareas correspondientes.

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
| `IdRol` | INT | FK → Roles, NOT NULL, DEFAULT 2 | Rol. Quien se registra desde la app es 'portador' (2) |
| `Nombre` | VARCHAR(50) | NOT NULL | Nombre |
| `Apellidos` | VARCHAR(100) | NOT NULL | Apellidos |
| `Email` | VARCHAR(255) | NOT NULL, UNIQUE | Correo en minúsculas. Se usa para iniciar sesión |
| `HashContrasenya` | VARCHAR(255) | NOT NULL | `scrypt$<sal>$<hash>`, nunca la contraseña en claro |
| `FechaRegistro` | DATETIME | NOT NULL, DEFAULT UTC_TIMESTAMP | Fecha de creación de la cuenta (UTC) |

## Tabla `Sesiones` (nueva, T016)

Una fila por sesión abierta en la app o en la web.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `HashToken` | CHAR(64) | PK | SHA-256 del token de sesión (nunca el token) |
| `IdUsuario` | INT | FK → Usuarios (ON DELETE CASCADE), NOT NULL | Dueño de la sesión |
| `FechaCaducidad` | DATETIME | NOT NULL | 30 días después de abrirla (UTC) |

## Tabla `RecuperacionesContrasenya` (nueva, T016)

Enlaces enviados por correo para crear una contraseña nueva.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `HashToken` | CHAR(64) | PK | SHA-256 del token del enlace |
| `IdUsuario` | INT | FK → Usuarios (ON DELETE CASCADE), NOT NULL | Usuario que lo pidió |
| `FechaCaducidad` | DATETIME | NOT NULL | 60 minutos después de pedirlo (UTC) |
| `Usada` | BOOLEAN | NOT NULL, DEFAULT FALSE | Un enlace solo se puede usar una vez |

## Aclaraciones

- `Email` es UNIQUE: si se intenta registrar un correo que ya existe, la BD lo rechaza y el servidor responde **409** a la app.
- La app envía el JSON con las claves `nombre`, `apellidos`, `correo` y `contrasena`. La lógica (`logica_design.md`) las guarda en `Nombre`, `Apellidos`, `Email` y calcula `HashContrasenya`.
- Premium es un rol (`IdRol = 4`), no una columna aparte.
- Si se borra un usuario, se borran también sus sesiones y enlaces de recuperación.

## Cómo crear las tablas

1. Abrir XAMPP Control Panel y pulsar **Start** en Apache y MySQL.
2. Abrir `http://localhost/phpmyadmin`.
3. Pestaña **Importar** → seleccionar `src/bd/usuarios.sql` → **Importar**.
4. Debe aparecer la base de datos `aeris` con las tablas `Roles` (5 filas), `Usuarios`, `Sesiones` y `RecuperacionesContrasenya`.

## Prueba del script

Los tests de `src/logica` (`npm test`) crean la BD `aeris_test` desde cero con este mismo script; si el script tiene un error, los tests fallan.
