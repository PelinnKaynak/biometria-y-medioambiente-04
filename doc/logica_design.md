# Diseño del componente: lógica de negocio

**Equipo:** 04 – SenseTech · **Sprint:** 2 · **Implementación:** `src/logica/` (Node.js, MySQL con `mysql2`)

---

## 1. Usuarios y autenticación (T016 · H001, H002)

La lógica es la única parte que habla con la base de datos. El servidor REST (`servidor_rest_design.md`) solo traduce HTTP ⇄ llamadas a la lógica.

```text
ServidorREST --> Logica --> MySQL (tabla Usuarios)
                   |--> Seguridad         (hash de contraseñas y tokens firmados)
                   |--> ValidadorUsuario  (mismas reglas que la app)
                   |--> enviarCorreo()    (la crea EnviadorCorreo en el servidor)
```

### Tipos

```text
SesionIniciada = ( idUsuario: N, token: Texto, rol: Texto, nombre: Texto )
DatosBasicos   = ( nombre: Texto, apellidos: Texto, correo: Texto )      // T010

UsuarioSesion  = ( idUsuario: N, rol: Texto )
    rol ∈ { "administrador", "tecnico", "portador", "ciudadano" }

DatosUsuario   = ( idUsuario: N, nombre: Texto, apellidos: Texto,
                   correo: Texto, rol: Texto, fechaAlta: Fecha,
                   alertas: V/F, premiumHasta: Fecha | null,
                   foto: Texto | null )                         // alertas y foto: T010

ConfigBD       = ( host: Texto, port: N, user: Texto, password: Texto, database: Texto )

ErrorLogica    = ( codigo: Texto, mensaje: Texto, campos: Lista<Texto> )
    codigo ∈ { DATOS_NO_VALIDOS, CORREO_YA_REGISTRADO, CORREO_NO_REGISTRADO,
               CREDENCIALES_INCORRECTAS, TOKEN_NO_VALIDO,
               CONTRASENA_INCORRECTA }                          // CONTRASENA_INCORRECTA: T010
```

### Clase Logica (NUEVA)

```text
                                    --------- Logica ---------------------------------
                                    |
                                    | conexion: Pool (MySQL)
                                    | enviarCorreo: (destinatario: Texto, asunto: Texto, texto: Texto) --> Promesa
                                    | urlRestablecer: Texto
                                    | claveTokens: Texto
                                    |
  configBD: ConfigBD            --> crear() -->                         (estático)
  enviarCorreo: Función             |
  urlRestablecer: Texto             |
  claveTokens: Texto                |
  Logica                        <-- |
                                    |
  nombre: Texto                 --> registrarUsuario() -->
  apellidos: Texto                  |
  correo: Texto                     |
  contrasena: Texto                 |
  SesionIniciada                <-- |     lanza DATOS_NO_VALIDOS, CORREO_YA_REGISTRADO
                                    |
  correo: Texto                 --> iniciarSesion() -->
  contrasena: Texto                 |
  SesionIniciada                <-- |     lanza CREDENCIALES_INCORRECTAS
                                    |
  token: Texto                  --> comprobarSesion() -->
  UsuarioSesion | null          <-- |
                                    |
  idUsuario: N                  --> obtenerUsuario() -->
  DatosUsuario | null           <-- |
                                    |
  correo: Texto                 --> solicitarRecuperacion() -->
                                    |     lanza DATOS_NO_VALIDOS, CORREO_NO_REGISTRADO
                                    |
  token: Texto                  --> restablecerContrasenya() -->
  contrasenaNueva: Texto            |     lanza DATOS_NO_VALIDOS, TOKEN_NO_VALIDO
                                    |
  idUsuario: N                  --> cambiarAlertas() -->
  alertas: V/F                      |     interruptor «Notificaciones» del perfil (T010);
                                    |     lanza DATOS_NO_VALIDOS si no es true/false
                                    |
  idUsuario: N                  --> actualizarDatos() -->
  nombre: Texto, apellidos: Texto,  |     «Editar mis datos» (T010); mismas reglas que el registro
  correo: Texto                     |     lanza DATOS_NO_VALIDOS, CORREO_YA_REGISTRADO
  DatosBasicos                  <-- |
                                    |
  idUsuario: N                  --> cambiarContrasenya() -->
  contrasenaActual: Texto,          |     (T010) devuelve una sesión nueva: las demás se cierran
  contrasenaNueva: Texto            |     lanza DATOS_NO_VALIDOS, CONTRASENA_INCORRECTA
  SesionIniciada                <-- |
                                    |
  idUsuario: N                  --> cambiarFoto() -->
  foto: Texto | null                |     (T010) JPEG/PNG en base64, máx. 200 000 caracteres;
                                    |     null la quita. Lanza DATOS_NO_VALIDOS
                                    |
                                --> cerrar() -->
                                    |
                                    |    idUsuario: N --> crearSesion() -->
                                    |    SesionIniciada <--
                                    |
                                    |    usuario: FilaUsuario, tipo: Texto, segundos: N --> crearToken() --x
                                    |    Texto <--
                                    |
                                    |    token: Texto, tipo: Texto --> leerTokenDeUsuario() -->
                                    |    FilaUsuario | null <--
                                    |
                                    -------------------------------------------------
```

