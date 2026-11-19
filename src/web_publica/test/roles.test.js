// ------------------------------------------------------------
// Pruebas de las consultas del rol (roles.js)
// ------------------------------------------------------------

const roles = require("../js/roles");
const login = require("../js/login");
const inicio = require("../js/inicio");

describe("¿es administrador? ¿es técnico?", () => {
    test.each([
        [{ rol: "administrador" }, true, false, "ADMINISTRADOR"],
        [{ rol: "ADMINISTRADOR" }, true, false, "ADMINISTRADOR"],
        [{ rol: "tecnico" }, false, true, "TECNICO"],
        [{ rol: "portador" }, false, false, "USUARIO"],
        [{ rol: "ciudadano" }, false, false, "USUARIO"],
        [{ rol: "" }, false, false, "USUARIO"],
        [null, false, false, "SIN_SESION"]
    ])("%p → admin %p, técnico %p, tipo %p", (usuario, admin, tecnico, tipo) => {
        expect(roles.esAdministrador(usuario)).toBe(admin);
        expect(roles.esTecnico(usuario)).toBe(tecnico);
        expect(roles.tipoDeUsuario(usuario)).toBe(tipo);
    });
});

describe("la web pública usa las mismas consultas", () => {
    test("al iniciar sesión, admin y técnico van al panel y el resto a Mi cuenta", () => {
        expect(login.paginaInicioSegunRol("administrador")).toBe("../web_admin/panel_nodos.html");
        expect(login.paginaInicioSegunRol("tecnico")).toBe("../web_admin/panel_nodos.html");
        expect(login.paginaInicioSegunRol("portador")).toBe("mi_cuenta.html");
        expect(login.paginaInicioSegunRol("ciudadano")).toBe("mi_cuenta.html");
    });

    test("la cabecera enseña Panel a admin y técnico, y Mi cuenta al resto", () => {
        expect(inicio.accesoCabecera({ rol: "tecnico" }).texto).toBe("Panel");
        expect(inicio.accesoCabecera({ rol: "ciudadano" }).texto).toBe("Mi cuenta");
    });
});
describe("roles múltiples (T048)", () => {
    const cuenta = (admin, tecnico, portador, rol = "") =>
        ({ rol, esAdministrador: admin, esTecnico: tecnico, esPortador: portador });

    test.each([
        [cuenta(true, false, false), true, false, false, true, "ADMINISTRADOR"],
        [cuenta(false, true, false), false, true, false, true, "TECNICO"],
        [cuenta(false, false, true), false, false, true, false, "USUARIO"],
        [cuenta(false, true, true), false, true, true, true, "TECNICO"],
        [cuenta(true, false, true), true, false, true, true, "ADMINISTRADOR"],
        [cuenta(true, true, true), true, true, true, true, "ADMINISTRADOR"],
        [cuenta(false, false, false), false, false, false, false, "USUARIO"]
    ])("%p → admin %p, técnico %p, portador %p, panel %p, tipo %p",
        (usuario, admin, tecnico, portador, panel, tipo) => {
            expect(roles.esAdministrador(usuario)).toBe(admin);
            expect(roles.esTecnico(usuario)).toBe(tecnico);
            expect(roles.esPortador(usuario)).toBe(portador);
            expect(roles.tieneAccesoPanel(usuario)).toBe(panel);
            expect(roles.tipoDeUsuario(usuario)).toBe(tipo);
        });

    test("si vienen los campos, mandan sobre «rol»", () => {
        // El servidor manda rol = el más alto; los campos dicen todos los que tiene
        const marc = cuenta(false, true, true, "tecnico");
        expect(roles.esPortador(marc)).toBe(true);
        // Aunque rol diga administrador, si el campo dice que no, no lo es
        expect(roles.esAdministrador(cuenta(false, false, true, "administrador"))).toBe(false);
    });

    test("sin los campos, sigue mirando «rol» como antes", () => {
        expect(roles.tieneRolesMultiples({ rol: "portador" })).toBe(false);
        expect(roles.esPortador({ rol: "portador" })).toBe(true);
        expect(roles.esPortador({ rol: "administrador" })).toBe(false);
        expect(roles.esPortador(null)).toBe(false);
        expect(roles.tieneAccesoPanel({ rol: "TECNICO" })).toBe(true);
    });

    test("al iniciar sesión, un técnico que también es portador va al panel", () => {
        expect(login.paginaInicioSegunRol(cuenta(false, true, true, "tecnico"))).toBe("../web_admin/panel_nodos.html");
        expect(login.paginaInicioSegunRol(cuenta(false, false, true, "portador"))).toBe("mi_cuenta.html");
    });

    test("la cabecera de la portada enseña Panel a quien tiene acceso", () => {
        expect(inicio.accesoCabecera(cuenta(false, true, true)).texto).toBe("Panel");
        expect(inicio.accesoCabecera(cuenta(false, false, true)).texto).toBe("Mi cuenta");
    });
});
