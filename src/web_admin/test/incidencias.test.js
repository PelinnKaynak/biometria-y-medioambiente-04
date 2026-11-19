/** @jest-environment jsdom */

const fs = require("fs");
const path = require("path");
const { LogicaAdminFake } = require("../js/logica_admin_fake");
const comun = require("../js/admin_comun");
const incidencias = require("../js/incidencias");

const AHORA = new Date("2026-11-04T12:00:00Z");
const html = fs.readFileSync(path.join(__dirname, "../incidencias.html"), "utf8");

function cargarPagina() {
    document.documentElement.innerHTML = new DOMParser()
        .parseFromString(html, "text/html").documentElement.innerHTML;
    Object.assign(incidencias.pantallaIncidencias, {
        incidencias: [], idSeleccionada: null, solicitudLista: 0, solicitudDetalle: 0
    });
}

function crearLogica(rol = "tecnico") {
    sessionStorage.setItem("aeris_usuario", JSON.stringify({
        id: 8, rol, nombre: "Marta", correo: "marta@aeris.es"
    }));
    return new LogicaAdminFake(5, AHORA, 0);
}

const eventoFalso = () => ({ preventDefault: jest.fn() });

beforeEach(() => {
    sessionStorage.clear();
    cargarPagina();
});

test("solo técnicos y administradores pueden acceder a la pantalla", () => {
    const irA = jest.fn();
    expect(comun.comprobarAcceso(crearLogica("tecnico"), irA)).toBe(true);
    expect(comun.comprobarAcceso(crearLogica("administrador"), irA)).toBe(true);
    expect(comun.comprobarAcceso(crearLogica("portador"), irA)).toBe(false);
    expect(irA).toHaveBeenCalledWith(comun.PAGINA_LOGIN);
});

test("la lista respeta ambos filtros y muestra los datos del sensor", async () => {
    const logica = crearLogica();
    await incidencias.cargarIncidencias(logica);
    expect(document.querySelectorAll(".boton-incidencia")).toHaveLength(4);
    expect(document.getElementById("usuario-incidencia").textContent).toBe("Laura Martínez");
    expect(document.getElementById("bateria-incidencia").textContent).toBe("Batería: 72%");
    expect(document.getElementById("conexion-incidencia").textContent).toContain("Última conexión:");

    document.getElementById("filtro-estado").value = "abierta";
    document.getElementById("filtro-tipo").value = "cuenta";
    await incidencias.cargarIncidencias(logica);
    expect(document.querySelectorAll(".boton-incidencia")).toHaveLength(1);
    expect(document.getElementById("asunto-incidencia").textContent).toBe("No puedo cambiar mi correo");
});

test("no guarda una respuesta vacía si tampoco cambia el estado", async () => {
    const logica = crearLogica();
    await incidencias.cargarIncidencias(logica);
    document.getElementById("texto-respuesta").value = "   ";

    await incidencias.enviarRespuestaIncidencia(eventoFalso(), logica);

    expect(document.getElementById("error-respuesta").textContent)
        .toBe("Escribe una respuesta o cambia el estado antes de guardar.");
    expect((await logica.obtenerIncidencia(101)).incidencia.respuesta).toBeNull();
});

test("responder guarda el texto y estado, y actualiza el contador del menú", async () => {
    const logica = crearLogica();
    await incidencias.cargarIncidencias(logica);
    document.getElementById("texto-respuesta").value = "Estamos revisando el sensor.";
    document.getElementById("nuevo-estado").value = "en curso";

    await incidencias.enviarRespuestaIncidencia(eventoFalso(), logica);

    expect((await logica.obtenerIncidencia(101)).incidencia).toMatchObject({
        respuesta: "Estamos revisando el sensor.", estado: "en curso"
    });
    expect(document.getElementById("aviso-ok").textContent)
        .toBe("Respuesta guardada en datos de prueba; no se envió correo.");
    await comun.actualizarContadorIncidencias(logica);
    expect(document.getElementById("contador-incidencias").textContent).toBe("1");
});

