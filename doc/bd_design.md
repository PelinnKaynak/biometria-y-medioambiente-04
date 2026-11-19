# Diseño de la base de datos (bd)

Motor: **MySQL / MariaDB** (XAMPP en local).
Base de datos: `aeris` (codificación `utf8mb4`).
Script: [`src/bd/usuarios.sql`](../src/bd/usuarios.sql)

Sigue el diagrama de la BD en Figma (enlace en el README). Ahora están las tablas `Usuarios`, `Contaminantes`, `Sensores`, `Mediciones` (T015), `Incidencias` (T041), `MensajesIncidencia` (T043) y `Lugares` (T046), más las columnas de la solicitud de vinculación en `Sensores` (T005). Las sesiones y los enlaces de recuperación de contraseña de T016 son tokens firmados por el servidor, así que no necesitan tablas (ver `logica_design.md`). El resto (MovimientosPuntos, Insignias, UsuarioInsignia, Recompensas, Canjes, Campañas, ZonasSensibles) se añadirá en las tareas correspondientes.

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
| `foto` | MEDIUMTEXT | NULL | Foto de perfil: JPEG de 256×256 en base64 (unos 30 KB); NULL = sin foto. Añadida en T010 |

## Tabla `Contaminantes` (T015)

Contaminantes que puede medir AERIS y sus umbrales.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `idContaminante` | INT | PK, AUTO_INCREMENT | Identificador |
| `nombre` | VARCHAR(100) | NOT NULL, UNIQUE | Nombre (p. ej. O3) |
| `unidad` | VARCHAR(20) | NOT NULL | Unidad de medida |
| `umbralModerado`, `umbralMalo`, `umbralMuyMalo` | DOUBLE | NULL | Límites de cada nivel |

## Tabla `Sensores` (T015 + T005)

Sensores fabricados. Cada uno está ligado al correo de quien lo compró. La solicitud de vinculación se guarda en la misma fila (no hace falta otra tabla).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `idSensor` | INT | PK, AUTO_INCREMENT | Identificador del sensor |
| `numeroSerie` | VARCHAR(100) | NOT NULL, UNIQUE | Número de serie del código QR |
| `sensibilidad` | DOUBLE | NOT NULL | Sensibilidad del QR (calibración) |
| `correoCompra` | VARCHAR(255) | NOT NULL | Correo de quien lo compró; ahí se manda el correo de confirmación (T005) |
| `idUsuario` | INT | FK → Usuarios, NULL, ON DELETE RESTRICT | Dueño del sensor; NULL = sin vincular |
| `nombre` | VARCHAR(100) | NOT NULL, DEFAULT 'Sensor AERIS' | Nombre que ve el usuario |
| `estado` | VARCHAR(20) | NOT NULL, DEFAULT 'inactivo' | Estado del sensor |
| `bateria` | INT | NULL, CHECK 0–100 | Batería en % |
| `ultimaConexion` | DATETIME | NULL | Última vez que envió datos |
| `necesitaCalibracion`, `luzActiva` | BOOLEAN | NOT NULL, DEFAULT FALSE | Datos del sensor del diagrama |
| `idSolicitante` | INT | FK → Usuarios, NULL, ON DELETE SET NULL | Quién ha pedido vincularlo (T005) |
| `estadoSolicitud` | VARCHAR(20) | NULL, CHECK | 'pendiente', 'confirmada' o 'rechazada' (T005) |
| `fechaSolicitud` | DATETIME | NULL | Cuándo se pidió o se reenvió el correo, UTC (T005) |

`idUsuario` admite NULL porque un sensor recién fabricado todavía no tiene dueño: se rellena cuando el comprador confirma la vinculación.

Como no hay compra en la app, el script mete dos sensores de prueba comprados con `pkaynak@upv.edu.es`: `092021010920` y `092021011003` (el del nodo montado, T004). Si la BD ya estaba creada, `src/bd/actualizar_T004.sql` añade el segundo.

