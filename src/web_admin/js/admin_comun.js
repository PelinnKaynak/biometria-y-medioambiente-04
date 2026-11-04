// ------------------------------------------------------------
// admin_comun.js
// Lo que comparten todas las pantallas del panel de
// administración: el control de acceso por rol, el menú
// lateral (que en móvil se abre con ☰) y el botón Salir.
// ------------------------------------------------------------

const ROLES_ADMIN = ["ADMINISTRADOR", "TECNICO"];
const PAGINA_LOGIN = "../web_publica/login.html";

// --------------------------------------------------------
// usuario: Usuario --> tieneAccesoAdmin() --> B
//
// Solo entran administradores y técnicos. El rol se compara
// sin tener en cuenta mayúsculas, porque el servidor lo
// manda en minúsculas.
// --------------------------------------------------------
function tieneAccesoAdmin(usuario) {
    return Boolean(usuario) && ROLES_ADMIN.includes(String(usuario.rol).toUpperCase());
}

// --------------------------------------------------------
// logica: LogicaAdmin, irA: (url: Text) --> comprobarAcceso()
//                                       --> B
//
// Si no hay sesión o el usuario no tiene permiso, lo manda
// al inicio de sesión y devuelve false.
// --------------------------------------------------------
function comprobarAcceso(logica, irA) {
    if (!tieneAccesoAdmin(logica.usuarioActual())) {
        irA(PAGINA_LOGIN);
        return false;
    }
    return true;
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
// Conecta el botón ☰, el botón de cerrar el menú y Salir.
// Salir es un enlace al login: aunque fallara el JavaScript,
// seguiría llevando al inicio de sesión.
// --------------------------------------------------------
function conectarMenu(logica, irA) {
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
    module.exports = { tieneAccesoAdmin, comprobarAcceso, mostrarMenuMovil, conectarMenu, PAGINA_LOGIN };
}