test("el contador informa el número abierto y señala si falla", async () => {
    const contador = document.getElementById("contador-incidencias");
    await comun.actualizarContadorIncidencias({
        obtenerNumeroIncidenciasAbiertas: async () => ({ correcto: true, abiertas: 2 })
    });
    expect(contador.textContent).toBe("2");

    await comun.actualizarContadorIncidencias({
        obtenerNumeroIncidenciasAbiertas: async () => ({ correcto: false, error: "Servidor no disponible" })
    });
    expect(contador.textContent).toBe("!");
    expect(contador.title).toBe("Servidor no disponible");
});

test("la lógica fake también bloquea a los portadores", async () => {
    const resultado = await crearLogica("portador").obtenerIncidencias();
    expect(resultado.correcto).toBe(false);
    expect(resultado.incidencias).toEqual([]);
});

// --- Conversación de cada incidencia (T043) ---------------------------------

const mensajesPintados = () => [...document.querySelectorAll("#lista-mensajes .mensaje")];

test("una incidencia sin mensajes no enseña la conversación", async () => {
    const logica = crearLogica();
    await incidencias.cargarIncidencias(logica);      // abre la 101, sin mensajes
    expect(document.getElementById("conversacion-panel").classList.contains("oculto")).toBe(true);
    expect(mensajesPintados()).toHaveLength(0);
    expect(document.getElementById("respuesta-actual-panel").classList.contains("oculto")).toBe(true);
});

test("enseña lo que escribió el usuario y lo del equipo, cada uno con su autor", async () => {
    const logica = crearLogica();
    await incidencias.cargarIncidencias(logica);
    await incidencias.cargarDetalleIncidencia(logica, 103);       // la usuaria escribió un mensaje

    expect(document.getElementById("conversacion-panel").classList.contains("oculto")).toBe(false);
    const [mensaje] = mensajesPintados();
    expect(mensaje.classList.contains("mensaje-usuario")).toBe(true);
    expect(mensaje.querySelector("strong").textContent).toBe("Lucía · Usuario");
    expect(mensaje.querySelector(".texto-mensaje").textContent).toContain("Sigue sin dejarme guardar el correo");

    await incidencias.cargarDetalleIncidencia(logica, 104);       // resuelta: respuesta del equipo
    const [respuesta] = mensajesPintados();
    expect(mensajesPintados()).toHaveLength(1);
    expect(respuesta.classList.contains("mensaje-equipo")).toBe(true);
    expect(respuesta.querySelector("strong").textContent).toBe("Administración · Administrador");
});

test("al responder desde el panel, la respuesta aparece en la conversación y no se repite «Respuesta enviada»", async () => {
    const logica = crearLogica();
    await incidencias.cargarIncidencias(logica);                  // abre la 101
    document.getElementById("texto-respuesta").value = "Prueba a cargarlo 30 minutos.";

    await incidencias.enviarRespuestaIncidencia(eventoFalso(), logica);

    const [mensaje] = mensajesPintados();
    expect(mensajesPintados()).toHaveLength(1);
    expect(mensaje.classList.contains("mensaje-equipo")).toBe(true);
    expect(mensaje.querySelector("strong").textContent).toBe("Marta · Técnico");
    expect(mensaje.querySelector(".texto-mensaje").textContent).toBe("Prueba a cargarlo 30 minutos.");
    expect(document.getElementById("respuesta-actual-panel").classList.contains("oculto")).toBe(true);
});

test("si no se puede cargar la conversación, lo avisa y sigue enseñando la última respuesta", async () => {
    const logica = crearLogica();
    logica.obtenerMensajesIncidencia = async () => ({ correcto: false, mensajes: [], error: "Sin conexión" });
    await incidencias.cargarIncidencias(logica);
    await incidencias.cargarDetalleIncidencia(logica, 104);

    const error = document.getElementById("error-conversacion");
    expect(error.classList.contains("oculto")).toBe(false);
    expect(error.textContent).toBe("No se ha podido cargar la conversación: Sin conexión");
    expect(document.getElementById("respuesta-actual-panel").classList.contains("oculto")).toBe(false);
    expect(document.getElementById("respuesta-actual").textContent).toContain("ya está solucionado");
    expect(mensajesPintados()).toHaveLength(0);
});

