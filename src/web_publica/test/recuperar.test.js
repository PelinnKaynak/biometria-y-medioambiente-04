/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas de recuperar contraseña (T013 · H002)
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { LogicaFake } = require("../js/logica_fake");
const recuperar = require("../js/recuperar");

const html = fs.readFileSync(path.join(__dirname, "../recuperar.html"), "utf8");
const eventoFalso = () => ({ preventDefault: jest.fn() });
const visible = id => !document.getElementById(id).classList.contains("oculto");

beforeEach(() => {
  document.documentElement.innerHTML = new DOMParser()
    .parseFromString(html, "text/html").documentElement.innerHTML;
});

describe("enviarSolicitud()", () => {
  test("con un correo válido pide el enlace y muestra la confirmación", async () => {
    const logica = new LogicaFake(0);
    document.getElementById("correo").value = "laura@correo.es";

    await recuperar.enviarSolicitud(eventoFalso(), logica);

    expect(logica.solicitudes).toEqual(["laura@correo.es"]);
    expect(visible("paso-formulario")).toBe(false);
    expect(visible("paso-enviado")).toBe(true);
    expect(document.getElementById("correo-enviado").textContent).toBe("laura@correo.es");
  });

  test("también confirma con un correo que no está registrado", async () => {
    const logica = new LogicaFake(0);
    document.getElementById("correo").value = "nadie@correo.es";

    await recuperar.enviarSolicitud(eventoFalso(), logica);

    expect(visible("paso-enviado")).toBe(true);
  });

  test("con un correo mal escrito muestra el error y no llama a la lógica", async () => {
    const logica = { solicitarRecuperacion: jest.fn() };
    document.getElementById("correo").value = "laura@correo";

    await recuperar.enviarSolicitud(eventoFalso(), logica);

    expect(logica.solicitarRecuperacion).not.toHaveBeenCalled();
    expect(visible("mensaje-error")).toBe(true);
    expect(document.getElementById("correo").classList.contains("error")).toBe(true);
    expect(visible("paso-formulario")).toBe(true);
  });

  test("si el servidor falla, se queda en el formulario con el error", async () => {
    const logica = {
      solicitarRecuperacion: jest.fn().mockResolvedValue({
        correcto: false, error: "No se puede conectar con el servidor"
      })
    };
    document.getElementById("correo").value = "laura@correo.es";

    await recuperar.enviarSolicitud(eventoFalso(), logica);

    expect(document.getElementById("texto-error").textContent)
      .toBe("No se puede conectar con el servidor");
    expect(visible("paso-enviado")).toBe(false);
  });
});

describe("reenviarEnlace()", () => {
  test("vuelve a pedir el enlace para el mismo correo", async () => {
    const logica = new LogicaFake(0);
    recuperar.mostrarPasoEnviado("laura@correo.es");

    await recuperar.reenviarEnlace(logica);

    expect(logica.solicitudes).toEqual(["laura@correo.es"]);
    expect(visible("aviso-reenviado")).toBe(true);
  });
});
