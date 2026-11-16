/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas del mapa público (mapa.html, T012)
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { LogicaMapaFake } = require("../js/logica_mapa_fake");
const inicio = require("../js/inicio");

const html = fs.readFileSync(path.join(__dirname, "../mapa.html"), "utf8");
const AHORA = new Date(2026, 10, 8, 18, 50);
const texto = id => document.getElementById(id).textContent;
const visible = id => !document.getElementById(id).classList.contains("oculto");

function estadoInicial() {
    return { contaminante: "O3", mediciones: [], tipos: ["ciudadano", "oficial"], zona: { ...inicio.ZONA_POR_DEFECTO }, ahora: AHORA };
}

beforeEach(() => {
    document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/, "").replace(/<\/html>[\s\S]*$/, "");
    sessionStorage.clear();
});

describe("nivelContaminante()", () => {
    test.each([
        ["O3", 84, "Bueno"], ["O3", 100, "Bueno"], ["O3", 150, "Moderado"], ["O3", 196, "Malo"], ["O3", 260, "Muy malo"],
        ["NO2", 18, "Bueno"], ["NO2", 92, "Malo"], ["PM10", 31, "Moderado"], ["CO", 0.4, "Bueno"], ["CO", 12, "Muy malo"]
    ])("%s con %p es %s", (contaminante, valor, nivel) => {
        expect(inicio.nivelContaminante(contaminante, valor).texto).toBe(nivel);
    });
});

describe("distancias y búsqueda", () => {
    const mediciones = [
        { municipio: "Gandia", lat: 38.967, lon: -0.181 },
        { municipio: "Valencia", lat: 39.470, lon: -0.376 },
        { municipio: "Castelló de la Plana", lat: 39.986, lon: -0.051 }
    ];

    test("distanciaKm() entre Gandia y Valencia ronda los 58 km", () => {
        expect(inicio.distanciaKm(mediciones[0], mediciones[1])).toBeCloseTo(58, -1);
    });

    test("medicionMasCercana() elige la más próxima", () => {
        expect(inicio.medicionMasCercana(mediciones, { lat: 39.4, lon: -0.4 }).municipio).toBe("Valencia");
        expect(inicio.medicionMasCercana([], { lat: 0, lon: 0 })).toBeNull();
    });

    test("buscarMunicipio() no tiene en cuenta mayúsculas ni tildes", () => {
        expect(inicio.buscarMunicipio("castello", mediciones).municipio).toBe("Castelló de la Plana");
        expect(inicio.buscarMunicipio("VALENCIA", mediciones).municipio).toBe("Valencia");
        expect(inicio.buscarMunicipio("gan", mediciones).municipio).toBe("Gandia");
        expect(inicio.buscarMunicipio("Lugo", mediciones)).toBeNull();
        expect(inicio.buscarMunicipio("  ", mediciones)).toBeNull();
    });

    test("listaMunicipios() quita repetidos y ordena", () => {
        expect(inicio.listaMunicipios([...mediciones, mediciones[0]])).toEqual(["Castelló de la Plana", "Gandia", "Valencia"]);
    });

    test("filtrarPorTipo() deja solo las capas marcadas", () => {
        const m = [{ tipo: "ciudadano" }, { tipo: "oficial" }];
        expect(inicio.filtrarPorTipo(m, ["oficial"])).toEqual([{ tipo: "oficial" }]);
    });
});

describe("textos", () => {
    test("textoActualizado() hoy, ayer y otro día", () => {
        expect(inicio.textoActualizado(new Date(2026, 10, 8, 18, 42).toISOString(), AHORA)).toBe("Actualizado hoy a las 18:42");
        expect(inicio.textoActualizado(new Date(2026, 10, 7, 9, 5).toISOString(), AHORA)).toBe("Actualizado ayer a las 9:05");
        expect(inicio.textoActualizado(new Date(2026, 10, 3, 9, 5).toISOString(), AHORA)).toBe("Actualizado el 3 nov a las 9:05");
    });

    test("accesoCabecera() según la sesión", () => {
        expect(inicio.accesoCabecera(null)).toEqual({ texto: "Acceder", url: "login.html" });
        expect(inicio.accesoCabecera({ rol: "portador" })).toEqual({ texto: "Mi cuenta", url: "mi_cuenta.html" });
        expect(inicio.accesoCabecera({ rol: "administrador" }).url).toBe("../web_admin/panel_nodos.html");
    });

    test("pintarCabecera() cambia el botón Acceder", () => {
        inicio.pintarCabecera({ rol: "portador" });
        expect(texto("boton-acceder")).toBe("Mi cuenta");
        expect(document.getElementById("boton-acceder").getAttribute("href")).toBe("mi_cuenta.html");
    });
});

