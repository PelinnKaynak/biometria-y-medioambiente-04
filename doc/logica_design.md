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

UsuarioSesion  = ( idUsuario: N, rol: Texto )
    rol ∈ { "administrador", "tecnico", "portador", "ciudadano" }

DatosUsuario   = ( idUsuario: N, nombre: Texto, apellidos: Texto,
                   correo: Texto, rol: Texto, fechaAlta: Fecha,
                   premiumHasta: Fecha | null )

ConfigBD       = ( host: Texto, port: N, user: Texto, password: Texto, database: Texto )

ErrorLogica    = ( codigo: Texto, mensaje: Texto, campos: Lista<Texto> )
    codigo ∈ { DATOS_NO_VALIDOS, CORREO_YA_REGISTRADO,
               CREDENCIALES_INCORRECTAS, TOKEN_NO_VALIDO }
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
  V/F                           <-- |     V si se ha enviado el correo
                                    |
  token: Texto                  --> restablecerContrasenya() -->
  contrasenaNueva: Texto            |     lanza DATOS_NO_VALIDOS, TOKEN_NO_VALIDO
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
- **Mismo error de acceso:** `iniciarSesion()` lanza `CREDENCIALES_INCORRECTAS` tanto si el correo no existe como si la contraseña es incorrecta, para no revelar qué correos tienen cuenta. Por la misma razón el servidor responde igual a `/solicitarRecuperacion` exista o no el correo.
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