## Tabla `Mediciones` (T015)

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `idMedicion` | INT | PK, AUTO_INCREMENT | Identificador |
| `idSensor` | INT | FK → Sensores, NOT NULL | Sensor que midió |
| `idUsuario` | INT | FK → Usuarios, NOT NULL | Usuario que llevaba el sensor |
| `idContaminante` | INT | FK → Contaminantes, NOT NULL | Qué se midió |
| `valorMedicion` | DOUBLE | NOT NULL | Valor medido |
| `ubicacion` | POINT | NOT NULL | Dónde se midió |
| `fechaHora` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Cuándo se midió (la hora del móvil al recibir la trama) |

Clave única `uk_mediciones_unica (idSensor, idContaminante, fechaHora)`: una medición reenviada por la app (sin conexión) no se guarda dos veces (T017). `ubicacion` es `POINT(longitud, latitud)`.

El script mete en `Contaminantes` el ozono: `O3`, en µg/m³, con los umbrales 100 (valor guía de la OMS), 180 (información) y 240 (alerta).

## Tabla `Incidencias` (T041)

Las que el usuario envía desde Ayuda (app y web). Las reciben y las responden los técnicos y los administradores. Sigue el diagrama de Figma y añade `asunto` e `idResponsable`, que pide el diseño de la pantalla Ayuda (título de cada incidencia y «Respuesta de Marc (técnico)»).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `idIncidencia` | INT | PK, AUTO_INCREMENT | Identificador |
| `idUsuario` | INT | FK → Usuarios, NOT NULL, ON DELETE CASCADE | Quién la envió |
| `idSensor` | INT | FK → Sensores, NULL, ON DELETE SET NULL | Sensor del que se habla; NULL si no va de un sensor (p. ej. la cuenta) |
| `tipo` | VARCHAR(10) | NOT NULL, CHECK | 'sensor', 'datos', 'cuenta' u 'otra' |
| `asunto` | VARCHAR(120) | NOT NULL | Título corto que escribe el usuario (el de la tarjeta en «Mis incidencias») |
| `descripcion` | TEXT | NOT NULL | Lo que escribe el usuario |
| `estado` | VARCHAR(10) | NOT NULL, DEFAULT 'abierta', CHECK | 'abierta', 'en curso' o 'resuelta' |
| `respuesta` | TEXT | NULL | Última respuesta del técnico o administrador (la sigue usando la web; la conversación completa está en `MensajesIncidencia`, T043) |
| `idResponsable` | INT | FK → Usuarios, NULL, ON DELETE SET NULL | Técnico o administrador que respondió (su nombre sale junto a la respuesta) |
| `fechaCreacion` | DATETIME | NOT NULL, DEFAULT UTC_TIMESTAMP | Cuándo se envió (UTC) |
| `fechaRespuesta` | DATETIME | NULL | Cuándo se respondió (UTC) |

## Tabla `MensajesIncidencia` (T043)

La conversación de cada incidencia desde la pantalla Ayuda de la app (y desde el panel): lo que el usuario añade después de enviarla y lo que responden los técnicos y los administradores, por orden de fecha. **No hay una tabla de mensajes distinta**: esta es la única. La descripción de la incidencia es el primer mensaje del usuario y se queda en `Incidencias.descripcion` (no se copia aquí).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `idMensaje` | INT | PK, AUTO_INCREMENT | Identificador |
| `idIncidencia` | INT | FK → Incidencias, NOT NULL, ON DELETE CASCADE | Incidencia a la que pertenece; al borrarla se borran sus mensajes |
| `idAutor` | INT | FK → Usuarios, NULL, ON DELETE SET NULL | Quién lo escribió: el usuario de la incidencia o un técnico o administrador. NULL si se borró su cuenta |
| `texto` | TEXT | NOT NULL | El mensaje (la lógica admite hasta 2000 caracteres) |
| `fecha` | DATETIME | NOT NULL, DEFAULT UTC_TIMESTAMP | Cuándo se escribió (UTC) |

El índice `idx_mensajes_incidencia (idIncidencia, fecha, idMensaje)` sirve para leer la conversación en orden y para la clave foránea. El rol del autor no se guarda: se calcula al leer, con los roles que tenga el usuario (el mismo método que ya usa «Respuesta de Marc (técnico)»).

