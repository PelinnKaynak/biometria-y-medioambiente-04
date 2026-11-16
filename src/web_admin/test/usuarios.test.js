/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas de la gestión de usuarios (T029 · H018)
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { LogicaAdminFake } = require("../js/logica_admin_fake");
const usuarios = require("../js/usuarios");

const html = fs.readFileSync(path.join(__dirname, "../usuarios.html"), "utf8");
const AHORA = new Date("2026-11-04T12:00:00Z");
const eventoFalso = () => ({ preventDefault: jest.fn() });
const visible = id => !document.getElementById(id).classList.contains("oculto");

function nuevaLogica() {
    sessionStorage.setItem("aeris_usuario", JSON.stringify({ id: 1, rol: "administrador", correo: "admin@aeris.es" }));
    return new LogicaAdminFake(64, AHORA, 0);
}

function rellenarNuevo(nombre, apellidos, correo, rol = "tecnico") {
    document.getElementById("nuevo-nombre").value = nombre;
    document.getElementById("nuevo-apellidos").value = apellidos;
    document.getElementById("nuevo-correo").value = correo;
    document.getElementById("nuevo-rol").value = rol;
}

beforeEach(() => {
    document.documentElement.innerHTML = new DOMParser()
        .parseFromString(html, "text/html").documentElement.innerHTML;
    sessionStorage.clear();
    usuarios.pantalla.seleccionados.clear();
    Object.assign(usuarios.pantalla.filtro, { busqueda: "", grupo: "todos", estado: "todos", pagina: 1 });
});

describe("formatearFecha()", () => {
    test("escribe la fecha como dd/mm/aaaa", () => {
        expect(usuarios.formatearFecha("2026-09-12T10:00:00Z")).toBe("12/09/2026");
    });
});

describe("validarNuevoUsuario()", () => {
    test("acepta un técnico con datos correctos", () => {
        expect(usuarios.validarNuevoUsuario(
            { nombre: "José Luis", apellidos: "García-Ortega", correo: "jl@gandia.org", rol: "tecnico" })).toEqual([]);
    });

    test("rechaza números en el nombre y un correo mal escrito", () => {
        const errores = usuarios.validarNuevoUsuario(
            { nombre: "Pepe2", apellidos: "Soler", correo: "pepe@", rol: "tecnico" });
        expect(errores.map(e => e.campo)).toEqual(["nuevo-nombre", "nuevo-correo"]);
    });

    test("no deja crear portadores desde el panel", () => {
        const errores = usuarios.validarNuevoUsuario(
            { nombre: "Ana", apellidos: "Ribes", correo: "ana@correo.es", rol: "portador" });
        expect(errores[0].campo).toBe("nuevo-rol");
    });
});

describe("LogicaAdminFake: usuarios", () => {
    test("el conteo no incluye a los usuarios de baja", async () => {
        const logica = nuevaLogica();
        const { conteo } = await logica.obtenerConteoUsuarios();
        const enBaja = logica.usuarios.filter(u => u.estado === "baja").length;
        expect(conteo.todos).toBe(logica.usuarios.length - enBaja);
    });

    test("filtra por grupo y busca sin tildes", async () => {
        const logica = nuevaLogica();
        const r = await logica.obtenerUsuarios({ busqueda: "MARTINEZ", grupo: "portadores", estado: "todos", pagina: 1, porPagina: 10 });
        expect(r.usuarios.map(u => u.correo)).toContain("laura@correo.es");
        expect(r.usuarios.every(u => u.rol === "portador")).toBe(true);
    });

    test("no deja crear dos cuentas con el mismo correo", async () => {
        const r = await nuevaLogica().crearUsuario({ nombre: "Otra", apellidos: "Persona", correo: "LAURA@correo.es", rol: "tecnico" });
        expect(r).toEqual({ correcto: false, error: "Ya hay una cuenta con ese correo", campos: ["correo"] });
    });

    test("un administrador no puede cambiarse su rol ni darse de baja", async () => {
        const logica = nuevaLogica();
        expect((await logica.cambiarRol(1, "portador")).correcto).toBe(false);
        expect((await logica.darDeBaja([1, 2])).correcto).toBe(false);
    });
});

