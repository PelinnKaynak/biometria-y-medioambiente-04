// ------------------------------------------------------------
// Pruebas de la lógica fake del panel de nodos
// ------------------------------------------------------------

const { LogicaAdminFake } = require("../js/logica_admin_fake");
const { estadoNodo, minutosSinDatos } = require("../js/nodos");

const AHORA = new Date("2026-11-04T12:00:00Z");
const logica = new LogicaAdminFake(64, AHORA, 0);
const filtro = cambios => Object.assign({ busqueda: "", estado: "todos", pagina: 1, porPagina: 10 }, cambios);

test("el resumen cuadra: activos + inactivos = total", async () => {
    const { resumen } = await logica.obtenerResumenNodos();
    expect(resumen.total).toBe(64);
    expect(resumen.activos + resumen.inactivos24h).toBe(64);
    expect(resumen.inactivos7d).toBeLessThanOrEqual(resumen.inactivos24h);
});

test("pagina los resultados y devuelve el total sin paginar", async () => {
    const r = await logica.obtenerNodos(filtro({ pagina: 7 }));
    expect(r.nodos).toHaveLength(4);
    expect(r.total).toBe(64);
});

test("ordena de más a menos tiempo sin datos", async () => {
    const { nodos } = await logica.obtenerNodos(filtro({ porPagina: 64 }));
    const minutos = nodos.map(nd => minutosSinDatos(nd.ultimaMedicion, AHORA));
    expect(minutos).toEqual([...minutos].sort((a, b) => b - a));
});

test("busca por portador sin tener en cuenta tildes ni mayúsculas", async () => {
    const { nodos } = await logica.obtenerNodos(filtro({ busqueda: "LUCIA", porPagina: 64 }));
    expect(nodos.length).toBeGreaterThan(0);
    expect(nodos.every(nd => nd.portador === "Lucía Pastor")).toBe(true);
});

test("busca por identificador", async () => {
    const { nodos } = await logica.obtenerNodos(filtro({ busqueda: "n-0100" }));
    expect(nodos.map(nd => nd.id)).toEqual(["N-0100"]);
});

test("el filtro de inactivos solo devuelve nodos inactivos", async () => {
    const { nodos, total } = await logica.obtenerNodos(filtro({ estado: "inactivos", porPagina: 64 }));
    const { resumen } = await logica.obtenerResumenNodos();
    expect(total).toBe(resumen.inactivos24h);
    expect(nodos.every(nd => estadoNodo(nd, AHORA) === "INACTIVO")).toBe(true);
});

test("obtenerNodosMapa() devuelve todos los nodos del filtro sin paginar", async () => {
    const r = await logica.obtenerNodosMapa(filtro({ estado: "activos" }));
    const { resumen } = await logica.obtenerResumenNodos();
    expect(r.nodos).toHaveLength(resumen.activos);
});