# Diseño del componente: servidor REST

**Equipo:** 04 – SenseTech · **Sprint:** 2 · **Implementación:** `src/servidor_rest/` (Node.js con Express)

---

## 1. API de usuarios y autenticación (T016 · H001, H002)

```text
App / Web --HTTP JSON--> ServidorREST (Express) --> ReglasREST --> Logica (logica_design.md)
                                       |--> Autorizacion.requiereSesion()  (token y rol)
mainServidorREST --> .env, Logica.crear(), EnviadorCorreo, listen(8080)
```

### Contrato REST

Todas las peticiones y respuestas son JSON (`Content-Type: application/json`). Las rutas con 🔒 necesitan la cabecera `Authorization: Bearer <token>`.

| Método y ruta | Cuerpo | Respuestas |
|---|---|---|
| `POST /registrarUsuario` | `{ nombre, apellidos, correo, contrasena }` | **201** `{ idUsuario, token, rol, nombre }` · **400** `{ error, campos }` · **409** correo ya registrado |
| `POST /iniciarSesion` | `{ correo, contrasena }` | **200** `{ idUsuario, token, rol, nombre }` · **401** correo o contraseña incorrectos |
| `GET /usuarioActual` 🔒 | — | **200** `{ idUsuario, nombre, apellidos, correo, rol, fechaAlta, alertas, premiumHasta, foto, sensor, numeroSerie }` · **401** — `sensor` (nombre) y `numeroSerie` del sensor vinculado, o `null` (T017) |
| `GET /miSensor` 🔒 | — | **200** `{ nombre, numeroSerie, bateria, ultimaConexion }` · **404** sin sensor · **401** — información del sensor de la cuenta (T011); batería y última conexión pueden ser `null` |
| `DELETE /miSensor` 🔒 | — | **204** desvinculado · **404** sin sensor · **401** — quita la asociación y revierte el rol a ciudadano si era el último sensor (T011) |
| `POST /cambiarAlertas` 🔒 | `{ alertas: true \| false }` | **204** guardado · **400** valor no válido · **401** — interruptor «Notificaciones» del perfil (T010) |
| `POST /actualizarDatos` 🔒 | `{ nombre, apellidos, correo }` | **200** `{ nombre, apellidos, correo }` · **400** `{ error, campos }` · **409** el correo es de otra cuenta · **401** — «Editar mis datos» (T010) |
| `POST /cambiarContrasenya` 🔒 | `{ contrasenaActual, contrasenaNueva }` | **200** `{ idUsuario, token, rol, nombre }` (sesión nueva) · **400** contraseña débil · **403** la contraseña actual no es correcta · **401** (T010) |
| `POST /cambiarFoto` 🔒 | `{ foto: base64 \| null }` | **204** · **400** no es una imagen JPEG/PNG válida · **401** — foto de perfil (T010). El cuerpo puede ocupar hasta 300 KB |
| `POST /solicitarRecuperacion` | `{ correo }` | **200** enlace enviado · **400** correo no válido · **404** el correo no tiene cuenta (no se envía nada) |
| `GET /restablecer.html` | — | **200** página de `src/web_publica` para crear la contraseña nueva (la abre el enlace del correo) |
| `POST /restablecerContrasenya` | `{ token, contrasena }` | **204** · **400** enlace no válido o caducado, o contraseña débil |
| `POST /solicitarVinculacion` 🔒 | `{ numeroSerie, sensibilidad }` | **201** `{ numeroSerie, correoComprador (oculto), estado: "pendiente", fecha }` y correo a quien lo compró · **200** `estado: "confirmada"` si ya era suyo · **400** · **404** sensor no registrado · **409** vinculado a otra cuenta · **401** (T005) |
| `GET /estadoVinculacion` 🔒 | — | **200** `{ numeroSerie, correoComprador, estado: pendiente \| confirmada \| rechazada, fecha }` · **404** sin solicitud · **401** (T005) |
| `POST /reenviarCorreoVinculacion` 🔒 | — | **200** `{ mensaje }` · **404** no hay ninguna pendiente · **401** (T005) |
| `GET /responderVinculacion?token=…&respuesta=si\|no` | — | **200** HTML «¿Vinculamos el sensor?» con un botón · **400** HTML enlace no válido — lo abren los botones del correo (T005) |
| `POST /responderVinculacion` | formulario `token`, `respuesta` | **200** HTML «Sensor vinculado» o «Vinculación rechazada» · **400** HTML «Enlace no válido»; al confirmar, asigna el sensor y activa el rol de portador (T037) |
| `GET /miCuenta` 🔒 | — | **200** `Resumen`, incluidos los lugares del usuario con ozono actual o `null` si no hay mediciones recientes · **404** sin sensor vinculado o sin mediciones todavía · **401** — página Mi cuenta de la web |
| `GET /miExposicion?periodo=semana\|mes\|3meses` 🔒 | — | **200** `[ { fecha, ozono } ]` media de cada día · **400** periodo no válido (`campos: ["periodo"]`) · **404** sin sensor vinculado · **401** — gráfica de Mi cuenta (T024) |
| `GET /lugares` 🔒 | — | **200** `[ Lugar ]` del usuario, aunque no tenga sensor · **401** |
| `POST /lugares` 🔒 | `{ nombre, tipo, direccion, latitud, longitud, avisosActivos? }` | **201** `Lugar` · **400** `{ error, campos }` · **409** límite de cinco · **401**. Tipo: `casa`, `trabajo`, `colegio` u `otro` (T046) |
| `PUT /lugares/:idLugar` 🔒 | Todos los campos de `Lugar` | **200** `Lugar` actualizado · **400** `{ error, campos }` · **404** no existe o no pertenece al usuario · **401** (T046) |
| `PATCH /lugares/:idLugar` 🔒 | Uno o más campos de `Lugar` | **200** `Lugar` actualizado · **400** `{ error, campos }` · **404** no existe o no pertenece al usuario · **401** (T046) |
| `DELETE /lugares/:idLugar` 🔒 | — | **204** eliminado · **404** no existe o no pertenece al usuario · **401** (T046) |
| `POST /crearIncidencia` 🔒 | `{ tipo, asunto, descripcion, idSensor? }` | **201** `Incidencia` · **400** `{ error, campos }` · **401** — Ayuda de la app y de la web (T041). `tipo`: sensor, datos, cuenta, otra. Sin `idSensor`, las de tipo sensor o datos llevan el sensor del usuario |
| `GET /misIncidencias` 🔒 | — | **200** `[ Incidencia ]` del usuario, con la respuesta, la más nueva primero · **401** (T041) |
| `GET /incidencias?estado=…&tipo=…` 🔒👷 | — | **200** `[ IncidenciaGestion ]` · **400** filtro no válido · **401** · **403** — pantalla Incidencias del panel (T041, T044) |
| `GET /numeroIncidenciasAbiertas` 🔒👷 | — | **200** `{ abiertas: N }` (número del menú del panel) · **401** · **403** (T041) |
| `GET /incidencia?id=N` 🔒👷 | — | **200** `IncidenciaGestion` · **404** no existe · **401** · **403** (T041) |
| `POST /guardarMedicion` 🔒 | `{ numeroSerie, contaminante?, valor, latitud, longitud, fecha }` | **201** `{ medicion: Medicion, nueva: true }` · **200** `{ medicion, nueva: false }` ya estaba guardada · **400** `{ error, campos }` · **403** el sensor no es suyo · **404** sensor no registrado · **401** — la app, con lo que recibe del nodo por Bluetooth (T017) |
| `GET /ultimasMediciones?cantidad=N` 🔒 | — | **200** `[ Medicion ]` del usuario, la más nueva primero (5 si no se dice, como mucho 100) · **400** cantidad no válida · **401** — pantalla de inicio de la app (T017) |
| `GET /misDatos?desde=<epoch-ms>&hasta=<epoch-ms>` 🔒 | — | **200** `[ Medicion ]` de ozono del usuario en el periodo `[desde, hasta)` (máximo 26 h, con latitud/longitud) · **400** fechas no válidas · **404** sin sensor · **401** — resumen diario de la app (T007) |
| `GET /ultimaMedicion` | — | **200** `Medicion` (la más nueva de todos los sensores) · **404** aún no hay — pública (T017, H006) |
| `GET /nodos/resumen` 🔒👷 | — | **200** `{ total, activos, inactivos24h, inactivos7d, porCalibrar, umbralHoras }` · **401** · **403** — números de arriba de la página Nodos del panel (T021). `inactivos24h` son los que pasan del umbral de inactividad, `UMBRAL_INACTIVO_HORAS` en el `.env` (24 por defecto, T022) |
| `GET /nodos?busqueda=&estado=todos\|activos\|inactivos\|calibrar&pagina=1&porPagina=20` 🔒👷 | — | **200** `{ nodos: [ Nodo ], total }` (total sin paginar; `porPagina` máx. 100) · **400** filtro no válido (`campos`) · **401** · **403** — lista del panel (T021) |
| `GET /nodos/mapa?busqueda=&estado=` 🔒👷 | — | **200** `{ nodos: [ Nodo ], total }` sin paginar, solo los que tienen ubicación · **400** · **401** · **403** — mapa del panel (T021) |
| `POST /responderIncidencia` 🔒👷 | `{ idIncidencia, respuesta?, estado? }` | **200** `IncidenciaGestion` · **400** `{ error, campos }` · **404** · **401** · **403** — con respuesta se guarda quién responde (el usuario de la sesión), se manda por correo al usuario y, si no se indica estado, pasa a «resuelta» (T041) |