### Módulo Seguridad (NUEVO)

```text
                                    --------- Seguridad ------------------------------
                                    |
  contrasena: Texto             --> calcularHash() -->
  Texto                         <-- |     "scrypt$<sal>$<hash>"
                                    |
  contrasena: Texto             --> comprobarContrasenya() -->
  hashGuardado: Texto               |
  V/F                           <-- |
                                    |
  datos: Objeto                 --> firmarToken() --x
  clave: Texto                      |
  Texto                         <-- |     "<datos base64url>.<firma HMAC-SHA256>"
                                    |
  token: Texto                  --> leerToken() --x
  clave: Texto                      |
  Objeto | null                 <-- |     null si la firma no vale o ha caducado
                                    |
  passwordHash: Texto           --> huellaContrasenya() --x
  Texto                         <-- |     16 caracteres; cambia si cambia la contraseña
                                    |
                                    -------------------------------------------------
```

### Módulo ValidadorUsuario (NUEVO)

```text
                                    --------- ValidadorUsuario -----------------------
                                    |
                                    | LONGITUD_MINIMA_CONTRASENA: N = 8
                                    |
  nombre: Texto                 --> validarRegistro() --x
  apellidos: Texto                  |
  correo: Texto                     |
  contrasena: Texto                 |
  Lista<Texto>                  <-- |     campos erróneos; vacía si todo está bien
                                    |
  texto: Texto                  --> estaVacio() --x            --> V/F
  texto: Texto, longitudMaxima: N --> esNombreValido() --x      --> V/F
  correo: Texto                 --> esCorreoValido() --x       --> V/F
  contrasena: Texto             --> esContrasenaSegura() --x   --> V/F
  correo: Texto                 --> normalizarCorreo() --x     --> Texto
                                    |
                                    -------------------------------------------------
```

---

## 2. Aclaraciones del diseño

- **Contraseñas:** solo se guarda `scrypt$<sal>$<hash>` (módulo `crypto` de Node, sin dependencias nativas). Cada contraseña lleva una sal aleatoria. La comprobación se hace en tiempo constante.
- **Sesiones sin tabla (token firmado):** al registrarse o iniciar sesión el servidor devuelve un token `datos.firma`. Los datos son `{ u: idUsuario, t: "sesion", exp, h }` y la firma es HMAC-SHA256 con la clave secreta del servidor (`CLAVE_TOKENS`), así que nadie puede fabricarlo ni cambiarlo. El cliente lo envía en la cabecera `Authorization: Bearer <token>`. Duración: 30 días. No se guarda nada en la BD: así no hacen falta tablas de sesiones.
- **Huella de la contraseña (`h`):** el token lleva 16 caracteres del SHA-256 de `passwordHash`. Si la contraseña cambia, la huella ya no coincide y todos los tokens anteriores dejan de valer.
- **Cerrar sesión:** la app o la web borran su token. El servidor no guarda sesiones, así que no hay ruta para cerrarla.
- **Rol al registrarse:** quien se registra desde la app es **portador** (columna `role` de `Usuarios`). Los demás roles los asigna el administrador (T030). Premium no es un rol: depende de `premiumHasta`.
- **Mismo error de acceso:** `iniciarSesion()` lanza `CREDENCIALES_INCORRECTAS` tanto si el correo no existe como si la contraseña es incorrecta, para no revelar qué correos tienen cuenta.
- **Correo no registrado en la recuperación:** decisión del equipo: si el correo no tiene cuenta, `solicitarRecuperacion()` lanza `CORREO_NO_REGISTRADO`, no se envía ningún correo y la app avisa al usuario. (Revela qué correos tienen cuenta, igual que el registro con `CORREO_YA_REGISTRADO`.)
- **Recuperación de contraseña sin tabla:** el enlace lleva un token firmado de tipo `"recuperacion"` válido 30 minutos: `urlRestablecer?token=...` (la página la hará la web). Al usarlo cambia la contraseña y, con ella, la huella: el mismo enlace ya no se puede volver a usar y todas las sesiones abiertas se cierran. Un token de recuperación no sirve como sesión (se comprueba el tipo).
- **Validación en el servidor:** las mismas reglas que `ValidadorRegistro.java` de la app: nombre y apellidos solo con letras (con tilde, ñ…) separadas por un espacio, guion o apóstrofo, sin números ni símbolos como `_`, `@` o `.` (máx. 50 y 100 caracteres); correo con formato `nombre@dominio.ext`; contraseña de 8 caracteres con letra y número. El servidor nunca se fía de lo que llega.
- **Correo normalizado:** sin espacios y en minúsculas, igual que la app.
- **Fechas:** en UTC (`UTC_TIMESTAMP()`).

