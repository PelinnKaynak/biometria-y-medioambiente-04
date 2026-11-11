# Diseño de la web pública y Mi cuenta

## Diseño del componente

### 1. Inicio de sesión (T013 · H002)

Pantalla `login.html`. El usuario escribe su correo y su contraseña. Si son correctos, la web le lleva a su página según el rol. Si no lo son, muestra un aviso y se queda en el formulario.

#### Tipos

```
Rol = { PORTADOR, PREMIUM, TECNICO, ADMINISTRADOR, CIUDADANO }

Credenciales = ( correo: Text, contrasena: Text )

Usuario = ( id: N, nombre: Text, correo: Text, rol: Rol )

ResultadoSesion = ( correcto: B, usuario: Usuario, error: Text )

ResultadoOperacion = ( correcto: B, error: Text )

ErrorCampo = ( campo: Text, mensaje: Text )
```

#### Lógica del navegador

La lógica fake y la real tienen la misma interfaz, así que la pantalla funciona con cualquiera de las dos sin cambios.

```
 --------- LogicaFake --------------------------------------
 |
 |  usuarios: [ ( credenciales: Credenciales, usuario: Usuario ) ]
 |  solicitudes: [ Text ]
 |  retardo_ms: N
 |
 |
 credenciales: Credenciales --> iniciarSesion() -->
          r: ResultadoSesion <--
 |
 |
      datos: DatosRegistro --> registrarUsuario() -->
      r: ResultadoRegistro <--
 |
 |
            correo: Text --> solicitarRecuperacion() -->
      r: ResultadoOperacion <--
 |
 |
 token: Text, contrasena: Text --> restablecerContrasena() -->
      r: ResultadoOperacion <--
 |
 |
                              cerrarSesion() -->
 |
 |
                 r: Usuario <-- usuarioActual() <--
 |
 -----------------------------------------------------------
```

```
 --------- LogicaReal --------------------------------------
 |
 |  url_servidor: Text
 |  usuario_actual: Usuario
 |
 |
 credenciales: Credenciales --> iniciarSesion() -->
          r: ResultadoSesion <--
 |
 |
      datos: DatosRegistro --> registrarUsuario() -->
      r: ResultadoRegistro <--
 |
 |
            correo: Text --> solicitarRecuperacion() -->
      r: ResultadoOperacion <--
 |
 |
 token: Text, contrasena: Text --> restablecerContrasena() -->
      r: ResultadoOperacion <--
 |
 |
                              cerrarSesion() -->
 |
 |
                 r: Usuario <-- usuarioActual() <--
 |
 -----------------------------------------------------------
```

#### Controlador de la pantalla (`login.js`)

```
correo: Text, contrasena: Text --> validarFormulario() --> errores: [ ErrorCampo ]

rol: Rol --> paginaInicioSegunRol() --> url: Text

mensaje: Text, campos: [ Text ] --> mostrarError()

ocultarError()

alternarVisibilidadContrasena()

evento: Evento, logica: LogicaFake | LogicaReal, irA: (url: Text) --> enviarFormulario()

iniciarPantalla()
```

- `validarFormulario()` comprueba el correo y la contraseña con las reglas de `validacion.js` (apartado 2). Devuelve un error por cada campo que falla, con el id del campo y el mensaje. Si la lista está vacía, el formulario es correcto.
- `paginaInicioSegunRol()` devuelve `../web_admin/panel_nodos.html` para TECNICO y ADMINISTRADOR, y `mi_cuenta.html` para PORTADOR y PREMIUM.
- `mostrarError()` enseña el aviso debajo de los campos con el mensaje y marca con el borde de error los campos indicados por su id.
- `ocultarError()` esconde el aviso y quita el borde de error de todos los campos.
- `alternarVisibilidadContrasena()` cambia el campo de contraseña entre texto oculto y visible y cambia el icono del ojo.
- `enviarFormulario()` valida el formulario, llama a `iniciarSesion()` de la lógica, y según el resultado lleva a la página del rol con `irA()` o muestra el error. La lógica y `irA()` se reciben como parámetros para poder probar la función sin servidor y sin cambiar de página.
- `iniciarPantalla()` crea la lógica con `crearLogica()` de `configuracion.js` y conecta el formulario y el botón del ojo con sus funciones.

