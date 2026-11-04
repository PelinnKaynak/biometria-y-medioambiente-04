# Diseño del componente: app (App Android del portador)

**Equipo:** 04 – SenseTech · **Sprint:** 2 · **Implementación:** `src/app/` (paquete `com.example.aeris`, Java, Android 10 o superior)

---

## 0. Bienvenida (T001)

Pantalla de Figma «bienvenida». Es la primera pantalla de la app (`LAUNCHER`).

```text
BienvenidaActivity --(hay sesión guardada: Sesion.haySesion())--> InicioActivity
BienvenidaActivity --«Iniciar sesión»--> LoginActivity
                   --«Registrarte»----> RegistroActivity
                   --«Ver el mapa sin cuenta»--> MapaSinCuentaActivity   (provisional hasta la tarea del mapa)
```

```text
BienvenidaActivity:     onCreate()
MapaSinCuentaActivity:  onCreate()        (provisional)
```

- Arriba, degradado `verde_suave → fondo` (`fondo_bienvenida.xml`) con el logo; abajo, título, texto y botones, como en Figma.
- Al iniciar sesión o registrarse se cierran la bienvenida y el login (`FLAG_ACTIVITY_CLEAR_TASK`): «atrás» desde el inicio sale de la app.
- «Cerrar sesión» vuelve a la bienvenida.
- Entre registro y login se usa `FLAG_ACTIVITY_CLEAR_TOP` para no abrir dos veces la misma pantalla.

---

## 1. Registro de usuario (T002 · H001)

La pantalla de registro solo muestra datos y reacciona a los toques. Las comprobaciones están en `ValidadorRegistro` y la llamada al servidor en `LogicaFakeRegistro`, que ofrece la misma firma que `registrarUsuario()` de la lógica de negocio del servidor (`logica_design.md`).

```text
RegistroActivity --> ValidadorRegistro.validar()
                 --> LogicaFakeRegistro.registrarUsuario() --> PeticionarioREST --> POST /registrarUsuario
                 --> Sesion.iniciar()  --> VincularSensorActivity
```

### Tipos

```text
ResultadoRegistro = { REGISTRADO, CORREO_YA_REGISTRADO, ERROR }

ErroresFormulario = Lista<( campo: Text, mensaje: Text )>
    campo ∈ { "nombre", "apellidos", "correo", "contrasena", "confirmacion" }

RespuestaREST = ( codigo: Z, cuerpo: Text )
```

### Clase ValidadorRegistro (NUEVA)

```text
                                    --------- ValidadorRegistro ----------------------
                                    |
                                    | LONGITUD_MINIMA_CONTRASENA: N
                                    | LONGITUD_MAXIMA_NOMBRE: N = 50
                                    | LONGITUD_MAXIMA_APELLIDOS: N = 100
                                    |
                                    |
  nombre: Text                  --> validar() --x
  apellidos: Text                   |
  correo: Text                      |
  contrasena: Text                  |
  confirmacion: Text                |
  ErroresFormulario             <-- |
                                    |
                                    |    texto: Text --> estaVacio() --x
                                    |    B <--
                                    |
                                    |    texto: Text, longitudMaxima: N --> esNombreValido() --x
                                    |    B <--
                                    |
                                    |    correo: Text --> esCorreoValido() --x
                                    |    B <--
                                    |
                                    |    contrasena: Text --> esContrasenaSegura() --x
                                    |    B <--
                                    |
                                    -------------------------------------------------
```

### Clase LogicaFakeRegistro (NUEVA)

```text
                                    --------- LogicaFakeRegistro ---------------------
                                    |
                                    | URL_SERVIDOR: Text
                                    | CODIGO_CREADO: Z
                                    | CODIGO_CORREO_YA_REGISTRADO: Z
                                    |
                                    |
                                    |    nombre: Text, apellidos: Text, correo: Text, contrasena: Text --> crearJSON() --x
                                    |    Text <--
                                    |
                                    |    codigo: Z --> interpretarCodigo() --x
                                    |    ResultadoRegistro <--
                                    |
                                    |    codigo: Z, cuerpo: Text --> notificarResultado() --x
                                    |
                                    |    correo: Text --> normalizarCorreo() --x
                                    |    Text <--
                                    |
                                    |
  nombre: Text                  --> registrarUsuario() -->
  apellidos: Text                   |
  correo: Text                      |
  contrasena: Text                  |
                                    |
                                    -------------------------------------------------
```

### Clase RegistroActivity (NUEVA)