---

## 3. Reglas generales

- **Lenguaje:** JavaScript (Node.js 18 o superior), CommonJS, `async/await`.
- **Cabecera de fichero** y **cabecera de cada función** con su diseño lógico y una línea `What it does:`.
- **Tests automáticos (mocha):** `npm test` desde `src/logica`. Necesitan MySQL de XAMPP en marcha; crean y usan la BD `aeris_test` con el mismo script `src/bd/usuarios.sql` (nunca tocan `aeris`).
  - `test_seguridad_validador.js`: hash, tokens firmados y validación (sin BD).
  - `test_logica.js`: registro, inicio de sesión, tokens caducados o modificados, roles, recuperación de contraseña.
  - `test_vinculacion.js`: vinculación del sensor por correo (T005).
  - `test_mi_cuenta.js`: datos de la página Mi cuenta (T024).
  - `test_lugares.js`: CRUD, privacidad, límite e interpolación de lugares (T046).
  - `test_incidencias.js`: incidencias (T041).
  - `test_mediciones.js`: mediciones (T017).
  - `test_nodos.js`: nodos del panel de administración (T021) y detección de nodos inactivos (T022).
- **Foto de perfil (T010):** se guarda en la columna `foto` de `Usuarios` como texto base64 (la app la reduce antes a un JPEG de 256×256, unos 30 KB), para que se vea en cualquier teléfono. No hace falta otra tabla.
- **Cambiar la contraseña (T010):** pide la contraseña actual. Como el token lleva una huella del hash, al cambiarla se cierran todas las sesiones; por eso se devuelve un token nuevo para el teléfono que la ha cambiado.
- **Correo de bienvenida (T002/T016):** al registrarse, `registrarUsuario()` llama a `enviarBienvenida()` sin esperarla: el registro responde enseguida y, si el correo falla (por ejemplo, Gmail no responde), la cuenta se crea igual y el error solo se escribe en la consola del servidor. El correo lo monta `CorreoBienvenida.crearCorreoBienvenida(nombre)` en español: texto plano y HTML con los colores de la app, el logo de AERIS arriba, una presentación general de la app y algunas de sus funciones (mapa, alertas, historial, previsión de ozono, rutas limpias, lugares, puntos…) y el logo de SenseTech al pie. Los logos (`src/logica/img/`) van incrustados en el correo (`cid:`), así se ven aunque el servidor no esté en internet. El nombre se escapa (`escaparHTML()`) para que no pueda meter HTML.