#### Usuarios de prueba de la lógica fake (cumplen el formato del apartado 2)

| Correo | Contraseña | Rol |
|---|---|---|
| admin@aeris.es | admin1234 | ADMINISTRADOR |
| laura@correo.es | laura1234 | PORTADOR |

### 2. Formato del correo y de la contraseña (`validacion.js`)

Las reglas están en un solo archivo y las usan todas las pantallas de acceso. Son las mismas que aplican el servidor (`src/logica/ValidadorUsuario.js`) y la app (`ValidadorRegistro.java`), para que una cuenta creada en la app siempre pueda entrar en la web. El servidor vuelve a comprobarlas, porque lo que se comprueba en el navegador se puede saltar.

```
correo: Text --> esCorreoValido() --> B

contrasena: Text --> esContrasenaValida() --> B

correo: Text --> errorCorreo() --> Text

contrasena: Text --> errorContrasena() --> Text
```

Correo válido: como mucho 255 caracteres (sin contar los espacios del principio y del final) y la forma `nombre@dominio.ext`, con el patrón `^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$`.

Contraseña válida: al menos 8 caracteres, al menos una letra y al menos un número.

`errorCorreo()` y `errorContrasena()` devuelven el mensaje que se muestra al usuario, o un texto vacío si el dato es correcto. El mensaje es distinto si el campo está vacío o si no cumple el formato:

| Caso | Mensaje |
|---|---|
| Correo vacío | Escribe tu correo electrónico |
| Correo con formato incorrecto | Escribe un correo válido, por ejemplo nombre@dominio.es |
| Contraseña vacía | Escribe tu contraseña |
| Contraseña con formato incorrecto | La contraseña debe tener al menos 8 caracteres, con al menos una letra y un número |

En el HTML, el campo del correo tiene `maxlength="255"`.

### 3. Recuperar contraseña (T013 · H002)

Pantalla `recuperar.html` con dos pasos en la misma página. En el primero el usuario escribe su correo y pulsa «Enviar enlace». En el segundo («Revisa tu correo») se confirma el envío y puede volver a iniciar sesión o pedir que se reenvíe el enlace.

```
mensaje: Text --> mostrarErrorCorreo()

ocultarErrorCorreo()

correo: Text --> mostrarPasoEnviado()

evento: Evento, logica: LogicaFake | LogicaReal --> enviarSolicitud()

logica: LogicaFake | LogicaReal --> reenviarEnlace()

iniciarPantallaRecuperar()
```

- `enviarSolicitud()` comprueba el correo con `errorCorreo()`. Si falla, muestra el error y no llama a la lógica. Si es correcto, llama a `solicitarRecuperacion()` y pasa al segundo paso con `mostrarPasoEnviado()`.
- `reenviarEnlace()` vuelve a llamar a `solicitarRecuperacion()` con el mismo correo y muestra «Te hemos enviado otro enlace».
- La lógica real llama a `POST /solicitarRecuperacion`. Si el correo no tiene cuenta, el servidor responde 404 y la pantalla avisa con «No hay ninguna cuenta con ese correo». La lógica fake hace lo mismo.

### 4. Contraseña nueva (T013 · H002)

Pantalla `restablecer.html`. Se abre desde el enlace del correo de recuperación, que lleva un token firmado por el servidor: `restablecer.html?token=...`. El token caduca y solo se puede usar una vez.

```
busqueda: Text --> leerToken() --> token: Text

nueva: Text, repetida: Text --> validarContrasenas() --> errores: [ ErrorCampo ]

mensaje: Text, campos: [ Text ] --> mostrarErrorRestablecer()

ocultarErrorRestablecer()

boton: Elemento --> alternarVisibilidad()

evento: Evento, logica: LogicaFake | LogicaReal, token: Text --> guardarContrasena()

iniciarPantallaRestablecer()
```

