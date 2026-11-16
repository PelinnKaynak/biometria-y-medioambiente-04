/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas de LogicaReal con el servidor simulado (fetch falso).
// Comprueban que se usan las rutas y respuestas de la T016
// (doc/servidor_rest_design.md).
// ------------------------------------------------------------

const { LogicaReal } = require("../js/logica_real");

function respuestaFalsa(status, cuerpo) {
    return Promise.resolve({
        status,
        ok: status >= 200 && status < 300,
        json: () => Promise.resolve(cuerpo)
    });
}

beforeEach(() => {
    sessionStorage.clear();
    global.fetch = jest.fn();
});

test("iniciarSesion() llama a POST /iniciarSesion y guarda la sesión", async () => {
    fetch.mockReturnValue(respuestaFalsa(200, { idUsuario: 7, token: "abc", rol: "portador", nombre: "Laura" }));
    const logica = new LogicaReal("");

    const r = await logica.iniciarSesion({ correo: "Laura@Correo.es", contrasena: "laura1234" });

    expect(fetch.mock.calls[0][0]).toBe("/iniciarSesion");
    expect(fetch.mock.calls[0][1].method).toBe("POST");
    expect(r.correcto).toBe(true);
    expect(r.usuario).toEqual({ id: 7, nombre: "Laura", correo: "laura@correo.es", rol: "portador", token: "abc" });
    expect(logica.usuarioActual().token).toBe("abc");
});

test("iniciarSesion() con 401 devuelve el error de credenciales", async () => {
    fetch.mockReturnValue(respuestaFalsa(401, { error: "Correo o contraseña incorrectos" }));
    const r = await new LogicaReal("").iniciarSesion({ correo: "a@b.es", contrasena: "mala1234" });

    expect(r.correcto).toBe(false);
    expect(r.error).toBe("Correo o contraseña incorrectos");
});

test("sin conexión devuelve un error claro", async () => {
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const r = await new LogicaReal("").solicitarRecuperacion("a@b.es");

    expect(r).toEqual({ correcto: false, error: "No se puede conectar con el servidor" });
});

test("solicitarRecuperacion() llama a POST /solicitarRecuperacion", async () => {
    fetch.mockReturnValue(respuestaFalsa(200, {}));
    const r = await new LogicaReal("").solicitarRecuperacion("a@b.es");

    expect(fetch.mock.calls[0][0]).toBe("/solicitarRecuperacion");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ correo: "a@b.es" });
    expect(r.correcto).toBe(true);
});

test("restablecerContrasena() llama a POST /restablecerContrasenya", async () => {
    fetch.mockReturnValue(respuestaFalsa(204));
    const r = await new LogicaReal("").restablecerContrasena("tok", "nueva1234");

    expect(fetch.mock.calls[0][0]).toBe("/restablecerContrasenya");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ token: "tok", contrasena: "nueva1234" });
    expect(r.correcto).toBe(true);
});

test("restablecerContrasena() con 400 dice que el enlace no vale", async () => {
    fetch.mockReturnValue(respuestaFalsa(400, { error: "Token no válido" }));
    const r = await new LogicaReal("").restablecerContrasena("tok", "nueva1234");

    expect(r.correcto).toBe(false);
    expect(r.error).toMatch(/enlace/);
});

describe("registrarUsuario()", () => {
    const datos = { nombre: "Marta", apellidos: "Ribes", correo: "Marta@Correo.es", contrasena: "aeris2026" };

    test("hace POST /registrarUsuario y guarda la sesión", async () => {
        fetch.mockReturnValue(respuestaFalsa(201, { idUsuario: 9, token: "t9", rol: "portador", nombre: "Marta" }));
        const logica = new LogicaReal("");
        const r = await logica.registrarUsuario(datos);

        expect(fetch.mock.calls[0][0]).toBe("/registrarUsuario");
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(datos);
        expect(r.correcto).toBe(true);
        expect(logica.usuarioActual()).toEqual({ id: 9, nombre: "Marta", correo: "marta@correo.es", rol: "portador", token: "t9" });
    });

    test("con 409 avisa de que el correo ya tiene cuenta", async () => {
        fetch.mockReturnValue(respuestaFalsa(409, { error: "El correo ya tiene una cuenta" }));
        const r = await new LogicaReal("").registrarUsuario(datos);
        expect(r).toMatchObject({ correcto: false, campos: ["correo"], correoRepetido: true });
    });

    test("con 400 devuelve los campos que marca el servidor", async () => {
        fetch.mockReturnValue(respuestaFalsa(400, { error: "Datos de registro no válidos", campos: ["nombre", "contrasena"] }));
        const r = await new LogicaReal("").registrarUsuario(datos);
        expect(r.campos).toEqual(["nombre", "contrasena"]);
    });
});

test("solicitarRecuperacion() avisa si el correo no tiene cuenta (404)", async () => {
    fetch.mockReturnValue(respuestaFalsa(404, { error: "No existe" }));
    const r = await new LogicaReal("").solicitarRecuperacion("nadie@correo.es");
    expect(r).toEqual({ correcto: false, error: "No hay ninguna cuenta con ese correo" });
});