```text
  correo: Texto, nombre: Texto  --> enviarBienvenida() --> Promesa      (nunca falla)
  nombre: Texto                 --> crearCorreoBienvenida() --> ( asunto, texto, html, adjuntos )
```
- **Correo de recuperación (T003/T016):** `solicitarRecuperacion()` envía el correo de `CorreoRecuperacion.crearCorreoRecuperacion(nombre, enlace, minutos)`, con el mismo diseño que el de bienvenida: botón «Crear contraseña nueva» con el enlace y aviso de que caduca en 30 minutos y solo sirve una vez (el enlace escrito solo va en la versión de texto del correo, para las apps que no muestran HTML). Los dos correos usan el marco común `PlantillaCorreo.marcoCorreo()` (logo de AERIS arriba, pie con el logo de SenseTech).
- **Contraseña nueva igual a la actual:** `restablecerContrasenya()` (enlace del correo) y `cambiarContrasenya()` (Editar mis datos) la rechazan con `DATOS_NO_VALIDOS` y el mensaje «La contraseña nueva tiene que ser distinta de la actual» (`campos: ["contrasena"]` / `["contrasenaNueva"]`). En el enlace se compara con el hash guardado; quien tiene el enlace ya puede cambiar la contraseña, así que decirle que es la misma no revela nada. La página `restablecer.html` muestra el mensaje debajo del campo y el enlace sigue valiendo para otro intento.
- **Vinculación del sensor por correo (T005/T037, diseño T038):** el sensor está ligado al correo de quien lo compró (`Sensores.correoCompra`). La solicitud se guarda en la misma fila (`idSolicitante`, `estadoSolicitud`, `fechaSolicitud`), sin tabla nueva. El correo lo monta `CorreoVinculacion.crearCorreoVinculacion()` con el marco común: quién lo pide (nombre y correo), el número de serie, la fecha, y dos botones, «Sí, vincular el sensor» y «No conozco a esta persona». El HTML del correo usa tablas e estilos en línea para adaptarse a clientes de correo y pantallas estrechas. Los enlaces llevan un token firmado de tipo `"vinculacion"` con el sensor, el usuario y la fecha de la solicitud, válido 48 horas. El token solo vale si la fila sigue pendiente con esa misma fecha y ese solicitante: si se reenvía el correo, otra persona pide el sensor o ya se ha respondido, el enlace viejo deja de valer. La respuesta se procesa en una transacción; al confirmar, asigna el sensor y activa `Usuarios.esPortador` (cambiando `role` de `ciudadano` a `portador`), y al rechazar el sensor permanece sin dueño. Una solicitud pendiente de más de 48 horas cuenta como rechazada. Si el correo falla, la solicitud se guarda igual y el error solo sale en la consola.

```text
  idUsuario: N, numeroSerie: Texto, sensibilidad: R
                    --> solicitarVinculacion() --> Solicitud   | DATOS_NO_VALIDOS, SENSOR_NO_REGISTRADO, SENSOR_YA_VINCULADO
  idUsuario: N      --> estadoVinculacion() --> Solicitud      | SIN_SOLICITUD
  idUsuario: N      --> reenviarCorreoVinculacion() -->        | SIN_SOLICITUD
  token: Texto, acepta: V/F
                    --> responderVinculacion() --> ( estado, numeroSerie, nombreSolicitante )   | TOKEN_NO_VALIDO
  Solicitud = ( numeroSerie, correoComprador (oculto: «p•••••@upv.edu.es»), estado, fecha )
```

- **Mi sensor (T011):** `obtenerMiSensor()` lee nombre, número de serie, batería y `Sensores.ultimaConexion`, incluso si el sensor aún no ha enviado mediciones. `desvincularMiSensor()` libera el sensor en una transacción, limpia la solicitud y el estado de luz; si no quedan otros sensores del usuario, también pone `esPortador` a falso. `desvincularSensor(numeroSerie)` hace lo mismo desde el panel de administración con cualquier sensor vinculado (si no existe o no está vinculado da `SIN_SENSOR`); las dos usan `desvincularEnTransaccion()`. Las mediciones del sensor no se borran.
- **Datos de Mi cuenta (T024 · H035):** `resumenCuenta()` y `exposicion()` calculan lo que enseña la página Mi cuenta de la web, con las mismas claves que `LogicaCuentaFake`. Se usan las mediciones del usuario (`Mediciones.idUsuario`) y, para los valores de ozono, solo las del contaminante `O3` de `Contaminantes` (también se acepta el nombre `Ozono`). Los cálculos que no necesitan la BD están en `MiCuenta.js`.
  - `medicionesMes` y `medicionesMesAnterior`: mes natural, en UTC.
  - `exposicionMedia`: media de ozono de los últimos 30 días, redondeada; `null` si no hay ninguna.
  - `horasOzonoAlto`: horas de los últimos 7 días con algún valor por encima del umbral de aviso del usuario (`umbralAlerta`) o, si no tiene, 180 µg/m³. Dos mediciones en la misma hora cuentan una vez. Se devuelve también `umbralAviso`.
  - `puntos` y nivel: provisional, un punto por medición guardada, hasta que exista la tabla `MovimientosPuntos`. Niveles: Principiante (0), Explorador (1.000), Guardián (3.000) y Experto (10.000).
  - `lugares`: lugares del usuario con zona y ozono interpolado, o `null` si no hay lecturas recientes.
  - `ultimasMediciones`: las 4 últimas de ozono. Como todavía no hay nombres de sitios, `lugar` son las coordenadas («38,967, -0,181»), y se mandan aparte `latitud` y `longitud`. En `ubicacion` el POINT es (longitud, latitud).
  - `nodo`: número de serie del sensor vinculado. `ultimaSincronizacion`: `Sensores.ultimaConexion` o, si está vacía, la fecha de la última medición.
  - `exposicion(periodo)`: media de ozono de cada día de los últimos 7, 30 o 90 días (`semana`, `mes`, `3meses`). Los días sin mediciones no salen. Cada punto lleva la fecha de ese día a las 12:00 UTC.
