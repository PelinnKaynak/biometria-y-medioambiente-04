# Diseño de la web pública y Mi cuenta

## Diseño del componente

### 1. Inicio de sesión (T013 · H002)

Pantalla `login.html`. El usuario escribe su correo y su contraseña. Si son correctos, la web le lleva a su página según el rol. Si no lo son, muestra un aviso y se queda en el formulario.

#### Tipos

```
Rol = { PORTADOR, PREMIUM, TECNICO, ADMINISTRADOR }

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
            correo: Text --> solicitarRecuperacion() -->
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
            correo: Text --> solicitarRecuperacion() -->
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

Las reglas están en un solo archivo y las usan todas las pantallas de acceso, para que el formato sea el mismo en toda la web. El servidor tiene que aplicar las mismas reglas, porque la comprobación del navegador se puede saltar.

```
correo: Text --> esCorreoValido() --> B

contrasena: Text --> esContrasenaValida() --> B

correo: Text --> errorCorreo() --> Text

contrasena: Text --> errorContrasena() --> Text
```

Correo válido:

- Como mucho 254 caracteres, sin contar los espacios del principio y del final.
- Una sola @, con texto antes y después.
- Antes de la @: letras sin tilde, números y los signos `. _ % + -`. No puede empezar ni acabar en punto ni tener dos puntos seguidos.
- Después de la @: un dominio con al menos un punto y una terminación de dos letras o más (`correo.es`, `alumnos.upv.es`).

Contraseña válida:

- Entre 8 y 64 caracteres.
- Al menos una letra y al menos un número.
- Ningún espacio.

`errorCorreo()` y `errorContrasena()` devuelven el mensaje que se muestra al usuario, o un texto vacío si el dato es correcto. El mensaje es distinto si el campo está vacío o si no cumple el formato:

| Caso | Mensaje |
|---|---|
| Correo vacío | Escribe tu correo electrónico |
| Correo con formato incorrecto | Escribe un correo válido, por ejemplo nombre@dominio.es |
| Contraseña vacía | Escribe tu contraseña |
| Contraseña con formato incorrecto | La contraseña debe tener entre 8 y 64 caracteres, al menos una letra y un número, y ningún espacio |

En el HTML, el campo del correo tiene `maxlength="254"` y el de la contraseña `maxlength="64"`.

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
- La lógica real llama a `POST /api/recuperacion`. El servidor responde igual exista o no el correo.

## Aclaraciones del diseño

- Si el correo o la contraseña fallan, el aviso es siempre el mismo («Correo o contraseña incorrectos»). Así no se revela qué correos están registrados.
- Si el formulario no es válido (correo sin formato de correo o contraseña vacía), se muestra el primer error, se marca solo el campo que falla y no se llama a la lógica.
- Mientras se espera la respuesta, el botón Acceder se desactiva para que no se envíe el formulario dos veces.
- La lógica que se usa (fake o real) se elige en un solo sitio, `js/configuracion.js`. Para pasar al servidor real solo se cambia esa línea.
- El usuario que ha iniciado sesión se guarda en `sessionStorage`, de modo que la sesión se cierra al cerrar el navegador.
- La lógica real llama a `POST /api/sesion` del servidor REST. El formato de la petición y de la respuesta se define en `servidor_rest_design.md`.
- El enlace «Recuperar contraseña» lleva a `recuperar.html` (apartado 3).
- En recuperar contraseña se confirma el envío aunque el correo no exista, por el mismo motivo que el aviso del inicio de sesión. Si falla la conexión con el servidor, sí se muestra el error.
- Los estilos de las pantallas de acceso (login, recuperar y correo enviado) están en `css/acceso.css`.
- Las pantallas son responsive. Por encima de 1100 px se ve el diseño de escritorio de Figma, con el panel del logo y el formulario. Entre 801 y 1100 px se mantienen las dos columnas con márgenes más pequeños. Por debajo de 800 px de ancho, o con menos de 560 px de alto (móvil en horizontal), se usa el diseño móvil: una sola columna con el logo arriba y el formulario limitado a 480 px de ancho y centrado.
- Las pantallas siguen el diseño de Figma. Los colores, la tipografía y los botones comunes están en `css/estilos.css` y los reutilizan todas las páginas.

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