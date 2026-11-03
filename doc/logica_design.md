# Diseño del componente: lógica de negocio

**Equipo:** 04 – SenseTech · **Sprint:** 2 · **Implementación:** `src/logica/` (Node.js, MySQL con `mysql2`)

---

## 1. Usuarios y autenticación (T016 · H001, H002)

La lógica es la única parte que habla con la base de datos. El servidor REST (`servidor_rest_design.md`) solo traduce HTTP ⇄ llamadas a la lógica.

```text
ServidorREST --> Logica --> MySQL (Roles, Usuarios, Sesiones, RecuperacionesContrasenya)
                   |--> Seguridad         (hash de contraseñas y tokens)
                   |--> ValidadorUsuario  (mismas reglas que la app)
                   |--> enviarCorreo()    (la crea EnviadorCorreo en el servidor)
```

### Tipos

```text
SesionIniciada = ( idUsuario: N, token: Texto, rol: Texto, nombre: Texto )

UsuarioSesion  = ( idUsuario: N, rol: Texto )
    rol ∈ { "administrador", "portador", "ciudadano", "premium", "tecnico" }

DatosUsuario   = ( idUsuario: N, nombre: Texto, apellidos: Texto,
                   correo: Texto, rol: Texto, fechaRegistro: Fecha )

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
                                    |
  configBD: ConfigBD            --> crear() -->                         (estático)
  enviarCorreo: Función             |
  urlRestablecer: Texto             |
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
  token: Texto                  --> cerrarSesion() -->
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
                                --> generarToken() --x
  Texto                         <-- |     64 caracteres hexadecimales
                                    |
  token: Texto                  --> hashToken() --x
  Texto                         <-- |     SHA-256 en hexadecimal
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
  correo: Texto                 --> esCorreoValido() --x       --> V/F
  contrasena: Texto             --> esContrasenaSegura() --x   --> V/F
  correo: Texto                 --> normalizarCorreo() --x     --> Texto
                                    |
                                    -------------------------------------------------
```

---

## 2. Aclaraciones del diseño

- **Contraseñas:** solo se guarda `scrypt$<sal>$<hash>` (módulo `crypto` de Node, sin dependencias nativas). Cada contraseña lleva una sal aleatoria. La comprobación se hace en tiempo constante.
- **Sesiones con token:** al registrarse o iniciar sesión se crea un token aleatorio de 64 caracteres que el cliente envía en la cabecera `Authorization: Bearer <token>`. La BD guarda solo el **SHA-256 del token**, así que una copia de la BD no sirve para entrar. Duración: 30 días.
- **Rol al registrarse:** quien se registra desde la app es **portador**. Los demás roles los asigna el administrador (T030).
- **Mismo error de acceso:** `iniciarSesion()` lanza `CREDENCIALES_INCORRECTAS` tanto si el correo no existe como si la contraseña es incorrecta, para no revelar qué correos tienen cuenta. Por la misma razón el servidor responde igual a `/solicitarRecuperacion` exista o no el correo.
- **Recuperación de contraseña:** token de un solo uso, válido 60 minutos; se guarda su SHA-256. El enlace es `urlRestablecer?token=...` (la página la hará la web). Al cambiar la contraseña se cierran todas las sesiones del usuario.
- **Validación en el servidor:** las mismas reglas que `ValidadorRegistro.java` de la app (correo, contraseña de 8 caracteres con letra y número). El servidor nunca se fía de lo que llega.
- **Correo normalizado:** sin espacios y en minúsculas, igual que la app.
- **Fechas:** en UTC (`UTC_TIMESTAMP()`).

---

## 3. Reglas generales

- **Lenguaje:** JavaScript (Node.js 18 o superior), CommonJS, `async/await`.
- **Cabecera de fichero** y **cabecera de cada función** con su diseño lógico y una línea `What it does:`.
- **Tests automáticos (mocha):** `npm test` desde `src/logica`. Necesitan MySQL de XAMPP en marcha; crean y usan la BD `aeris_test` con el mismo script `src/bd/usuarios.sql` (nunca tocan `aeris`).
  - `test_seguridad_validador.js`: hash, tokens y validación (sin BD).
  - `test_logica.js`: registro, inicio y cierre de sesión, roles, recuperación de contraseña.
