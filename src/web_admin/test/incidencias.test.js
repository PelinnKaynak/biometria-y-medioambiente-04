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
