/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas del registro de usuario en la web (T034 · H001)
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { LogicaFake } = require("../js/logica_fake");
const registro = require("../js/registro");

const html = fs.readFileSync(path.join(__dirname, "../registro.html"), "utf8");
const eventoFalso = () => ({ preventDefault: jest.fn() });
const visible = id => !document.getElementById(id).classList.contains("oculto");
const tieneError = id => document.getElementById(id).classList.contains("error");

function rellenar(datos) {
    const completos = Object.assign({
        nombre: "Marta", apellidos: "Ribes Soler", correo: "marta@correo.es",
        contrasena: "aeris2026", repetida: "aeris2026"
    }, datos);
    for (const [id, valor] of Object.entries(completos)) {
        document.getElementById(id).value = valor;
    }
}

beforeEach(() => {
    document.documentElement.innerHTML = new DOMParser()
        .parseFromString(html, "text/html").documentElement.innerHTML;
    sessionStorage.clear();
});

describe("validarRegistro()", () => {
    const datos = extra => Object.assign(
        { nombre: "José Luis", apellidos: "García-Ortega", correo: "jl@correo.es", contrasena: "aeris2026" }, extra);

    test("acepta datos correctos", () => {
        expect(registro.validarRegistro(datos(), "aeris2026")).toEqual([]);
    });

    test("rechaza números en el nombre y en los apellidos", () => {
        const errores = registro.validarRegistro(datos({ nombre: "Jose2", apellidos: "G_O" }), "aeris2026");
        expect(errores.map(e => e.campo)).toEqual(["nombre", "apellidos"]);
    });

    test("rechaza una contraseña sin números", () => {
        const errores = registro.validarRegistro(datos({ contrasena: "sinnumeros" }), "sinnumeros");
        expect(errores).toEqual([{ campo: "contrasena",
            mensaje: "La contraseña debe tener al menos 8 caracteres, con al menos una letra y un número" }]);
    });

    test("avisa si las contraseñas no coinciden", () => {
        expect(registro.validarRegistro(datos(), "aeris2027")).toEqual([
            { campo: "repetida", mensaje: "Las dos contraseñas no coinciden" }
        ]);
    });
});

describe("enviarRegistro()", () => {
    test("crea la cuenta, deja la sesión iniciada y lleva a Mi cuenta", async () => {
        const logica = new LogicaFake(0);
        const irA = jest.fn();
        rellenar({});

        await registro.enviarRegistro(eventoFalso(), logica, irA);

        expect(irA).toHaveBeenCalledWith("mi_cuenta.html");
        expect(logica.usuarioActual()).toMatchObject({ correo: "marta@correo.es", rol: "PORTADOR" });
        const login = await logica.iniciarSesion({ correo: "marta@correo.es", contrasena: "aeris2026" });
        expect(login.correcto).toBe(true);
    });

    test("con datos mal escritos marca los campos y no llama a la lógica", async () => {
        const logica = { registrarUsuario: jest.fn() };
        rellenar({ nombre: "", correo: "marta@" });

        await registro.enviarRegistro(eventoFalso(), logica, jest.fn());

        expect(logica.registrarUsuario).not.toHaveBeenCalled();
        expect(tieneError("nombre")).toBe(true);
        expect(tieneError("correo")).toBe(true);
        expect(document.getElementById("texto-error").textContent).toBe("Escribe tu nombre");
    });

    test("si el correo ya tiene cuenta, ofrece iniciar sesión o recuperar la contraseña", async () => {
        const irA = jest.fn();
        rellenar({ correo: "laura@correo.es" });

        await registro.enviarRegistro(eventoFalso(), new LogicaFake(0), irA);

        expect(irA).not.toHaveBeenCalled();
        expect(tieneError("correo")).toBe(true);
        expect(visible("ayuda-correo-repetido")).toBe(true);
    });
});

describe("alternarVisibilidadRegistro()", () => {
    test("muestra solo el campo de su botón", () => {
        registro.alternarVisibilidadRegistro(document.querySelector('.boton-ojo[data-campo="contrasena"]'));
        expect(document.getElementById("contrasena").type).toBe("text");
        expect(document.getElementById("repetida").type).toBe("password");
    });
});