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
| `GET /api/prevision/ozono?zona=Gandia` | — (pública, sin sesión) | **200** `{ zona, simulados, advertencia, modelo, ultima_observacion_utilizada, predicciones: [{ fecha_hora, ozono_predicho, nivel }] × 48, hora_pico, valor_pico, nivel_pico }` · **400** `{ error, zona_solicitada, zona_disponible }` zona sin modelo · **503** `{ error, motivo }` con `motivo` = `no_disponible` (servicio caído o error interno) o `desactivada` (`PREVISION_ACTIVA=0`); los servidores anteriores a T032 también respondían 503 con «ocupado» · **504** `{ error, motivo: "tiempo_agotado" }` — previsión de 48 h (T031 · T032). El texto de `error` es siempre genérico: nunca lleva trazas ni mensajes internos de Python |

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

### Módulo ServicioPrediccion (NUEVO, T032)

```text
                                    --------- ServicioPrediccion ----------------------
                                    |
                                    | TTL_CACHE_MS = 5 min · TIEMPO_ESPERA_MS = 10 s · TIEMPO_ARRANQUE_MS = 20 s (solo la 1ª vez)
                                    | ESPERA_REINICIO_MS = 5 s · GRACIA_SALIDA_MS = 100 ms
                                    |
                                --> predecir() -->
  Promise<Resultado>            <-- |     (rechaza siempre con ErrorPrevision { motivo })
                                    |     caché < 5 min --> la devuelve; cálculo en curso --> lo comparte;
                                    |     si no, lanza el worker (si hace falta) y le pide una predicción
                                    |
                                --> detener() -->     para el worker (y todo su árbol de procesos) y vacía la caché
                                    |
                                    |    --> obtenerProceso() --x    lanza el worker; falla si estamos en la espera de reinicio
                                    |    linea: Text --> alRecibirLinea() --x    JSON de la respuesta; «error» de Python --> solo al log
                                    |    proceso: ChildProcess, causa: Text --> descartar() --x
                                    |         error / close / exit / timeout / error de stdin·stdout·stderr
                                    |         --> lo mata (árbol), falla la petición en curso y fija la espera de reinicio
                                    |
                                    -------------------------------------------------

  servidor: Express,
  opciones: { activa: B, servicio: ServicioPrediccion }
                                --> cargarRutasPrevision() --> ServicioPrediccion       (RutasPrevision.js)
  servidor: Express,
  logica: Logica,
  reglasExtra, opciones: { prevision: B, servicioPrevision }
                                --> crearServidor() --> Express                          (ServidorREST.js)
```

---

## 2. Aclaraciones del diseño

