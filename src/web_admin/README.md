# src/web_admin

Panel de administración: HTML, CSS y JavaScript.

Diseño: `doc/web_admin_design.md`

La pantalla `incidencias.html` permite a técnicos y administradores filtrar,
consultar y responder incidencias. Usa la API REST de gestión de incidencias;
para la vista de demostración, el panel puede configurarse con
`USAR_LOGICA_FAKE` en `js/configuracion.js`.

**Conversación de cada incidencia (T043).** Al abrir una incidencia, el detalle
muestra debajo de lo que escribió el usuario la conversación completa: sus
mensajes nuevos (que envía desde Ayuda en la app) y las respuestas del equipo,
cada uno con su autor, su rol y su fecha. Se pide a `GET /mensajesIncidencia?id=`
(`obtenerMensajesIncidencia()` en `logica_admin_real.js` y en la lógica falsa).
Para contestar se sigue usando el formulario de siempre («Responder y actualizar
estado», `POST /responderIncidencia`): la respuesta se guarda como último mensaje
de la conversación, se avisa al usuario por correo (una sola vez) y la conversación
se vuelve a cargar. Si la conversación no se puede cargar, o la incidencia es
anterior a T043 y aún no tiene mensajes, se enseña la última respuesta como antes
(«Respuesta enviada»). Cuando el usuario escribe en una incidencia «Resuelta», pasa
a «Abierta» y vuelve a contar en el número del menú.