```text
                                    --------- RegistroActivity -----------------------
                                    |
                                    |    pulsarContinuar() -->
                                    |
                                    |    ErroresFormulario --> mostrarErrores() -->
                                    |
                                    |    campo: EditText, etiquetaError: TextView, mensaje: Text --> mostrarError() -->
                                    |
                                    |    campo: EditText, etiquetaError: TextView --> limpiarError() -->
                                    |
                                    |    enviando: B --> mostrarEnviando() -->
                                    |
                                    |    abrirVincularSensor() -->
                                    |
                                    |    campo: EditText --> texto() --x
                                    |    Text <--
                                    |
                                    onCreate() -->
                                    |
                                    -------------------------------------------------
```

### Clase Sesion (MODIFICADA en T003)

Guarda en `SharedPreferences` el correo y los datos de sesión que devuelve el servidor (token, rol y nombre).

```text
                                    --------- Sesion ---------------------------------
                                    |
  contexto: Context             --> iniciar() --x
  correo: Text                      |
  datos: DatosSesion                |
                                    |
  contexto: Context             --> haySesion() --x
  B                             <-- |
                                    |
  contexto: Context             --> token() --x          --> Text | null
  contexto: Context             --> rol() --x            --> Text | null
  contexto: Context             --> nombre() --x         --> Text | null
  contexto: Context             --> correoActual() --x   --> Text | null
                                    |
  contexto: Context             --> cerrar() --x
                                    |
                                    -------------------------------------------------
```

### Clase PeticionarioREST (proporcionada, adaptada)

```text
                                    --------- PeticionarioREST -----------------------
                                    |
                                    |    conexion: HttpURLConnection, codigo: Z --> leerCuerpo() --x
                                    |    Text <--
                                    |
  metodo: Text                  --> hacerPeticionREST() -->
  urlDestino: Text                  |
  cuerpo: Text                      |
  RespuestaREST                 <-- |
                                    |
                                    -------------------------------------------------
```

---

## 2. Inicio de sesión y recuperación de contraseña (T003 · H002)

Pantallas de Figma: «login», «recuperar contraseña» y «correo enviado». «Entrar con huella» no se hace en este sprint.

```text
BienvenidaActivity --> LoginActivity
LoginActivity --> ValidadorLogin.validar()
              --> LogicaFakeSesion.iniciarSesion() --> PeticionarioREST --> POST /iniciarSesion
              --> Sesion.iniciar() --> InicioActivity
LoginActivity --> RegistroActivity  («Regístrate»)
LoginActivity --> RecuperarContrasenaActivity --> LogicaFakeSesion.solicitarRecuperacion()
              --> POST /solicitarRecuperacion --> CorreoEnviadoActivity («Revisa tu correo»)
InicioActivity --(barra: «Perfil»)--> PerfilActivity --(«Cerrar sesión»)--> BienvenidaActivity   (T010)
```

### Tipos

```text
DatosSesion = ( token: Text, rol: Text, nombre: Text )      // lo devuelve el servidor (200 y 201)
```

### Clase DatosSesion (NUEVA)

```text
                                    --------- DatosSesion ----------------------------
                                    |
                                    | token: Text, rol: Text, nombre: Text
                                    |
  cuerpo: Text                  --> desdeJSON() --x
  DatosSesion | null            <-- |     null si no es JSON o no tiene token
                                    |
                                    -------------------------------------------------
```

### Clase ValidadorLogin (NUEVA)

```text
                                    --------- ValidadorLogin -------------------------
                                    |
  correo: Text                  --> validar() --x
  contrasena: Text                  |     correo escrito y con formato válido;
  ErroresFormulario             <-- |     contraseña escrita (sus reglas las comprueba el servidor)
                                    |
  correo: Text                  --> validarCorreo() --x
  Text | null                   <-- |     mensaje de error o null (también para «Recuperar contraseña»)
                                    |
                                    -------------------------------------------------
```

### Clase LogicaFakeSesion (NUEVA)

```text
                                    --------- LogicaFakeSesion -----------------------
                                    |
                                    | CODIGO_OK: Z = 200
                                    | CODIGO_CREDENCIALES_INCORRECTAS: Z = 401
                                    | MENSAJE_CREDENCIALES_INCORRECTAS: Text = "Correo o contraseña incorrectos"
                                    |
  correo: Text                  --> iniciarSesion() -->
  contrasena: Text                  |     callback: sesionIniciada(DatosSesion),
                                    |     credencialesIncorrectas(), error(Text)
                                    |
  correo: Text                  --> solicitarRecuperacion() -->
                                    |     callback: enlaceEnviado(), correoNoRegistrado(), error(Text)
                                    |
                                    |    correo: Text, contrasena: Text --> crearJSONInicioSesion() --x
                                    |    Text <--
                                    |
                                    |    codigo: Z, cuerpo: Text --> notificarInicioSesion() --x
                                    |
                                    |    codigo: Z --> notificarRecuperacion() --x
                                    |
                                    -------------------------------------------------
```

