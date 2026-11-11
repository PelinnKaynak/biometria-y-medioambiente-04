/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas de la página Mi cuenta (T018 · H035)
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { LogicaCuentaFake } = require("../js/logica_cuenta_fake");
const cuenta = require("../js/mi_cuenta");

const html = fs.readFileSync(path.join(__dirname, "../mi_cuenta.html"), "utf8");
const AHORA = new Date(2026, 10, 8, 12, 0);
const visible = id => !document.getElementById(id).classList.contains("oculto");
const texto = id => document.getElementById(id).textContent;
const SESION = { id: 2, nombre: "Laura", correo: "laura@correo.es", rol: "portador", token: "t" };

beforeEach(() => {
    document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/, "").replace(/<\/html>[\s\S]*$/, "");
    sessionStorage.clear();
});

describe("formato", () => {
    test("nivelOzono() usa 100 y 180 µg/m³ como límites", () => {
        expect(cuenta.nivelOzono(62).texto).toBe("Bueno");
        expect(cuenta.nivelOzono(100).texto).toBe("Bueno");
        expect(cuenta.nivelOzono(118).texto).toBe("Moderado");
        expect(cuenta.nivelOzono(180).texto).toBe("Moderado");
        expect(cuenta.nivelOzono(186).texto).toBe("Malo");
    });

    test("formatearNumero() pone punto de miles", () => {
        expect(cuenta.formatearNumero(1284)).toBe("1.284");
        expect(cuenta.formatearNumero(950)).toBe("950");
        expect(cuenta.formatearNumero(1234567)).toBe("1.234.567");
    });

    test("formatearFecha() con y sin hora", () => {
        const fecha = new Date(2026, 10, 2, 8, 5).toISOString();
        expect(cuenta.formatearFecha(fecha)).toBe("2 nov");
        expect(cuenta.formatearFecha(fecha, true)).toBe("2 nov · 08:05");
    });

    test("textoHace() en minutos, horas y días", () => {
        const hace = min => new Date(AHORA.getTime() - min * 60000).toISOString();
        expect(cuenta.textoHace(hace(1), AHORA)).toBe("hace 1 minuto");
        expect(cuenta.textoHace(hace(5), AHORA)).toBe("hace 5 minutos");
        expect(cuenta.textoHace(hace(120), AHORA)).toBe("hace 2 horas");
        expect(cuenta.textoHace(hace(60 * 72), AHORA)).toBe("hace 3 días");
    });

    test("textoVariacion() compara con el mes anterior", () => {
        expect(cuenta.textoVariacion(1284, 1146, AHORA)).toBe("12 % más que en octubre");
        expect(cuenta.textoVariacion(900, 1000, AHORA)).toBe("10 % menos que en octubre");
        expect(cuenta.textoVariacion(50, 0, AHORA)).toBe("Primer mes con mediciones");
    });

    test("nombreCorto() y textoPlan()", () => {
        expect(cuenta.nombreCorto("Laura", "martínez")).toBe("Laura M.");
        expect(cuenta.nombreCorto("Laura", "")).toBe("Laura");
        expect(cuenta.textoPlan({ premiumHasta: null }, AHORA)).toBe("Gratuito");
        expect(cuenta.textoPlan({ premiumHasta: "2026-12-31T00:00:00Z" }, AHORA)).toBe("Premium hasta el 31 dic");
        expect(cuenta.textoPlan({ premiumHasta: "2026-01-01T00:00:00Z" }, AHORA)).toBe("Gratuito");
    });
});

describe("calcularGrafica()", () => {
    const puntos = [60, 120, 186, 90].map((ozono, i) => ({ fecha: new Date(2026, 9, 26 + i).toISOString(), ozono }));

    test("encuentra el máximo y lo coloca en porcentaje", () => {
        const g = cuenta.calcularGrafica(puntos);
        expect(g.maximoY).toBe(240);
        expect(g.maximo.punto.ozono).toBe(186);
        expect(g.maximo.x).toBeCloseTo(66.7, 1);
        expect(g.maximo.y).toBeCloseTo((1 - 186 / 240) * 100, 1);
    });

    test("sube el eje si hay valores por encima de 240", () => {
        expect(cuenta.calcularGrafica([{ fecha: puntos[0].fecha, ozono: 250 }]).maximoY).toBe(300);
    });

    test("pone como mucho 5 fechas en el eje x", () => {
        expect(cuenta.calcularGrafica(puntos).etiquetasX.map(e => e.texto)).toEqual(["26 oct", "27 oct", "28 oct", "29 oct"]);
        const mes = Array.from({ length: 30 }, (_, i) => ({ fecha: new Date(2026, 9, 1 + i).toISOString(), ozono: 80 }));
        expect(cuenta.calcularGrafica(mes).etiquetasX).toHaveLength(5);
    });
});