- **Mis lugares (T046 · H034/H035):** el módulo `Lugares.js` implementa el CRUD por `idUsuario`, limita a cinco lugares bajo bloqueo transaccional y valida nombre, tipo, dirección y coordenadas. `resumenCuenta()` incluye esos lugares. El ozono se interpola con la medición O3 más reciente de cada sensor durante las últimas 24 horas; sin lecturas devuelve `null`. El interruptor de avisos queda persistido por lugar; el envío y el intervalo de avisos no forman parte de T046.

```text
  idUsuario: N, ahora: Fecha    --> resumenCuenta() --> Resumen                 | SIN_SENSOR, SIN_MEDICIONES
  idUsuario: N, periodo: Texto, ahora: Fecha
                                --> exposicion() --> [ PuntoExposicion ]        | DATOS_NO_VALIDOS, SIN_SENSOR
  idUsuario: N                  --> sensorDelUsuario() --> ( idSensor, numeroSerie, ultimaConexion )   | SIN_SENSOR

  Resumen = ( nodo, ultimaSincronizacion, medicionesMes, medicionesMesAnterior,
              puntos, nivel, siguienteNivel, puntosSiguienteNivel,
              exposicionMedia, horasOzonoAlto, umbralAviso,
              lugares: [ ], ultimasMediciones: [ ( fecha, lugar, latitud, longitud, ozono ) ] )
  PuntoExposicion = ( fecha: Fecha, ozono: R )
```

- **Incidencias (T041):** están en `Incidencias.js` (clase `Incidencias`), para no hacer más grande `Logica.js`. Se usan como `logica.incidencias.crear(…)`. Tabla `Incidencias` (ver `bd_design.md`). `tipo`: sensor, datos, cuenta, otra. `estado`: abierta, en curso, resuelta. Una incidencia nueva está «abierta» y lleva un `asunto` (como mucho 120 caracteres). Si es de tipo sensor o datos y no se dice qué sensor, se pone el del usuario (o ninguno si no tiene). Al responder, si no se indica el estado pasa a «resuelta», se guardan `fechaRespuesta` e `idResponsable` (el técnico o administrador de la sesión, que sale como `responsable: { nombre, rol }`) y se manda al usuario el correo de `CorreoRespuestaIncidencia.crearCorreoRespuestaIncidencia()` (su mensaje, la respuesta y el estado, con el marco común). Si el correo falla, la respuesta se guarda igual. La descripción y la respuesta tienen como mucho 2000 caracteres.