- `validarContrasenas()` comprueba la contraseña nueva con `errorContrasena()` y que las dos sean iguales («Las dos contraseñas no coinciden»).
- `guardarContrasena()` llama a `restablecerContrasena()` de la lógica. Si va bien, muestra «Contraseña cambiada» con el botón para iniciar sesión. Si el enlace no tiene token, ha caducado o ya se ha usado, lo dice y muestra el enlace «Pedir un enlace nuevo».
- Los dos campos tienen su propio botón del ojo.
- En la lógica fake, el token de prueba es `token-prueba` y cambia la contraseña de la portadora de prueba.

### 5. Conexión con el servidor REST (T016)

La lógica real usa las rutas de `doc/servidor_rest_design.md`:

| Función | Petición | Respuestas |
|---|---|---|
| `iniciarSesion()` | `POST /iniciarSesion { correo, contrasena }` | 200 `{ idUsuario, token, rol, nombre }` · 401 |
| `registrarUsuario()` | `POST /registrarUsuario { nombre, apellidos, correo, contrasena }` | 201 `{ idUsuario, token, rol, nombre }` · 400 `{ error, campos }` · 409 |
| `solicitarRecuperacion()` | `POST /solicitarRecuperacion { correo }` | 200 · 400 · 404 (correo sin cuenta) |
| `restablecerContrasena()` | `POST /restablecerContrasenya { token, contrasena }` | 204 · 400 |

- El servidor manda el rol en minúsculas (`administrador`, `tecnico`, `portador`, `ciudadano`), y `paginaInicioSegunRol()` lo compara sin tener en cuenta mayúsculas. Ser premium no es un rol: lo indica `premiumHasta`.
- Tras iniciar sesión se guarda en `sessionStorage` el usuario con su token, que se enviará en la cabecera `Authorization: Bearer` en las peticiones que lo pidan.
- La web la sirve el mismo servidor REST (`ServidorREST.js`): `web_publica` en `/` y también en `/web_publica`, y `web_admin` en `/web_admin`. Por eso `URL_SERVIDOR` está vacío y las peticiones van a la misma dirección que la página.
- Para usar la base de datos real: `USAR_LOGICA_FAKE = false` en `src/web_publica/js/configuracion.js`, `npm start` en `src/servidor_rest` con MySQL de XAMPP en marcha, y abrir `http://localhost:8080/login.html`. Abrir la página desde PhpStorm (puerto 63342) no sirve con la lógica real, porque las peticiones irían a PhpStorm y no al servidor.
- El panel de administración sigue con su lógica fake hasta que el servidor tenga las rutas de nodos y usuarios (T021, T022, T030), pero ya usa la sesión real que guarda el inicio de sesión.
- Para tener un administrador en la base de datos: registrarse en la web y cambiar el rol en phpMyAdmin con `UPDATE Usuarios SET role='administrador' WHERE email='...';`.

### 6. Registro (T034 · H001)

Pantalla `registro.html`. Se llega desde «¿No tienes cuenta? Regístrate» en el inicio de sesión. Crea una cuenta de portador con nombre, apellidos, correo y contraseña (escrita dos veces). Si va bien, la sesión queda iniciada y se entra en Mi cuenta.

#### Tipos

```
DatosRegistro = ( nombre: Text, apellidos: Text, correo: Text, contrasena: Text )

ResultadoRegistro = ( correcto: B, usuario: Usuario, error: Text,
                      campos: [ Text ], correoRepetido: B )
```

#### Método nuevo de la lógica (fake y real)

```
            datos: DatosRegistro --> registrarUsuario() -->
            r: ResultadoRegistro <--
```

- La lógica fake añade el usuario a su lista como PORTADOR y guarda la sesión. Si el correo ya existe, devuelve `correoRepetido: true`.
- La lógica real llama a `POST /registrarUsuario { nombre, apellidos, correo, contrasena }` (T016): 201 `{ idUsuario, token, rol, nombre }`, 400 `{ error, campos }` y 409 si el correo ya tiene cuenta. Con 201 guarda la sesión igual que `iniciarSesion()`.

#### Reglas nuevas en `validacion.js`

```
texto: Text, longitud_maxima: N --> esNombreValido() --> B

nombre: Text --> errorNombre() --> Text

apellidos: Text --> errorApellidos() --> Text
```

