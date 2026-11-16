/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas de la pantalla de contraseña nueva (T013 · H002)
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { LogicaFake, TOKEN_PRUEBA } = require("../js/logica_fake");
const restablecer = require("../js/restablecer");

const html = fs.readFileSync(path.join(__dirname, "../restablecer.html"), "utf8");
const eventoFalso = () => ({ preventDefault: jest.fn() });
const visible = id => !document.getElementById(id).classList.contains("oculto");

function rellenar(nueva, repetida) {
    document.getElementById("contrasena").value = nueva;
    document.getElementById("repetida").value = repetida;
}

beforeEach(() => {
    document.documentElement.innerHTML = new DOMParser()
        .parseFromString(html, "text/html").documentElement.innerHTML;
});

describe("leerToken()", () => {
    test("saca el token de la dirección", () => {
        expect(restablecer.leerToken("?token=abc.123")).toBe("abc.123");
    });

    test("devuelve vacío si no hay token", () => {
        expect(restablecer.leerToken("")).toBe("");
    });
});

describe("validarContrasenas()", () => {
    test("acepta dos contraseñas iguales y con formato correcto", () => {
        expect(restablecer.validarContrasenas("nueva1234", "nueva1234")).toEqual([]);
    });

    test("rechaza una contraseña sin números", () => {
        expect(restablecer.validarContrasenas("sinnumeros", "sinnumeros")[0].campo).toBe("contrasena");
    });

    test("rechaza dos contraseñas distintas", () => {
        expect(restablecer.validarContrasenas("nueva1234", "nueva12345")).toEqual([
            { campo: "repetida", mensaje: "Las dos contraseñas no coinciden" }
        ]);
    });
});

describe("guardarContrasena()", () => {
    test("con un token válido cambia la contraseña y muestra la confirmación", async () => {
        const logica = new LogicaFake(0);
        rellenar("nueva1234", "nueva1234");

        await restablecer.guardarContrasena(eventoFalso(), logica, TOKEN_PRUEBA);

        expect(visible("paso-hecho")).toBe(true);
        const r = await logica.iniciarSesion({ correo: "laura@correo.es", contrasena: "nueva1234" });
        expect(r.correcto).toBe(true);
    });

    test("con un token caducado muestra el error y el enlace para pedir otro", async () => {
        rellenar("nueva1234", "nueva1234");

        await restablecer.guardarContrasena(eventoFalso(), new LogicaFake(0), "token-caducado");

        expect(visible("mensaje-error")).toBe(true);
        expect(visible("enlace-pedir-otro")).toBe(true);
        expect(visible("paso-hecho")).toBe(false);
    });

    test("sin token no llama a la lógica", async () => {
        const logica = { restablecerContrasena: jest.fn() };
        rellenar("nueva1234", "nueva1234");

        await restablecer.guardarContrasena(eventoFalso(), logica, "");

        expect(logica.restablecerContrasena).not.toHaveBeenCalled();
        expect(visible("enlace-pedir-otro")).toBe(true);
    });

    test("si las contraseñas no coinciden marca el segundo campo", async () => {
        const logica = { restablecerContrasena: jest.fn() };
        rellenar("nueva1234", "otra1234");

        await restablecer.guardarContrasena(eventoFalso(), logica, TOKEN_PRUEBA);

        expect(logica.restablecerContrasena).not.toHaveBeenCalled();
        expect(document.getElementById("repetida").classList.contains("error")).toBe(true);
    });
});

describe("alternarVisibilidad()", () => {
    test("muestra solo el campo de su botón", () => {
        const boton = document.querySelector('.boton-ojo[data-campo="repetida"]');
        restablecer.alternarVisibilidad(boton);

        expect(document.getElementById("repetida").type).toBe("text");
        expect(document.getElementById("contrasena").type).toBe("password");
    });
});