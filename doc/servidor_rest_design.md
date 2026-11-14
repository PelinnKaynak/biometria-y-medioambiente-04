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
| `GET /usuarioActual` 🔒 | — | **200** `{ idUsuario, nombre, apellidos, correo, rol, fechaAlta, alertas, premiumHasta, foto }` · **401** |
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
| `POST /responderVinculacion` | formulario `token`, `respuesta` | **200** HTML «Sensor vinculado» o «Vinculación rechazada» · **400** HTML «Enlace no válido» (T005) |

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
- **Vinculación por correo (T005):** el GET del enlace del correo **no cambia nada**: solo enseña la pregunta con un botón, y el botón hace el POST. Así, si el programa de correo (por ejemplo, Outlook de la UPV) abre los enlaces solo para revisarlos, no se vincula ni se rechaza nada sin que la persona pulse. Las páginas las monta `PaginaVinculacion.js`, con los colores de AERIS.
- **`URL_VINCULACION`** (en `.env`): dirección que llevan los botones del correo. Por defecto `http://localhost:8080/responderVinculacion`, así que el correo hay que abrirlo en el mismo ordenador donde corre el servidor.
- **Puerto 8080:** la app lo usa en el emulador como `http://10.0.2.2:8080` (`LogicaFakeRegistro.URL_SERVIDOR`).
- **El registro abre sesión:** `POST /registrarUsuario` ya devuelve el token, para que la app no tenga que iniciar sesión justo después de registrarse.
- **JSON de la app:** las claves son las de `LogicaFakeRegistro.crearJSON()` (`nombre`, `apellidos`, `correo`, `contrasena`). En la BD se guardan en `nombre`, `apellidos`, `email` y `passwordHash`.

---

## 3. Reglas generales

- **Lenguaje:** JavaScript (Node.js 18 o superior), Express 4.
- **Cabecera de fichero** y **cabecera de cada función** con su diseño lógico y una línea `What it does:`.
- **Tests automáticos (mocha):** `npm test` desde `src/servidor_rest`. Arrancan el servidor en un puerto libre con la BD de pruebas `aeris_test` y hacen peticiones HTTP reales a cada ruta (códigos 200/201/204/400/401/403/404/409). La vinculación tiene su propio fichero, `test_api_vinculacion.js`.