### Clase PermisoRedLocal (NUEVA)

```text
  contexto: Context             --> hayQuePedirlo() --x
  B                             <-- |     V en Android 17+ si falta ACCESS_LOCAL_NETWORK
```

### Pantallas (NUEVAS)

```text
LoginActivity:               onCreate(), pulsarAcceder(), enviarInicioSesion(), mostrarErrores(),
                             marcarCampo(), mostrarErrorGeneral(), cambiarVisibilidadContrasena(),
                             mostrarEnviando(), abrirInicio()
RecuperarContrasenaActivity: onCreate(), pulsarEnviar(), enviarSolicitud(), mostrarErrorCorreo()
CorreoEnviadoActivity:       onCreate(), reenviar()
InicioActivity (provisional hasta T006): onCreate()      (con la barra de navegación, T010)
```

---

## 3. Perfil, editar mis datos y barra de navegación (T010)

Pantalla de Figma «perfil» y componente «barra navegacion». La barra está en las pantallas principales (por ahora Inicio y Perfil); Mapa, Mis datos e Info llegan en otras tareas y de momento no hacen nada al pulsarlas.

```text
InicioActivity <--barra--> PerfilActivity
PerfilActivity --> LogicaFakePerfil.obtenerUsuario() --> PeticionarioREST --> GET /usuarioActual   (con token)
PerfilActivity --(interruptor «Notificaciones»)--> LogicaFakePerfil.cambiarAlertas() --> POST /cambiarAlertas
PerfilActivity --(foto)--> cámara o galería --> FotoPerfil.prepararFoto() --> LogicaFakePerfil.cambiarFoto() --> POST /cambiarFoto
PerfilActivity --(«Editar mis datos»)--> EditarDatosActivity
EditarDatosActivity --> ValidadorEditarDatos --> LogicaFakeEditarDatos.actualizarDatos()   --> POST /actualizarDatos
                                             --> LogicaFakeEditarDatos.cambiarContrasena() --> POST /cambiarContrasenya
PerfilActivity --(«Cerrar sesión» o 401)--> Sesion.cerrar() --> BienvenidaActivity
```

### Tipos

```text
DatosUsuario = ( nombre: Text, apellidos: Text, correo: Text, rol: Text, alertas: B,
                 foto: Text )                     // de GET /usuarioActual; foto: base64 o ""
Pestanya     ∈ { INICIO, MAPA, MIS_DATOS, INFO, PERFIL }
```

### Clase DatosUsuario (NUEVA)

```text
                                    --------- DatosUsuario ---------------------------
                                    |
                                    | nombre, apellidos, correo, rol: Text, alertas: B, foto: Text
                                    |
                                --> tieneFoto() --x
  B                             <-- |
                                    |
                                --> nombreCompleto() --x
  Text                          <-- |     "nombre apellidos"
                                    |
  cuerpo: Text                  --> desdeJSON() --x
  DatosUsuario | null           <-- |     null si no es JSON o no tiene correo;
                                    |     sin "alertas" -> true (valor por defecto de la BD)
                                    |
                                    -------------------------------------------------
```

### Clase LogicaFakePerfil (NUEVA)

```text
                                    --------- LogicaFakePerfil -----------------------
                                    |
                                    | CODIGO_OK: Z = 200, CODIGO_GUARDADO: Z = 204
                                    | CODIGO_SIN_SESION: Z = 401, CODIGO_SIN_CONEXION: Z = 0
                                    |
  token: Text                   --> obtenerUsuario() -->
                                    |     callback: usuarioObtenido(DatosUsuario),
                                    |     sesionCaducada(), error(Text)
                                    |
  token: Text                   --> cambiarAlertas() -->
  alertas: B                        |     callback: cambioGuardado(), sesionCaducada(), error(Text)
                                    |
  token: Text                   --> cambiarFoto() -->
  foto: Text | null                 |     mismo callback; null quita la foto
                                    |
                                    |    foto: Text | null --> crearJSONFoto() --x
                                    |    Text <--
                                    |
                                    |    alertas: B --> crearJSONAlertas() --x
                                    |    Text <--
                                    |
                                    |    codigo: Z, cuerpo: Text --> notificarUsuario() --x
                                    |
                                    |    codigo: Z --> notificarCambio() --x
                                    |
                                    -------------------------------------------------
```