describe("crearFilaUsuario()", () => {
    const usuario = extra => Object.assign({
        idUsuario: 7, nombre: "Pau", apellidos: "Ferrer", correo: "pau@correo.es", rol: "portador",
        premium: true, nodo: "N-0412", estado: "activo", fechaAlta: "2026-10-03T10:00:00Z"
    }, extra);

    test("muestra nombre, correo, rol, premium, nodo, estado y alta", () => {
        const fila = usuarios.crearFilaUsuario(usuario(), 1);
        expect(fila.querySelector("strong").textContent).toBe("Pau Ferrer");
        expect(fila.querySelector(".correo").textContent).toBe("pau@correo.es");
        expect(fila.querySelector(".selector-rol").value).toBe("portador");
        expect(fila.querySelector(".etiqueta-premium")).not.toBeNull();
        expect(fila.querySelector(".celda-nodo").textContent).toBe("N-0412");
        expect(fila.querySelector(".celda-estado").textContent).toBe("Activo");
        expect(fila.querySelector(".celda-alta").textContent).toBe("03/10/2026");
    });

    test("el propio administrador no se puede seleccionar ni cambiar de rol", () => {
        const fila = usuarios.crearFilaUsuario(usuario({ idUsuario: 1, rol: "administrador" }), 1);
        expect(fila.querySelector(".casilla").disabled).toBe(true);
        expect(fila.querySelector(".selector-rol").disabled).toBe(true);
    });

    test("un usuario de baja tampoco", () => {
        const fila = usuarios.crearFilaUsuario(usuario({ estado: "baja" }), 1);
        expect(fila.querySelector(".casilla").disabled).toBe(true);
        expect(fila.querySelector(".celda-estado").textContent).toBe("De baja");
    });
});

describe("pantalla", () => {
    test("carga la primera página y los totales", async () => {
        const logica = nuevaLogica();
        await usuarios.recargarUsuarios(logica);

        expect(document.querySelectorAll(".fila-usuario")).toHaveLength(10);
        expect(document.getElementById("conteo-todos").textContent).toMatch(/^\(\d+\)$/);
        expect(document.getElementById("boton-baja").disabled).toBe(true);
    });

    test("crear un técnico cierra el diálogo, avisa y lo añade", async () => {
        const logica = nuevaLogica();
        usuarios.mostrarDialogo("dialogo-nuevo", true);
        rellenarNuevo("Marta", "Pons", "marta.pons@gandia.org");

        await usuarios.enviarNuevoUsuario(eventoFalso(), logica);

        expect(visible("dialogo-nuevo")).toBe(false);
        expect(visible("aviso-ok")).toBe(true);
        const creado = logica.usuarios.find(u => u.correo === "marta.pons@gandia.org");
        expect(creado).toMatchObject({ rol: "tecnico", estado: "pendiente" });
    });

    test("con datos mal escritos marca los campos y no crea nada", async () => {
        const logica = nuevaLogica();
        const antes = logica.usuarios.length;
        rellenarNuevo("", "Pons", "marta");

        await usuarios.enviarNuevoUsuario(eventoFalso(), logica);

        expect(logica.usuarios).toHaveLength(antes);
        expect(document.getElementById("nuevo-nombre").classList.contains("error")).toBe(true);
        expect(document.getElementById("nuevo-correo").classList.contains("error")).toBe(true);
    });

    test("si el servidor rechaza el rol, el selector vuelve a como estaba", async () => {
        const logica = { cambiarRol: async () => ({ correcto: false, error: "No puedes cambiar tu propio rol" }) };
        const fila = usuarios.crearFilaUsuario({
            idUsuario: 3, nombre: "A", apellidos: "B", correo: "a@b.es", rol: "tecnico",
            premium: false, nodo: null, estado: "activo", fechaAlta: "2026-10-01T00:00:00Z"
        }, 1);
        document.getElementById("lista-usuarios").appendChild(fila);
        const selector = fila.querySelector(".selector-rol");
        selector.value = "portador";

        await usuarios.alCambiarRol(logica, selector);

        expect(selector.value).toBe("tecnico");
        expect(document.getElementById("aviso-error").textContent).toBe("No puedes cambiar tu propio rol");
    });

    test("dar de baja pide confirmación y luego marca a los usuarios", async () => {
        const logica = nuevaLogica();
        usuarios.pantalla.seleccionados.add(2);
        usuarios.actualizarSeleccion();
        expect(document.getElementById("texto-seleccion").textContent).toBe("1 seleccionado");

        usuarios.pedirConfirmacionBaja();
        expect(visible("dialogo-baja")).toBe(true);

        await usuarios.confirmarBaja(logica);

        expect(visible("dialogo-baja")).toBe(false);
        expect(logica.usuarios.find(u => u.idUsuario === 2).estado).toBe("baja");
        expect(usuarios.pantalla.seleccionados.size).toBe(0);
    });
});