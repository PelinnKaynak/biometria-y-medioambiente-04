/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas de los permisos de técnico y administrador
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { LogicaAdminFake } = require("../js/logica_admin_fake");
const comun = require("../js/admin_comun");

const AHORA = new Date("2026-11-04T12:00:00Z");
const cargar = pagina => {
    const html = fs.readFileSync(path.join(__dirname, "..", pagina), "utf8");
    document.documentElement.innerHTML = new DOMParser()
        .parseFromString(html, "text/html").documentElement.innerHTML;
};
const entrarComo = rol => sessionStorage.setItem("aeris_usuario", JSON.stringify({ id: 999, rol }));
const opcion = texto => [...document.querySelectorAll(".opcion-menu")].find(a => a.textContent.trim() === texto);

beforeEach(() => sessionStorage.clear());

describe("acceso al panel", () => {
    test("administrador y técnico entran; portador y ciudadano no", () => {
        expect(comun.tieneAccesoAdmin({ rol: "administrador" })).toBe(true);
        expect(comun.tieneAccesoAdmin({ rol: "tecnico" })).toBe(true);
        expect(comun.tieneAccesoAdmin({ rol: "portador" })).toBe(false);
        expect(comun.tieneAccesoAdmin({ rol: "ciudadano" })).toBe(false);
    });

    test("con roles múltiples, entra quien es técnico aunque «rol» diga otra cosa (T048)", () => {
        expect(comun.tieneAccesoAdmin({ rol: "portador", esAdministrador: false, esTecnico: true, esPortador: true })).toBe(true);
        expect(comun.tieneAccesoAdmin({ rol: "portador", esAdministrador: false, esTecnico: false, esPortador: true })).toBe(false);
    });

    test("un técnico que abre Usuarios vuelve a Nodos", () => {
        entrarComo("tecnico");
        const irA = jest.fn();
        expect(comun.comprobarAcceso(new LogicaAdminFake(5, AHORA, 0), irA, true)).toBe(false);
        expect(irA).toHaveBeenCalledWith("panel_nodos.html");
    });

    test("un administrador puede abrir Usuarios", () => {
        entrarComo("administrador");
        const irA = jest.fn();
        expect(comun.comprobarAcceso(new LogicaAdminFake(5, AHORA, 0), irA, true)).toBe(true);
        expect(irA).not.toHaveBeenCalled();
    });
});

describe.each(["panel_nodos.html", "usuarios.html", "incidencias.html"])("menú de %s", pagina => {
    test("el técnico no ve Usuarios ni «Ver como usuario»", () => {
        cargar(pagina);
        entrarComo("tecnico");
        comun.conectarMenu(new LogicaAdminFake(5, AHORA, 0), jest.fn());
        expect(opcion("Usuarios").hidden).toBe(true);
        expect(opcion("Ver como usuario").hidden).toBe(true);
        expect(document.querySelector('a[href="incidencias.html"]')).not.toBeNull();
    });

    test("el administrador ve Usuarios y puede entrar como usuario en su Mi cuenta", () => {
        cargar(pagina);
        entrarComo("administrador");
        comun.conectarMenu(new LogicaAdminFake(5, AHORA, 0), jest.fn());
        expect(opcion("Usuarios").hidden).toBe(false);
        expect(opcion("Ver como usuario").hidden).toBe(false);
        expect(opcion("Ver como usuario").getAttribute("href")).toBe("../web_publica/mi_cuenta.html");
        expect(document.querySelector('a[href="incidencias.html"]')).not.toBeNull();
    });

    test("un técnico que también es portador ve «Ver como usuario», pero no Usuarios (T048)", () => {
        cargar(pagina);
        sessionStorage.setItem("aeris_usuario", JSON.stringify({
            id: 999, rol: "tecnico", esAdministrador: false, esTecnico: true, esPortador: true }));
        comun.conectarMenu(new LogicaAdminFake(5, AHORA, 0), jest.fn());
        expect(opcion("Usuarios").hidden).toBe(true);
        expect(opcion("Ver como usuario").hidden).toBe(false);
    });
});

describe("gestión de usuarios", () => {
    test("un técnico no puede dar de baja, cambiar el rol ni crear cuentas", async () => {
        entrarComo("tecnico");
        const logica = new LogicaAdminFake(5, AHORA, 0);
        const baja = await logica.darDeBaja([2]);
        const rol = await logica.cambiarRol(2, "tecnico");
        const alta = await logica.crearUsuario({ nombre: "Ana", apellidos: "Gil", correo: "ana@aeris.es", rol: "tecnico" });
        for (const r of [baja, rol, alta]) {
            expect(r.correcto).toBe(false);
            expect(r.error).toBe("Solo un administrador puede gestionar usuarios");
        }
        expect(logica.usuarios.find(u => u.idUsuario === 2).estado).not.toBe("baja");
    });

    test("un administrador sí puede dar de baja", async () => {
        entrarComo("administrador");
        const logica = new LogicaAdminFake(5, AHORA, 0);
        expect((await logica.darDeBaja([2])).correcto).toBe(true);
        expect(logica.usuarios.find(u => u.idUsuario === 2).estado).toBe("baja");
    });
});