Nombre y apellidos solo pueden tener letras (con tildes) separadas por un espacio, guion o apóstrofo, con un máximo de 50 caracteres el nombre y 100 los apellidos. Son las mismas reglas que `src/logica/ValidadorUsuario.js` y la app.

#### Controlador de la pantalla (`registro.js`)

```
datos: DatosRegistro, repetida: Text --> validarRegistro() --> errores: [ ErrorCampo ]

mensaje: Text, campos: [ Text ] --> mostrarErrorRegistro()

ocultarErrorRegistro()

boton: Elemento --> alternarVisibilidadRegistro()

evento: Evento, logica: LogicaFake | LogicaReal, irA: (url: Text) --> enviarRegistro()

iniciarPantallaRegistro()
```

- `validarRegistro()` comprueba los cuatro campos con `validacion.js` y que las dos contraseñas coincidan. Devuelve un error por cada campo que falla.
- `enviarRegistro()` muestra el primer error y marca todos los campos que fallan. Si el servidor dice que el correo ya tiene cuenta, muestra los enlaces para iniciar sesión o recuperar la contraseña. Si va bien, lleva a `mi_cuenta.html`.
- En escritorio, nombre y apellidos van en la misma fila. En móvil, uno debajo del otro.

## Aclaraciones del diseño

- Si el correo o la contraseña fallan, el aviso es siempre el mismo («Correo o contraseña incorrectos»). Así no se revela qué correos están registrados.
- Si el formulario no es válido (correo sin formato de correo o contraseña vacía), se muestra el primer error, se marca solo el campo que falla y no se llama a la lógica.
- Mientras se espera la respuesta, el botón Acceder se desactiva para que no se envíe el formulario dos veces.
- La lógica que se usa (fake o real) se elige en un solo sitio, `js/configuracion.js`. Para pasar al servidor real solo se cambia esa línea.
- El usuario que ha iniciado sesión se guarda en `sessionStorage`, de modo que la sesión se cierra al cerrar el navegador.
- La lógica real llama a `POST /iniciarSesion` del servidor REST (apartado 5).
- El enlace «Recuperar contraseña» lleva a `recuperar.html` (apartado 3).
- En recuperar contraseña, si el correo no tiene cuenta se avisa con «No hay ninguna cuenta con ese correo», como hace el servidor (404). Si falla la conexión con el servidor, también se muestra el error.
- Los estilos de las pantallas de acceso (login, recuperar y correo enviado) están en `css/acceso.css`.
- Las pantallas son responsive. Por encima de 1100 px se ve el diseño de escritorio de Figma, con el panel del logo y el formulario. Entre 801 y 1100 px se mantienen las dos columnas con márgenes más pequeños. Por debajo de 800 px de ancho, o con menos de 560 px de alto (móvil en horizontal), se usa el diseño móvil: una sola columna con el logo arriba y el formulario limitado a 480 px de ancho y centrado.
- Las pantallas siguen el diseño de Figma. Los colores, la tipografía y los botones comunes están en `css/estilos.css` y los reutilizan todas las páginas.

### 7. Mi cuenta (T018 · H035)

Página `mi_cuenta.html`. Es donde llega el portador después de iniciar sesión o de registrarse. Sigue los diseños «Mi cuenta» y «Mi cuenta · móvil» de Figma.

#### Contenido

- Cabecera con el logo, los enlaces Mapa y Contaminantes, el avatar (la foto de perfil o la inicial), el nombre corto («Laura M.») y Salir. En el móvil, Mapa, Contaminantes y Salir van en un menú que se abre con el botón ☰.
- Saludo con el nombre y el estado del nodo: identificador y hace cuánto se sincronizó.
- Cuatro indicadores: mediciones del mes comparadas con el mes anterior, puntos y nivel, exposición media al ozono con su nivel, y horas por encima del umbral de aviso esta semana.
- Gráfica de la exposición al ozono (media diaria) por semana, mes o 3 meses, con las líneas de 100 µg/m³ (valor guía de la OMS) y 180 µg/m³ (umbral de aviso) y el máximo del periodo marcado.
- Mis lugares con la calidad del aire actual de cada uno. Se añaden y se editan desde la app.
- Recompensas: puntos que faltan para el siguiente nivel y barra de progreso.
- Últimas mediciones (solo en escritorio).
- Tu perfil: nombre, correo, aviso de ozono y plan. El botón «Editar perfil» abre un diálogo para cambiar nombre, apellidos y correo. La contraseña, la foto y los avisos se cambian desde la app.
- Sin sesión, o con la sesión caducada (401), la página vuelve a `login.html`.
- Si todavía no hay datos del sensor, se muestra «Todavía no hay mediciones» y solo el perfil.