describe("cargarCuenta()", () => {
    test("sin sesión lleva al inicio de sesión", async () => {
        const irA = jest.fn();
        expect(await cuenta.cargarCuenta(new LogicaCuentaFake(0, AHORA), irA)).toBeNull();
        expect(irA).toHaveBeenCalledWith("login.html");
    });

    test("con sesión pinta el perfil, los indicadores y la gráfica", async () => {
        sessionStorage.setItem("aeris_usuario", JSON.stringify(SESION));
        const irA = jest.fn();

        const estado = await cuenta.cargarCuenta(new LogicaCuentaFake(0, AHORA), irA);

        expect(irA).not.toHaveBeenCalled();
        expect(estado.perfil.nombre).toBe("Laura");
        expect(texto("saludo")).toBe("Hola, Laura");
        expect(texto("nombre-cabecera")).toBe("Laura M.");
        expect(texto("avatar")).toBe("L");
        expect(texto("dato-mediciones")).toBe("1.284");
        expect(texto("dato-exposicion")).toBe("86 µg/m³");
        expect(texto("texto-recompensas")).toBe("Te faltan 650 puntos para el nivel Guardián");
        expect(document.querySelectorAll("#lista-lugares li")).toHaveLength(3);
        expect(document.querySelectorAll("#tabla-mediciones tr")).toHaveLength(4);
        expect(document.querySelector("#svg-grafica path")).not.toBeNull();
        expect(visible("sin-datos")).toBe(false);
        expect(visible("cargando")).toBe(false);
    });

    test("sin datos del sensor muestra el aviso y oculta los indicadores", async () => {
        sessionStorage.setItem("aeris_usuario", JSON.stringify(SESION));
        const logica = new LogicaCuentaFake(0, AHORA);
        logica.obtenerResumen = async () => ({ correcto: true, resumen: null, error: "" });

        await cuenta.cargarCuenta(logica, jest.fn());

        expect(visible("sin-datos")).toBe(true);
        expect(visible("indicadores")).toBe(false);
        expect(visible("tarjeta-grafica")).toBe(false);
        expect(texto("perfil-correo")).toBe("laura@correo.es");
    });

    test("si la sesión ha caducado la cierra y vuelve al login", async () => {
        sessionStorage.setItem("aeris_usuario", JSON.stringify(SESION));
        const logica = new LogicaCuentaFake(0, AHORA);
        logica.obtenerPerfil = async () => ({ correcto: false, perfil: null, error: "caducada", sinSesion: true });
        const irA = jest.fn();

        await cuenta.cargarCuenta(logica, irA);

        expect(irA).toHaveBeenCalledWith("login.html");
        expect(sessionStorage.getItem("aeris_usuario")).toBeNull();
    });

    test("si el servidor falla enseña el error", async () => {
        sessionStorage.setItem("aeris_usuario", JSON.stringify(SESION));
        const logica = new LogicaCuentaFake(0, AHORA);
        logica.obtenerPerfil = async () => ({ correcto: false, perfil: null, error: "No se puede conectar con el servidor", sinSesion: false });

        await cuenta.cargarCuenta(logica, jest.fn());

        expect(visible("error-carga")).toBe(true);
        expect(texto("error-carga")).toBe("No se puede conectar con el servidor");
    });
});

