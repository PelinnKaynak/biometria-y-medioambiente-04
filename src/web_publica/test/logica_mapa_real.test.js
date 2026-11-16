/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas de LogicaMapaReal con fetch falso
// (GET /mediciones, ruta propuesta para T017)
// ------------------------------------------------------------

const { LogicaMapaReal } = require("../js/logica_mapa_real");

const respuesta = (status, cuerpo) =>
    Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(cuerpo) });

beforeEach(() => {
    sessionStorage.clear();
    global.fetch = jest.fn();
});

test("pide las mediciones del contaminante", async () => {
    fetch.mockReturnValue(respuesta(200, [{ municipio: "Gandia", valor: 84 }]));
    const r = await new LogicaMapaReal("").obtenerMediciones("O3");
    expect(fetch.mock.calls[0][0]).toBe("/mediciones?contaminante=O3");
    expect(r).toEqual({ correcto: true, mediciones: [{ municipio: "Gandia", valor: 84 }], error: "" });
});

test("con 404 devuelve la lista vacía", async () => {
    fetch.mockReturnValue(respuesta(404, {}));
    expect(await new LogicaMapaReal("").obtenerMediciones("O3")).toEqual({ correcto: true, mediciones: [], error: "" });
});

test("con error del servidor o sin conexión lo dice", async () => {
    fetch.mockReturnValue(respuesta(500, {}));
    expect((await new LogicaMapaReal("").obtenerMediciones("O3")).correcto).toBe(false);
    fetch.mockRejectedValue(new Error("red"));
    expect((await new LogicaMapaReal("").obtenerMediciones("O3")).error).toBe("No se puede conectar con el servidor");
});

test("usuarioActual() lee la sesión guardada", () => {
    expect(new LogicaMapaReal("").usuarioActual()).toBeNull();
    sessionStorage.setItem("aeris_usuario", JSON.stringify({ rol: "portador" }));
    expect(new LogicaMapaReal("").usuarioActual().rol).toBe("portador");
});