/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas de las partes interactivas de la portada (index.html)
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const portada = require("../js/portada");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const texto = id => document.getElementById(id).textContent;

beforeEach(() => {
    document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/, "").replace(/<\/html>[\s\S]*$/, "");
});

describe("funciones sin DOM", () => {
    test("siguienteIndice() vuelve al principio al llegar al final", () => {
        expect(portada.siguienteIndice(0, 4)).toBe(1);
        expect(portada.siguienteIndice(3, 4)).toBe(0);
    });

    test("formatearEuros() usa coma decimal", () => {
        expect(portada.formatearEuros(2.99)).toBe("2,99 €");
        expect(portada.formatearEuros(24.99)).toBe("24,99 €");
    });

    test("precioPremium() según el periodo", () => {
        expect(portada.precioPremium("mes")).toEqual({ precio: "2,99 €", periodo: "al mes" });
        expect(portada.precioPremium("anyo")).toEqual({ precio: "24,99 €", periodo: "al año" });
    });

    test("porcentajeAhorro() compara el año con doce meses", () => {
        expect(portada.porcentajeAhorro(2.99, 24.99)).toBe(30);
        expect(portada.porcentajeAhorro(10, 120)).toBe(0);
    });

    test.each([[50, "Bueno"], [150, "Moderado"], [200, "Malo"], [280, "Muy malo"]])(
        "resultadoOzono(%p) es %s y trae su consejo", (valor, nivel) => {
            const r = portada.resultadoOzono(valor);
            expect(r.nivel.texto).toBe(nivel);
            expect(r.consejo.length).toBeGreaterThan(0);
        });

    test("hay una pantalla por cada función y una explicación por cada capa", () => {
        expect(portada.PANTALLAS_APP).toHaveLength(document.querySelectorAll("[data-funcion]").length);
        for (const boton of document.querySelectorAll("[data-capa]")) {
            expect(portada.CAPAS[boton.dataset.capa]).toBeDefined();
        }
    });
});

describe("esquema del proyecto", () => {
    test("al pulsar una capa cambia la explicación y la capa activa", () => {
        portada.mostrarCapa("servidor");
        expect(texto("titulo-capa")).toBe(portada.CAPAS.servidor.titulo);
        expect(texto("tecnologia-capa")).toContain("Express");
        expect(document.querySelector("[data-capa=servidor]").getAttribute("aria-selected")).toBe("true");
        expect(document.querySelector("[data-capa=sensor]").classList.contains("activa")).toBe(false);
    });
});

describe("funciones de la app", () => {
    test("mostrarFuncion() cambia la pantalla del móvil y la función activa", () => {
        portada.mostrarFuncion(3);
        expect(document.getElementById("pantalla-app").getAttribute("src")).toBe("img/app-ruta-limpia.jpg");
        expect(document.querySelector('[data-funcion="3"]').classList.contains("activa")).toBe(true);
        expect(document.querySelector('[data-funcion="0"]').getAttribute("aria-selected")).toBe("false");
    });
});

describe("probador de ozono", () => {
    test("enseña el valor, el nivel y resalta su fila", () => {
        portada.mostrarOzono(200);
        expect(texto("salida-ozono")).toBe("200 µg/m³");
        expect(texto("resultado-ozono")).toContain("Malo");
        expect(document.querySelector(".fila-nivel.resaltada").dataset.nivel).toBe("malo");
    });

    test("en el límite de 100 sigue siendo bueno", () => {
        portada.mostrarOzono(100);
        expect(document.querySelector(".fila-nivel.resaltada").dataset.nivel).toBe("bueno");
    });
});

describe("planes", () => {
    test("al cambiar a anual cambia el precio de Premium", () => {
        portada.mostrarPeriodo("anyo");
        expect(texto("precio-premium")).toBe("24,99 €");
        expect(texto("periodo-premium")).toBe("al año");
        expect(document.querySelector("[data-periodo=anyo]").getAttribute("aria-pressed")).toBe("true");
        portada.mostrarPeriodo("mes");
        expect(texto("precio-premium")).toBe("2,99 €");
    });

    test("hay tres planes y Premium está destacado", () => {
        expect(document.querySelectorAll(".plan")).toHaveLength(3);
        expect(document.querySelector(".plan-destacado h3").textContent).toBe("Premium");
    });
});

describe("avisos del móvil", () => {
    test("mostrarAviso() deja visible solo uno", () => {
        const avisos = [...document.querySelectorAll(".notificacion")];
        portada.mostrarAviso(avisos, 2);
        expect(avisos.filter(a => a.classList.contains("visible"))).toEqual([avisos[2]]);
    });
});

