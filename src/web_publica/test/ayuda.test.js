/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas de la página Ayuda (T042 · H038)
// Criterios de validación:
// 1. La página muestra las preguntas frecuentes, el formulario y Mis incidencias.
// 2. Con el mensaje vacío no se envía.
// 3. Cada incidencia muestra su estado y la respuesta.
// 4. Sigue los diseños de Figma.
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { LogicaAyudaFake, CLAVE_SESION_AYUDA } = require("../js/logica_ayuda_fake");
const ayuda = require("../js/ayuda");

const html = fs.readFileSync(path.join(__dirname, "../ayuda.html"), "utf8");

const USUARIO_PRUEBA = {
    id: 2,
    nombre: "Laura Martínez",
    correo: "laura@correo.es",
    rol: "PORTADOR",
    token: "token-de-prueba"
};

beforeEach(() => {
    document.documentElement.innerHTML = html
        .replace(/^[\s\S]*<html[^>]*>/, "")
        .replace(/<\/html>[\s\S]*$/, "");
    sessionStorage.clear();
});

describe("Criterio 1: Estructura de la página Ayuda", () => {
    test("muestra las preguntas frecuentes (FAQ)", () => {
        const seccionFaq = document.querySelector(".seccion-faq");
        expect(seccionFaq).not.toBeNull();
        const items = document.querySelectorAll(".faq-item");
        expect(items.length).toBeGreaterThanOrEqual(4);
    });

    test("muestra el formulario para enviar una incidencia", () => {
        const form = document.getElementById("formulario-incidencia");
        expect(form).not.toBeNull();
        expect(document.getElementById("tipo-incidencia")).not.toBeNull();
        expect(document.getElementById("asunto-incidencia")).not.toBeNull();
        expect(document.getElementById("descripcion-incidencia")).not.toBeNull();
        expect(document.getElementById("boton-enviar")).not.toBeNull();
    });

    test("muestra la sección de Mis incidencias", () => {
        const contenedor = document.getElementById("contenedor-mis-incidencias");
        expect(contenedor).not.toBeNull();
    });
});

describe("Criterio 2: Validación de formulario (Con el mensaje vacío no se envía)", () => {
    test("validarIncidencia() rechaza descripción vacía o de solo espacios", () => {
        const r1 = ayuda.validarIncidencia({ asunto: "Avería", descripcion: "" });
        expect(r1.valido).toBe(false);
        expect(r1.campo).toBe("descripcion");

        const r2 = ayuda.validarIncidencia({ asunto: "Avería", descripcion: "    " });
        expect(r2.valido).toBe(false);
        expect(r2.campo).toBe("descripcion");
    });

    test("validarIncidencia() rechaza asunto vacío", () => {
        const r = ayuda.validarIncidencia({ asunto: "   ", descripcion: "Explicación válida" });
        expect(r.valido).toBe(false);
        expect(r.campo).toBe("asunto");
    });

    test("validarIncidencia() acepta asunto y descripción completos", () => {
        const r = ayuda.validarIncidencia({ asunto: "Avería sensor", descripcion: "No enciende el LED" });
        expect(r.valido).toBe(true);
        expect(r.error).toBe("");
    });

    test("enviarIncidenciaFormulario() no envía si el mensaje está vacío y muestra error", async () => {
        const logica = new LogicaAyudaFake(0);
        sessionStorage.setItem(CLAVE_SESION_AYUDA, JSON.stringify(USUARIO_PRUEBA));

        document.getElementById("asunto-incidencia").value = "Asunto de prueba";
        document.getElementById("descripcion-incidencia").value = "   "; // mensaje vacío

        const enviado = await ayuda.enviarIncidenciaFormulario(null, logica);
        expect(enviado).toBe(false);

        const errorMsg = document.getElementById("error-formulario");
        expect(errorMsg.classList.contains("oculto")).toBe(false);
        expect(document.getElementById("descripcion-incidencia").classList.contains("error")).toBe(true);

        // Comprobar que en la lógica fake no se añadió ninguna incidencia
        const mis = await logica.obtenerMisIncidencias();
        expect(mis.incidencias.some(i => i.asunto === "Asunto de prueba")).toBe(false);
    });

    test("enviarIncidenciaFormulario() envía correctamente cuando los campos son válidos", async () => {
        const logica = new LogicaAyudaFake(0);
        sessionStorage.setItem(CLAVE_SESION_AYUDA, JSON.stringify(USUARIO_PRUEBA));

        document.getElementById("asunto-incidencia").value = "Batería dura poco";
        document.getElementById("descripcion-incidencia").value = "Se descarga en solo 2 horas.";

        const enviado = await ayuda.enviarIncidenciaFormulario(null, logica);
        expect(enviado).toBe(true);

        const exitoMsg = document.getElementById("exito-formulario");
        expect(exitoMsg.classList.contains("oculto")).toBe(false);
        expect(document.getElementById("asunto-incidencia").value).toBe("");
        expect(document.getElementById("descripcion-incidencia").value).toBe("");

        // Comprobar que la nueva incidencia aparece en la lista renderizada
        const contenedor = document.getElementById("contenedor-mis-incidencias");
        expect(contenedor.textContent).toContain("Batería dura poco");
    });
});

