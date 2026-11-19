# Diseño del componente: app (App Android del portador)

**Equipo:** 04 – SenseTech · **Sprint:** 2 · **Implementación:** `src/app/` (paquete `com.example.aeris`, Java, Android 10 o superior)

---

## 0. Bienvenida (T001)

Pantalla de Figma «bienvenida». Es la primera pantalla de la app (`LAUNCHER`).

```text
BienvenidaActivity --(hay sesión guardada y GET /usuarioActual responde 200 o no hay conexión)--> InicioActivity
BienvenidaActivity --(GET /usuarioActual responde 401: la contraseña cambió en otro dispositivo)--> Sesion.cerrar(), se queda en la bienvenida
BienvenidaActivity --«Iniciar sesión»--> LoginActivity
                   --«Registrarte»----> RegistroActivity
                   --«Ver el mapa sin cuenta»--> MapaSinCuentaActivity   (provisional hasta la tarea del mapa)
```

```text
BienvenidaActivity:     onCreate(), comprobarSesion(), abrirInicio()
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
InicioActivity: ver la sección 3c (T006)
```

---

## 3. Perfil, editar mis datos y barra de navegación (T010)

Pantalla de Figma «perfil» y componente «barra navegacion». La barra está en las pantallas principales (Inicio, Información y Perfil). Mapa sigue abriendo la pantalla provisional `ProximamenteActivity` (T006); «Mis datos» abre `MisDatosActivity` (T007).

```text
InicioActivity <--barra--> PerfilActivity
PerfilActivity --> LogicaFakePerfil.obtenerUsuario() --> PeticionarioREST --> GET /usuarioActual   (con token)
PerfilActivity --(interruptor «Notificaciones»)--> LogicaFakePerfil.cambiarAlertas() --> POST /cambiarAlertas
PerfilActivity --(foto)--> cámara o galería --> FotoPerfil.prepararFoto() --> LogicaFakePerfil.cambiarFoto() --> POST /cambiarFoto
PerfilActivity --(«Mi sensor», sin sensor)--> VincularSensorActivity (desdePerfil) --(volver / vinculado)--> PerfilActivity   (T005)
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
                                    |    Class <--          (Mapa: ProximamenteActivity, T006; Mis datos: MisDatosActivity, T007)
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

## 3b. Información (T009 · H021)

Pantallas de Figma «informacion · rediseño» (todas las tarjetas cerradas) e «informacion · leer más abierto». Se abre con la pestaña «Info» de la barra de navegación (`BarraNavegacion.pantallaDe(INFO)`).

```text
barra («Info») --> InformacionActivity
InformacionActivity --> ConsejosDelDia.deHoy() / siguiente()      (tarjeta «Consejo de hoy»)
InformacionActivity --(tocar una tarjeta)--> alternar()            (abre o cierra la tarjeta)
InformacionActivity --(bajar por la pantalla)--> actualizarConScroll() --> llamadas del sensor y colocarPiezas()
```

### Tipos

```text
NivelOzono ∈ { BUENO (≤ 100), MODERADO (≤ 180), MALO (≤ 240), MUY_MALO }   // µg/m³
```

### Clase NivelOzono (NUEVA, enum)

```text
                                    --------- NivelOzono ---------------------------
                                    |
  microgramos: R                --> desdeValor() --x
  NivelOzono                    <-- |     ≤ 100 Bueno, ≤ 180 Moderado, ≤ 240 Malo,
                                    |     más Muy malo (negativo = Bueno)
                                    ------------------------------------------------
```

### Clase ConsejosDelDia (NUEVA)

```text
                                    --------- ConsejosDelDia -----------------------
                                    |
  diaDelAnyo: N, total: N       --> deHoy() --x
  N                             <-- |     consejo con el que empieza hoy
                                    |
  actual: N, total: N           --> siguiente() --x
  N                             <-- |     el siguiente; tras el último, el primero
                                    ------------------------------------------------
```

### Pantalla

```text
InformacionActivity (NUEVA): onCreate(), onResume(), onPause(), prepararConsejo(), mostrarConsejo(),
                             anyadirTemas(), rellenarCuerpo(), escalaNiveles(), alternar(), prepararSensor(),
                             crearLlamada(), colocarLlamadas(), actualizarConScroll(), colocarPiezas(),
                             animarEntrada()
```

- **Contenido** (textos en `strings.xml`, prefijo `info_`):
  - «El aire que respiras»: Ozono (O₃), Los niveles de AERIS y Sol y temperatura. «Los niveles» enseña una barra de colores de 0 a 300 µg/m³ con las marcas 100, 180 y 240 (`escalaNiveles()`, límites de `NivelOzono`) y una fila por nivel: punto de color, nombre, rango y consejo. Los colores y límites son los mismos que el mapa de la web.
  - «Tu sensor AERIS», lo que necesita saber el portador (`seccion_conoce_sensor.xml`; imágenes renderizadas del modelo 3D de la carcasa (`aeris_assembly.glb`, con fondo transparente) en `res/drawable-nodpi/sensor_*.webp`):
    - **Conoce tu sensor:** la imagen del sensor sube y baja despacio (2,4 s) y su sombra se encoge cuando sube. Cuando la tarjeta aparece en pantalla salen, una detrás de otra, tres llamadas: punto violeta, línea y etiqueta («Anilla para colgarlo», «Rejilla: entra el aire», «Ranuras de ventilación»). Su posición está en `LLAMADAS` como fracción de la imagen.
    - **Por dentro:** tapa frontal, filtro de polvo, sensor de O₃ y carcasa con clip. Empiezan juntas en el centro (sensor cerrado) y se separan mientras la tarjeta sube por la pantalla (`colocarPiezas()` con un progreso de 0 a 1); a la vez aparecen sus nombres.
    - **Cómo llevarlo:** tres tarjetas con imagen: con el clip, con la anilla y con la rejilla al aire.
    - Tarjetas: Cómo mide tu sensor (SPEC Sensors ULPSM-O3 968-046, la sensibilidad en la etiqueta), Bluetooth y envío de datos (BLE tipo beacon; el móvil añade hora y ubicación) y Tus datos.
  - «Normativa»: Límites legales: umbral de información 180, umbral de alerta 240, valor objetivo 120 µg/m³ (8 h) y guía de la OMS 100 µg/m³.
- **Tarjetas** (`item_tema_informacion.xml`): iconos de línea fina sobre un círculo del color de su sección (el aire en verde, el sensor en violeta y la normativa en azul; el título de la sección va del mismo color). Cerradas al abrir la pantalla. Al tocar la tarjeta se abre o se cierra: la altura cambia con una animación (`TransitionManager` + `AutoTransition`, 250 ms), la flecha gira 180° y se vuelve violeta y el borde pasa a violeta suave. No hay enlace «Leer más»: la flecha basta. Al pulsar, la tarjeta se hunde un poco (escala 0,98).
- **Consejo de hoy:** cinco consejos (`info_consejos`). Cada día empieza por uno distinto (`ConsejosDelDia.deHoy()` con el día del año); cambia solo cada 7 s (solo mientras la pantalla se ve: `onResume()` / `onPause()`) o al tocarlo, con un fundido (`TextSwitcher`). Los puntos de abajo marcan cuál se ve.
- **Entrada:** al abrir la pantalla, el consejo y las tarjetas de «El aire que respiras» aparecen uno detrás de otro (fundido y desplazamiento hacia arriba, 60 ms entre cada una).

## 3c. Pantalla de inicio (T006 · H006)

Pantallas de Figma «inicio», «inicio (sin sensor)» e «inicio · notificaciones abiertas». Se sigue el diseño de Figma (textos, tarjetas y orden) y se añaden animaciones. Es la pantalla que se abre con sesión iniciada y la pestaña «Inicio» de la barra.

```text
InicioActivity.onResume() --> LogicaFakeInicio.obtenerUltimasMediciones()   (GET /ultimasMediciones?cantidad=5, T017)
                          --> LogicaFakePerfil.obtenerUsuario()             (GET /usuarioActual: ¿tiene sensor?)