### Clase FotoPerfil (NUEVA)

```text
  resolver: ContentResolver     --> prepararFoto() --x
  uri: Uri                          |     recorta el cuadrado central, 256x256, JPEG 80 %,
  Text                          <-- |     base64 (fuera del hilo principal)
                                    |
  base64: Text                  --> aImagen() --x
  Bitmap | null                 <-- |
                                    |
                                    |    ancho: N, alto: N --> recorteCuadrado() --x
                                    |    [x: N, y: N, lado: N] <--
```

### Clase ValidadorEditarDatos (NUEVA)

```text
  nombre: Text, apellidos: Text,
  correo: Text                  --> validarDatos() --x
  ErroresFormulario             <-- |     mismas reglas y mensajes que el registro
                                    |
  actual: Text, nueva: Text,
  repetida: Text                --> validarContrasena() --x
  ErroresFormulario             <-- |     actual escrita; nueva segura y distinta de la actual;
                                    |     repetida igual que la nueva
```

### Clase LogicaFakeEditarDatos (NUEVA)

```text
                                    --------- LogicaFakeEditarDatos ------------------
                                    |
                                    | MENSAJE_CORREO_YA_REGISTRADO: Text = "Este correo ya tiene una cuenta."
                                    | MENSAJE_CONTRASENA_INCORRECTA: Text = "La contraseña actual no es correcta."
                                    |
  token: Text, nombre: Text,
  apellidos: Text, correo: Text --> actualizarDatos() -->
                                    |     callback: datosGuardados(DatosUsuario), correoYaRegistrado(),
                                    |     sesionCaducada(), error(Text)
                                    |
  token: Text, actual: Text,
  nueva: Text                   --> cambiarContrasena() -->
                                    |     callback: contrasenaCambiada(DatosSesion), contrasenaActualIncorrecta(),
                                    |     sesionCaducada(), error(Text)
                                    |
                                    |    nombre, apellidos, correo: Text --> crearJSONDatos() --x      Text <--
                                    |    actual: Text, nueva: Text --> crearJSONContrasena() --x      Text <--
                                    |    codigo: Z, cuerpo: Text --> notificarDatos() --x
                                    |    codigo: Z, cuerpo: Text --> notificarContrasena() --x
                                    |
                                    -------------------------------------------------
```

### Clase Sesion (MODIFICADA en T010)

```text
  contexto: Context, nombre: Text,
  correo: Text                  --> cambiarDatos() --x     (tras «Editar mis datos»)
```

### Clase BarraNavegacion (NUEVA)

```text
                                    --------- BarraNavegacion ------------------------
                                    |
  actividad: Activity           --> conectar() -->
  activa: Pestanya                  |     pestaña activa en violeta, las demás en gris;
                                    |     cada pestaña abre su pantalla
                                    |
                                    |    actual: Pestanya, destino: Pestanya --> cierraLaActual() --x
                                    |    B <--
                                    |
                                    |    pestanya: Pestanya --> pantallaDe() --x
                                    |    Class | null <--          (null = aún no hecha)
                                    |
                                    -------------------------------------------------
```

### Clase PeticionarioREST (MODIFICADA en T010)

```text
  metodo: Text, urlDestino: Text,
  cuerpo: Text, token: Text | null --> hacerPeticionREST() -->
  RespuestaREST                 <-- |     igual que antes, y si hay token envía
                                    |     "Authorization: Bearer <token>"
```

### Pantallas

```text
PerfilActivity (NUEVA):    onCreate(), onResume(), cargarUsuario(), mostrarUsuario(), cambiarAlertas(),
                           ponerInterruptor(), pulsarFoto(), abrirCamara(), subirFoto(), enviarFoto(), mostrarFoto(),
                           cerrarSesion()
EditarDatosActivity (NUEVA): onCreate(), cargarDatos(), pulsarGuardar(), pulsarCambiarContrasena(),
                           marcar(), cerrarSesion()
InicioActivity (MODIFICADA): ya no tiene «Cerrar sesión»; tiene la barra de navegación
```

---

## 4. Aclaraciones del diseño