describe("Criterio 3: Cada incidencia muestra su estado y la respuesta", () => {
    test("textoEstado() mapea 'abierta', 'en curso' y 'resuelta'", () => {
        expect(ayuda.textoEstado("abierta").texto).toBe("Abierta");
        expect(ayuda.textoEstado("abierta").clase).toBe("abierta");

        expect(ayuda.textoEstado("en curso").texto).toBe("En curso");
        expect(ayuda.textoEstado("en curso").clase).toBe("en-curso");

        expect(ayuda.textoEstado("resuelta").texto).toBe("Resuelta");
        expect(ayuda.textoEstado("resuelta").clase).toBe("resuelta");
    });

    test("pintarIncidencias() renderiza el estado y la respuesta", () => {
        const contenedor = document.createElement("div");
        const lista = [
            {
                idIncidencia: 10,
                tipo: "sensor",
                asunto: "Sensor bloqueado",
                descripcion: "El botón no reacciona.",
                estado: "resuelta",
                respuesta: "Solucionado reiniciando el dispositivo.",
                responsable: { nombre: "Marc", rol: "técnico" },
                fechaCreacion: "2026-11-16T10:00:00Z",
                fechaRespuesta: "2026-11-16T12:00:00Z"
            },
            {
                idIncidencia: 11,
                tipo: "datos",
                asunto: "Duda de calibración",
                descripcion: "¿Cada cuánto se calibra?",
                estado: "en curso",
                respuesta: null,
                responsable: null,
                fechaCreacion: "2026-11-17T09:00:00Z",
                fechaRespuesta: null
            }
        ];

        ayuda.pintarIncidencias(contenedor, lista);

        // Tarjeta 1 (resuelta con respuesta)
        const tarjetaResuelta = contenedor.querySelector('[data-id="10"]');
        expect(tarjetaResuelta).not.toBeNull();
        expect(tarjetaResuelta.querySelector(".etiqueta-estado").textContent).toBe("Resuelta");
        expect(tarjetaResuelta.querySelector(".asunto-incidencia").textContent).toBe("Sensor bloqueado");
        expect(tarjetaResuelta.querySelector(".descripcion-incidencia").textContent).toBe("El botón no reacciona.");

        const bloqueResp = tarjetaResuelta.querySelector(".bloque-respuesta");
        expect(bloqueResp).not.toBeNull();
        expect(bloqueResp.textContent).toContain("Marc (técnico)");
        expect(bloqueResp.textContent).toContain("Solucionado reiniciando el dispositivo.");

        // Tarjeta 2 (en curso sin respuesta)
        const tarjetaEnCurso = contenedor.querySelector('[data-id="11"]');
        expect(tarjetaEnCurso).not.toBeNull();
        expect(tarjetaEnCurso.querySelector(".etiqueta-estado").textContent).toBe("En curso");
        expect(tarjetaEnCurso.querySelector(".pendiente-respuesta")).not.toBeNull();
    });

    test("pintarIncidencias() muestra mensaje si la lista está vacía", () => {
        const contenedor = document.createElement("div");
        ayuda.pintarIncidencias(contenedor, []);
        expect(contenedor.querySelector(".sin-incidencias").textContent)
            .toContain("Aún no has enviado ninguna incidencia");
    });
});

describe("Criterio 4: Comportamiento de sesión y diseño", () => {
    test("cargarMisIncidencias() avisa si el usuario no tiene sesión", async () => {
        const logica = new LogicaAyudaFake(0);
        sessionStorage.clear();

        await ayuda.cargarMisIncidencias(logica);

        const aviso = document.getElementById("aviso-sin-sesion");
        expect(aviso.classList.contains("oculto")).toBe(false);
        const contenedor = document.getElementById("contenedor-mis-incidencias");
        expect(contenedor.textContent).toContain("Inicia sesión");
    });

    test("cargarMisIncidencias() carga las incidencias si hay sesión", async () => {
        const logica = new LogicaAyudaFake(0);
        sessionStorage.setItem(CLAVE_SESION_AYUDA, JSON.stringify(USUARIO_PRUEBA));

        await ayuda.cargarMisIncidencias(logica);

        const aviso = document.getElementById("aviso-sin-sesion");
        expect(aviso.classList.contains("oculto")).toBe(true);

        const contenedor = document.getElementById("contenedor-mis-incidencias");
        const tarjetas = contenedor.querySelectorAll(".tarjeta-incidencia");
        expect(tarjetas.length).toBe(2);
    });
});
