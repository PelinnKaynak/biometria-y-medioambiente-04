/** @jest-environment jsdom */

const fs = require("fs");
const path = require("path");
const { LogicaCuentaFake, CLAVE_VINCULACION_FAKE } = require("../js/logica_cuenta_fake");
const { LogicaCuentaReal } = require("../js/logica_cuenta_real");
const { leerCodigoSensor, mostrarSensorLeido, confirmarVinculacion, iniciarVincularSensor } =
    require("../js/vincular");

const html = fs.readFileSync(path.join(__dirname, "../vincular.html"), "utf8");
const AHORA = new Date("2026-11-19T12:00:00Z");
const USUARIO = { id: 7, nombre: "Ana", correo: "ana@correo.es", rol: "portador", token: "token-prueba" };
const CODIGO = "092021010920 110406 03 2109 -44.75";
const SENSOR = leerCodigoSensor(CODIGO);

function cargarPagina() {
    document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/, "").replace(/<\/html>[\s\S]*$/, "");
}

function iniciarSesion() {
    sessionStorage.setItem("aeris_usuario", JSON.stringify(USUARIO));
}

beforeEach(() => {
    cargarPagina();
    sessionStorage.clear();
    iniciarSesion();
});

afterEach(() => {
    delete global.fetch;
});

describe("leerCodigoSensor()", () => {
    test("lee serie, modelo, gas, fecha y sensibilidad del código completo", () => {
        expect(SENSOR).toEqual({
            numeroSerie: "092021010920",
            modelo: "110406",
            gas: "03",
            fecha: "2109",
            fechaFabricacion: "09/2021",
            sensibilidad: -44.75
        });
    });

    test("acepta una serie escrita sin los demás datos del código", () => {
        expect(leerCodigoSensor(" 092021010920 ")).toMatchObject({
            numeroSerie: "092021010920",
            fechaFabricacion: null,
            sensibilidad: null
        });
    });

    test.each([
        "",
        "123",
        "092021010920 110406 03 2199 -44.75",
        "092021010920 110406 03 2109 NaN"
    ])("rechaza un código incompleto o no válido: %s", codigo => {
        expect(leerCodigoSensor(codigo)).toBeNull();
    });
});

describe("pantalla Vincular sensor", () => {
    test("muestra la lectura antes de solicitar el vínculo", () => {
        mostrarSensorLeido(SENSOR);

        expect(document.getElementById("paso-entrada").classList.contains("oculto")).toBe(true);
        expect(document.getElementById("paso-sensor").classList.contains("oculto")).toBe(false);
        expect(document.getElementById("serie-leida").textContent).toBe("092021010920");
        expect(document.getElementById("fecha-leida").textContent).toBe("09/2021");
    });

    test("el formulario vacío no solicita vincular", () => {
        const solicitarVinculacion = jest.fn();
        iniciarVincularSensor({ usuarioActual: () => USUARIO, solicitarVinculacion }, jest.fn());
        document.getElementById("formulario-codigo").dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true }));

        expect(solicitarVinculacion).not.toHaveBeenCalled();
        expect(document.getElementById("error-codigo").textContent).toContain("no es válido");
    });

    test("la web permite escribir el código, pero no solicita acceso a la cámara", () => {
        expect(document.getElementById("codigo-etiqueta")).not.toBeNull();
        expect(document.getElementById("boton-escanear")).toBeNull();
        expect(document.getElementById("video-escaner")).toBeNull();
        expect(document.querySelector(".texto-ayuda").textContent).toContain("utiliza la app AERIS");
    });

    test("si el API acepta la solicitud, vuelve a Mi cuenta", async () => {
        const irA = jest.fn();
        const logica = { solicitarVinculacion: jest.fn(async () => ({ correcto: true })) };

        await expect(confirmarVinculacion(logica, SENSOR, irA)).resolves.toBe(true);
        expect(logica.solicitarVinculacion).toHaveBeenCalledWith(SENSOR);
        expect(irA).toHaveBeenCalledWith("mi_cuenta.html");
    });

    test.each([
        ["no registrado", "Este sensor no está registrado"],
        ["de otra cuenta", "Este sensor ya está vinculado"]
    ])("muestra el error del sensor %s", async (_caso, mensaje) => {
        const irA = jest.fn();
        const logica = {
            solicitarVinculacion: jest.fn(async () => ({ correcto: false, error: mensaje }))
        };

        await expect(confirmarVinculacion(logica, SENSOR, irA)).resolves.toBe(false);
        expect(document.getElementById("error-vincular").textContent).toBe(mensaje);
        expect(irA).not.toHaveBeenCalled();
    });

});

describe("lógica de vinculación", () => {
    test("la lógica real envía serie y sensibilidad con la sesión", async () => {
        global.fetch = jest.fn(async () => ({
            ok: true,
            status: 201,
            json: async () => ({ estado: "pendiente", numeroSerie: SENSOR.numeroSerie })
        }));
        const logica = new LogicaCuentaReal("/api");

        const resultado = await logica.solicitarVinculacion(SENSOR);

        expect(resultado.correcto).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith("/api/solicitarVinculacion", {
            method: "POST",
            headers: { Authorization: "Bearer token-prueba", "Content-Type": "application/json" },
            body: JSON.stringify({ numeroSerie: SENSOR.numeroSerie, sensibilidad: -44.75 })
        });
    });

    test.each([
        [404, "no está registrado"],
        [409, "vinculado a otra cuenta"]
    ])("la API traduce el error HTTP %i", async (status, mensaje) => {
        global.fetch = jest.fn(async () => ({ ok: false, status }));

        const resultado = await new LogicaCuentaReal("").solicitarVinculacion(SENSOR);

        expect(resultado.correcto).toBe(false);
        expect(resultado.error).toContain(mensaje);
    });

    test("la lógica fake guarda el estado pendiente para Mi cuenta", async () => {
        const logica = new LogicaCuentaFake(0, AHORA, null);

        const resultado = await logica.solicitarVinculacion(SENSOR);

        expect(resultado).toMatchObject({ correcto: true, solicitud: { estado: "pendiente" } });
        expect(JSON.parse(sessionStorage.getItem(CLAVE_VINCULACION_FAKE))).toMatchObject({
            estado: "pendiente",
            nodo: SENSOR.numeroSerie,
            fechaSolicitud: AHORA.toISOString()
        });
    });

    test("la lógica fake distingue sensor desconocido y sensor ya vinculado", async () => {
        const logica = new LogicaCuentaFake(0, AHORA, null);

        await expect(logica.solicitarVinculacion({ numeroSerie: "111111111111" }))
            .resolves.toMatchObject({ correcto: false, error: expect.stringContaining("no está registrado") });
        await expect(logica.solicitarVinculacion({ numeroSerie: "999999999999" }))
            .resolves.toMatchObject({ correcto: false, error: expect.stringContaining("otra cuenta") });
    });
});