InicioActivity --(«Vincular», sin sensor)--> VincularSensorActivity (extra desdePerfil: al terminar vuelve a Inicio)
InicioActivity --(«Ver más»)--> MisDatosActivity
InicioActivity --(«Ver»)--> MiSensorActivity
InicioActivity --(«Mejor hora para salir»)--> ProximamenteActivity
InicioActivity --(«Mis lugares»)--> MisLugaresActivity
InicioActivity --(campana)--> panel de notificaciones (avisos del servidor + «Sensor desconectado», o los de ejemplo)
InicioActivity --(onResume)--> LogicaFakeAvisos.obtenerAvisos()           (GET /avisos?desdeId=, T008)
InicioActivity --(pulsar un aviso con zona)--> MapaAvisoActivity            (OpenStreetMap centrado en el aviso, T008)
InicioActivity --(tocar una de las últimas mediciones)--> elegir() (esa medición pasa al arco)
barra «Mapa» --> ProximamenteActivity
barra «Mis datos» --> MisDatosActivity
```

### Tipos

```text
Medicion: { valor: R (µg/m³), momento: Z (ms desde 1970, UTC) }
Seccion ∈ { MAPA, PREVISION, MIS_LUGARES, MI_SENSOR }                // secciones provisionales
Aviso: { tipo ∈ { CONTAMINACION, BATERIA, DESCONECTADO }, titulo: Text, texto: Text, momento: Z, clave: Text,
         zona: Text | null, latitud: R | null, longitud: R | null }       // T008: los del servidor llevan zona y coordenadas
```

### Clase Medicion (NUEVA)

```text
                                    --------- Medicion -----------------------------
                                    |
                                --> nivel() --x
  NivelOzono                    <-- |
                                    |
                                --> valorRedondeado() --x
  Z                             <-- |
                                    |
  cuerpo: Text                  --> listaDesdeJSON() --x
  [Medicion] | null             <-- |     lee [{"valor", "fecha"}] ("fecha" en ISO o ms),
                                    |     salta las no válidas, de la más nueva a la más antigua
                                    ------------------------------------------------
```

### Clase TiempoTranscurrido (NUEVA)

```text
                                    --------- TiempoTranscurrido -------------------
                                    |
  momento: Z, ahora: Z          --> haceCuanto() --x
  Text                          <-- |     «ahora mismo», «hace 5 min», «hace 2 h», «hace 3 días»
                                    |
  momento: Z, ahora: Z          --> esAntigua() --x
  B                             <-- |     más de 1 hora (H006)
                                    |
  momento: Z, zona: ZoneId      --> hora() --x
  Text                          <-- |     «18:42»
                                    |
  momento: Z, ahora: Z,
  zona: ZoneId                  --> horaODia() --x
  Text                          <-- |     «18:42» si es hoy, «Ayer», o «09/11»
                                    ------------------------------------------------
```

### Clase Aviso (NUEVA)

```text
  mediciones: [Medicion],
  tieneSensor: B, ahora: Z      --> calcular() --x
  [Aviso]                       <--       última > 180 µg/m³ → «Contaminación alta»;
                                          con sensor y última de más de 1 h → «Sensor desconectado»
                                          (desde T008 Inicio solo usa «Sensor desconectado»: los de contaminación vienen del servidor)

  cuerpo: Text                  --> listaDesdeJSON() --x      [Aviso] | null <--   (T008) lee la respuesta de GET /avisos; salta las filas sin
                                                              idAviso, valor o fecha; sin coordenadas válidas el aviso se conserva pero tieneZona() es false
                                --> tieneZona() --x            B <--   true si tiene latitud y longitud válidas (puede abrir el mapa)
```

### Clase LogicaFakeAvisos (NUEVA · T008)

```text
  token: Text                   --> obtenerAvisos() -->        GET /avisos?desdeId=0 y, mientras la página venga llena (100), la siguiente con desdeId = mayor idAviso;
  RespuestaAvisos               <-- |                          se queda con los 20 más recientes (del más nuevo al más antiguo)
  pagina, desdeId, pedidas      --> hayOtraPagina() --x        B <--   página llena Y el cursor avanza Y menos de 50 llamadas (nunca hace bucle)
  [Aviso], maximo               --> masRecientes() --x         [Aviso] <--   sin repetir clave, del más nuevo al más antiguo
  servidor, locales             --> combinar() --x             [Aviso] <--   los del servidor + los locales que no son de contaminación
  codigo: Z, cuerpo: Text       --> notificarAvisos() --x      200 → página · 401 → sesionCaducada() · 0 → sin conexión · otro → error()

RespuestaAvisos: avisosObtenidos(avisos: [Aviso]), sesionCaducada(), error(mensaje: Text)
```

### Clase AvisosLeidos (NUEVA)

```text
  contexto: Context             --> leer() --x          {Text} <--   claves de los avisos leídos
  contexto: Context, claves: [Text] --> marcar() -->
  avisos: [Aviso], leidos: {Text} --> Aviso.cuantosSinLeer() --x      N <--
```

### Clase EfectoPulsar (NUEVA)

```text
  vistas: [View]                --> aplicar() -->       al pulsar se hunde (0,97) y al soltar vuelve con rebote
```

### Clase LogicaFakeInicio (NUEVA)

```text
                                    --------- LogicaFakeInicio ---------------------
                                    |
  token: Text                   --> obtenerUltimasMediciones() -->
  RespuestaMediciones           <-- |     USAR_DATOS_DE_EJEMPLO: las de ejemplo;
                                    |     si no, GET /ultimasMediciones?cantidad=5
                                    |
                                    |    ahora: Z --> medicionesDeEjemplo() --x
                                    |    [Medicion] <--
                                    |
                                    |    ahora: Z --> avisosDeEjemplo() --x
                                    |    [Aviso] <--         (los 3 del Figma)
                                    |
                                    |    codigo: Z, cuerpo: Text --> notificarMediciones() --x
                                    ------------------------------------------------

RespuestaMediciones: medicionesObtenidas(mediciones: [Medicion], deEjemplo: B), sesionCaducada(), error(mensaje: Text)
```

### Clase IndicadorCalidad (NUEVA, vista)

```text
  valor: R, color: Z, animar: B --> mostrar() -->      (arco gris de 220° y la parte del valor, de 0 a 300 µg/m³, con punto blanco en la punta;
                                                        pasa del valor y color anteriores al nuevo)
                                --> vaciar() -->
  valor: R                      --> fraccionDe() --x   R <--
```

### Pantallas

```text
InicioActivity (MODIFICADA): onCreate(), onResume(), onPause(), cargarMediciones(), cargarSensor(), cargarAvisosServidor(),
                             mostrarMediciones(), elegir(), refrescarTextos(), mostrarSensor(), mostrarAccesos(),
                             actualizarAvisos(), abrirAvisos(), cerrarAvisos(), mostrarError(), contarHasta(),
                             animarEntrada(), colorDe(), nombreDe(), mensajeDe(), marcarLeidos(), cerrarSesion()
