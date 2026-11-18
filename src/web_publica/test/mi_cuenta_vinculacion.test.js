/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas de Mi cuenta sin sensor y esperando confirmación
// (mi_cuenta.html, T040 · H037)
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { LogicaCuentaFake, CLAVE_VINCULACION_FAKE, guardarVinculacionFake } = require("../js/logica_cuenta_fake");
const { LogicaCuentaReal } = require("../js/logica_cuenta_real");
const cuenta = require("../js/mi_cuenta");

const html = fs.readFileSync(path.join(__dirname, "../mi_cuenta.html"), "utf8");
const AHORA = new Date(2026, 10, 12, 19, 0);
const visible = id => !document.getElementById(id).classList.contains("oculto");
const texto = id => document.getElementById(id).textContent;
const LAURA = { id: 2, nombre: "Laura", correo: "laura@correo.es", rol: "portador", token: "t" };
const NUEVA = { id: 7, nombre: "Ana", correo: "ana@correo.es", rol: "portador", token: "t" };

function iniciarSesion(usuario) {
    sessionStorage.setItem("aeris_usuario", JSON.stringify(usuario));
}

async function cargarCon(estado) {
    iniciarSesion(NUEVA);
    const logica = new LogicaCuentaFake(0, AHORA, estado);
    const resultado = await cuenta.cargarCuenta(logica, jest.fn());
    return { logica, resultado };
}

beforeEach(() => {
    document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/, "").replace(/<\/html>[\s\S]*$/, "");
    sessionStorage.clear();
});

describe("textos", () => {
    test("enmascararCorreo() deja la primera letra y el dominio", () => {
        expect(cuenta.enmascararCorreo("maria.lopez@gmail.com")).toBe("m•••••@gmail.com");
        expect(cuenta.enmascararCorreo("a@b.es")).toBe("a•••••@b.es");
        expect(cuenta.enmascararCorreo("sin-arroba")).toBe("sin-arroba");
        expect(cuenta.enmascararCorreo(null)).toBe("");
    });

    test("textosVinculacion() distingue rechazada y caducada", () => {
        const base = { nodo: "N-0412", emailConfirmacion: "maria@gmail.com" };
        expect(cuenta.textosVinculacion({ ...base, estado: "rechazada" }).titulo).toBe("Vinculación rechazada");
        expect(cuenta.textosVinculacion({ ...base, estado: "caducada" }).titulo).toBe("La vinculación ha caducado");
        expect(cuenta.textosVinculacion({ ...base, estado: "confirmada" })).toBeNull();
    });
});

describe("LogicaCuentaFake · vinculación", () => {
    test("las cuentas de prueba tienen el sensor vinculado y las nuevas no", async () => {
        iniciarSesion(LAURA);
        expect((await new LogicaCuentaFake(0, AHORA, null).obtenerVinculacion()).vinculacion.estado).toBe("confirmada");
        iniciarSesion(NUEVA);
        expect((await new LogicaCuentaFake(0, AHORA, null).obtenerVinculacion()).vinculacion.estado).toBe("sin_sensor");
    });

    test("usa el estado guardado (lo guardará la página Vincular sensor)", async () => {
        iniciarSesion(NUEVA);
        guardarVinculacionFake({ estado: "pendiente", nodo: "N-0099", emailConfirmacion: "pepe@gmail.com",
            fechaSolicitud: AHORA.toISOString() });
        const v = (await new LogicaCuentaFake(0, AHORA, null).obtenerVinculacion()).vinculacion;
        expect(v).toMatchObject({ estado: "pendiente", nodo: "N-0099", emailConfirmacion: "pepe@gmail.com" });
        expect(new Date(v.caducaEn) - new Date(v.fechaSolicitud)).toBe(48 * 3600000);
    });

    test("solo se puede reenviar el correo si está pendiente", async () => {
        iniciarSesion(NUEVA);
        expect((await new LogicaCuentaFake(0, AHORA, "pendiente").reenviarCorreo()).correcto).toBe(true);
        expect(JSON.parse(sessionStorage.getItem(CLAVE_VINCULACION_FAKE)).fechaSolicitud).toBe(AHORA.toISOString());
        const r = await new LogicaCuentaFake(0, AHORA, "rechazada").reenviarCorreo();
        expect(r).toMatchObject({ correcto: false, error: "No hay ninguna vinculación pendiente" });
    });
});

