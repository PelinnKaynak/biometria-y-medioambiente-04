/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas de las páginas de información (contaminantes,
// normativa y consejos)
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const info = require("../js/informacion");

const cargar = pagina => {
    const html = fs.readFileSync(path.join(__dirname, "../" + pagina), "utf8");
    document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/, "").replace(/<\/html>[\s\S]*$/, "");
};
const filas = () => [...document.querySelectorAll("#cuerpo-niveles tr")].map(tr => [...tr.cells].map(td => td.textContent));

describe("filasNiveles()", () => {
    test("ozono: rangos de la tabla de Figma", () => {
        expect(info.filasNiveles("O3").map(f => f.rango)).toEqual(["0 – 100", "101 – 180", "181 – 240", "> 240"]);
    });

    test("CO usa decimales con coma", () => {
        expect(info.filasNiveles("CO").map(f => f.rango)).toEqual(["0 – 4", "4,1 – 7", "7,1 – 10", "> 10"]);
    });

    test("cada fila tiene su nivel y su consejo", () => {
        const f = info.filasNiveles("NO2");
        expect(f.map(x => x.nivel.texto)).toEqual(["Bueno", "Moderado", "Malo", "Muy malo"]);
        expect(f.every(x => x.consejo.length > 0)).toBe(true);
    });

    test("todos los contaminantes tienen cuatro consejos", () => {
        for (const c of Object.keys(info.INFO_CONTAMINANTES)) {
            expect(info.INFO_CONTAMINANTES[c].consejos).toHaveLength(4);
        }
    });
});

describe("pintarNiveles()", () => {
    beforeEach(() => cargar("contaminantes.html"));

    test("pinta la tabla del ozono y marca su tarjeta", () => {
        info.pintarNiveles("O3");
        expect(document.getElementById("titulo-niveles").textContent).toBe("Ozono: niveles y qué hacer");
        expect(filas()).toHaveLength(4);
        expect(filas()[0]).toEqual(["Bueno", "0 – 100", "Disfruta del aire libre con normalidad."]);
        expect(document.querySelector("[data-contaminante=O3]").getAttribute("aria-pressed")).toBe("true");
    });

    test("al cambiar de contaminante cambia el título, la unidad y la tarjeta activa", () => {
        info.pintarNiveles("O3");
        info.pintarNiveles("CO");
        expect(document.getElementById("titulo-niveles").textContent).toBe("Monóxido de carbono: niveles y qué hacer");
        expect(document.getElementById("unidad-niveles").textContent).toBe("mg/m³");
        expect(document.querySelector("[data-contaminante=O3]").classList.contains("activa")).toBe(false);
        expect(document.querySelector("[data-contaminante=CO]").classList.contains("activa")).toBe(true);
    });
});

describe("cabecera", () => {
    test.each(["index.html", "contaminantes.html", "normativa.html", "consejos.html"])("%s: Acceder cambia con la sesión y el menú se abre", pagina => {
        cargar(pagina);
        info.iniciarCabeceraInfo({ rol: "portador" });
        expect(document.getElementById("boton-acceder").textContent).toBe("Mi cuenta");
        document.getElementById("boton-menu-inicio").click();
        expect(document.getElementById("menu-inicio").classList.contains("abierto")).toBe(true);
    });
});

describe("enlaces", () => {
    test("contaminantes lleva a normativa y a consejos", () => {
        cargar("contaminantes.html");
        const enlaces = [...document.querySelectorAll(".tarjeta-enlace")].map(a => a.getAttribute("href"));
        expect(enlaces).toEqual(["normativa.html", "consejos.html"]);
    });

    test("los textos oficiales se abren en otra pestaña", () => {
        cargar("normativa.html");
        const enlaces = [...document.querySelectorAll(".tarjeta-texto")];
        expect(enlaces).toHaveLength(4);
        expect(enlaces.every(a => a.target === "_blank" && a.rel === "noopener")).toBe(true);
    });
});

describe("portada (index.html)", () => {
    beforeEach(() => cargar("index.html"));

    test("el menú tiene Inicio, Mapa y Contaminantes, con Inicio marcado", () => {
        const enlaces = [...document.querySelectorAll("#menu-inicio a")];
        expect(enlaces.map(a => a.getAttribute("href"))).toEqual(["index.html", "mapa.html", "contaminantes.html", "#planes"]);
        expect(enlaces[0].getAttribute("aria-current")).toBe("page");
    });

    test("«Ver el mapa» lleva a mapa.html y «Cómo funciona» baja a la sección del proyecto", () => {
        expect(document.querySelector(".boton-portada").getAttribute("href")).toBe("mapa.html");
        expect(document.querySelector(".enlace-portada").getAttribute("href")).toBe("#proyecto");
        expect(document.getElementById("proyecto")).not.toBeNull();
    });

    test("la sección de la app tiene las cuatro funciones y el móvil", () => {
        expect(document.querySelectorAll("#la-app [data-funcion]")).toHaveLength(4);
        expect(document.getElementById("pantalla-app").getAttribute("src")).toBe("img/app-inicio.jpg");
    });

    test("la portada no carga el mapa", () => {
        expect(document.getElementById("mapa")).toBeNull();
    });
});

describe("menú en las demás páginas", () => {
    test.each(["mapa.html", "contaminantes.html", "normativa.html", "consejos.html"])("%s enlaza a Inicio, Mapa, Contaminantes y Planes", pagina => {
        cargar(pagina);
        const enlaces = [...document.querySelectorAll("#menu-inicio a")].map(a => a.getAttribute("href"));
        expect(enlaces).toEqual(["index.html", "mapa.html", "contaminantes.html", "index.html#planes"]);
    });
});