ProximamenteActivity (NUEVA, provisional): onCreate(), intentPara(), seccionDe()
MapaAvisoActivity (NUEVA, T008): onCreate(), intentPara(), userAgent(), onResume(), onPause(), onDestroy()
```

- **Cabecera:** «Bienvenido», «Así está el aire que respiras ahora.» y la campana con el número de avisos (insignia violeta). Cuando hay avisos nuevos la insignia aparece con un rebote y la campana se balancea.
- **Calidad del aire ahora:** la medición elegida (al abrir, la última) en el arco (`IndicadorCalidad`), con su valor en µg/m³, la calidad («Buena», «Moderada», «Mala», «Muy mala»; mismos colores que «Información» y el mapa de la web), un consejo según el nivel y «Medido hace 4 min · 18:42». Al abrir la pantalla el arco se llena y el número sube de 0 al valor (0,9 s). Si la última medición tiene más de 1 hora sale el aviso amarillo «No hay datos nuevos desde hace 2 h…» (H006). Sin mediciones: arco vacío y «Todavía no hay mediciones…». Sin conexión: el error en rojo y «Reintentar».
- **Últimas mediciones:** se piden 5: la última va en el arco («ahora») y las 4 anteriores en cajas (valor y hora) que entran una detrás de otra con un pequeño rebote. Al tocar una, se marca (borde violeta y una rayita del color de su nivel) y el arco, el número, la calidad y «Medido hace…» pasan a esa medición; el título cambia de «Calidad del aire ahora» a «Calidad del aire a las 15:19» (con un fundido) y aparece el botón «Ahora» arriba a la derecha; «Ahora» o tocar otra vez la caja vuelve a la última. Con sensor el título es «Últimas mediciones (µg/m³)»; sin sensor, «Últimas horas en tu zona (µg/m³)». «Ver más» abrirá «Mis datos».
- **Mi sensor / Vincular:** `GET /usuarioActual` determina si hay sensor. «Ver» y la fila «Mi sensor» del perfil abren `MiSensorActivity`, que consulta `GET /miSensor` para mostrar el identificador, la última sincronización y la batería de `Sensores.bateria`; si la batería es `null`, enseña «No disponible». El estado se deriva de `ultimaConexion` (conectado si la última sincronización fue en las últimas 24 horas). El interruptor de luz de aviso (H033) cambia de verdad el LED del sensor: `LuzSensor` se conecta por Bluetooth a la dirección que guardó `ServicioMediciones` al recibir la última trama del sensor, escribe 1/0 en la característica `AERIS-LUZ-ACTIVA` del servicio `AERIS-SERVICIO-1` (UUID con `UuidAERIS`) y se desconecta. Mientras tanto el interruptor queda desactivado con «Cambiando la luz del sensor…»; si el sensor no responde en 15 s, no hay Bluetooth o todavía no se conoce su dirección, el interruptor vuelve a su posición y se explica el motivo. En Android 12+ pide el permiso `BLUETOOTH_CONNECT`. «Desvincular sensor» llama a `DELETE /miSensor`; al volver a consultar el estado, la pantalla permite vincular otro. Sin sensor, Inicio muestra «¿Tienes un sensor AERIS?» con «Vincular». Para datos de muestra (sensor AERIS, batería al 78 %), se puede poner `LogicaFakeMiSensor.USAR_DATOS_DE_EJEMPLO = true`; el valor predeterminado usa la API real.
- **Accesos:** «Mejor hora para salir» (con los datos de ejemplo: «Hoy de 8:00 a 10:00 · pico a las 14:00») y «Mis lugares» (con los de ejemplo: «● Casa: Buena  ● Trabajo: Moderada») abren `ProximamenteActivity` hasta que se hagan sus tareas.
- **Notificaciones (T006 + T008):** la campana abre el panel de Figma, arriba a la derecha: velo oscuro, el panel crece desde la campana y los avisos entran uno detrás de otro (título, texto y hora o «Ayer»). Tocar fuera del panel o «atrás» lo cierra **sin marcar nada como leído**. Los no leídos llevan un punto violeta a la izquierda y la insignia de la campana cuenta solo esos. Con muchos avisos, la lista se desplaza dentro del panel. **Origen:** `GET /avisos` del servidor (tabla `Avisos`: contaminación de tu sensor y de tus lugares, con su zona y coordenadas), pedido en `onResume()` y al guardarse una medición, más el aviso local «Sensor desconectado» (`Aviso.calcular()`); se enseñan los 20 más recientes. Si la petición falla, se quedan los últimos avisos. Un aviso del servidor se muestra aunque no tenga coordenadas, pero entonces no se puede abrir el mapa; el que no tiene `idAviso`, `valor` o `fecha` válidos se descarta. **Leído:** el servidor no guarda si un aviso se ha leído (no hay columna ni ruta, y no hace falta migración SQL); se recuerda en el teléfono por la clave `AVISO:<idAviso>` (`AvisosLeidos`, SharedPreferences). **Solo se marca como leído el aviso que se pulsa** (el punto se encoge y la insignia baja de uno en uno); no se sincroniza entre dispositivos. Los 3 avisos de ejemplo (`USAR_DATOS_DE_EJEMPLO`) no se guardan y salen otra vez sin leer. **Mapa:** los avisos con coordenadas llevan «Ver en el mapa ›»; al pulsarlos se marca ese aviso, se cierra el panel y se abre `MapaAvisoActivity`: un mapa mínimo de OpenStreetMap (osmdroid, ya usado en «Mis lugares»), centrado en las coordenadas del aviso (zoom 15), con un marcador con el nombre de la zona, el texto del aviso y la atribución. No es el mapa completo de la pestaña «Mapa» (otra tarea). Para que OpenStreetMap sirva los mapas, la pantalla identifica la app con el `User-Agent` `AERIS/<versión> (<applicationId>)`; sin él devuelve «403 Access blocked».
- **Pulsar:** las filas, las cajas y los botones se hunden un poco al pulsarlos (`EfectoPulsar`).
- **Textos de tiempo:** «hace X min» se actualiza cada minuto mientras la pantalla se ve (`onResume()` / `onPause()`).
- **Datos reales (T017 + T023):** `LogicaFakeInicio.USAR_DATOS_DE_EJEMPLO = false` y `SENSOR_DE_EJEMPLO = false`: las mediciones salen de `GET /ultimasMediciones?cantidad=5` y la tarjeta del sensor de `GET /usuarioActual` (`sensor`, `numeroSerie`). Respuesta esperada: `200` con `[{"valor": 84, "fecha": "2026-11-12T17:42:00Z"}, ...]`; `401` sesión caducada. Para ver la pantalla sin servidor, poner los dos a `true`: datos del Figma (5 mediciones 84, 90, 102, 96 y 88 µg/m³, una cada 20 min, la batería, la mejor hora, Mis lugares y los 3 avisos). Si el usuario tiene sensor, Inicio guarda su número de serie (`Sesion.guardarNumeroSerie`), pide los permisos que falten (una vez cada vez que se abre la app) y arranca `ServicioMediciones` (sección 3e); al recibir `ACCION_MEDICION_GUARDADA` vuelve a pedir las mediciones.
- **Entrada:** las tarjetas aparecen una detrás de otra (fundido y desplazamiento, 70 ms entre cada una); la de Mi sensor / Vincular entra a la vez que las demás con el último estado conocido (guardado en el teléfono) y luego el servidor lo confirma o lo cambia.
- **ProximamenteActivity:** título, icono, etiqueta «Próximamente» y un texto de la sección, con la barra de navegación (la pestaña marcada si se abrió desde la barra; desde un acceso de Inicio no se marca ninguna y tiene flecha de volver).

## 3d. Pantalla Mis lugares (T019/T046 · H034)

Pantalla completa de «Mis lugares» (Figma: «mis lugares»). Permite guardar hasta 5 ubicaciones en el servidor, especificando nombre, tipo, dirección y coordenadas; muestra el ozono interpolado de las mediciones recientes y permite activar o desactivar los avisos asociados a cada ubicación. Se abre desde el acceso «Mis lugares» de `InicioActivity` o desde la opción «Mis lugares» de `PerfilActivity`.

```text
InicioActivity («filaLugares»)   --> MisLugaresActivity
PerfilActivity («opcionMisLugares») --> MisLugaresActivity
MisLugaresActivity --> LogicaFakeMisLugares.obtenerLugares()
MisLugaresActivity --> LogicaFakeMisLugares.anadirLugar()
MisLugaresActivity --> LogicaFakeMisLugares.cambiarAvisos()
MisLugaresActivity --> LogicaFakeMisLugares.eliminarLugar()
MisLugaresActivity --(«Elegir posición en el mapa»)--> SeleccionarUbicacionActivity
SeleccionarUbicacionActivity --(latitud, longitud)--> MisLugaresActivity
MisLugaresActivity --(«atrás»)--> finish()
```

### Tipos

```text
Lugar: (
    id: Z,
    idUsuario: Z,
    nombre: Texto,
    tipo: casa | trabajo | colegio | otro,
    direccion: Texto,
    latitud: R,
    longitud: R,
    ozonoActual: R | null,
    avisosActivos: B
)
```

### Clase Lugar (NUEVA)

```text
                                    --------- Lugar --------------------------------
                                    |
  id: Z, idUsuario: Z,              --> Lugar() -->
  nombre: Texto, direccion: Texto,      |
  lat: R, lon: R, ozono: R, avisos: B   |
                                    |
                                    --> nivelOzono() --x
  NivelOzono                        <-- |     desdeValor(ozonoActual)
                                    |
                                    --> textoOzono() --x
  Texto                             <-- |     "%.0f µg/m³"
                                    |
  json: JSONObject                  --> desdeJSON() --x
  Lugar | null                      <-- |
                                    |
                                    --> aJSON() --x
  JSONObject                        <-- |
                                    ------------------------------------------------