- **Petición REST:** `POST /registrarUsuario` con el cuerpo `{"nombre": ..., "apellidos": ..., "correo": ..., "contrasena": ...}`. Respuestas: `201` cuenta creada, `409` el correo ya tiene cuenta, `400` datos incorrectos, `500` error del servidor. Si no hay conexión el código es `0`.
- **Contraseña:** el teléfono la envía tal cual por la petición; el **servidor** la guarda cifrada (criterio de H001, tarea T016). El teléfono nunca la guarda.
- **Correo:** se envía sin espacios y en minúsculas (`normalizarCorreo()`), para que `Pelin@AERIS.es` y `pelin@aeris.es` sean la misma cuenta.
- **Nombre y apellidos:** solo letras (también con tilde, ñ, ç…) separadas por un espacio, guion o apóstrofo: «María José», «García-López», «O'Connor». No se aceptan números ni símbolos como `_`, `@` o `.`. Máximo 50 caracteres el nombre y 100 los apellidos.
- **Formato del correo:** `nombre@dominio.ext` (por ejemplo, `pelin@aeris` no es válido).
- **Contraseña segura:** mínimo 8 caracteres, con al menos una letra y un número.
- **Sin datos simulados:** la app no simula respuestas. El resultado siempre viene del servidor, que consulta la tabla `Usuarios` de la BD (ver `doc/bd_design.md`). Si el servidor no está en marcha, la app muestra el error de conexión.
- **Permiso de red local (Android 17):** desde Android 17 (API 37) una app con `targetSdk 37` necesita el permiso `ACCESS_LOCAL_NETWORK` (grupo «Dispositivos cercanos») para conectar con direcciones de la red local, como `10.0.2.2` o la IP del ordenador en la Wi‑Fi. `RegistroActivity` lo pide al pulsar «Continuar» (`necesitaPermisoRedLocal()`) y, si se concede, llama a `enviarRegistro()`. En versiones anteriores no se pide.
- **URL_SERVIDOR:** en el emulador es `http://10.0.2.2:8080`; en un teléfono real, la IPv4 del ordenador en la misma Wi‑Fi.
- **Sesión:** el servidor devuelve un token al registrarse (201) y al iniciar sesión (200). `Sesion.iniciar()` lo guarda con el correo, el rol y el nombre en `SharedPreferences`, así la sesión sigue abierta al cerrar y volver a abrir la app. Las peticiones que necesiten sesión enviarán `Authorization: Bearer <token>`.
- **Primera pantalla:** `BienvenidaActivity` (T001); si ya hay sesión guardada, va directa a `InicioActivity`.
- **Cerrar sesión:** `Sesion.cerrar()` borra el token del teléfono; el servidor no guarda sesiones.
- **Login:** `POST /iniciarSesion` con `{"correo", "contrasena"}`. `200` → sesión iniciada; `401` → «Correo o contraseña incorrectos» (mismo mensaje si el correo no existe), se borra la contraseña escrita y no se da acceso.
- **Recuperar contraseña:** `POST /solicitarRecuperacion` con `{"correo"}`. `200` → el servidor ha enviado un enlace que caduca a los 30 minutos y se abre «Revisa tu correo»; `404` → el correo no tiene cuenta: no se envía nada y la app muestra «No hay ninguna cuenta con este correo.» debajo del campo. «¿No te ha llegado? Reenviar» pide otro enlace.
- **Tras el registro** se abre `VincularSensorActivity`, con la opción «Omitir por ahora» (abre el inicio). En este sprint es una pantalla provisional; la búsqueda por Bluetooth se programa en T005 (H019).
- **Inicio provisional:** `InicioActivity` solo saluda y tiene la barra de navegación; la pantalla de inicio real es T006.
- **Perfil (T010):** al abrirse muestra el nombre y el correo guardados en `Sesion` y pide `GET /usuarioActual` (con `Authorization: Bearer <token>`) para mostrar el nombre completo, el correo y el interruptor «Notificaciones». El interruptor está desactivado hasta que llegan los datos.
- **Interruptor «Notificaciones»:** al cambiarlo se envía `POST /cambiarAlertas` con `{"alertas": true | false}` y se guarda en la columna `alertas` de `Usuarios`. Mientras se guarda no se puede tocar; si falla (sin conexión o error), vuelve a su posición y se muestra el error. Tocar la fila también lo cambia.
- **Sesión caducada:** si el servidor responde `401` (token caducado o la contraseña ha cambiado), la app cierra la sesión y vuelve a la bienvenida.
- **Cerrar sesión (perfil):** `Sesion.cerrar()` y abre `BienvenidaActivity` cerrando las demás pantallas (`FLAG_ACTIVITY_CLEAR_TASK`).
- **Foto de perfil:** al tocar el avatar o el lápiz se elige «Hacer una foto» (la app de cámara guarda la foto en `cache/fotos/camara.jpg`, compartido con `FileProvider`; no hace falta el permiso `CAMERA`) o «Elegir de la galería» (selector de fotos de Android, sin permisos). La foto se recorta en cuadrado, se reduce a 256×256 y se envía como JPEG en base64 con `POST /cambiarFoto`; se guarda en la columna `foto` de `Usuarios`, así se ve en cualquier teléfono. Si ya hay foto, aparece también «Quitar la foto» (`{"foto": null}`). Se muestra recortada en círculo (`ShapeableImageView`).
- **Editar mis datos:** al abrirse pide `GET /usuarioActual` y rellena nombre, apellidos y correo. «Guardar cambios» los comprueba con las reglas del registro y envía `POST /actualizarDatos`: `200` → se actualizan el nombre y el correo guardados en `Sesion` y se vuelve al perfil, que se recarga en `onResume()`; `409` → «Este correo ya tiene una cuenta.» debajo del correo.
- **Mensajes en la pantalla, sin avisos emergentes (Toast):** los errores y las confirmaciones se escriben en la propia pantalla: en el perfil, en rojo debajo del correo; en «Editar mis datos», debajo de cada botón («Contraseña cambiada…» en violeta); en «Revisa tu correo», debajo de «Reenviar». Al guardar los datos no sale ningún mensaje: se vuelve al perfil, que ya enseña los datos nuevos.
- **Cambiar contraseña:** pide la actual, la nueva (segura y distinta de la actual) y repetirla; `POST /cambiarContrasenya`. `200` → el servidor devuelve una sesión nueva, que se guarda con `Sesion.iniciar()` (la sesión de los otros teléfonos se cierra); `403` → «La contraseña actual no es correcta.» y se borra ese campo.
- **Opciones de otras tareas:** «Mi sensor» (T011), «Umbral de alerta», «Puntos y recompensas», «Mis lugares» (T019) y «AERIS Premium» aún no hacen nada al pulsarlas. «Umbral de alerta» enseña «Normal», el valor por defecto (`umbralAlerta` NULL).
- **Barra de navegación:** `barra_navegacion.xml` se añade con `<include>` y `BarraNavegacion.conectar()` la pinta y conecta. Inicio siempre queda debajo: desde cualquier pestaña se cierra la pantalla actual al cambiar (`cierraLaActual()`), así «atrás» vuelve a Inicio y «atrás» en Inicio sale de la app. Al volver a Inicio se reutiliza (`FLAG_ACTIVITY_CLEAR_TOP`). Las pestañas cambian sin animación.
- **PeticionarioREST:** es el código proporcionado por el profesor, con la misma interfaz, pero sin `AsyncTask` (obsoleta desde Android 11): la petición se hace en un hilo de fondo (`Executor`) y el callback se llama en el hilo principal.
- **Visibilidad:** los métodos auxiliares de `ValidadorRegistro` y `LogicaFakeRegistro` son de paquete (sin `public`) para poder probarlos con JUnit; ninguna otra clase los usa.

---

## 5. Reglas generales

- **Lenguaje:** Java 11, Android 10 (API 29) o superior.
- **Cabecera de fichero** con nombre, descripción, autores, fecha y copyright; **cabecera de cada método** con su diseño lógico en la notación de la asignatura y una línea `What it does:`.
- **Tests automáticos (JUnit 4):** `ValidadorRegistroTest` (campos vacíos, nombre y apellidos, correo, contraseña segura, confirmación), `LogicaFakeRegistroTest` (JSON enviado y respuesta para 201 con token, 409, 500 y sin conexión), `ValidadorLoginTest` (campos vacíos y correo) `LogicaFakeSesionTest` (JSON enviado, 200 con token, 401, 500, sin conexión y recuperación) `LogicaFakePerfilTest` (lectura de `DatosUsuario` con la foto, JSON de la foto, respuestas de `GET /usuarioActual`, `POST /cambiarAlertas` y `POST /cambiarFoto`, y qué pantalla cierra la barra) y `LogicaFakeEditarDatosTest` (validación de los datos y de la contraseña, JSON enviado y respuestas 200, 400, 401, 403, 409 y sin conexión). Se ejecutan con `./gradlew test` desde `src/app`.
