/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas de LogicaCuentaReal con fetch falso.
// /usuarioActual y /actualizarDatos son rutas del servidor
// (T016, T010); /miCuenta y /miExposicion son las propuestas
// para T024.
// ------------------------------------------------------------

const { LogicaCuentaReal } = require("../js/logica_cuenta_real");

function respuestaFalsa(status, cuerpo) {
    return Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(cuerpo) });
}

const SESION = { id: 7, nombre: "Laura", correo: "laura@correo.es", rol: "portador", token: "abc" };

beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem("aeris_usuario", JSON.stringify(SESION));
    global.fetch = jest.fn();
});

test("obtenerPerfil() llama a GET /usuarioActual con el token", async () => {
    fetch.mockReturnValue(respuestaFalsa(200, {
        idUsuario: 7, nombre: "Laura", apellidos: "Martínez", correo: "laura@correo.es",
        rol: "portador", alertas: 1, premiumHasta: null, foto: null
    }));

    const r = await new LogicaCuentaReal("").obtenerPerfil();

    expect(fetch.mock.calls[0][0]).toBe("/usuarioActual");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer abc");
    expect(r.correcto).toBe(true);
    expect(r.perfil).toMatchObject({ nombre: "Laura", apellidos: "Martínez", alertas: true });
});

test("obtenerPerfil() con 401 indica que no hay sesión", async () => {
    fetch.mockReturnValue(respuestaFalsa(401, {}));
    const r = await new LogicaCuentaReal("").obtenerPerfil();
    expect(r).toMatchObject({ correcto: false, sinSesion: true });
});

test("obtenerPerfil() sin sesión guardada no llama al servidor", async () => {
    sessionStorage.clear();
    const r = await new LogicaCuentaReal("").obtenerPerfil();
    expect(fetch).not.toHaveBeenCalled();
    expect(r.sinSesion).toBe(true);
});

test("obtenerResumen() con 404 (T024 sin hacer) devuelve resumen vacío", async () => {
    fetch.mockReturnValue(respuestaFalsa(404, { error: "Ruta no encontrada" }));
    const r = await new LogicaCuentaReal("").obtenerResumen();
    expect(fetch.mock.calls[0][0]).toBe("/miCuenta");
    expect(r).toEqual({ correcto: true, resumen: null, error: "" });
});

test("obtenerExposicion() pasa el periodo en la dirección", async () => {
    fetch.mockReturnValue(respuestaFalsa(200, [{ fecha: "2026-11-01T12:00:00Z", ozono: 90 }]));
    const r = await new LogicaCuentaReal("").obtenerExposicion("semana");
    expect(fetch.mock.calls[0][0]).toBe("/miExposicion?periodo=semana");
    expect(r.puntos).toHaveLength(1);
});

test("actualizarDatos() llama a POST /actualizarDatos y actualiza la sesión", async () => {
    fetch.mockReturnValue(respuestaFalsa(200, { nombre: "Lara", apellidos: "Pons", correo: "lara@correo.es" }));

    const r = await new LogicaCuentaReal("").actualizarDatos({ nombre: "Lara", apellidos: "Pons", correo: "lara@correo.es" });

    expect(fetch.mock.calls[0][0]).toBe("/actualizarDatos");
    expect(fetch.mock.calls[0][1].method).toBe("POST");
    expect(r.correcto).toBe(true);
    expect(JSON.parse(sessionStorage.getItem("aeris_usuario"))).toMatchObject({ nombre: "Lara", correo: "lara@correo.es", token: "abc" });
});

test("actualizarDatos() con 409 marca el correo", async () => {
    fetch.mockReturnValue(respuestaFalsa(409, { error: "Correo en uso" }));
    const r = await new LogicaCuentaReal("").actualizarDatos({ nombre: "Lara", apellidos: "Pons", correo: "admin@aeris.es" });
    expect(r).toMatchObject({ correcto: false, error: "Ya hay otra cuenta con ese correo", campos: ["correo"] });
});

test("sin conexión lo dice", async () => {
    fetch.mockRejectedValue(new Error("red"));
    const r = await new LogicaCuentaReal("").obtenerPerfil();
    expect(r.error).toBe("No se puede conectar con el servidor");
});