```

### Clase LogicaFakeMisLugares (NUEVA)

La implementación predeterminada usa la API REST; el almacenamiento en memoria solo se activa en el modo de ejemplo de las pruebas.

```text
                                    --------- LogicaFakeMisLugares -----------------
                                    |
  token: Texto,                     --> obtenerLugares() -->
  callback: CallbackLugares             |     200 -> lugaresObtenidos(lista)
                                        |     401 -> sesionCaducada()
                                    |
  token: Texto, nombre: Texto,      --> anadirLugar() -->
  tipo: Texto, dirección: Texto,        |     POST /lugares con tipo y coordenadas
  latitud: R, longitud: R,              |     400 -> error(campos), 409 -> limiteAlcanzado()
  callback: CallbackOperacionLugar      |     201 -> lugar guardado
                                    |
  token: Texto, idLugar: Z,         --> cambiarAvisos() -->
  avisosActivos: B,                     |     PATCH /lugares/:idLugar
  callback: CallbackOperacionLugar      |
                                    |
  token: Texto, idLugar: Z,         --> eliminarLugar() -->
  callback: CallbackEliminarLugar       |     DELETE /lugares/:idLugar
                                    |
  token: Texto                      --> esTokenValido() --x
  B                                 <-- |     comprueba sesión
                                    |
  direccion: Texto                  --> interpolarOzonoParaDireccion() --x
  R                                 <-- |     ozono actual estimado del mapa (µg/m³)
                                    ------------------------------------------------
```

### Pantalla

```text
MisLugaresActivity (NUEVA): onCreate(), onResume(), cargarLugares(), mostrarLugares(),
                            guardarNuevoLugar(), confirmarEliminarLugar(), colorDe(), nombreDe()
```

- **Aislamiento por usuario:** La app usa la API con la sesión activa (`token`); el servidor filtra por propietario. El almacén en memoria se conserva solo para pruebas del modo de ejemplo.
- **Límite de 5 lugares:** La tarjeta de contador muestra `X de 5 lugares guardados`. Si se alcanza el límite (5 lugares), se muestra el aviso de límite y se bloquea la adición hasta que se elimine algún lugar.
- **Ozono interpolado:** Cada lugar muestra la concentración y nivel cuando hay lecturas O3 de las últimas 24 horas; si no las hay, muestra «Sin datos recientes».
- **Interruptor de avisos:** Cada tarjeta de lugar incluye un `MaterialSwitch` que activa o desactiva las alertas de esa ubicación específica.
- **Eliminación:** Cada tarjeta dispone de un botón de papelera que solicita confirmación antes de borrar el lugar.
- **Tipo y posición:** El formulario permite elegir Casa/Trabajo/Colegio/Otro. La posición se elige tocando el mapa de OpenStreetMap; el selector devuelve latitud y longitud a `MisLugaresActivity`, sin pedir al usuario que las escriba. El mapa muestra la atribución de OpenStreetMap.

## 3e. Recepción de las mediciones por Bluetooth (T023)

El nodo (T004, `doc/arduino_design.md`) emite tramas iBeacon: UUID = `"AERI"` + número de serie (12 cifras), major = tipo × 256 + contador, minor = valor con signo. Ozono (tipo 11, µg/m³) durante 6 s y temperatura (tipo 12, décimas de °C) durante 3 s; una ronda cada ~9 s. La app las recibe y las envía al servidor:

```
sensor --BLE--> ServicioMediciones --TramaAERIS--> ReceptorMediciones --> ColaMediciones --POST /guardarMedicion--> servidor
                     (+ ubicación y hora)                                                   └─ ACCION_MEDICION_GUARDADA --> Inicio
```

### Clase TramaAERIS (NUEVA)
- `leer(datos: [N] | null) → TramaAERIS | null`: datos del fabricante `0x004C` del anuncio: `0x02 0x15`, UUID, major, minor, txPower (23 bytes). `null` si no empieza por `PREFIJO` (`0x02 0x15 "AERI"`) o el número de serie no son 12 cifras.
- Campos: `numeroSerie`, `tipo` (`OZONO` = 11, `TEMPERATURA` = 12), `contador` (0..255), `valor` (con signo). `esOzono()`. Basada en `TramaIBeacon` del Sprint 0.

### Clase ReceptorMediciones (NUEVA)
- `esNueva(trama, ahora) → B`: solo ozono, contador distinto del último guardado y al menos `INTERVALO_MINIMO` (60 s) después: el sensor repite la misma medición durante 6 s y hace una nueva cada ~9 s, así que se guarda una por minuto. La temperatura no se envía (el servidor solo guarda contaminantes).
- `cuerpo(numeroSerie, valor, latitud, longitud, momento) → Text`: `{"numeroSerie", "contaminante": "O3", "valor", "latitud", "longitud", "fecha"}` (ISO sin milisegundos). El valor se deja entre 0 y 2000 (`valorParaServidor`): con muy poco ozono el sensor puede dar un poco menos de 0.
- `queHacer(codigo) → Resultado`: `200`/`201` ENVIADA; `401` SIN_SESION; `0`, `408`, `429`, `5xx` REINTENTAR; el resto (400, 403, 404) DESCARTAR (el servidor nunca la aceptará).

### Clase ColaMediciones (NUEVA)
- Mediciones aún no enviadas, la más antigua primero: `anadir()`, `primero()`, `quitarPrimero()`, `tamano()`, `vacia()`. Como mucho `MAXIMO` (2000, ~33 h a una por minuto); si se llena se pierden las más antiguas.
- `aTexto()` / `desdeTexto()`: una por línea, para guardarla en el teléfono (`SharedPreferences` «mediciones_pendientes») y no perderla al cerrar la app.

### Clase PermisosMedicion (NUEVA)
- `obligatorios(sdk)`: ubicación precisa y aproximada (cada medición va con dónde se tomó; en Android 10 y 11 también hacen falta para buscar por Bluetooth) y, desde Android 12, `BLUETOOTH_SCAN`. `aPedir(sdk)`: además `POST_NOTIFICATIONS` desde Android 13 (si se niega, se mide igual, sin ver la notificación). `concedidos(contexto)`.

### Clase ServicioMediciones (NUEVA, servicio en primer plano de tipo `location`)
- `iniciar(contexto)` (solo con los permisos) / `parar(contexto)`. Lo arranca Inicio si el usuario tiene sensor; `Sesion.cerrar()` lo para.
- Busca por Bluetooth con un filtro en los datos del fabricante (`PREFIJO`), así también funciona con la pantalla apagada, y se queda con las tramas del número de serie de `Sesion.numeroSerie()`. Ubicación: la última conocida y una nueva cada 30 s (GPS y red, `LocationManager`). Sin ubicación todavía, la medición no se guarda (el servidor la exige) y la notificación lo dice.
- Envía las pendientes de una en una a `POST /guardarMedicion` con el token; sin conexión lo reintenta cada minuto; `401` para el servicio. Al guardar una envía `ACCION_MEDICION_GUARDADA` (solo a la propia app).
- Notificación fija (canal «Medición con tu sensor», importancia baja): «Buscando tu sensor…», «Última medida: 84 µg/m³ · 13:42», Bluetooth apagado o sin ubicación. Al tocarla abre Inicio.
- Logcat, etiqueta `ServicioMediciones`: cada medición nueva, los envíos que fallan y las que el servidor no acepta.

### Clase Sesion y DatosUsuario (MODIFICADAS en T023)
- `DatosUsuario.numeroSerie` (de `GET /usuarioActual`; `""` si no tiene sensor). `Sesion.guardarNumeroSerie()` / `numeroSerie()`; `Sesion.cerrar()` también para `ServicioMediciones`.


## 3f. Pantalla Mis datos (T007)

`MisDatosActivity` está disponible desde la pestaña inferior «Mis datos» y desde «Ver más» de Inicio. Al abrirse consulta los registros del día local con el token de sesión; el servidor comprueba que el usuario tenga un sensor y filtra por su `idUsuario`.

```text
MisDatosActivity.onResume()
  --> LogicaFakeMisDatos.obtenerDatos(token, inicioDiaLocal, inicioDiaSiguiente)
  --> GET /misDatos?desde=<epoch-ms>&hasta=<epoch-ms>
  --> MedicionDiaria.listaDesdeJSON()
  --> ResumenMisDatos.calcular()