👷 = solo técnicos y administradores (rol `tecnico` o `administrador`).

`Incidencia = { idIncidencia, tipo, asunto, descripcion, estado, respuesta, responsable: { nombre, rol } | null, fechaCreacion, fechaRespuesta, sensor: { idSensor, numeroSerie } | null }` — `responsable` es quien respondió (para «Respuesta de Marc (técnico)»).
`IncidenciaGestion = Incidencia + usuario: { idUsuario, nombre, apellidos, correo }`, en `responsable` también `idUsuario` y, en `sensor`, también `nombre, estado, bateria, ultimaConexion, necesitaCalibracion`.
`Medicion = { idMedicion, contaminante, valor, unidad, fecha, latitud, longitud }` — `fecha` en ISO (UTC); nunca dice quién la tomó.
`Lugar = { id, idLugar, idUsuario, nombre, tipo, direccion, zona, latitud, longitud, avisosActivos, ozonoActual, ozono }`. La exposición usa la interpolación inversa al cuadrado de la distancia de mediciones O3 de las últimas 24 horas; si no hay, devuelve `null`. Todas las operaciones filtran por el usuario de la sesión.

Errores comunes: **400** JSON mal formado · **401** sin sesión · **403** el rol no tiene permiso · **404** ruta que no existe · **500** error del servidor (sin detalles).