```text
  idUsuario: N, tipo: Texto, asunto: Texto, descripcion: Texto, idSensor: N (opcional)
                         --> incidencias.crear() --> Incidencia                  | DATOS_NO_VALIDOS
  idUsuario: N           --> incidencias.listarDeUsuario() --> Lista<Incidencia>
  { estado?, tipo? }     --> incidencias.listar() --> Lista<IncidenciaGestion>   | DATOS_NO_VALIDOS
  idIncidencia: N        --> incidencias.obtener() --> IncidenciaGestion         | INCIDENCIA_NO_EXISTE
                         --> incidencias.contarAbiertas() --> N
  idIncidencia: N, { respuesta?, estado? }, idResponsable: N
                         --> incidencias.responder() --> IncidenciaGestion       | DATOS_NO_VALIDOS, INCIDENCIA_NO_EXISTE
  Incidencia = ( idIncidencia, tipo, asunto, descripcion, estado, respuesta, responsable ( nombre, rol ) | null, fechaCreacion, fechaRespuesta, sensor | null )
  IncidenciaGestion = Incidencia + usuario ( idUsuario, nombre, apellidos, correo ) + datos del sensor

  Conversación (T043):
  idIncidencia: N, idUsuario: N
                         --> incidencias.listarMensajes() --> Lista<Mensaje>     | INCIDENCIA_NO_EXISTE
  idIncidencia: N, idAutor: N, texto: Texto, estado: Texto (opcional)
                         --> incidencias.enviarMensaje() --> Mensaje             | DATOS_NO_VALIDOS, INCIDENCIA_NO_EXISTE
  idIncidencia: N, { respuesta?, estado? }, idResponsable: N
                         --> incidencias.responderConMensaje() --> ( incidencia: IncidenciaGestion, idMensaje: N | null )
  Mensaje = ( idMensaje, idIncidencia, texto, fecha, autor ( idUsuario, nombre, rol ) | null, delUsuario: V/F )
```

- **Conversación de cada incidencia (T043):** tabla `MensajesIncidencia` (ver `bd_design.md`). La descripción de la incidencia es el primer mensaje del usuario y no se repite en la tabla; el resto va por orden de `fecha` y `idMensaje`. `delUsuario` es V si lo escribió quien envió la incidencia (en la app, «Tú») y F si lo escribió el equipo. `autor` es `null` si la cuenta del autor se borró.
  - **Quién puede leer y escribir:** quien envió la incidencia y los técnicos y administradores (los roles se leen de la BD, no se fía de quien llama). Para cualquier otro, o si no existe, `INCIDENCIA_NO_EXISTE` (404): nadie puede averiguar qué incidencias existen.
  - **Mensaje del usuario:** se guarda como suyo y, si la incidencia estaba «resuelta», vuelve a «abierta» (si estaba «en curso» o «abierta» no cambia). No manda correo y el `estado` que se envíe se ignora: solo el equipo lo cambia. Una persona del equipo que escribe en una incidencia suya cuenta como usuario.
  - **Mensaje del equipo:** es la respuesta de siempre. `enviarMensaje()` de un técnico o administrador y `responder()` con `respuesta` usan **la misma vía**, `responderConMensaje()`: en una sola transacción actualizan `respuesta`, `idResponsable`, `fechaRespuesta` y `estado` de la incidencia (lo que siguen usando la web y el panel) y añaden el mensaje a la conversación; después se manda **un solo correo** al usuario. Así una respuesta nunca se avisa dos veces. Un cambio de estado sin respuesta no añade mensaje ni manda correo.
  - `texto` entre 1 y 2000 caracteres (sin contar los espacios de los extremos); si no, `DATOS_NO_VALIDOS` con `campos`.

- **Mediciones (T017):** están en `Mediciones.js` (clase `Mediciones`), como las incidencias. Se usan como `logica.mediciones.guardar(…)`. Tablas `Mediciones`, `Sensores` y `Contaminantes`. Solo se guarda la medición del sensor vinculado al usuario (el `numeroSerie` de la trama iBeacon). `contaminante` es `O3` si no se indica y tiene que existir en `Contaminantes`. Se comprueba que no falte nada y que esté en rango: valor de 0 a 2000 µg/m³, latitud −90..90, longitud −180..180 y fecha (ISO o milisegundos) de los últimos 7 días, con 5 minutos de margen hacia el futuro; si no, `DATOS_NO_VALIDOS` con los campos y un aviso en la consola. La clave única `(idSensor, idContaminante, fechaHora)` hace que una medición reenviada por la app no se guarde dos veces: `nueva` = false. Al guardar, el sensor pasa a `activo` y `ultimaConexion` es la fecha más reciente recibida. `obtenerUsuario()` devuelve también `sensor` (nombre) y `numeroSerie` del sensor vinculado, o `null`.