- **Cerrar sesión:** no hay ruta; el cliente borra su token (las sesiones son tokens firmados, ver `logica_design.md`).
- **Configuración** en `src/servidor_rest/.env` (copiar de `.env.ejemplo`; `.env` no se sube a GitHub): puerto, conexión a MySQL, `CLAVE_TOKENS` (clave secreta que firma los tokens; sin ella se usa una de desarrollo y se avisa en la consola), URL de la página de restablecer contraseña y SMTP.
- **Páginas estáticas:** el servidor sirve la carpeta `src/web_publica` (`express.static`). Por ahora solo `restablecer.html` (ver `web_publica_design.md`).
- **Sin SMTP** (`SMTP_HOST` vacío) el correo de recuperación se muestra en la consola del servidor en lugar de enviarse. Así se puede probar en local sin una cuenta de correo.
- **Puerto 8080:** la app lo usa en el emulador como `http://10.0.2.2:8080` (`LogicaFakeRegistro.URL_SERVIDOR`).
- **El registro abre sesión:** `POST /registrarUsuario` ya devuelve el token, para que la app no tenga que iniciar sesión justo después de registrarse.
- **Previsión de ozono (T032):** `ServidorREST` monta `cargarRutasPrevision()` (`RutasPrevision.js`) y `ServicioPrediccion.js` gestiona el proceso Python persistente `src/prevision/worker_prediccion.py` (una petición por línea de JSON). La app llama a esta ruta en el **puerto 8080**; `mainServidorPrevision.js` (puerto 8081, `PUERTO_PREVISION`) es un servidor independiente solo para pruebas (`test/test_prevision_api.js`). Los datos son **de demostración** (`simulados: true`): el servicio reutiliza 48 horas históricas con las fechas desplazadas, y la app lo indica siempre. Solo hay modelo para Gandia.
- **Arranque perezoso:** Python **no se lanza al crear el servidor**, sino en la primera petición de previsión (la primera tarda unos 5 s en cargar el modelo; por eso tiene 20 s de margen extra). Si Python, el modelo o los datos no están disponibles, el servidor REST arranca igual y solo la previsión responde 503.
- **Desactivar la previsión:** `PREVISION_ACTIVA=0` en `.env` (o `crearServidor(logica, reglasExtra, { prevision: false })` en los tests): la ruta responde 503 con `motivo: "desactivada"` y Python no se lanza nunca. Los tests de las demás rutas no necesitan Python.
- **Caché y peticiones simultáneas:** el último resultado válido se reutiliza **5 minutos** (los errores no se guardan). El worker atiende una predicción a la vez, pero las peticiones que lleguen mientras hay un cálculo en curso **comparten ese cálculo**: ya no hay respuestas 503 «ocupado».
- **Caída y recuperación del worker:** error de arranque, de `stdin`/`stdout`/`stderr`, `exit`/`close` o tiempo agotado descartan el worker: se mata **todo su árbol de procesos** (el predictor crea decenas de subprocesos `joblib/loky`; en Windows `kill()` solo mataría el principal y los demás quedarían huérfanos, por eso se usa `taskkill /T`), la petición en curso falla enseguida (503, o 504 si fue por tiempo) y no se vuelve a lanzar hasta pasados 5 s. La primera petición posterior lo lanza de nuevo. Un worker colgado se mata para que su respuesta tardía no llegue a otra petición.
- **Sin filtrar nada interno:** el cliente solo recibe `{ error, motivo }` con textos genéricos. Las trazas, rutas y mensajes de Python (stderr, `{"error": …}`) se escriben en la consola del servidor con el prefijo `[previsión]`.
- **Niveles de la previsión:** el campo `nivel` usa los mismos límites y nombres que `NivelOzono` de la app (`bueno` ≤ 100, `moderado` ≤ 180, `malo` ≤ 240 y `muy_malo`, en µg/m³; `clasificar_nivel()` en `servicio_prediccion_api.py`). La app, aun así, clasifica cada hora con `NivelOzono.desdeValor()` a partir de `ozono_predicho`, para tener una única fuente de verdad.
- **JSON de la app:** las claves son las de `LogicaFakeRegistro.crearJSON()` (`nombre`, `apellidos`, `correo`, `contrasena`). En la BD se guardan en `nombre`, `apellidos`, `email` y `passwordHash`.

---

## 3. Reglas generales

- **Lenguaje:** JavaScript (Node.js 18 o superior), Express 4.
- **Cabecera de fichero** y **cabecera de cada función** con su diseño lógico y una línea `What it does:`.
- **Tests automáticos (mocha):** `npm test` desde `src/servidor_rest`. Arrancan el servidor en un puerto libre con la BD de pruebas `aeris_test` y hacen peticiones HTTP reales a cada ruta (códigos 200/201/204/400/401/403/404/409).
- **Tests de la previsión (T032):** `test/test_servicio_prediccion.js` (mocha, **sin MySQL ni Python**): arranque perezoso, desactivación, caché de 5 minutos, peticiones simultáneas, errores de spawn/stdin/stdout/stderr/exit, caída y recuperación, tiempo agotado, que no se filtren mensajes internos y que no queden procesos huérfanos (con procesos falsos y con un worker real hecho con Node). `test/test_prevision_api.js` exige el servidor de previsión en el puerto 8081.
