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