```

- `ResumenMisDatos` ordena las mediciones, suma las distancias entre ubicaciones consecutivas con la fórmula de Haversine y calcula la media aritmética de O3. La media se clasifica con `NivelOzono`.
- La pantalla muestra la distancia recorrida, la calidad media y una gráfica horaria de concentraciones del día; el umbral de 100 µg/m³ se marca en la gráfica. Si hoy no hay mediciones, los valores quedan como «—» y se indica que no hay datos.
- Sin sensor vinculado, el servidor responde 404 y la pantalla muestra el aviso y el acceso a «Vincular sensor». Al volver a la pantalla se vuelven a cargar los datos. `401` cierra la sesión; los errores de red ofrecen «Reintentar».
- El día se calcula en la zona horaria del dispositivo y se envía al servidor como un intervalo semiabierto. El servidor admite hasta 26 horas para cubrir cambios de horario y devuelve todas las mediciones O3 de ese usuario con sus coordenadas.
- **Tests:** `MisDatosTest` cubre el análisis del JSON, la distancia, la media y el estado vacío; `LogicaFakeMisDatosTest` cubre las respuestas de la API. Las pruebas del servidor verifican el aislamiento de datos, el intervalo y el caso sin sensor.

## 3g. Pantalla Ayuda (T043)

Dos pantallas: `AyudaActivity` (preguntas frecuentes, formulario y «Mis incidencias») e `IncidenciaActivity` (la conversación de una incidencia). No usan ninguna tabla ni ruta propias: reutilizan las incidencias de T041 (`/crearIncidencia`, `/misIncidencias`) y la conversación de este mismo T043 (`/mensajesIncidencia`, `/enviarMensajeIncidencia`; ver `servidor_rest_design.md`, `logica_design.md` y `bd_design.md`). Siempre con el token de la sesión.

```text
PerfilActivity       --(fila «Ayuda»)------------------------------------------> AyudaActivity
MiSensorActivity     --(«¿Algún problema con tu sensor?»)--> AyudaActivity (tipo «Sensor», con el sensor a la vista)
VincularSensorActivity --(«Necesito ayuda»)---------------> AyudaActivity (tipo «Sensor», sin sensor)
AyudaActivity --onResume()--> LogicaFakeAyuda.obtenerIncidencias() --> GET /misIncidencias --> Incidencia.listaDesdeJSON()
AyudaActivity --(«Enviar incidencia»)--> ValidadorIncidencia.validarNueva() --> LogicaFakeAyuda.crearIncidencia() --> POST /crearIncidencia
AyudaActivity --(tocar una incidencia)--> IncidenciaActivity
IncidenciaActivity --onResume()--> LogicaFakeAyuda.obtenerMensajes() --> GET /mensajesIncidencia?id=N --> MensajeIncidencia.listaDesdeJSON()
IncidenciaActivity --(«Enviar»)--> ValidadorIncidencia.validarMensaje() --> LogicaFakeAyuda.enviarMensaje() --> POST /enviarMensajeIncidencia
```

### Tipos

```text
Incidencia        = ( idIncidencia: N, tipo, asunto, descripcion, estado, tieneRespuesta: B, fechaCreacionMs: Z, numeroSerie )
                    tipo ∈ { sensor, datos, cuenta, otra }    estado ∈ { abierta, en curso, resuelta }
MensajeIncidencia = ( idMensaje: N, texto, fechaMs: Z, delUsuario: B, autorNombre, autorRol )
```

### Clases

```text
Incidencia            desdeJSON() · listaDesdeJSON()       null si no es JSON o falta el id o el asunto; salta los elementos malos;
                                                           un tipo o un estado que no se conoce pasa a «otra» / «abierta»
MensajeIncidencia     desdeJSON() · listaDesdeJSON()       idem (necesita id y texto)
                      quienEs() --x Text <--               «usuario» si delUsuario; «tecnico» o «administrador» si lo escribió el equipo;
                                                           «equipo» si el rol no se conoce o la cuenta se borró
LectorJSON            texto() · fechaMs()                  nunca devuelve el texto «null» (el org.json de Android lo daría con optString())
ValidadorIncidencia   validarNueva(tipo, asunto, descripcion) --x Lista<( campo, mensaje )> <--     asunto y mensaje: como mucho 120 y 2000 caracteres
                      validarMensaje(texto) --x Text | null <--
LogicaFakeAyuda       obtenerIncidencias() · crearIncidencia() · obtenerMensajes() · enviarMensaje()
                      callback: lista / creada / mensajes / enviado, datosNoValidos(Text), incidenciaNoExiste(), sesionCaducada(), error(Text)
AyudaActivity         onCreate(), onResume(), anyadirPreguntas(), alternar(), seleccionarTipo(), pulsarEnviar(), cargarIncidencias(), pintarIncidencias()
IncidenciaActivity    onCreate(), onResume(), cargarMensajes(), pintarMensajes(), pulsarEnviar()
```

### Qué se ve

- **Ayuda:** abajo del título, tres secciones. **Preguntas frecuentes:** las **cinco de la página Ayuda de la web** (T042), con el mismo texto, en las tarjetas desplegables de Información (`item_tema_informacion.xml`, cerradas al abrir; se abren con la misma animación y la flecha que gira). **Enviar una incidencia:** cuatro opciones «¿De qué trata?» (Sensor, Mediciones, Cuenta, Otra consulta; por defecto «Sensor», como en la web), asunto (hasta 120 caracteres) y mensaje (hasta 2000), con los errores debajo de cada campo y «Incidencia enviada» al terminar. **Mis incidencias:** una tarjeta por incidencia con su tipo, su estado (Abierta en rojo, En curso en amarillo, Resuelta en verde, como en la web), un trozo del mensaje, la fecha y «Con respuesta» si el equipo ha contestado. La más nueva primero.
- **Sensor preseleccionado:** desde Mi sensor (o desde Vincular sensor) el tipo llega elegido y la pantalla baja sola al formulario. Desde Mi sensor, mientras el tipo sea «Sensor» o «Mediciones», sale una línea «Sensor: nombre · número de serie». La app **no envía** el sensor: el servidor ya adjunta el sensor del usuario a las incidencias de esos dos tipos (`POST /crearIncidencia` sin `idSensor`), y a las de «Cuenta» u «Otra» no les pone ninguno. La app tampoco recibe el `idSensor` (solo el nombre y el número de serie), y en el sistema un usuario solo tiene un sensor.
- **Conversación:** la **descripción** es el primer mensaje (violeta, a la derecha, «Tú»); después los mensajes por orden: los del usuario a la derecha y los del equipo en blanco a la izquierda, con «Marc (técnico)» o «Alba (administrador)» y la fecha. Si el equipo aún no ha contestado, una nota dice que se está revisando. Abajo, la caja para escribir (una o varias líneas, hasta 2000 caracteres) y «Enviar».
- **Reabrir:** si la incidencia estaba «Resuelta» y el usuario escribe, el servidor la pasa a «Abierta» y la etiqueta cambia al enviar el mensaje. Los mensajes del usuario no mandan correo; cada respuesta del equipo manda uno solo al usuario (lo hace el servidor).

### Aclaraciones

- **Ciclo de vida:** cada pantalla carga en `onResume()`, así al volver de la conversación la lista refleja el estado actual y la conversación recoge respuestas nuevas. Hay una sola petición a la vez por pantalla (`cargandoLista`, `cargando`, `enviando`); la primera carga enseña un indicador y, si falla, el motivo y «Reintentar»; las siguientes refrescan sin mover nada y, si fallan, dejan lo que había. Lo escrito en el formulario y la opción elegida se conservan al girar el móvil; si el envío falla, no se borra nada. Al escribir en un campo desaparece su error y el aviso de «incidencia enviada» del envío anterior.
- **Estado al día en la conversación:** el estado de la cabecera viene de la lista, y como el equipo puede cambiarlo mientras la conversación está abierta (por ejemplo, pasarla a «Resuelta» al responder), cada vez que se cargan los mensajes se vuelve a pedir `/misIncidencias` y se actualiza la etiqueta. Si esa petición falla, se queda el estado que había.
- **Errores (en la propia pantalla, sin Toast):** sin conexión → «No hay conexión con el servidor. Inténtalo de nuevo.»; `400` → el texto del servidor; `404` en la conversación → «Esta incidencia ya no está disponible.» y se desactiva la caja; `401` cierra la sesión y vuelve a la bienvenida, como en el resto de la app. Los textos de lo que escribe el usuario y de las respuestas se pintan como texto, no como HTML.
- **Seguridad:** el servidor solo deja leer y escribir en una incidencia a quien la envió y a los técnicos y administradores; para cualquier otro responde 404 como si no existiera.
- **Quitado:** `ProximamenteActivity.Seccion.AYUDA` y sus textos, que solo servían de pantalla provisional hasta esta tarea (se comprobó que no quedaban más referencias).
- **Tests:** `AyudaTest` cubre la lectura de incidencias y mensajes (también con campos `null` o «null»), `quienEs()`, el validador y las respuestas de `LogicaFakeAyuda` (200, 201, 400, 401, 404, sin conexión y otros códigos) para las cuatro operaciones, y el JSON que se envía (sin `idSensor`).

## 3c. Previsión de ozono de 48 horas (T032)

Pantalla nueva que se abre desde una tarjeta resumen de Inicio. Usa el estilo de «Editar mis datos» (`ScrollView`, botón volver, título 28 sp, tarjetas blancas `fondo_tarjeta`) y no lleva barra de navegación porque no es una pestaña. La tarjeta va en su propio `tarjeta_prevision_inicio.xml` (`<include>`), para que la pantalla de inicio real (T006) la coloque donde quiera.

```text
InicioActivity --(onResume)--> LogicaFakePrevision.vigente()   (la última previsión recibida hace menos de 30 minutos)
InicioActivity --(onResume, si no hay vigente)--> LogicaFakePrevision.obtenerPrevision() --> PeticionarioREST --> GET /api/prevision/ozono?zona=Gandia   (servidor principal, puerto 8080)
InicioActivity --(tarjeta «Previsión de ozono»)--> PrevisionActivity
PrevisionActivity --(onCreate / onResume)--> LogicaFakePrevision.vigente(), y si no hay --> obtenerPrevision()   («Reintentar» también)
PrevisionActivity --> PrevisionOzono.mejorMomento() / Hora.nivel() --> NivelOzono.desdeValor()
PrevisionActivity --> GraficaPrevision.poner()
```

### Tipos

```text
Hora          = ( fecha: LocalDateTime, ozono: R )                    // µg/m³; la fecha es la hora local del servidor
Franja        = ( inicio: LocalDateTime, fin: LocalDateTime, media: R, indice: N, horas: N )
PrevisionOzono = ( zona: Text, simulados: B, advertencia: Text, modelo: Text, ultimaObservacion: Text,
                   horas: Lista<Hora>, pico: Hora, json: Text, recibidaMs: Z )      // recibidaMs: cuándo la recibió el teléfono