## Tabla `Lugares` (T046 · H034, H035)

Lugares habituales, privados por usuario. La app envía la dirección y sus coordenadas; el servidor guarda `POINT(longitud, latitud)` y la preferencia de avisos.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `idLugar` | INT | PK, AUTO_INCREMENT | Identificador del lugar |
| `idUsuario` | INT | FK → Usuarios, NOT NULL, ON DELETE CASCADE | Propietario |
| `nombre` | VARCHAR(80) | NOT NULL | Nombre elegido por el usuario |
| `tipo` | VARCHAR(20) | NOT NULL, CHECK | `casa`, `trabajo`, `colegio` u `otro` |
| `direccion` | VARCHAR(255) | NOT NULL | Dirección o municipio para mostrar |
| `ubicacion` | POINT | NOT NULL | Coordenadas validadas; se usa para interpolar el ozono |
| `avisosActivos` | BOOLEAN | NOT NULL, DEFAULT TRUE | Preferencia de avisos del lugar |

## Aclaraciones

- `email` es UNIQUE: si se intenta registrar un correo que ya existe, la BD lo rechaza y el servidor responde **409** a la app.
- La app envía el JSON con las claves `nombre`, `apellidos`, `correo` y `contrasena`. La lógica (`logica_design.md`) las guarda en `nombre`, `apellidos`, `email` y calcula `passwordHash`.
- La foto se guarda en la misma tabla (una columna, no una tabla nueva) para que se vea en cualquier teléfono donde el usuario inicie sesión.
- Premium no es un rol: un usuario es premium mientras `premiumHasta` sea una fecha futura.

## Cómo crear las tablas

1. Abrir XAMPP Control Panel y pulsar **Start** en Apache y MySQL.
2. Abrir `http://localhost/phpmyadmin`.
3. Pestaña **Importar** → seleccionar `src/bd/usuarios.sql` → **Importar**.
4. Debe aparecer la base de datos `aeris` con las tablas `Usuarios`, `Contaminantes`, `Sensores`, `Mediciones`, `Incidencias`, `MensajesIncidencia` y `Lugares`.

**Instalación limpia (BD nueva):** basta con `src/bd/usuarios.sql`, que ya incluye `MensajesIncidencia`. No hay que importar ningún `actualizar_*.sql`.

**Si la BD ya estaba creada antes de T010:** importar también `src/bd/actualizar_T010.sql`, que añade la columna `foto` sin borrar los usuarios.

**Si la BD ya estaba creada** (con la tabla `Sensores` antigua de T005 o con la de T015 sin las columnas de vinculación): importar primero `src/bd/usuarios.sql` y después `src/bd/actualizar_T005.sql`. Añade las columnas que falten y el sensor de prueba sin borrar nada. Se puede importar más de una vez. Usa sintaxis de MariaDB (la de XAMPP y la del servidor de la UPV).

**Si la BD ya estaba creada antes de T017:** importar `src/bd/actualizar_T017.sql`, que añade el ozono a `Contaminantes` y la clave única de `Mediciones`. Se puede importar más de una vez.

**Si la BD ya estaba creada antes de T041:** importar `src/bd/actualizar_T041.sql`, que crea la tabla `Incidencias` sin borrar nada. Si ya se había importado una versión anterior (sin `asunto` ni `idResponsable`), borrar antes la tabla con `DROP TABLE Incidencias;`.

**Si la BD ya estaba creada antes de T043:** importar `src/bd/actualizar_T043.sql`, que crea `MensajesIncidencia` y pasa a ella las respuestas que ya había en `Incidencias.respuesta`, para que salgan en la conversación. **No borra ni cambia nada** (solo crea la tabla y añade filas) y se puede importar más de una vez sin duplicar mensajes. Requiere que exista la tabla `Incidencias` (de T041).

**Si la BD ya estaba creada antes de T046:** importar `src/bd/actualizar_T046.sql`, que crea `Lugares` sin borrar nada. Se puede importar más de una vez.

## Prueba del script

Los tests de `src/logica` (`npm test`) crean la BD `aeris_test` desde cero con este mismo script; si el script tiene un error, los tests fallan.