describe("cambiarContaminante() y Tu zona", () => {
    test("con ozono muestra la medición de Gandia", async () => {
        const estado = estadoInicial();
        const pintar = jest.fn();

        await inicio.cambiarContaminante(new LogicaMapaFake(0, AHORA), estado, "O3", pintar);

        expect(pintar).toHaveBeenCalled();
        expect(texto("titulo-zona")).toBe("Tu zona ahora · Gandia");
        expect(texto("nivel-zona")).toBe("Bueno");
        expect(texto("valor-zona")).toBe("Ozono: 84 µg/m³");
        expect(document.querySelector("[data-contaminante=O3]").classList.contains("activo")).toBe(true);
        expect(document.querySelectorAll("#lista-municipios option").length).toBeGreaterThan(10);
        expect(visible("aviso-mapa")).toBe(false);
    });

    test("al cambiar a NO2 marca el botón y usa sus límites", async () => {
        const estado = estadoInicial();
        await inicio.cambiarContaminante(new LogicaMapaFake(0, AHORA), estado, "NO2", jest.fn());
        expect(document.querySelector("[data-contaminante=NO2]").getAttribute("aria-pressed")).toBe("true");
        expect(document.querySelector("[data-contaminante=O3]").getAttribute("aria-pressed")).toBe("false");
        expect(texto("valor-zona")).toBe("NO₂: 18 µg/m³");
    });

    test("sin estaciones oficiales no hay NO2 y lo dice", async () => {
        const estado = estadoInicial();
        estado.tipos = ["ciudadano"];
        await inicio.cambiarContaminante(new LogicaMapaFake(0, AHORA), estado, "NO2", jest.fn());
        expect(texto("nivel-zona")).toBe("Sin datos");
    });

    test("si la medición más cercana está lejos dice dónde se midió", async () => {
        const estado = estadoInicial();
        estado.zona = { municipio: "Xàtiva", lat: 38.99, lon: -0.52 };
        await inicio.cambiarContaminante(new LogicaMapaFake(0, AHORA), estado, "O3", jest.fn());
        expect(texto("valor-zona")).toMatch(/\(medido en /);
    });

    test("sin mediciones (servidor sin T017) avisa en el mapa", async () => {
        const estado = estadoInicial();
        const logica = { obtenerMediciones: async () => ({ correcto: true, mediciones: [], error: "" }) };
        await inicio.cambiarContaminante(logica, estado, "O3", jest.fn());
        expect(visible("aviso-mapa")).toBe(true);
        expect(texto("aviso-mapa")).toBe("Todavía no hay mediciones para mostrar en el mapa.");
    });

    test("si falla el servidor enseña el error", async () => {
        const estado = estadoInicial();
        const logica = { obtenerMediciones: async () => ({ correcto: false, mediciones: [], error: "No se puede conectar con el servidor" }) };
        await inicio.cambiarContaminante(logica, estado, "O3", jest.fn());
        expect(texto("aviso-mapa")).toBe("No se puede conectar con el servidor");
    });
});

describe("buscar()", () => {
    test("un municipio con mediciones pasa a ser Tu zona y mueve el mapa", async () => {
        const estado = estadoInicial();
        await inicio.cambiarContaminante(new LogicaMapaFake(0, AHORA), estado, "O3", jest.fn());
        const irAPunto = jest.fn();

        expect(inicio.buscar(estado, "alicante", irAPunto)).toBe(true);

        expect(texto("titulo-zona")).toBe("Tu zona ahora · Alicante");
        expect(texto("nivel-zona")).toBe("Malo");
        expect(irAPunto).toHaveBeenCalledWith(expect.objectContaining({ municipio: "Alicante" }));
    });

    test("un municipio sin mediciones avisa y no mueve el mapa", async () => {
        const estado = estadoInicial();
        await inicio.cambiarContaminante(new LogicaMapaFake(0, AHORA), estado, "O3", jest.fn());
        const irAPunto = jest.fn();

        expect(inicio.buscar(estado, "Lugo", irAPunto)).toBe(false);

        expect(texto("aviso-buscar")).toBe("No hay mediciones en «Lugo»");
        expect(irAPunto).not.toHaveBeenCalled();
    });
});

describe("LogicaMapaFake", () => {
    test("los sensores ciudadanos solo miden ozono", async () => {
        const logica = new LogicaMapaFake(0, AHORA);
        const ozono = await logica.obtenerMediciones("O3");
        const no2 = await logica.obtenerMediciones("NO2");
        expect(ozono.mediciones.some(m => m.tipo === "ciudadano")).toBe(true);
        expect(no2.mediciones.every(m => m.tipo === "oficial")).toBe(true);
        expect(no2.mediciones[0].unidad).toBe("µg/m³");
        expect((await logica.obtenerMediciones("CO")).mediciones[0].unidad).toBe("mg/m³");
    });

    test("rechaza un contaminante desconocido", async () => {
        const r = await new LogicaMapaFake(0, AHORA).obtenerMediciones("SO2");
        expect(r.correcto).toBe(false);
    });
});

describe("vista inicial del mapa", () => {
    test("empieza acercado a Gandia y se puede alejar hasta ver España", () => {
        expect(inicio.ZONA_POR_DEFECTO.municipio).toBe("Gandia");
        expect(inicio.ZOOM_INICIAL).toBeGreaterThanOrEqual(11);
        expect(inicio.ZOOM_MINIMO).toBeLessThanOrEqual(6);
    });
});

describe("menú de la página del mapa", () => {
    test("tiene el enlace a Planes de la portada", () => {
        const enlaces = [...document.querySelectorAll("#menu-inicio a")].map((a) => a.textContent.trim());
        expect(enlaces).toEqual(["Inicio", "Mapa", "Contaminantes", "Planes"]);
        expect(document.querySelector('#menu-inicio a[href="index.html#planes"]')).not.toBeNull();
    });
});