#### Niveles de ozono

| Valor | Nivel |
|---|---|
| hasta 100 µg/m³ | Bueno |
| de 101 a 180 µg/m³ | Moderado |
| más de 180 µg/m³ | Malo |

#### Lógica

`LogicaCuentaFake` (`js/logica_cuenta_fake.js`) y `LogicaCuentaReal` (`js/logica_cuenta_real.js`) tienen la misma interfaz. `crearLogicaCuenta()` en `configuracion.js` elige una u otra con el mismo `USAR_LOGICA_FAKE`.

| Método | Petición | Estado |
|---|---|---|
| `obtenerPerfil()` | `GET /usuarioActual` | Ya está en el servidor (T016, T010) |
| `actualizarDatos(datos)` | `POST /actualizarDatos { nombre, apellidos, correo }` · 200 · 400 · 409 | Ya está en el servidor (T010) |
| `obtenerResumen()` | `GET /miCuenta` | Propuesta para T024 |
| `obtenerExposicion(periodo)` | `GET /miExposicion?periodo=semana, mes o 3meses` | Propuesta para T024 |

Todas las peticiones llevan la cabecera `Authorization: Bearer <token>`. Mientras T024 no esté hecha, el servidor responde 404 a las dos rutas nuevas y la página muestra el aviso de que todavía no hay mediciones. Con la lógica fake se ve la página completa con datos de ejemplo.

Respuesta propuesta de `GET /miCuenta`:

```
{ nodo, ultimaSincronizacion, medicionesMes, medicionesMesAnterior,
  puntos, nivel, siguienteNivel, puntosSiguienteNivel,
  exposicionMedia, horasOzonoAlto,
  lugares: [ { nombre, zona, ozono } ],
  ultimasMediciones: [ { fecha, lugar, ozono } ] }
```

Respuesta propuesta de `GET /miExposicion`: `[ { fecha, ozono } ]`, una media por día.

Funciones principales de `js/mi_cuenta.js`: `nivelOzono()`, `formatearNumero()`, `formatearFecha()`, `textoHace()`, `textoVariacion()`, `calcularGrafica()`, `cargarCuenta()`, `cambiarPeriodo()`, `validarPerfil()` y `guardarPerfil()`.

### 8. Página de inicio y mapa (T012)

Desde el 10/11/2026 la web pública sigue el diseño «Inicio · opción A (app)» de Figma:

- `index.html` es la portada. Arriba, «Respira con datos.» con el botón «Ver el mapa» y un móvil con la pantalla de inicio de la app y tres tarjetas (sensor conectado, ozono en Gandia y aviso). Debajo: Qué es AERIS, Cómo funciona, La app AERIS (cuatro pantallas de la app: inicio, Mis datos, previsión de ozono y ruta limpia), Niveles de ozono, Quiénes somos y Preguntas frecuentes. Estilos en `css/portada.css`; la cabecera, las secciones y el pie son los de `css/inicio.css`.
- `mapa.html` es el mapa que antes estaba en `index.html` (diseño «Homepage Mapa»), con la franja «Descargar la app».
- El menú de todas las páginas públicas es Inicio, Mapa y Contaminantes. Mi cuenta enlaza a `mapa.html`.
- Las pantallas de la app están en `img/app-inicio.jpg`, `img/app-mis-datos.jpg`, `img/app-prevision.jpg` y `img/app-ruta-limpia.jpg`, exportadas de Figma al doble de tamaño para que se vean nítidas.
- La app todavía no está publicada, así que «Descargar la app» baja a la sección de la app y allí una nota lo dice.
- La portada usa `informacion.js` para la cabecera (Acceder o Mi cuenta y el menú del móvil). El mapa usa `inicio.js`, que solo se arranca si la página tiene `#mapa`.