### Módulo ServidorREST (NUEVO)

```text
  logica: Logica                --> crearServidor() -->
  reglasExtra: (Express) -->        |     (reglasExtra es opcional: otras tareas y los tests)
  Express                       <-- |
```

### Módulo ReglasREST (NUEVO)

```text
                                    --------- ReglasREST -----------------------------
                                    |
  servidor: Express             --> cargarReglasREST() -->
  logica: Logica                    |
                                    |
  error: Error                  --> responderError() -->
  respuesta: Response               |     ErrorLogica --> 400 / 401 / 404 / 409; otro --> 500
                                    |
  funcion: (peticion, respuesta) --> Promesa
                                --> envolver() --> Middleware
                                    |
                                    -------------------------------------------------
```

### Módulo Autorizacion (NUEVO)

```text
                                    --------- Autorizacion ---------------------------
                                    |
  cabecera: Texto               --> extraerToken() --x
  Texto | null                  <-- |
                                    |
  logica: Logica                --> requiereSesion() --x
  rolesPermitidos: Lista<Texto>     |     lista vacía = cualquier rol con sesión
  Middleware                    <-- |     401 sin sesión · 403 rol sin permiso;
                                    |     si pasa: peticion.usuario = UsuarioSesion
                                    -------------------------------------------------
```

Otras tareas protegen sus rutas así:

```js
servidor.get('/usuarios', requiereSesion(logica, ['administrador', 'tecnico']), ...);
```

### Módulo EnviadorCorreo (NUEVO)

```text
  config: ( host, puerto, usuario, contrasenya, remitente )
                                --> crearEnviadorCorreo() -->
  (destinatario: Texto, asunto: Texto, texto: Texto) --> Promesa   <--
```

---

## 2. Aclaraciones del diseño

