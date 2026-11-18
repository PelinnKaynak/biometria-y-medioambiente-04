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
    [403, "Tu cuenta no tiene permiso para hacer esto"],
    [500, "Ha habido un error. Inténtalo de nuevo"]
])("con %i devuelve «%s»", async (status, mensaje) => {
    fetch.mockReturnValue(respuestaFalsa(status, {}));
    const r = await new LogicaAdminReal("").obtenerResumenNodos();
    expect(r).toEqual({ correcto: false, resumen: null, error: mensaje });
});

describe("usuarios", () => {
    test("obtenerUsuarios() pide GET /usuarios con el filtro", async () => {
        fetch.mockReturnValue(respuestaFalsa(200, { usuarios: [], total: 0 }));
        await new LogicaAdminReal("").obtenerUsuarios({ busqueda: "ana", grupo: "tecnicos", estado: "activo", pagina: 1, porPagina: 10 });
        expect(fetch.mock.calls[0][0]).toBe("/usuarios?busqueda=ana&grupo=tecnicos&estado=activo&pagina=1&porPagina=10");
    });

    test("crearUsuario() hace POST /usuarios y devuelve los campos erróneos", async () => {
        fetch.mockReturnValue(respuestaFalsa(400, { error: "Datos no válidos", campos: ["nombre"] }));
        const r = await new LogicaAdminReal("").crearUsuario({ nombre: "1", apellidos: "B", correo: "a@b.es", rol: "tecnico" });

        const [url, opciones] = fetch.mock.calls[0];
        expect(url).toBe("/usuarios");
        expect(opciones.method).toBe("POST");
        expect(opciones.headers["Content-Type"]).toBe("application/json");
        expect(r).toEqual({ correcto: false, error: "Datos no válidos", campos: ["nombre"] });
    });

    test("crearUsuario() con 409 marca el correo", async () => {
        fetch.mockReturnValue(respuestaFalsa(409, { error: "El correo ya tiene una cuenta" }));
        const r = await new LogicaAdminReal("").crearUsuario({ nombre: "A", apellidos: "B", correo: "a@b.es", rol: "tecnico" });
        expect(r.campos).toEqual(["correo"]);
    });

    test("cambiarRol() hace PATCH /usuarios/:id/rol", async () => {
        fetch.mockReturnValue(respuestaFalsa(204));
        const r = await new LogicaAdminReal("").cambiarRol(5, "tecnico");
        expect(fetch.mock.calls[0][0]).toBe("/usuarios/5/rol");
        expect(fetch.mock.calls[0][1].method).toBe("PATCH");
        expect(r.correcto).toBe(true);
    });

    test("darDeBaja() hace POST /usuarios/baja con los ids", async () => {
        fetch.mockReturnValue(respuestaFalsa(204));
        await new LogicaAdminReal("").darDeBaja([3, 4]);
        expect(fetch.mock.calls[0][0]).toBe("/usuarios/baja");
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ ids: [3, 4] });
    });
});

describe("incidencias", () => {
    test("obtenerIncidencias() envía filtros válidos y omite «todos»", async () => {
        fetch.mockReturnValue(respuestaFalsa(200, []));
        const logica = new LogicaAdminReal("");
        await logica.obtenerIncidencias({ estado: "en curso", tipo: "datos" });
        expect(fetch.mock.calls[0][0]).toBe("/incidencias?estado=en+curso&tipo=datos");

        await logica.obtenerIncidencias({ estado: "todos", tipo: "todos" });
        expect(fetch.mock.calls[1][0]).toBe("/incidencias");
    });

    test("obtenerIncidencia() y obtenerNumeroIncidenciasAbiertas() usan sus rutas", async () => {
        fetch.mockReturnValueOnce(respuestaFalsa(200, { idIncidencia: 7 }))
            .mockReturnValueOnce(respuestaFalsa(200, { abiertas: 3 }));
        const logica = new LogicaAdminReal("");
        expect((await logica.obtenerIncidencia(7)).incidencia.idIncidencia).toBe(7);
        expect((await logica.obtenerNumeroIncidenciasAbiertas()).abiertas).toBe(3);
        expect(fetch.mock.calls.map(llamada => llamada[0])).toEqual([
            "/incidencia?id=7", "/numeroIncidenciasAbiertas"
        ]);
    });

    test("responderIncidencia() envía la respuesta y el nuevo estado", async () => {
        fetch.mockReturnValue(respuestaFalsa(200, { idIncidencia: 7, estado: "en curso" }));
        const logica = new LogicaAdminReal("");
        const resultado = await logica.responderIncidencia({
            idIncidencia: 7, respuesta: "Lo estamos revisando", estado: "en curso"
        });
        const [url, opciones] = fetch.mock.calls[0];
        expect(url).toBe("/responderIncidencia");
        expect(opciones.method).toBe("POST");
        expect(JSON.parse(opciones.body)).toEqual({
            idIncidencia: 7, respuesta: "Lo estamos revisando", estado: "en curso"
        });
        expect(resultado.incidencia.estado).toBe("en curso");
    });
});