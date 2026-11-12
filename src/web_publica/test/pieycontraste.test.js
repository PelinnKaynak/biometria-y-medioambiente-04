/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas del pie común y del contraste de los colores de texto
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");

const leer = archivo => fs.readFileSync(path.join(__dirname, "..", archivo), "utf8");
const cargar = pagina => {
    document.documentElement.innerHTML = leer(pagina).replace(/^[\s\S]*<html[^>]*>/, "").replace(/<\/html>[\s\S]*$/, "");
};

// --------------------------------------------------------
// hex: Texto --> luminancia() --> R   (fórmula de la WCAG 2.1)
// --------------------------------------------------------
function luminancia(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// --------------------------------------------------------
// a: Texto, b: Texto --> contraste() --> R
// --------------------------------------------------------
function contraste(a, b) {
    const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
    return (claro + 0.05) / (oscuro + 0.05);
}

const PAGINAS = ["index.html", "mapa.html", "contaminantes.html", "normativa.html", "consejos.html", "mi_cuenta.html"];

describe("pie común", () => {
    test.each(PAGINAS)("%s tiene el pie con sus tres columnas y carga pie.css", pagina => {
        cargar(pagina);
        expect(document.querySelector('link[href="css/pie.css"]')).not.toBeNull();
        expect(document.querySelectorAll(".pie-web .pie-columnas h2").length).toBe(3);
        const enlaces = [...document.querySelectorAll(".pie-web a")].map(a => a.getAttribute("href"));
        const cuenta = pagina === "mi_cuenta.html" ? ["mi_cuenta.html"] : ["login.html", "registro.html"];
        expect(enlaces).toEqual(expect.arrayContaining(["mapa.html", "contaminantes.html", ...cuenta]));
    });

    test.each(PAGINAS.filter(p => p !== "index.html"))("en %s los enlaces a secciones de la portada llevan index.html", pagina => {
        cargar(pagina);
        const anclas = [...document.querySelectorAll(".pie-web a")].map(a => a.getAttribute("href")).filter(h => h.includes("#"));
        expect(anclas.length).toBe(5);
        expect(anclas.every(h => h.startsWith("index.html#"))).toBe(true);
    });
});

describe("contraste de los colores de texto", () => {
    const css = leer("css/estilos.css");
    const variable = nombre => css.match(new RegExp(nombre + ":\\s*(#[0-9A-Fa-f]{6})"))[1];

    test.each(["--texto", "--texto-suave", "--texto-gris", "--bueno-texto", "--moderado-texto", "--malo-texto"])(
        "%s llega a 4,5:1 sobre blanco y sobre el fondo", nombre => {
            const color = variable(nombre);
            expect(contraste(color, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
            expect(contraste(color, variable("--fondo"))).toBeGreaterThanOrEqual(4.5);
        });

    test("ninguna hoja de estilos usa ya el gris claro #8992B8 para texto", () => {
        for (const hoja of fs.readdirSync(path.join(__dirname, "../css"))) {
            expect(leer("css/" + hoja)).not.toMatch(/(^|[^-\w])color:\s*#8992B8/i);
        }
    });
});