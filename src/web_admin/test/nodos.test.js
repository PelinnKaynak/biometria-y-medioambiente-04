// ------------------------------------------------------------
// Pruebas de las funciones sobre nodos (T014 · T022)
// ------------------------------------------------------------

const n = require("../js/nodos");

const AHORA = new Date("2026-11-04T12:00:00Z");
const haceMinutos = m => new Date(AHORA.getTime() - m * 60000).toISOString();

describe("minutosSinDatos()", () => {
    test("cuenta los minutos desde la última medición", () => {
        expect(n.minutosSinDatos(haceMinutos(90), AHORA)).toBe(90);
    });

    test("nunca devuelve un número negativo", () => {
        expect(n.minutosSinDatos(haceMinutos(-5), AHORA)).toBe(0);
    });
});

describe("estadoNodo()", () => {
    const nodo = (minutos, calibrar = false) =>
        ({ ultimaMedicion: haceMinutos(minutos), necesitaCalibrar: calibrar });

    test("activo si ha enviado datos hace menos de 24 horas", () => {
        expect(n.estadoNodo(nodo(60), AHORA)).toBe("ACTIVO");
        expect(n.estadoNodo(nodo(24 * 60), AHORA)).toBe("ACTIVO");
    });

    test("inactivo si lleva más de 24 horas sin datos", () => {
        expect(n.estadoNodo(nodo(24 * 60 + 1), AHORA)).toBe("INACTIVO");
    });

    test("inactivo gana a calibrar", () => {
        expect(n.estadoNodo(nodo(3000, true), AHORA)).toBe("INACTIVO");
    });

    test("calibrar si está activo pero necesita calibración", () => {
        expect(n.estadoNodo(nodo(10, true), AHORA)).toBe("CALIBRAR");
    });

    test("respeta otro umbral de inactividad", () => {
        expect(n.estadoNodo(nodo(5 * 60), AHORA, 4)).toBe("INACTIVO");
    });
});

describe("textoTiempoSinDatos()", () => {
    test.each([
        [12, "12 min"],
        [59, "59 min"],
        [125, "2 h"],
        [1440, "1 día"],
        [4320, "3 días"]
    ])("%i minutos → %s", (minutos, texto) => {
        expect(n.textoTiempoSinDatos(minutos)).toBe(texto);
    });
});

describe("formatearNumero()", () => {
    test.each([[7, "7"], [1248, "1.248"], [1234567, "1.234.567"]])("%i → %s", (num, texto) => {
        expect(n.formatearNumero(num)).toBe(texto);
    });
});