```text
  idUsuario: N, { numeroSerie, contaminante?, valor, latitud, longitud, fecha }
                         --> mediciones.guardar() --> ( medicion: Medicion, nueva: V/F )
                                                   | DATOS_NO_VALIDOS, SENSOR_NO_REGISTRADO, SENSOR_NO_ES_TUYO
  idUsuario: N, cantidad: N (5, máx. 100), contaminante: Texto ("O3")
                         --> mediciones.ultimasDeUsuario() --> Lista<Medicion> | DATOS_NO_VALIDOS
  idUsuario: N, desde: Date, hasta: Date
                         --> mediciones.deUsuarioEnPeriodo() --> Lista<Medicion> | DATOS_NO_VALIDOS
  contaminante: Texto ("O3")
                         --> mediciones.ultima() --> Medicion                 | SIN_MEDICIONES
  fecha: Texto | N       --> leerFecha() --> Date | null                       (sin milisegundos)
  Medicion = ( idMedicion, contaminante, valor, unidad, fecha, latitud, longitud )
```
- `deUsuarioEnPeriodo()` admite rangos de hasta 26 horas para cubrir días locales de 23 o 25 horas; filtra por `idUsuario`, limita el resultado a ozono y ordena del más antiguo al más reciente (T007).
- **Nodos del panel (T021 · H011):** están en `Nodos.js` (clase `Nodos`) y se usan como `logica.nodos.buscar(…)`. Un nodo es un sensor vinculado a un usuario (`Sensores.idUsuario` no nulo); los que nadie ha vinculado todavía no salen. De cada uno se da el número de serie, el portador (nombre y apellidos), la fecha y el sitio de su última medición, la batería, si necesita calibración y el estado, con las mismas claves que los nodos de `LogicaAdminFake` de la web. Si un sensor no ha medido nunca, la fecha es `ultimaConexion` (o `null`) y la ubicación `null`.
  - Estado: `INACTIVO` si lleva más horas sin datos que el umbral (24 por defecto, el mismo que `nodos.js` de la web) o no ha medido nunca; si no, `CALIBRAR` si `necesitaCalibracion` y `ACTIVO` en el resto.
  - `buscar()`: busca en el número de serie y en el portador sin mirar mayúsculas ni acentos, filtra por `estado` (`todos`, `activos` = no inactivos, `inactivos`, `calibrar`) y ordena del que lleva más tiempo sin datos al más reciente. Devuelve la página pedida (`pagina` desde 1, `porPagina` 20 por defecto y 100 como mucho) y `total`, el número de nodos que cumplen el filtro sin paginar. `porPagina` 0 los devuelve todos (el mapa). Un filtro que no vale da `DATOS_NO_VALIDOS` con los campos.
  - `resumen()`: total, activos, inactivos (los que pasan del umbral; la clave sigue siendo `inactivos24h`), inactivos de más de 7 días, por calibrar y `umbralHoras`.
  - **Nodos inactivos (T022 · H012):** el umbral de inactividad es de 24 horas por defecto y se cambia con `UMBRAL_INACTIVO_HORAS` en el `.env` del servidor (un entero de 1 a 168). `mainServidorREST.js` lo pasa a `nodos.cambiarUmbral()` al arrancar; si no vale, avisa en la consola y deja 24. Hay que pasar del umbral: con 1 hora, un nodo que midió hace justo una hora sigue activo. El estado se calcula en cada petición con el umbral de ese momento, así que al cambiarlo se recalcula todo, y un nodo inactivo que vuelve a medir pasa a activo solo. Además, `marcarInactivos()` guarda el estado en `Sensores.estado` (`inactivo` o `activo`, los mismos valores que pone `Mediciones.js` al guardar una medición), tocando solo las filas que cambian. El servidor lo llama al arrancar y cada hora, y también se hace cada vez que se listan los nodos.

```text
  filtro: ( busqueda, estado, pagina, porPagina ), ahora: Fecha
                         --> nodos.buscar() --> ( nodos: Lista<Nodo>, total: N )   | DATOS_NO_VALIDOS
  ahora: Fecha           --> nodos.resumen() --> ( total, activos, inactivos24h, inactivos7d, porCalibrar, umbralHoras )
  horas: Texto | N       --> nodos.cambiarUmbral() --> N                       | DATOS_NO_VALIDOS
  ahora: Fecha           --> nodos.marcarInactivos() --> ( inactivos: N, activos: N )   cuántos han cambiado
  Nodo = ( id, portador, ultimaMedicion: Fecha | null, bateria: N | null,
           latitud: R | null, longitud: R | null, necesitaCalibrar: V/F,
           estado: ACTIVO | INACTIVO | CALIBRAR )
```