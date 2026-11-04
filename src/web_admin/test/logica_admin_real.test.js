/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas de LogicaAdminReal con un servidor simulado
// ------------------------------------------------------------

const { LogicaAdminReal } = require("../js/logica_admin_real");

const respuestaFalsa = (status, cuerpo) => Promise.resolve({
    status, ok: status >= 200 && status < 300, json: () => Promise.resolve(cuerpo)
});

beforeEach(() => {
    sessionStorage.setItem("aeris_usuario", JSON.stringify({ rol: "administrador", token: "tok123" }));
    global.fetch = jest.fn();
});

test("obtenerNodos() pide GET /nodos con el filtro y el token", async () => {
    fetch.mockReturnValue(respuestaFalsa(200, { nodos: [{ id: "N-1" }], total: 1 }));
    const r = await new LogicaAdminReal("").obtenerNodos({ busqueda: "lau", estado: "inactivos", pagina: 2, porPagina: 10 });

    const [url, opciones] = fetch.mock.calls[0];
    expect(url).toBe("/nodos?busqueda=lau&estado=inactivos&pagina=2&porPagina=10");
    expect(opciones.headers.Authorization).toBe("Bearer tok123");
    expect(r).toEqual({ correcto: true, nodos: [{ id: "N-1" }], total: 1, error: "" });
});

test("obtenerResumenNodos() pide GET /nodos/resumen", async () => {
    fetch.mockReturnValue(respuestaFalsa(200, { total: 3, activos: 2, inactivos24h: 1, inactivos7d: 0, porCalibrar: 0 }));
    const r = await new LogicaAdminReal("").obtenerResumenNodos();

    expect(fetch.mock.calls[0][0]).toBe("/nodos/resumen");
    expect(r.resumen.total).toBe(3);
});

test("obtenerNodosMapa() pide GET /nodos/mapa", async () => {
    fetch.mockReturnValue(respuestaFalsa(200, { nodos: [], total: 0 }));
    await new LogicaAdminReal("").obtenerNodosMapa({ busqueda: "", estado: "todos" });

    expect(fetch.mock.calls[0][0]).toMatch(/^\/nodos\/mapa\?/);
});

test.each([
    [401, "La sesión ha caducado. Vuelve a iniciar sesión"],
    [403, "Tu cuenta no tiene permiso para ver los nodos"],
    [500, "Ha habido un error. Inténtalo de nuevo"]
])("con %i devuelve «%s»", async (status, mensaje) => {
    fetch.mockReturnValue(respuestaFalsa(status, {}));
    const r = await new LogicaAdminReal("").obtenerResumenNodos();
    expect(r).toEqual({ correcto: false, resumen: null, error: mensaje });
});