test("una incidencia anterior a la conversación (con respuesta pero sin mensajes) enseña su respuesta como antes", async () => {
    const logica = crearLogica();
    logica.obtenerMensajesIncidencia = async () => ({ correcto: true, mensajes: [], error: "" });
    await incidencias.cargarIncidencias(logica);
    await incidencias.cargarDetalleIncidencia(logica, 104);

    expect(document.getElementById("conversacion-panel").classList.contains("oculto")).toBe(true);
    expect(document.getElementById("respuesta-actual-panel").classList.contains("oculto")).toBe(false);
});

test("la conversación de otra incidencia no pisa a la que se abrió después", async () => {
    const logica = crearLogica();
    await incidencias.cargarIncidencias(logica);
    const original = logica.obtenerMensajesIncidencia.bind(logica);
    let soltarPrimera;
    logica.obtenerMensajesIncidencia = (id) => id === 103
        ? new Promise(resolver => { soltarPrimera = () => original(id).then(resolver); })
        : original(id);

    const lenta = incidencias.cargarDetalleIncidencia(logica, 103);     // su conversación tarda
    while (!soltarPrimera) await new Promise(resolver => setTimeout(resolver, 0));   // ya la ha pedido
    await incidencias.cargarDetalleIncidencia(logica, 104);             // se abre otra y llega antes
    soltarPrimera();
    await lenta;

    expect(document.getElementById("asunto-incidencia").textContent).toBe("Consulta sobre el servicio");
    expect(mensajesPintados().map(m => m.querySelector("strong").textContent))
        .toEqual(["Administración · Administrador"]);
});

test("etiquetaAutorMensaje: usuario, técnico, administrador y autor borrado", () => {
    const etiqueta = incidencias.etiquetaAutorMensaje;
    expect(etiqueta({ delUsuario: true, autor: { nombre: "Ana", rol: "ciudadano" } })).toBe("Ana · Usuario");
    expect(etiqueta({ delUsuario: false, autor: { nombre: "Marc", rol: "tecnico" } })).toBe("Marc · Técnico");
    expect(etiqueta({ delUsuario: false, autor: { nombre: "Alba", rol: "administrador" } })).toBe("Alba · Administrador");
    expect(etiqueta({ delUsuario: false, autor: { nombre: "Eva", rol: "otro" } })).toBe("Eva · Equipo");
    expect(etiqueta({ delUsuario: false, autor: null })).toBe("Equipo de soporte");
});

test("el texto de los mensajes se pinta como texto, no como HTML", () => {
    const li = incidencias.crearMensajeIncidencia({
        idMensaje: 1, texto: "<img src=x onerror=alert(1)>", fecha: "2026-11-04T10:00:00Z",
        delUsuario: true, autor: { nombre: "<b>Ana</b>", rol: "ciudadano" }
    });
    expect(li.querySelector("img")).toBeNull();
    expect(li.querySelector("b")).toBeNull();
    expect(li.querySelector(".texto-mensaje").textContent).toBe("<img src=x onerror=alert(1)>");
});

test("la lógica fake da la conversación al equipo y la niega a los portadores", async () => {
    const equipo = await crearLogica("tecnico").obtenerMensajesIncidencia(103);
    expect(equipo.correcto).toBe(true);
    expect(equipo.mensajes).toHaveLength(1);
    expect((await crearLogica("tecnico").obtenerMensajesIncidencia(999)).correcto).toBe(false);

    const portador = await crearLogica("portador").obtenerMensajesIncidencia(103);
    expect(portador.correcto).toBe(false);
    expect(portador.mensajes).toEqual([]);
});