describe("probar avisos", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test("hay un botón por cada aviso", () => {
        expect(document.querySelectorAll("[data-aviso]")).toHaveLength(document.querySelectorAll(".notificacion").length);
    });

    test("al pulsar, baja ese aviso, marca el botón y se esconde a los 5 segundos", () => {
        const avisos = [...document.querySelectorAll(".notificacion")];
        portada.lanzarAviso(1, { id: null });
        jest.advanceTimersByTime(200);
        expect(avisos[1].classList.contains("visible")).toBe(true);
        expect(document.querySelector('[data-aviso="1"]').classList.contains("activo")).toBe(true);
        jest.advanceTimersByTime(5000);
        expect(avisos.some(a => a.classList.contains("visible"))).toBe(false);
    });

    test("al pulsar otro, cambia el aviso", () => {
        const avisos = [...document.querySelectorAll(".notificacion")];
        const t = { id: null };
        portada.lanzarAviso(0, t);
        jest.advanceTimersByTime(200);
        portada.lanzarAviso(3, t);
        jest.advanceTimersByTime(200);
        expect(avisos.filter(a => a.classList.contains("visible"))).toEqual([avisos[3]]);
    });
});

describe("sensor", () => {
    test("cada vista tiene imagen y piezas con su punto dentro de la imagen", () => {
        for (const vista of Object.values(portada.VISTAS_SENSOR)) {
            expect(vista.imagen).toMatch(/^img\/sensor-.+\.jpg$/);
            expect(vista.piezas.length).toBeGreaterThan(2);
            for (const p of vista.piezas) {
                expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(100);
                expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(100);
            }
        }
    });

    test("mostrarVistaSensor() pinta un punto y una pieza por cada parte y abre la primera", () => {
        portada.mostrarVistaSensor("interior");
        const n = portada.VISTAS_SENSOR.interior.piezas.length;
        expect(document.querySelectorAll(".punto-sensor")).toHaveLength(n);
        expect(document.querySelectorAll(".pieza")).toHaveLength(n);
        expect(document.getElementById("foto-sensor").getAttribute("src")).toBe("img/sensor-despiece.jpg");
        expect(document.querySelector('.pieza[data-pieza="tapa"]').classList.contains("activa")).toBe(true);
        expect(document.querySelector('[data-vista="interior"]').getAttribute("aria-selected")).toBe("true");
    });

    test("al pulsar un punto se abre su pieza en la lista", () => {
        portada.mostrarVistaSensor("exterior");
        document.querySelector('.punto-sensor[data-pieza="o3"]').click();
        expect(document.querySelector('.pieza[data-pieza="o3"]').classList.contains("activa")).toBe(true);
        expect(document.querySelector('.pieza[data-pieza="anilla"]').classList.contains("activa")).toBe(false);
        expect(document.querySelector('.punto-sensor[data-pieza="o3"]').getAttribute("aria-expanded")).toBe("true");
    });
});

describe("plano de cobertura", () => {
    test("barriosDelPlano() crea 12 barrios en 4 columnas y 3 filas", () => {
        const barrios = portada.barriosDelPlano(portada.PLANO);
        expect(barrios).toHaveLength(12);
        expect(barrios[1].x - barrios[0].x).toBe(portada.PLANO.barrio.ancho + portada.PLANO.barrio.calle);
    });

    test("barrioCubierto() mira la distancia al centro del barrio", () => {
        const barrio = { cx: 100, cy: 100 };
        expect(portada.barrioCubierto(barrio, [{ x: 130, y: 140 }], 50)).toBe(true);
        expect(portada.barrioCubierto(barrio, [{ x: 200, y: 100 }], 50)).toBe(false);
        expect(portada.barrioCubierto(barrio, [], 50)).toBe(false);
    });

    test("con AERIS hay muchos más barrios con datos que solo con estaciones", () => {
        const oficial = portada.coberturaRed(portada.PLANO, "oficial").filter(Boolean).length;
        const aeris = portada.coberturaRed(portada.PLANO, "aeris").filter(Boolean).length;
        expect(oficial).toBe(2);
        expect(aeris).toBe(11);
    });

    test("mostrarRed() pinta los barrios, el contador y el botón activo", () => {
        portada.pintarPlano();
        expect(document.querySelectorAll("#plano-red .barrio")).toHaveLength(12);
        portada.mostrarRed("aeris");
        expect(document.getElementById("barrios-cubiertos").textContent).toBe("11");
        expect(document.querySelectorAll("#plano-red .barrio.cubierto")).toHaveLength(11);
        expect(document.getElementById("plano-red").classList.contains("con-aeris")).toBe(true);
        portada.mostrarRed("oficial");
        expect(document.getElementById("barrios-cubiertos").textContent).toBe("2");
        expect(document.querySelector('[data-red="oficial"]').getAttribute("aria-pressed")).toBe("true");
    });
});

describe("pie", () => {
    test("enlaza al mapa, a las páginas de información y a la cuenta", () => {
        const enlaces = [...document.querySelectorAll(".pie-portada a")].map(a => a.getAttribute("href"));
        expect(enlaces).toEqual(expect.arrayContaining(["mapa.html", "contaminantes.html", "normativa.html", "consejos.html", "login.html", "registro.html"]));
    });

    test("la vista «Cómo es» del sensor no lleva texto debajo", () => {
        portada.mostrarVistaSensor("exterior");
        expect(document.getElementById("pie-sensor").hidden).toBe(true);
        portada.mostrarVistaSensor("medidas");
        expect(document.getElementById("pie-sensor").hidden).toBe(false);
    });
});