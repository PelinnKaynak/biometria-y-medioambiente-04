/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas del panel de nodos (T014 · H011, H012)
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { LogicaAdminFake } = require("../js/logica_admin_fake");
const comun = require("../js/admin_comun");
const panelNodos = require("../js/panel_nodos");

const html = fs.readFileSync(path.join(__dirname, "../panel_nodos.html"), "utf8");
const AHORA = new Date("2026-11-04T12:00:00Z");
const haceMinutos = m => new Date(AHORA.getTime() - m * 60000).toISOString();

beforeEach(() => {
    document.documentElement.innerHTML = new DOMParser()
        .parseFromString(html, "text/html").documentElement.innerHTML;
    sessionStorage.clear();
    Object.assign(panelNodos.panel.filtro, { busqueda: "", estado: "todos", pagina: 1 });
});

describe("control de acceso", () => {
    test.each([
        [{ rol: "administrador" }, true],
        [{ rol: "TECNICO" }, true],
        [{ rol: "portador" }, false],
        [null, false]
    ])("usuario %p → acceso %p", (usuario, acceso) => {
        expect(comun.tieneAccesoAdmin(usuario)).toBe(acceso);
    });

    test("sin sesión manda al inicio de sesión", () => {
        const irA = jest.fn();
        expect(comun.comprobarAcceso(new LogicaAdminFake(5, AHORA, 0), irA)).toBe(false);
        expect(irA).toHaveBeenCalledWith("../web_publica/login.html");
    });

    test("un portador no puede entrar", () => {
        sessionStorage.setItem("aeris_usuario", JSON.stringify({ rol: "portador" }));
        const irA = jest.fn();
        comun.comprobarAcceso(new LogicaAdminFake(5, AHORA, 0), irA);
        expect(irA).toHaveBeenCalled();
    });

    test("Salir cierra la sesión y vuelve al login", () => {
        sessionStorage.setItem("aeris_usuario", JSON.stringify({ rol: "administrador" }));
        const logica = new LogicaAdminFake(5, AHORA, 0);
        const irA = jest.fn();
        comun.conectarMenu(logica, irA);

        document.getElementById("boton-salir").click();

        expect(logica.usuarioActual()).toBeNull();
        expect(irA).toHaveBeenCalledWith("../web_publica/login.html");
    });

    test("el botón ☰ abre el menú y la X lo cierra", () => {
        comun.conectarMenu(new LogicaAdminFake(5, AHORA, 0), jest.fn());
        const menu = document.getElementById("menu-lateral");

        document.getElementById("boton-menu").click();
        expect(menu.classList.contains("abierto")).toBe(true);
        document.getElementById("boton-cerrar-menu").click();
        expect(menu.classList.contains("abierto")).toBe(false);
    });
});

describe("crearFilaNodo()", () => {
    const nodo = (minutos, extra = {}) => Object.assign({
        id: "N-0412", portador: "Laura Martínez", ultimaMedicion: haceMinutos(minutos),
        bateria: 78, latitud: 39, longitud: -0.2, necesitaCalibrar: false
    }, extra);

    test("muestra identificador, portador, tiempo sin datos y batería", () => {
        const fila = panelNodos.crearFilaNodo(nodo(120), AHORA);
        expect(fila.querySelector(".celda-id").textContent).toBe("N-0412");
        expect(fila.querySelector(".celda-portador").textContent).toBe("Laura Martínez");
        expect(fila.querySelector(".celda-tiempo").textContent).toBe("2 h");
        expect(fila.querySelector(".celda-bateria").textContent).toBe("78 %");
        expect(fila.classList.contains("inactivo")).toBe(false);
    });

    test("marca como inactivo un nodo con más de 24 horas sin datos", () => {
        const fila = panelNodos.crearFilaNodo(nodo(3000), AHORA);
        expect(fila.classList.contains("inactivo")).toBe(true);
        expect(fila.querySelector(".celda-aviso").textContent).toBe("Inactivo");
    });

    test("avisa de calibrar y de batería baja", () => {
        const fila = panelNodos.crearFilaNodo(nodo(10, { necesitaCalibrar: true, bateria: 12 }), AHORA);
        expect(fila.querySelector(".celda-aviso").textContent).toBe("Calibrar");
        expect(fila.querySelector(".celda-bateria").classList.contains("bateria-baja")).toBe(true);
    });
});

describe("textoPaginacion()", () => {
    test.each([
        [1, 10, 1248, "1-10 de 1.248"],
        [3, 10, 25, "21-25 de 25"],
        [1, 10, 0, "0 de 0"]
    ])("página %i de %i (total %i) → %s", (pagina, porPagina, total, texto) => {
        expect(panelNodos.textoPaginacion(pagina, porPagina, total)).toBe(texto);
    });
});

describe("cargarPanel()", () => {
    test("pinta los totales, la primera página y la paginación", async () => {
        await panelNodos.cargarPanel(new LogicaAdminFake(64, AHORA, 0), AHORA);

        expect(document.getElementById("dato-total").textContent).toBe("64");
        expect(document.querySelectorAll(".fila-nodo")).toHaveLength(10);
        expect(document.getElementById("texto-paginacion").textContent).toBe("1-10 de 64");
        expect(document.getElementById("boton-anterior").disabled).toBe(true);
    });

    test("«Ver más» añade la página siguiente a la lista", async () => {
        const logica = new LogicaAdminFake(64, AHORA, 0);
        await panelNodos.cargarNodos(logica, AHORA);
        panelNodos.panel.filtro.pagina = 2;
        await panelNodos.cargarNodos(logica, AHORA, true);

        expect(document.querySelectorAll(".fila-nodo")).toHaveLength(20);
    });

    test("sin resultados muestra el aviso", async () => {
        panelNodos.panel.filtro.busqueda = "no existe";
        await panelNodos.cargarNodos(new LogicaAdminFake(64, AHORA, 0), AHORA);

        expect(document.getElementById("sin-resultados").classList.contains("oculto")).toBe(false);
    });

    test("si el servidor falla muestra el error", async () => {
        const logica = {
            obtenerResumenNodos: async () => ({ correcto: false, error: "No se puede conectar con el servidor" }),
            obtenerNodos: async () => ({ correcto: false, nodos: [], total: 0, error: "No se puede conectar con el servidor" }),
            obtenerNodosMapa: async () => ({ correcto: false, nodos: [], total: 0, error: "" })
        };
        await panelNodos.cargarPanel(logica, AHORA);

        expect(document.getElementById("aviso-error").textContent).toBe("No se puede conectar con el servidor");
    });
});

describe("mostrarVistaMovil()", () => {
    test("cambia entre lista y mapa", () => {
        panelNodos.mostrarVistaMovil("mapa");
        expect(document.getElementById("zona-datos").dataset.vista).toBe("mapa");
        expect(document.querySelector('.pestana[data-vista="mapa"]').classList.contains("activa")).toBe(true);
    });
});