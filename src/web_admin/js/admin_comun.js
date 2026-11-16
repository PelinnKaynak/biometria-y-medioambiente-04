// ------------------------------------------------------------
// admin_comun.js
// Lo que comparten todas las pantallas del panel de
// administración: el control de acceso por rol, el menú
// lateral (que en móvil se abre con ☰) y el botón Salir.
//
// Técnico y administrador entran los dos en el panel. La
// diferencia es que solo el administrador gestiona las
// cuentas (pantalla Usuarios) y puede ver la web como un
// usuario más (su página Mi cuenta).
// ------------------------------------------------------------

// Las consultas del rol (esAdministrador, esTecnico) están en
// web_publica/js/roles.js. En el navegador son globales; en las
// pruebas (Node) se cargan con require.
const rolesAdmin = typeof module !== "undefined" ? require("../../web_publica/js/roles") : window;

const PAGINA_LOGIN = "../web_publica/login.html";
const PAGINA_INICIO_PANEL = "panel_nodos.html";

// --------------------------------------------------------
// usuario: Usuario --> tieneAccesoAdmin() --> B
//
// Al panel entran los administradores y los técnicos.
// --------------------------------------------------------
function tieneAccesoAdmin(usuario) {
    return rolesAdmin.esAdministrador(usuario) || rolesAdmin.esTecnico(usuario);
}

// --------------------------------------------------------
// logica: LogicaAdmin, irA: (url: Text),
// solo_administrador: B --> comprobarAcceso() --> B
//
// Si no hay sesión o el usuario no tiene permiso, lo manda
// al inicio de sesión y devuelve false. Si la pantalla es
// solo para administradores y entra un técnico, lo manda a
// la pantalla de nodos.
// --------------------------------------------------------
function comprobarAcceso(logica, irA, solo_administrador = false) {
    const usuario = logica.usuarioActual();
    if (!tieneAccesoAdmin(usuario)) {
        irA(PAGINA_LOGIN);
        return false;
    }
    if (solo_administrador && !rolesAdmin.esAdministrador(usuario)) {
        irA(PAGINA_INICIO_PANEL);
        return false;
    }
    return true;
}

// --------------------------------------------------------
// usuario: Usuario --> ajustarMenuSegunRol()
//
// Las opciones marcadas con data-solo-admin (Usuarios y
// «Ver como usuario») solo se muestran al administrador.
// --------------------------------------------------------
function ajustarMenuSegunRol(usuario) {
    const admin = rolesAdmin.esAdministrador(usuario);
    for (const opcion of document.querySelectorAll("[data-solo-admin]")) {
        opcion.hidden = !admin;
    }
}

// --------------------------------------------------------
// abierto: B --> mostrarMenuMovil()
//
// Abre o cierra el menú lateral en pantallas pequeñas.
// --------------------------------------------------------
function mostrarMenuMovil(abierto) {
    document.getElementById("menu-lateral").classList.toggle("abierto", abierto);
    document.getElementById("boton-menu").setAttribute("aria-expanded", String(abierto));
    document.body.classList.toggle("sin-scroll", abierto);
}

// --------------------------------------------------------
// logica: LogicaAdmin, irA: (url: Text) --> conectarMenu()
//
// Enseña las opciones que tocan según el rol y conecta el
// botón ☰, el botón de cerrar el menú y Salir.
// Salir es un enlace al login: aunque fallara el JavaScript,
// seguiría llevando al inicio de sesión.
// --------------------------------------------------------
function conectarMenu(logica, irA) {
    ajustarMenuSegunRol(logica.usuarioActual());
    document.getElementById("boton-menu").addEventListener("click", () => mostrarMenuMovil(true));
    document.getElementById("boton-cerrar-menu").addEventListener("click", () => mostrarMenuMovil(false));
    document.getElementById("boton-salir").addEventListener("click", evento => {
        evento.preventDefault();
        logica.cerrarSesion();
        irA(PAGINA_LOGIN);
    });
    // Al elegir una opción del menú en el móvil, se cierra
    for (const opcion of document.querySelectorAll(".opcion-menu")) {
        opcion.addEventListener("click", () => mostrarMenuMovil(false));
    }
}

if (typeof module !== "undefined") {
    module.exports = {
        tieneAccesoAdmin, comprobarAcceso, ajustarMenuSegunRol,
        mostrarMenuMovil, conectarMenu, PAGINA_LOGIN, PAGINA_INICIO_PANEL
    };
}