```

### Clase PrevisionOzono (NUEVA)

```text
                                    --------- PrevisionOzono ---------------------------
                                    |
  cuerpo: Text, recibidaMs: Z   --> desdeJSON() --x         (sin recibidaMs: la hora actual)
  PrevisionOzono | null         <-- |     null si no es JSON o no hay ninguna hora válida; salta las horas con
                                    |     fecha o valor incorrectos o null; ignora «nivel», «nivel_pico» y «criterios_nivel».
                                    |     Un campo de texto null (o «null») es "": nunca se muestra el texto «null»
                                    |
  ahoraMs: Z                    --> estaCaducada() --x
  B                             <-- |     V si se recibió hace más de 30 minutos (o «en el futuro»: se cambió el reloj)
                                    |
                                --> mejorMomento() --x
  Franja                        <-- |     2 horas seguidas con la media más baja entre las 07:00 y las 22:00;
                                    |     si no hay, la hora del día más baja; si tampoco, la más baja de todas
                                    |
  fecha: LocalDateTime          --> diasDesdeHoy() --x
  N                             <-- |     0 hoy, 1 mañana, 2 pasado mañana (hoy = día de la última observación)
                                    |
                                    -------------------------------------------------
  Hora:  --> nivel() --x  NivelOzono <--     NivelOzono.desdeValor(ozono)
```

### Clase LogicaFakePrevision (NUEVA)

```text
                                    --------- LogicaFakePrevision --------------------
                                    |
                                    | ZONA: Text = "Gandia"            (la única con modelo)
                                    |
  zona: Text                    --> obtenerPrevision() -->
                                    |     callback: previsionObtenida(PrevisionOzono), zonaSinModelo(Text),
                                    |     sinDatos(), error(Text), servicioOcupado(), servicioNoDisponible()
                                    |     (los dos últimos, por defecto, llaman a error() con su mensaje)
                                    |     UNA sola petición en vuelo por zona: las llamadas que lleguen mientras
                                    |     tanto se unen a ella y todas reciben la misma respuesta
                                    |
  ahoraMs: Z                    --> vigente() --x
  PrevisionOzono | null         <-- |     la última recibida si tiene menos de 30 minutos; si no, null
                                    |
                                    |    zona: Text --> crearURL() --x                         Text <--
                                    |    codigo: Z, cuerpo: Text --> notificarPrevision() --x
                                    |         200 --> la recuerda para vigente(); 503 --> servicioOcupado() si el
                                    |         servidor dice «ocupado», error() «desactivada», o servicioNoDisponible()
                                    |
                                    -------------------------------------------------
```

### Clase GraficaPrevision (NUEVA, vista propia con Canvas)

```text
  prevision: PrevisionOzono,
  franja: Franja | null         --> poner() -->
  AlElegirHora                  --> setAlElegirHora() -->     callback: horaElegida(indice: N)
  valorMaximo: R                --> escalaMaxima() --x        R <--     al menos 100; si no, el siguiente múltiplo de 50 con un 10 % de margen
```

### Pantallas

```text
PrevisionActivity (NUEVA): onCreate(), onResume(), mostrarVigenteOCargar(), adaptarAncho(), cargar(), mostrarCargando(),
                           mostrarMensaje(), mostrar(), mostrarAviso(), mostrarPico(), mostrarMejorMomento(),
                           textoFranja(), mostrarHora(), rellenarLeyenda(), nombreDia(), hora()