describe("cambiarPeriodo()", () => {
    test("marca el botón y pinta tantos días como el periodo", async () => {
        sessionStorage.setItem("aeris_usuario", JSON.stringify(SESION));
        const logica = new LogicaCuentaFake(0, AHORA);
        await cuenta.cargarCuenta(logica, jest.fn());
        const espia = jest.spyOn(logica, "obtenerExposicion");

        await cuenta.cambiarPeriodo(logica, "semana");

        expect(espia).toHaveBeenCalledWith("semana");
        expect(document.querySelector("[data-periodo=semana]").classList.contains("activo")).toBe(true);
        expect(document.querySelector("[data-periodo=mes]").classList.contains("activo")).toBe(false);
        expect(document.querySelector("#svg-grafica path").getAttribute("d").split("L")).toHaveLength(7);
    });

    test("sin mediciones en el periodo lo dice", async () => {
        sessionStorage.setItem("aeris_usuario", JSON.stringify(SESION));
        const logica = new LogicaCuentaFake(0, AHORA);
        await cuenta.cargarCuenta(logica, jest.fn());
        logica.obtenerExposicion = async () => ({ correcto: true, puntos: [], error: "" });

        await cuenta.cambiarPeriodo(logica, "3meses");

        expect(visible("grafica-vacia")).toBe(true);
    });
});

describe("editar perfil", () => {
    async function abrir() {
        sessionStorage.setItem("aeris_usuario", JSON.stringify(SESION));
        const logica = new LogicaCuentaFake(0, AHORA);
        const estado = await cuenta.cargarCuenta(logica, jest.fn());
        cuenta.abrirEdicion(estado.perfil);
        return { logica, estado };
    }
    const evento = () => ({ preventDefault: jest.fn() });

    test("rellena el formulario con los datos actuales", async () => {
        await abrir();
        expect(document.getElementById("editar-nombre").value).toBe("Laura");
        expect(document.getElementById("editar-correo").value).toBe("laura@correo.es");
    });

    test("valida el formato antes de llamar a la lógica", async () => {
        const { logica, estado } = await abrir();
        const espia = jest.spyOn(logica, "actualizarDatos");
        document.getElementById("editar-correo").value = "laura@";

        await cuenta.guardarPerfil(evento(), logica, estado);

        expect(espia).not.toHaveBeenCalled();
        expect(visible("error-perfil")).toBe(true);
        expect(document.getElementById("editar-correo").classList.contains("error")).toBe(true);
    });

    test("avisa si el correo es de otra cuenta", async () => {
        const { logica, estado } = await abrir();
        document.getElementById("editar-correo").value = "admin@aeris.es";

        await cuenta.guardarPerfil(evento(), logica, estado);

        expect(texto("error-perfil")).toBe("Ya hay otra cuenta con ese correo");
        expect(document.getElementById("editar-correo").classList.contains("error")).toBe(true);
    });

    test("al guardar actualiza la página y la sesión", async () => {
        const { logica, estado } = await abrir();
        document.getElementById("editar-nombre").value = "Lara";
        document.getElementById("editar-apellidos").value = "Pons";

        await cuenta.guardarPerfil(evento(), logica, estado);

        expect(texto("perfil-nombre")).toBe("Lara Pons");
        expect(texto("nombre-cabecera")).toBe("Lara P.");
        expect(JSON.parse(sessionStorage.getItem("aeris_usuario")).nombre).toBe("Lara");
    });
});

describe("cabecera", () => {
    test("el botón del menú lo abre y lo cierra, y Salir cierra la sesión", () => {
        sessionStorage.setItem("aeris_usuario", JSON.stringify(SESION));
        const logica = new LogicaCuentaFake(0, AHORA);
        const irA = jest.fn();
        cuenta.conectarCabecera(logica, irA);

        document.getElementById("boton-menu").click();
        expect(document.getElementById("menu-cuenta").classList.contains("abierto")).toBe(true);
        document.getElementById("boton-menu").click();
        expect(document.getElementById("menu-cuenta").classList.contains("abierto")).toBe(false);

        document.querySelector("[data-salir]").click();
        expect(sessionStorage.getItem("aeris_usuario")).toBeNull();
        expect(irA).toHaveBeenCalledWith("login.html");
    });
});

test("sin datos el perfil ocupa la rejilla él solo", async () => {
    sessionStorage.setItem("aeris_usuario", JSON.stringify(SESION));
    const logica = new LogicaCuentaFake(0, AHORA);
    logica.obtenerResumen = async () => ({ correcto: true, resumen: null, error: "" });
    await cuenta.cargarCuenta(logica, jest.fn());
    expect(document.querySelector(".rejilla-cuenta").classList.contains("solo-perfil")).toBe(true);
});