# Diseño de la base de datos (bd)

Motor: **MySQL / MariaDB** (XAMPP en local).
Base de datos: `aeris` (codificación `utf8mb4`).
Script: [`src/bd/usuarios.sql`](../src/bd/usuarios.sql)

Sigue el diagrama de la BD en Figma (enlace en el README). Por ahora está la tabla `Usuarios`. Las sesiones y los enlaces de recuperación de contraseña de T016 son tokens firmados por el servidor, así que no necesitan tablas (ver `logica_design.md`). El resto (Sensores, Mediciones, Contaminantes, Lugares, MovimientosPuntos, Insignias, UsuarioInsignia, Recompensas, Canjes, Campañas, ZonasSensibles) se añadirá en las tareas correspondientes.

## Tabla `Usuarios`

Personas registradas en la plataforma (app y web). Igual que en el diagrama de Figma.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `idUsuario` | INT | PK, AUTO_INCREMENT | Identificador del usuario |
| `role` | VARCHAR(20) | NOT NULL, DEFAULT 'portador', CHECK | 'administrador', 'tecnico', 'portador', 'ciudadano'. Quien se registra desde la app es 'portador' |
| `nombre` | VARCHAR(50) | NOT NULL | Nombre |
| `apellidos` | VARCHAR(100) | NOT NULL | Apellidos |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | Correo en minúsculas. Se usa para iniciar sesión |
| `passwordHash` | VARCHAR(255) | NOT NULL | `scrypt$<sal>$<hash>`, nunca la contraseña en claro |
| `fechaAlta` | DATETIME | NOT NULL, DEFAULT UTC_TIMESTAMP | Fecha de creación de la cuenta (UTC) |
| `alertas` | BOOLEAN | NOT NULL, DEFAULT TRUE | Si quiere recibir alertas |
| `estado` | VARCHAR(20) | NOT NULL, DEFAULT 'activo' | Estado de la cuenta |
| `umbralAlerta` | DOUBLE | NULL | Umbral de alerta elegido (perfil); NULL = el de por defecto |
| `premiumHasta` | DATETIME | NULL | Hasta cuándo es premium; NULL = no es premium |

## Aclaraciones

- `email` es UNIQUE: si se intenta registrar un correo que ya existe, la BD lo rechaza y el servidor responde **409** a la app.
- La app envía el JSON con las claves `nombre`, `apellidos`, `correo` y `contrasena`. La lógica (`logica_design.md`) las guarda en `nombre`, `apellidos`, `email` y calcula `passwordHash`.
- Premium no es un rol: un usuario es premium mientras `premiumHasta` sea una fecha futura.

## Cómo crear las tablas

1. Abrir XAMPP Control Panel y pulsar **Start** en Apache y MySQL.
2. Abrir `http://localhost/phpmyadmin`.
3. Pestaña **Importar** → seleccionar `src/bd/usuarios.sql` → **Importar**.
4. Debe aparecer la base de datos `aeris` con la tabla `Usuarios`.

## Prueba del script

Los tests de `src/logica` (`npm test`) crean la BD `aeris_test` desde cero con este mismo script; si el script tiene un error, los tests fallan.