#### Mapa

- Mapa de Leaflet 1.9.4 con teselas de OpenStreetMap, centrado en las mediciones que haya.
- Cada medición se pinta como una mancha de color difuminada (el nivel) y un punto que, al pulsarlo, dice el municipio, el valor, si es un sensor ciudadano o una estación oficial y cuándo se midió.
- Botones de contaminante: ozono, NO₂, partículas PM10 y CO. Los sensores de AERIS solo miden ozono, así que los otros tres solo tienen estaciones oficiales.
- Capas: sensores ciudadanos y estaciones oficiales. En el móvil se abren con el botón de capas que hay al lado del buscador.
- Buscador de municipios. Si el municipio tiene mediciones, pasa a ser «Tu zona» y el mapa se acerca. Si no, avisa.
- «Tu zona ahora»: nivel y valor de la medición más cercana. Empieza en Gandia. Si la medición está a más de 15 km, dice dónde se midió. «¿Qué significa esto?» baja a la tabla de niveles.
- Leyenda de los cuatro niveles (en el móvil no se muestra, como en el diseño).
- «¿Qué significa esto?» lleva a `contaminantes.html`, donde están los niveles de cada contaminante.
- Cabecera: sin sesión muestra «Acceder». Con sesión, «Mi cuenta» para portadores y «Panel» para técnicos y administradores.

#### Niveles

| Contaminante | Bueno | Moderado | Malo | Muy malo |
|---|---|---|---|---|
| O₃ (µg/m³) | hasta 100 | hasta 180 | hasta 240 | más de 240 |
| NO₂ (µg/m³) | hasta 40 | hasta 90 | hasta 230 | más de 230 |
| PM10 (µg/m³) | hasta 20 | hasta 50 | hasta 100 | más de 100 |
| CO (mg/m³) | hasta 4 | hasta 7 | hasta 10 | más de 10 |

Para el ozono son el valor guía de la OMS, el umbral de información y el umbral de alerta. Para el resto, las bandas del índice europeo de calidad del aire.

#### Lógica

`LogicaMapaFake` (`js/logica_mapa_fake.js`) y `LogicaMapaReal` (`js/logica_mapa_real.js`), elegidas con `crearLogicaMapa()` en `configuracion.js`.

| Método | Petición | Estado |
|---|---|---|
| `obtenerMediciones(contaminante)` | `GET /mediciones?contaminante=O3` | Propuesta para T017 |
| `usuarioActual()` | lee la sesión guardada | |

Respuesta propuesta: `[ { id, municipio, lat, lon, valor, unidad, tipo, fecha } ]`, la última medición de cada sensor o estación. `tipo` es `ciudadano` u `oficial`. Mientras la ruta no exista, el servidor responde 404 y el mapa sale vacío con el aviso «Todavía no hay mediciones para mostrar en el mapa».

Funciones principales de `js/inicio.js`: `nivelContaminante()`, `distanciaKm()`, `medicionMasCercana()`, `buscarMunicipio()`, `textoActualizado()`, `accesoCabecera()`, `cambiarContaminante()` y `buscar()`.

### 9. Contaminantes, Normativa y Consejos (T012)

Páginas públicas `contaminantes.html`, `normativa.html` y `consejos.html`, según los diseños «Homepage Contaminantes», «Normativa», «Consejos» y sus versiones móviles de Figma. Comparten la cabecera y el pie de la página principal (`css/inicio.css`) y sus estilos están en `css/informacion.css`.

- Contaminantes: explica cómo se forma el ozono y tiene una tarjeta por contaminante. Al pulsar una tarjeta, la tabla «niveles y qué hacer» cambia a ese contaminante, con los mismos límites que el mapa (`LIMITES_NIVEL` de `inicio.js`) y un consejo por nivel. Enlaza con Normativa y Consejos.
- Normativa: valores del ozono (100 de la OMS, 120 valor objetivo, 180 umbral de información, 240 umbral de alerta), cómo los usa AERIS y enlaces a los textos oficiales (Directiva 2008/50/CE, RD 102/2011, Ley 34/2007 y guías de la OMS de 2021). Nota sobre la Directiva (UE) 2024/2881.
- Consejos: qué hacer al moverse, en casa y cuando el ozono está alto, y la franja «Descargar la app».