describe("cargarCuenta() según la vinculación", () => {
    test("sin sensor enseña los pasos y el botón para vincular, sin datos", async () => {
        await cargarCon("sin_sensor");

        expect(visible("vista-sin-sensor")).toBe(true);
        expect(visible("accesos")).toBe(true);
        expect(visible("aviso-vinculacion")).toBe(false);
        expect(visible("indicadores")).toBe(false);
        expect(visible("rejilla-cuenta")).toBe(false);
        expect(visible("sin-datos")).toBe(false);
        expect(texto("estado-nodo")).toContain("Solo te falta vincular tu sensor");
        expect(document.querySelector("#vista-sin-sensor a.boton").getAttribute("href")).toBe("vincular.html");
        expect(document.querySelectorAll(".pasos-vincular li")).toHaveLength(3);
    });

    test("pendiente enseña a qué correo se envió, el estado y Reenviar correo", async () => {
        await cargarCon("pendiente");

        expect(visible("vista-sin-sensor")).toBe(false);
        expect(visible("aviso-vinculacion")).toBe(true);
        expect(document.getElementById("aviso-vinculacion").classList.contains("aviso-pendiente")).toBe(true);
        expect(texto("titulo-aviso")).toBe("Esperando la confirmación por correo");
        expect(texto("texto-aviso")).toContain("m•••••@gmail.com");
        expect(texto("texto-aviso")).toContain("N-0412");
        expect(texto("texto-aviso")).not.toContain("maria.lopez");
        expect(texto("estado-correo")).toBe("Pendiente · m•••••@gmail.com");
        expect(texto("fecha-escaneo")).toBe("12 nov · 18:40");
        expect(visible("boton-reenviar")).toBe(true);
        expect(visible("boton-vincular-de-nuevo")).toBe(false);
        expect(visible("indicadores")).toBe(false);
    });

    test("rechazada lo dice y deja volver a vincular", async () => {
        await cargarCon("rechazada");

        expect(document.getElementById("aviso-vinculacion").classList.contains("aviso-rechazada")).toBe(true);
        expect(texto("titulo-aviso")).toBe("Vinculación rechazada");
        expect(texto("estado-nodo")).toBe("No se ha podido vincular el sensor N-0412.");
        expect(texto("estado-correo")).toBe("Rechazada");
        expect(visible("boton-reenviar")).toBe(false);
        expect(visible("boton-vincular-de-nuevo")).toBe(true);
        expect(document.getElementById("boton-vincular-de-nuevo").getAttribute("href")).toBe("vincular.html");
    });

    test("caducada lo dice y deja volver a vincular", async () => {
        await cargarCon("caducada");

        expect(texto("titulo-aviso")).toBe("La vinculación ha caducado");
        expect(texto("estado-correo")).toBe("Caducada");
        expect(visible("boton-vincular-de-nuevo")).toBe(true);
    });

    test("confirmada enseña los datos como siempre", async () => {
        iniciarSesion(LAURA);
        await cuenta.cargarCuenta(new LogicaCuentaFake(0, AHORA, null), jest.fn());

        expect(visible("indicadores")).toBe(true);
        expect(visible("vista-sin-sensor")).toBe(false);
        expect(visible("aviso-vinculacion")).toBe(false);
        expect(visible("accesos")).toBe(false);
    });

    test("si el servidor aún no tiene la ruta (null), la página sigue como antes", async () => {
        iniciarSesion(LAURA);
        const logica = new LogicaCuentaFake(0, AHORA, null);
        logica.obtenerVinculacion = async () => ({ correcto: true, vinculacion: null, error: "" });
        await cuenta.cargarCuenta(logica, jest.fn());

        expect(visible("indicadores")).toBe(true);
        expect(visible("accesos")).toBe(false);
    });
});

