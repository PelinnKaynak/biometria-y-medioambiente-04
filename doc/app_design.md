# Diseño del componente: app (App Android del portador)

**Equipo:** 04 – SenseTech · **Sprint:** 2 · **Implementación:** `src/app/` (paquete `com.example.aeris`, Java, Android 10 o superior)

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
                                    |    codigo: Z --> notificarResultado() --x
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

### Clase Sesion (NUEVA)

```text
                                    --------- Sesion ---------------------------------
                                    |
  contexto: Context, correo: Text --> iniciar() --x
                                    |
  contexto: Context             --> correoActual() --x
  Text                          <-- |
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

## 2. Aclaraciones del diseño

- **Petición REST:** `POST /registrarUsuario` con el cuerpo `{"nombre": ..., "apellidos": ..., "correo": ..., "contrasena": ...}`. Respuestas: `201` cuenta creada, `409` el correo ya tiene cuenta, `400` datos incorrectos, `500` error del servidor. Si no hay conexión el código es `0`.
- **Contraseña:** el teléfono la envía tal cual por la petición; el **servidor** la guarda cifrada (criterio de H001, tarea T016). El teléfono nunca la guarda.
- **Correo:** se envía sin espacios y en minúsculas (`normalizarCorreo()`), para que `Pelin@AERIS.es` y `pelin@aeris.es` sean la misma cuenta.
- **Contraseña segura:** mínimo 8 caracteres, con al menos una letra y un número.
- **Sin datos simulados:** la app no simula respuestas. El resultado siempre viene del servidor, que consulta la tabla `Usuarios` de la BD (ver `doc/bd_design.md`). Si el servidor no está en marcha, la app muestra el error de conexión.
- **URL_SERVIDOR:** en el emulador es `http://10.0.2.2:8080`; en un teléfono real, la IPv4 del ordenador en la misma Wi‑Fi.
- **Sesión:** al crear la cuenta, `Sesion.iniciar()` guarda el correo en `SharedPreferences`; la sesión sigue abierta al cerrar y volver a abrir la app.
- **Tras el registro** se abre `VincularSensorActivity`, con la opción «Omitir por ahora». En este sprint es una pantalla provisional; la búsqueda por Bluetooth se programa en T005 (H019).
- **Pantalla de inicio provisional:** hasta que exista la bienvenida (T001), la app se abre en el registro.
- **PeticionarioREST:** es el código proporcionado por el profesor, con la misma interfaz, pero sin `AsyncTask` (obsoleta desde Android 11): la petición se hace en un hilo de fondo (`Executor`) y el callback se llama en el hilo principal.
- **Visibilidad:** los métodos auxiliares de `ValidadorRegistro` y `LogicaFakeRegistro` son de paquete (sin `public`) para poder probarlos con JUnit; ninguna otra clase los usa.

---

## 3. Reglas generales

- **Lenguaje:** Java 11, Android 10 (API 29) o superior.
- **Cabecera de fichero** con nombre, descripción, autores, fecha y copyright; **cabecera de cada método** con su diseño lógico en la notación de la asignatura y una línea `What it does:`.
- **Tests automáticos (JUnit 4):** `ValidadorRegistroTest` (campos vacíos, correo, contraseña segura, confirmación) y `LogicaFakeRegistroTest` (JSON enviado y respuesta para 201, 409, 500 y sin conexión). Se ejecutan con `./gradlew test` desde `src/app`.