`js/informacion.js` reutiliza `LIMITES_NIVEL`, `NIVELES` y `pintarCabecera()` de `inicio.js`, que por eso solo arranca el mapa si la página tiene `#mapa`. Funciones: `filasNiveles()`, `pintarNiveles()` e `iniciarCabeceraInfo()`.

## Reglas generales

- Lenguaje de programación: HTML, CSS y JavaScript sin frameworks.
- El encabezado de cada función o método incluye su diseño lógico dentro de un bloque de comentarios delimitado por líneas discontinuas (`--------------------`).
- El código debe ser lo más claro posible, de forma que casi no necesite comentarios adicionales.
- Se generan pruebas unitarias o de integración para todas las funciones y métodos importantes. Las pruebas se hacen con Jest.
- HTML, CSS y JavaScript van en archivos separados.
- La pantalla no contiene lógica de negocio ni accede directamente al servidor: todo pasa por la lógica del navegador.
- No se añaden funcionalidades que no estén en este diseño ni se cambia la arquitectura del sistema.

### Pruebas mínimas

- `validarFormulario()` con un correo sin @, con la contraseña vacía y con datos correctos.
- `paginaInicioSegunRol()` con cada uno de los cuatro roles.
- `iniciarSesion()` de la lógica fake con un usuario correcto, con una contraseña incorrecta y con un correo que no existe.
- `enviarFormulario()` muestra el aviso de error cuando la lógica devuelve `correcto: false`, y marca solo el campo que falla cuando el formato no es correcto.
- `esCorreoValido()` y `esContrasenaValida()` con ejemplos válidos y con cada caso que incumple una regla.
- `enviarSolicitud()` con un correo válido, con un correo mal escrito y con un error del servidor.
- `reenviarEnlace()` vuelve a pedir el enlace para el mismo correo.
- `esNombreValido()`, `errorNombre()` y `errorApellidos()` con nombres compuestos, con guion, con apóstrofo y con números o símbolos.
- `validarRegistro()` con datos correctos, nombre con números, contraseña sin números y contraseñas distintas.
- `enviarRegistro()` con un registro correcto, con datos mal escritos y con un correo que ya tiene cuenta.
- `guardarContrasena()` con un token válido, caducado y vacío, y con dos contraseñas distintas.
- `LogicaReal` con un servidor simulado: rutas, cuerpos y respuestas 200, 204, 400 y 401, y sin conexión.
- `nivelOzono()`, `formatearNumero()`, `textoHace()` y `textoVariacion()` con varios valores y en los límites.
- `calcularGrafica()` encuentra el máximo, ajusta el eje y pone como mucho cinco fechas.
- `cargarCuenta()` sin sesión, con datos, sin datos del sensor, con la sesión caducada y con error del servidor.
- `guardarPerfil()` con datos mal escritos, con un correo de otra cuenta y con datos correctos.
- `LogicaCuentaReal` con un servidor simulado: token en la cabecera, 401, 404 de las rutas de T024 y 409 al editar.
- `nivelContaminante()` con cada contaminante y en los límites de cada nivel.
- `distanciaKm()`, `medicionMasCercana()` y `buscarMunicipio()` con nombres sin tildes, en mayúsculas, a medias y que no existen.
- `cambiarContaminante()` con datos, sin estaciones oficiales, sin mediciones y con error del servidor.
- `buscar()` con un municipio que tiene mediciones y con uno que no.
- `LogicaMapaReal` con un servidor simulado: 200, 404, 500 y sin conexión.
- `filasNiveles()` con el ozono y con el CO (decimales), y `pintarNiveles()` al cambiar de contaminante.
- La cabecera de las tres páginas de información cambia con la sesión y abre el menú.
- La portada: menú, enlaces de «Ver el mapa» y «Cómo funciona», las cuatro funciones de la app con su imagen y que no cargue el mapa.
- Todas las páginas públicas enlazan a Inicio, Mapa y Contaminantes.