InicioActivity (MODIFICADA): onResume(), cargarPrevision(), mostrarPrevision(), noDisponible(), abrirPrevision()
```

### Qué se ve

- **Aviso «Datos simulados»** (tarjeta ámbar con `ic_info`), siempre arriba mientras el servidor diga `simulados: true` o envíe una `advertencia`: el texto del servidor tal cual y «No es una previsión real.». La tarjeta de Inicio lleva la etiqueta «Datos simulados».
- **Pico máximo** (valor, día y hora, nivel con su color) y **Mejor momento para salir** (franja y media, «Orientativo»), lado a lado; apiladas si la pantalla mide menos de 360 dp. En pantallas de más de 600 dp el contenido se centra a 600 dp.
- **Gráfica «Hora a hora»:** una barra por hora del color de su `NivelOzono`; punto y valor sobre el pico; franja recomendada sombreada en verde; líneas discontinuas en los límites de nivel que caben (100, 180, 240); horas cada 6 h (cada 12 h si no caben); «Hoy / Mañana / Pasado» separados por una línea. Al tocar o arrastrar se elige una hora y se escribe encima su día, hora, valor y nivel. Lleva `contentDescription` con el resumen.
- **Leyenda de niveles:** las mismas cuatro filas de «Los niveles de AERIS» de Información (`item_nivel_ozono.xml`, `InformacionActivity.NIVELES_OZONO`).
- **Pie:** modelo y última observación utilizada.

### Aclaraciones

- **Niveles:** la app no usa el campo `nivel` del servidor: cada hora se clasifica con `NivelOzono.desdeValor(ozono_predicho)` (Bueno ≤ 100, Moderado ≤ 180, Malo ≤ 240, Muy malo), la misma escala que Información y el mapa de la web. El servidor (`clasificar_nivel()`) usa ya los mismos límites. Con los datos de demostración casi todo sale «Bueno».
- **Errores (en la propia pantalla, sin Toast) con «Reintentar»:** sin conexión → «No hay conexión con el servidor. Inténtalo de nuevo.»; `400` → «Solo hay previsión para Gandia.»; `503` → depende del `motivo` que manda el servidor: caído → «El servicio de previsión no está disponible ahora mismo.», ocupado (servidores anteriores a T032) → «El servicio de previsión está ocupado. Inténtalo en unos segundos.», desactivado → «La previsión no está activada en el servidor.»; `504` → «La previsión ha tardado demasiado. Inténtalo de nuevo.»; `200` sin horas válidas → «No hay predicciones disponibles en este momento.». En Inicio la tarjeta dice «Previsión no disponible por ahora. Toca para reintentar.» (o «El servicio está ocupado…») y se vuelve a intentar al volver a la pantalla.
- **Una sola petición:** `LogicaFakePrevision` mantiene **una única petición en vuelo por zona**; Inicio y `PrevisionActivity` (y la actividad recreada al girar el móvil) se unen a ella en vez de lanzar otra. La última previsión recibida se recuerda en `LogicaFakePrevision` y las pantallas la usan mientras tenga **menos de 30 minutos** (`vigente()`): girar el móvil, volver a Inicio o abrir la pantalla no repite la petición. Ya no se pasa la respuesta por un extra del `Intent` ni por `onSaveInstanceState()`.
- **Caducidad (30 minutos):** cuenta desde que el teléfono recibe la respuesta (`recibidaMs`, reloj del teléfono). Una previsión más antigua no se reutiliza: Inicio y la pantalla la piden de nuevo al volver (`onResume()`); si el reloj se retrasa por debajo de la hora de recepción, también se considera caducada.
- **Campos `null`:** un campo de texto `null` o con el texto «null» se lee como vacío (el `optString()` de Android devolvería el texto «null»): zona vacía → «Gandia», modelo vacío → «-», advertencia vacía → texto por defecto, observación no válida → no se muestra. El aviso de datos simulados se mantiene mientras `simulados` sea `true`.
- **Mejor momento:** es orientativo y se calcula con los valores de la propia previsión; no es una recomendación médica.
- **Zona:** solo hay modelo para Gandia, así que la zona va fija en `LogicaFakePrevision.ZONA`.
- **Servidor:** `URL_SERVIDOR` + `/api/prevision/ozono` (puerto 8080). No necesita sesión ni token.
- **Tests (`PrevisionTest`):** lectura del JSON (datos, inválido, horas incorrectas), niveles con `NivelOzono` frente al de la API, mejor momento (de día, horas no consecutivas, sin franja diurna, una sola hora), `diasDesdeHoy()`, y las respuestas 200, 400, 503, 504 y sin conexión. **`PrevisionRobustezTest`:** caducidad a los 30 minutos (límite exacto y reloj atrasado), `vigente()`, campos `null` y «null», una sola petición compartida entre varias pantallas (también si falla el transporte o un callback), y la diferencia entre servicio ocupado, caído y desactivado.

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
- **Primera pantalla:** `BienvenidaActivity` (T001). Si hay sesión guardada, mientras se ve solo el logo pregunta `GET /usuarioActual`: `200` → `InicioActivity`; `401` (por ejemplo, la contraseña se ha cambiado en otro teléfono, lo que invalida los tokens antiguos) → `Sesion.cerrar()` y se muestran los botones de la bienvenida; sin conexión → `InicioActivity` igualmente, para no echar a nadie por estar sin internet.
- **Cerrar sesión:** `Sesion.cerrar()` borra el token del teléfono; el servidor no guarda sesiones.
- **Login:** `POST /iniciarSesion` con `{"correo", "contrasena"}`. `200` → sesión iniciada; `401` → «Correo o contraseña incorrectos» (mismo mensaje si el correo no existe), se borra la contraseña escrita y no se da acceso.
- **Recuperar contraseña:** `POST /solicitarRecuperacion` con `{"correo"}`. `200` → el servidor ha enviado un enlace que caduca a los 30 minutos y se abre «Revisa tu correo»; `404` → el correo no tiene cuenta: no se envía nada y la app muestra «No hay ninguna cuenta con este correo.» debajo del campo. «¿No te ha llegado? Reenviar» pide otro enlace.
- **Tras el registro** se abre `VincularSensorActivity`: escanear (o escribir) el código y vincular el sensor. Abajo hay un enlace gris «Ahora no, lo vincularé más tarde» que abre el inicio (igual que la flecha de volver); solo sale tras el registro, no desde Perfil ni Inicio. No está en Figma: se añadió para poder seguir sin sensor (por ejemplo, en la demo). El sensor se puede vincular luego desde Inicio o Perfil.
- **Desde el perfil** (extra `desdePerfil`): volver (o vincular el sensor) cierra la pantalla y se vuelve al perfil, que recarga sus datos en `onResume()`. Todo pasa por `salir()`.
- **Vincular sensor (T005):** el sensor se vincula escaneando con la cámara el código (DataMatrix) de la etiqueta del sensor de ozono, p. ej. `092021010920 110406 03 2109 -44.75`. «Escanear código» abre nuestro escáner, `EscanerActivity` (T039): el escáner de Google no leía el DataMatrix de la etiqueta, que mide pocos milímetros. Usa CameraX (vista previa y análisis a 1920×1080, solo la última imagen) y ML Kit `barcode-scanning` (DataMatrix y QR). Las imágenes se reparten entre dos lectores: una va entera a ML Kit y la siguiente, recortada al cuadrado del centro (`RecorteCentral`, el 60 % del lado corto, con tests), a ZXing (`com.google.zxing:core`, con `TRY_HARDER`). El DataMatrix de la etiqueta mide unos 4 mm y contiene, por ejemplo, `092021011003 110406 O3 2109 -38.11`; ML Kit solo no lo leía; empieza con zoom ×2, enfoca donde se toca la pantalla, se acerca con dos dedos y tiene botón de linterna si el móvil tiene flash. La primera vez pide el permiso `CAMERA`; si no se da, vuelve con «Sin permiso para usar la cámara…». Devuelve el texto del primer código leído (`EXTRA_CODIGO`); si no es el de un sensor, «Vincular sensor» enseña «Se ha leído «…», pero no es el código de un sensor AERIS.». `CodigoSensor.desdeTexto()` separa el texto en número de serie (12 cifras), modelo (6), gas (2 o 3 letras o cifras: en las etiquetas reales `O3`, con la letra O), fecha AAMM y sensibilidad (nA/ppm); si no tiene esa forma devuelve `null` y se enseña «Este código no es el de un sensor AERIS…» debajo del botón. Si la cámara no funciona, «¿No funciona la cámara? Escribe el código» enseña un campo, «Código de la etiqueta», donde basta con escribir el número de serie (las 12 primeras cifras, `092021010920`) o la línea entera que da el escáner y que aparece en la etiqueta debajo del código (`092021010920 110406 O3 2109 -44.75`, con los espacios; la sensibilidad puede llevar coma o punto). El campo admite letras (el gas de las etiquetas reales es `O3`, con la letra O). Se lee igual que el código escaneado, con `CodigoSensor.desdeTexto()`; con solo el número de serie, `sensibilidad` es `null` y `POST /solicitarVinculacion` se envía sin ella (el servidor ya la tiene, T039). La flecha de arriba y el botón «atrás» del teléfono vuelven al paso anterior: de «a mano» a «escanear» y de «Sensor leído», «Esperando la confirmación» o «Vinculación rechazada» a donde se metió el código (escáner, o el campo a mano con el código todavía escrito); desde el primer paso se sale de la pantalla. Volver atrás no cancela la solicitud pendiente. Si no es ni el número de serie ni los 5 grupos, sale el error debajo del campo y «Volver a escanear» vuelve al botón. Con un código válido se enseña la tarjeta «Sensor leído» (número de serie, tipo de sensor y fecha) con «Vincular», la nota «Enviaremos un correo a quien compró el sensor…» y «Escanear otro código».
- **Confirmación por correo (T005):** cada sensor está ligado al correo de quien lo compró (puede no ser el usuario, si se lo han regalado). «Vincular» llama a `LogicaFakeVincular.solicitarVinculacion()` (`POST /solicitarVinculacion` con `{"numeroSerie", "sensibilidad"}`); el servidor envía a ese correo un enlace para confirmar o rechazar y responde con la solicitud (`SolicitudVinculacion`: `{"numeroSerie", "correoComprador" (ya oculto, «m•••••@gmail.com»), "estado": "pendiente" | "confirmada" | "rechazada", "fecha"}`). Pendiente: «Esperando la confirmación» (aviso amarillo con el correo oculto, «Reenviar correo» → `POST /reenviarCorreoVinculacion`, y «Estado de la vinculación» con los 3 pasos: sensor escaneado con la hora, confirmación por correo, sensor vinculado). Mientras espera, el aviso lleva una rueda girando y la pantalla pregunta `GET /estadoVinculacion` al abrirla, al volver a ella y cada `INTERVALO_CONSULTA` (5 s; solo con la pantalla delante, `onResume()` / `onPause()`; sin conexión lo vuelve a probar): confirmada → aparece sola la tarjeta verde «¡Sensor vinculado!» («Tu sensor … ya está vinculado a tu cuenta…») con «Continuar», que sale a Inicio o Perfil (también la flecha atrás); rechazada o caducada (48 h) → «Vinculación rechazada» con «Escanear de nuevo». Errores: `404` al pedirla → «Este sensor no está registrado…»; `409` → «Este sensor ya está vinculado a otra cuenta.»; `404` al consultar = no hay solicitud. «Necesito ayuda» abre la pantalla Ayuda (T043, sección 3g) con el tipo «Sensor» ya elegido. El servidor ya tiene las rutas, así que `LogicaFakeVincular.USAR_DATOS_DE_EJEMPLO = false` y el correo se envía de verdad al comprador (el sensor de prueba `092021010920` está ligado a `pkaynak@upv.edu.es`, el correo fijo que hace de comprador en la demo: no hay compra en la app). Para ver las pantallas sin servidor, ponerlo a `true`: responde con una solicitud de ejemplo y `ESTADO_DE_EJEMPLO` (`PENDIENTE`; cambiarlo a `CONFIRMADA` o `RECHAZADA`). Diseños de Figma: «vincular sensor · código leído», «· esperando confirmación» y «· vinculación rechazada»; mismo flujo que «Mi cuenta · esperando confirmación» de la web.
- **Inicio (T006):** ver la sección 3c.
- **Perfil (T010):** al abrirse muestra el nombre y el correo guardados en `Sesion` y pide `GET /usuarioActual` (con `Authorization: Bearer <token>`) para mostrar el nombre completo, el correo y el interruptor «Notificaciones». El interruptor sale ya en su posición, sin animación: se recuerda el último valor en `Sesion` (`alertas()` / `guardarAlertas()`) y, cuando llega la respuesta, se coloca con `jumpDrawablesToCurrentState()`. Solo se anima cuando el usuario lo toca.
- **Interruptor «Notificaciones»:** al cambiarlo se envía `POST /cambiarAlertas` con `{"alertas": true | false}` y se guarda en la columna `alertas` de `Usuarios`. Mientras se guarda no se puede tocar (sin cambiar su aspecto); si falla (sin conexión o error), vuelve a su posición y se muestra el error. Tocar la fila también lo cambia.
- **Sesión caducada:** si el servidor responde `401` (token caducado o la contraseña ha cambiado), la app cierra la sesión y vuelve a la bienvenida.
- **Cerrar sesión (perfil):** `Sesion.cerrar()` y abre `BienvenidaActivity` cerrando las demás pantallas (`FLAG_ACTIVITY_CLEAR_TASK`).
- **Foto de perfil:** al tocar el avatar o el lápiz se elige «Hacer una foto» (la app de cámara guarda la foto en `cache/fotos/camara.jpg`, compartido con `FileProvider`; no hace falta el permiso `CAMERA`) o «Elegir de la galería» (selector de fotos de Android, sin permisos). La foto se recorta en cuadrado, se reduce a 256×256 y se envía como JPEG en base64 con `POST /cambiarFoto`; se guarda en la columna `foto` de `Usuarios`, así se ve en cualquier teléfono. Si ya hay foto, aparece también «Quitar la foto» (`{"foto": null}`). Se muestra recortada en círculo (`ShapeableImageView`).
- **Editar mis datos:** al abrirse pide `GET /usuarioActual` y rellena nombre, apellidos y correo. «Guardar cambios» los comprueba con las reglas del registro y envía `POST /actualizarDatos`: `200` → se actualizan el nombre y el correo guardados en `Sesion` y se vuelve al perfil, que se recarga en `onResume()`; `409` → «Este correo ya tiene una cuenta.» debajo del correo.
- **Tecla Enter (`TeclaEnter.pulsaBoton()`):** en el último campo de cada formulario el teclado muestra «Hecho» y Enter pulsa el botón: contraseña → «Acceder» (login), repetir contraseña → «Continuar» (registro), correo → «Enviar enlace» (recuperar contraseña), correo → «Guardar cambios» y repetir contraseña nueva → «Cambiar contraseña» (editar mis datos). Si el botón está desactivado (enviando), no hace nada.
- **Mensajes en la pantalla, sin avisos emergentes (Toast):** los errores y las confirmaciones se escriben en la propia pantalla: en el perfil, en rojo debajo del correo; en «Editar mis datos», los errores debajo de cada botón y, al cambiar la contraseña, una etiqueta verde «✓ Cambiada» al lado del título «Contraseña»; en «Revisa tu correo», debajo de «Reenviar». Al guardar los datos no sale ningún mensaje: se vuelve al perfil, que ya enseña los datos nuevos.
- **Cambiar contraseña:** pide la actual, la nueva (segura y distinta de la actual) y repetirla; `POST /cambiarContrasenya`. `200` → el servidor devuelve una sesión nueva, que se guarda con `Sesion.iniciar()` (la sesión de los otros teléfonos se cierra); `403` → «La contraseña actual no es correcta.» y se borra ese campo.
- **Mi sensor (T011):** el perfil obtiene el sensor con `GET /usuarioActual`; si existe, la fila abre `MiSensorActivity`, y si no, abre `VincularSensorActivity`. Mi sensor carga los datos de `GET /miSensor`, ofrece desvincular mediante `DELETE /miSensor` y cambia la luz de aviso del sensor por Bluetooth (`LuzSensor`, H033). Si el servidor responde `401`, se cierra la sesión; si no hay sensor (`404`), muestra la opción de volver a vincular.
- **Opciones de otras tareas:** «Umbral de alerta», «Puntos y recompensas» y «AERIS Premium» aún no hacen nada al pulsarlas. «Umbral de alerta» enseña «Normal», el valor por defecto (`umbralAlerta` NULL).
- **Barra de navegación:** `barra_navegacion.xml` se añade con `<include>` y `BarraNavegacion.conectar()` la pinta y conecta. Inicio siempre queda debajo: desde cualquier pestaña se cierra la pantalla actual al cambiar (`cierraLaActual()`), así «atrás» vuelve a Inicio y «atrás» en Inicio sale de la app. Al volver a Inicio se reutiliza (`FLAG_ACTIVITY_CLEAR_TOP`). Las pestañas cambian sin animación.
- **PeticionarioREST:** es el código proporcionado por el profesor, con la misma interfaz, pero sin `AsyncTask` (obsoleta desde Android 11): la petición se hace en un hilo de fondo (`Executor`) y el callback se llama en el hilo principal.
- **Visibilidad:** los métodos auxiliares de `ValidadorRegistro` y `LogicaFakeRegistro` son de paquete (sin `public`) para poder probarlos con JUnit; ninguna otra clase los usa.

---

## 5. Reglas generales

- **Lenguaje:** Java 11, Android 10 (API 29) o superior.
- **Tipografía (Entrega del Sprint 1, apartados 4.2 y 4.4):** Inter en toda la app (`res/font/inter.xml`, pesos 400, 500, 600 y 700; licencia SIL OFL en `doc/inter_licencia_OFL.txt`), puesta en el tema `Theme.AERIS`. Tamaños en móvil: H1 28 sp (700), H2 22 sp, H3 18 sp, H4 16 sp (600), texto principal 16 sp, texto secundario 14 sp (400) y botones 16 sp (600). Los botones principales y secundarios miden 44 dp de alto. Los textos que cambian de peso desde Java usan la clase `Tipografia` (`inter(contexto, peso)`).
- **Cabecera de fichero** con nombre, descripción, autores, fecha y copyright; **cabecera de cada método** con su diseño lógico en la notación de la asignatura y una línea `What it does:`.
- **Tests automáticos (JUnit 4):** `ValidadorRegistroTest` (campos vacíos, nombre y apellidos, correo, contraseña segura, confirmación), `LogicaFakeRegistroTest` (JSON enviado y respuesta para 201 con token, 409, 500 y sin conexión), `ValidadorLoginTest` (campos vacíos y correo) `LogicaFakeSesionTest` (JSON enviado, 200 con token, 401, 500, sin conexión y recuperación) `LogicaFakePerfilTest` (lectura de `DatosUsuario` con la foto, JSON de la foto, respuestas de `GET /usuarioActual`, `POST /cambiarAlertas` y `POST /cambiarFoto`, y qué pantalla cierra la barra) `SensorEncontradoTest` (textos de señal y distancia), `CodigoSensorTest` (código de la etiqueta, escaneado o escrito a mano), `VincularSensorTest` (solicitud de vinculación, correo oculto, «hoy, 18:40», JSON enviado y respuestas 200, 201, 401, 404, 409 y sin conexión), `InformacionTest` (niveles de ozono, consejo del día y pestaña «Info») y `LogicaFakeEditarDatosTest` (validación de los datos y de la contraseña, JSON enviado y respuestas 200, 400, 401, 403, 409 y sin conexión). Se ejecutan con `./gradlew test` desde `src/app`.