describe("reenviarCorreo()", () => {
    test("si va bien lo confirma con el correo enmascarado", async () => {
        const { logica } = await cargarCon("pendiente");

        expect(await cuenta.reenviarCorreo(logica)).toBe(true);
        expect(visible("resultado-reenvio")).toBe(true);
        expect(texto("resultado-reenvio")).toBe("Te lo hemos vuelto a enviar a m•••••@gmail.com.");
        expect(document.getElementById("boton-reenviar").disabled).toBe(false);
    });

    test("si falla enseña el error", async () => {
        const { logica } = await cargarCon("pendiente");
        logica.reenviarCorreo = async () => ({ correcto: false, emailConfirmacion: null, error: "Espera unos minutos" });

        expect(await cuenta.reenviarCorreo(logica)).toBe(false);
        expect(texto("resultado-reenvio")).toBe("Espera unos minutos");
        expect(document.getElementById("resultado-reenvio").classList.contains("error")).toBe(true);
    });
});

describe("LogicaCuentaReal · vinculación (rutas de T005)", () => {
    const respuesta = (status, cuerpo) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });

    beforeEach(() => iniciarSesion(LAURA));
    afterEach(() => { delete global.fetch; });

    test("GET /estadoVinculacion con el token y los nombres del servidor", async () => {
        global.fetch = jest.fn(async () => respuesta(200, {
            numeroSerie: "092021010920", correoComprador: "p•••••@upv.edu.es",
            estado: "pendiente", fecha: "2026-11-12T17:40:00.000Z"
        }));
        const r = await new LogicaCuentaReal("").obtenerVinculacion();

        expect(global.fetch.mock.calls[0][0]).toBe("/estadoVinculacion");
        expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer t");
        expect(r.vinculacion).toEqual({
            estado: "pendiente", nodo: "092021010920", emailConfirmacion: "p•••••@upv.edu.es",
            fechaSolicitud: "2026-11-12T17:40:00.000Z", caducaEn: "2026-11-14T17:40:00.000Z"
        });
    });

    test("con 404 (no ha pedido vincular ninguno) el usuario está sin sensor", async () => {
        global.fetch = jest.fn(async () => respuesta(404, { error: "No has pedido vincular ningún sensor" }));
        const r = await new LogicaCuentaReal("").obtenerVinculacion();
        expect(r.correcto).toBe(true);
        expect(r.vinculacion.estado).toBe("sin_sensor");
    });

    test("POST /reenviarCorreoVinculacion y sus errores", async () => {
        global.fetch = jest.fn(async () => respuesta(200, { mensaje: "Correo reenviado" }));
        expect(await new LogicaCuentaReal("").reenviarCorreo()).toEqual({ correcto: true, emailConfirmacion: null, error: "" });
        expect(global.fetch.mock.calls[0][0]).toBe("/reenviarCorreoVinculacion");
        expect(global.fetch.mock.calls[0][1].method).toBe("POST");

        global.fetch = jest.fn(async () => respuesta(404, {}));
        expect((await new LogicaCuentaReal("").reenviarCorreo()).error).toBe("No hay ninguna vinculación pendiente");

        global.fetch = jest.fn(async () => { throw new Error("sin red"); });
        expect((await new LogicaCuentaReal("").reenviarCorreo()).error).toBe("No se puede conectar con el servidor");
    });

    test("si el servidor no devuelve el correo, la página usa el que ya enseñaba", async () => {
        const { logica } = await cargarCon("pendiente");
        logica.reenviarCorreo = async () => ({ correcto: true, emailConfirmacion: null, error: "" });

        await cuenta.reenviarCorreo(logica, "p•••••@upv.edu.es");
        expect(texto("resultado-reenvio")).toBe("Te lo hemos vuelto a enviar a p•••••@upv.edu.es.");
        await cuenta.reenviarCorreo(logica);
        expect(texto("resultado-reenvio")).toBe("Te lo hemos vuelto a enviar.");
    });
});