- **Cerrar sesión:** no hay ruta; el cliente borra su token (las sesiones son tokens firmados, ver `logica_design.md`).
- **Configuración** en `src/servidor_rest/.env` (copiar de `.env.ejemplo`; `.env` no se sube a GitHub): puerto, conexión a MySQL, `CLAVE_TOKENS` (clave secreta que firma los tokens; sin ella se usa una de desarrollo y se avisa en la consola), URL de la página de restablecer contraseña y SMTP.
- **Páginas estáticas:** el servidor sirve la carpeta `src/web_publica` (`express.static`). Por ahora solo `restablecer.html` (ver `web_publica_design.md`).
- **Sin SMTP** (`SMTP_HOST` vacío) el correo de recuperación se muestra en la consola del servidor en lugar de enviarse. Así se puede probar en local sin una cuenta de correo.
- **Vinculación por correo (T005/T037, diseño T038):** el GET del enlace del correo **no cambia nada**: solo enseña la pregunta con un botón, y el botón hace el POST. Así, si el programa de correo (por ejemplo, Outlook de la UPV) abre los enlaces solo para revisarlos, no se vincula ni se rechaza nada sin que la persona pulse. La respuesta válida y de un solo uso se procesa en una transacción; al confirmar asigna el sensor, activa `esPortador` y cambia `role` de `ciudadano` a `portador`. Las páginas las monta `PaginaVinculacion.js`, con el logotipo, los colores y el diseño adaptable de AERIS; el resultado confirma «Sensor vinculado», «Vinculación rechazada» o «Enlace no válido».
- **`URL_VINCULACION`** (en `.env`, opcional): dirección que llevan los botones del correo. Si no se pone, se usa el mismo servidor que `URL_RESTABLECER` + `/responderVinculacion`. En local es `http://localhost:8080/…` (el correo hay que abrirlo en el ordenador del servidor); en el servidor de la UPV es `https://pfermar1.upv.edu.es/responderVinculacion`, así que el correo se puede abrir desde cualquier sitio, también desde el móvil.
- **Mediciones (T017):** la app recibe las tramas del nodo (`doc/arduino_design.md`), se queda con las de `numeroSerie` de `/usuarioActual`, les pone la hora y la ubicación del móvil y las envía con `POST /guardarMedicion`. `numeroSerie` son las 12 cifras que van detrás de «AERI» en el UUID. Si no hay conexión, las guarda y las reenvía después: el servidor no duplica una medición del mismo sensor, contaminante y segundo, y responde **200** con `nueva: false` para que la app la borre igualmente. Se rechazan (y se apuntan en la consola) las que tienen datos que faltan o fuera de rango: valor de 0 a 2000 µg/m³, latitud y longitud válidas y fecha de los últimos 7 días (con 5 min de margen hacia el futuro).
- **Incidencias (T041):** la misma API sirve a la app (pantalla Ayuda, T043) y a la web (página Ayuda, T042, y pantalla Incidencias del panel, T044). Los técnicos y los administradores ven todas; cada usuario solo las suyas (`/misIncidencias`). En `/incidencias` un parámetro vacío cuenta como no enviado y uno repetido da 400. Con la palabra «en curso» hay que codificar el espacio (`estado=en%20curso`).
- **Puerto 8080:** la app lo usa en el emulador como `http://10.0.2.2:8080` (`LogicaFakeRegistro.URL_SERVIDOR`).
- **El registro abre sesión:** `POST /registrarUsuario` ya devuelve el token, para que la app no tenga que iniciar sesión justo después de registrarse.
- **JSON de la app:** las claves son las de `LogicaFakeRegistro.crearJSON()` (`nombre`, `apellidos`, `correo`, `contrasena`). En la BD se guardan en `nombre`, `apellidos`, `email` y `passwordHash`.

---

## 3. Reglas generales

- **Lenguaje:** JavaScript (Node.js 18 o superior), Express 4.
- **Cabecera de fichero** y **cabecera de cada función** con su diseño lógico y una línea `What it does:`.
- **Tests automáticos (mocha):** `npm test` desde `src/servidor_rest`. Arrancan el servidor en un puerto libre con la BD de pruebas `aeris_test` y hacen peticiones HTTP reales a cada ruta (códigos 200/201/204/400/401/403/404/409). La vinculación, las incidencias, las mediciones y los lugares tienen sus propios ficheros: `test_api_vinculacion.js`, `test_api_incidencias.js`, `test_api_mediciones.js` y `test_api_lugares.js`.