// ------------------------------------------------------------
// usuarios.js
// Controlador de la gestión de usuarios (usuarios.html, T029).
// Lista los usuarios por tipo, permite crear cuentas de
// técnico y administrador, cambiar el rol y dar de baja.
// ------------------------------------------------------------

const enNodeUsuarios = typeof module !== "undefined";
const comunUsuarios = enNodeUsuarios ? require("./admin_comun") : window;
const reglasUsuarios = enNodeUsuarios ? require("../../web_publica/js/validacion") : window;
const formatoUsuarios = enNodeUsuarios ? require("./nodos") : window;

const USUARIOS_POR_PAGINA = 10;
const PATRON_NOMBRE = /^\p{L}+([ '’-]\p{L}+)*$/u;
const TEXTO_ROL = { portador: "Portador", tecnico: "Técnico", administrador: "Administrador", ciudadano: "Ciudadano" };
const TEXTO_ESTADO = { activo: "Activo", pendiente: "Pendiente", baja: "De baja" };

const pantalla = {
    filtro: { busqueda: "", grupo: "todos", estado: "todos", pagina: 1, porPagina: USUARIOS_POR_PAGINA },
    total: 0,
    seleccionados: new Set()
};

// --------------------------------------------------------
// fecha_iso: Text --> formatearFecha() --> Text
//
// "2026-09-12T08:00:00Z" → "12/09/2026"
// --------------------------------------------------------
function formatearFecha(fecha_iso) {
    const fecha = new Date(fecha_iso);
    const dos = n => String(n).padStart(2, "0");
    return dos(fecha.getDate()) + "/" + dos(fecha.getMonth() + 1) + "/" + fecha.getFullYear();
}

// --------------------------------------------------------
// datos: NuevoUsuario --> validarNuevoUsuario()
//                     --> errores: [ ErrorCampo ]
//
// Nombre y apellidos: solo letras (con tildes), separadas por
// un espacio, guion o apóstrofo, como en el servidor y la app.
// Correo: las reglas de web_publica/js/validacion.js.
// Rol: técnico o administrador.
// --------------------------------------------------------
function validarNuevoUsuario(datos) {
    const errores = [];
    if (!PATRON_NOMBRE.test(datos.nombre.trim())) {
        errores.push({ campo: "nuevo-nombre", mensaje: "Escribe un nombre válido (solo letras)" });
    }
    if (!PATRON_NOMBRE.test(datos.apellidos.trim())) {
        errores.push({ campo: "nuevo-apellidos", mensaje: "Escribe unos apellidos válidos (solo letras)" });
    }
    const errorCorreo = reglasUsuarios.errorCorreo(datos.correo);
    if (errorCorreo) errores.push({ campo: "nuevo-correo", mensaje: errorCorreo });
    if (!["tecnico", "administrador"].includes(datos.rol)) {
        errores.push({ campo: "nuevo-rol", mensaje: "Elige técnico o administrador" });
    }
    return errores;
}

// --------------------------------------------------------
// conteo: ConteoUsuarios --> pintarConteo()
// --------------------------------------------------------
function pintarConteo(conteo) {
    for (const grupo of ["todos", "portadores", "premium", "administradores", "tecnicos"]) {
        document.getElementById("conteo-" + grupo).textContent =
            "(" + formatoUsuarios.formatearNumero(conteo[grupo]) + ")";
    }
}

// --------------------------------------------------------
// usuario: UsuarioAdmin, id_actual: N --> crearFilaUsuario()
//                                     --> Elemento
//
// Crea la fila con la casilla de selección, el nombre y el
// correo, el selector de rol, el nodo, el estado y la fecha de
// alta. El propio administrador y los usuarios de baja no se
// pueden seleccionar ni cambiar de rol.
// --------------------------------------------------------
function crearFilaUsuario(usuario, id_actual) {
    const fila = document.createElement("li");
    fila.className = "fila-usuario";
    fila.dataset.id = usuario.idUsuario;
    const bloqueado = usuario.idUsuario === id_actual || usuario.estado === "baja";
    if (usuario.estado === "baja") fila.classList.add("de-baja");

    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.className = "casilla";
    casilla.disabled = bloqueado;
    casilla.checked = pantalla.seleccionados.has(usuario.idUsuario);
    casilla.setAttribute("aria-label", "Seleccionar a " + usuario.nombre + " " + usuario.apellidos);

    const persona = document.createElement("span");
    persona.className = "celda-persona";
    const nombre = document.createElement("strong");
    nombre.textContent = usuario.nombre + " " + usuario.apellidos;
    const correo = document.createElement("span");
    correo.className = "correo";
    correo.textContent = usuario.correo;
    persona.append(nombre, correo);

    const celdaRol = document.createElement("span");
    celdaRol.className = "celda-rol";
    const selector = document.createElement("select");
    selector.className = "selector-rol";
    selector.disabled = bloqueado;
    selector.setAttribute("aria-label", "Rol de " + usuario.nombre);
    for (const rol of ["portador", "tecnico", "administrador"]) {
        const opcion = new Option(TEXTO_ROL[rol], rol, false, usuario.rol === rol);
        selector.add(opcion);
    }
    selector.dataset.rolAnterior = usuario.rol;
    celdaRol.appendChild(selector);
    if (usuario.premium) {
        const premium = document.createElement("span");
        premium.className = "etiqueta etiqueta-premium";
        premium.textContent = "Premium";
        celdaRol.appendChild(premium);
    }

    const nodo = document.createElement("span");
    nodo.className = "celda-nodo";
    nodo.textContent = usuario.nodo || "Sin nodo";

    const estado = document.createElement("span");
    estado.className = "celda-estado";
    estado.innerHTML = '<span class="etiqueta etiqueta-' + usuario.estado + '"></span>';
    estado.firstChild.textContent = TEXTO_ESTADO[usuario.estado] || usuario.estado;

    const alta = document.createElement("span");
    alta.className = "celda-alta";
    alta.textContent = formatearFecha(usuario.fechaAlta);

    fila.append(casilla, persona, celdaRol, nodo, estado, alta);
    return fila;
}

// --------------------------------------------------------
// actualizarSeleccion()
//
// Escribe cuántos usuarios hay seleccionados y activa el
// botón «Dar de baja» solo si hay alguno.
// --------------------------------------------------------
function actualizarSeleccion() {
    const n = pantalla.seleccionados.size;
    document.getElementById("texto-seleccion").textContent =
        n === 0 ? "Ningún usuario seleccionado" : n === 1 ? "1 seleccionado" : n + " seleccionados";
    document.getElementById("boton-baja").disabled = n === 0;
}

// --------------------------------------------------------
// usuarios: [ UsuarioAdmin ], id_actual: N, anadir: B
//   --> pintarListaUsuarios()
// --------------------------------------------------------
function pintarListaUsuarios(usuarios, id_actual, anadir) {
    const lista = document.getElementById("lista-usuarios");
    if (!anadir) lista.innerHTML = "";
    for (const usuario of usuarios) {
        lista.appendChild(crearFilaUsuario(usuario, id_actual));
    }
    document.getElementById("sin-resultados").classList.toggle("oculto", lista.children.length > 0);
}

// --------------------------------------------------------
// pintarPaginacionUsuarios()
// --------------------------------------------------------
function pintarPaginacionUsuarios() {
    const { pagina, porPagina } = pantalla.filtro;
    const total = pantalla.total;
    const hayMas = pagina * porPagina < total;
    const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
    const hasta = Math.min(pagina * porPagina, total);

    document.getElementById("texto-paginacion").textContent =
        total === 0 ? "0 de 0" : desde + "-" + hasta + " de " + formatoUsuarios.formatearNumero(total);
    document.getElementById("boton-anterior").disabled = pagina <= 1;
    document.getElementById("boton-siguiente").disabled = !hayMas;
    document.getElementById("boton-ver-mas").classList.toggle("oculto", !hayMas);
}

// --------------------------------------------------------
// mensaje: Text, tipo: Text --> mostrarAviso()
//
// tipo "ok" muestra el aviso verde y "error" el rojo. Un
// mensaje vacío lo esconde.
// --------------------------------------------------------
function mostrarAviso(mensaje, tipo) {
    const ok = document.getElementById("aviso-ok");
    const error = document.getElementById("aviso-error");
    ok.classList.add("oculto");
    error.classList.add("oculto");
    if (!mensaje) return;
    const aviso = tipo === "ok" ? ok : error;
    aviso.textContent = mensaje;
    aviso.classList.remove("oculto");
}

// --------------------------------------------------------
// logica: LogicaAdmin, anadir: B --> cargarUsuarios()
// --------------------------------------------------------
async function cargarUsuarios(logica, anadir = false) {
    const resultado = await logica.obtenerUsuarios(pantalla.filtro);
    if (!resultado.correcto) {
        mostrarAviso(resultado.error, "error");
        return;
    }
    pantalla.total = resultado.total;
    const actual = logica.usuarioActual();
    pintarListaUsuarios(resultado.usuarios, actual ? actual.id : null, anadir);
    pintarPaginacionUsuarios();
}

// --------------------------------------------------------
// logica: LogicaAdmin --> cargarConteo()
// --------------------------------------------------------
async function cargarConteo(logica) {
    const resultado = await logica.obtenerConteoUsuarios();
    if (resultado.correcto) pintarConteo(resultado.conteo);
}

// --------------------------------------------------------
// logica: LogicaAdmin --> recargarUsuarios()
//
// Vuelve a la página 1, vacía la selección y recarga la lista
// y los totales.
// --------------------------------------------------------
async function recargarUsuarios(logica) {
    pantalla.filtro.pagina = 1;
    pantalla.seleccionados.clear();
    actualizarSeleccion();
    await Promise.all([cargarUsuarios(logica), cargarConteo(logica)]);
}

// --------------------------------------------------------
// id: Text, abierto: B --> mostrarDialogo()
// --------------------------------------------------------
function mostrarDialogo(id, abierto) {
    document.getElementById(id).classList.toggle("oculto", !abierto);
    document.body.classList.toggle("sin-scroll", abierto);
    if (abierto) {
        const primero = document.querySelector("#" + id + " input, #" + id + " button");
        if (primero) primero.focus();
    }
}

// --------------------------------------------------------
// evento: Evento, logica: LogicaAdmin --> enviarNuevoUsuario()
//
// Valida el formulario del diálogo y crea la cuenta. Si va
// bien, cierra el diálogo, avisa y recarga la lista.
// --------------------------------------------------------
async function enviarNuevoUsuario(evento, logica) {
    evento.preventDefault();
    const error = document.getElementById("error-nuevo");
    error.classList.add("oculto");
    for (const campo of document.querySelectorAll("#formulario-nuevo .campo")) {
        campo.classList.remove("error");
    }

    const datos = {
        nombre: document.getElementById("nuevo-nombre").value,
        apellidos: document.getElementById("nuevo-apellidos").value,
        correo: document.getElementById("nuevo-correo").value.trim(),
        rol: document.getElementById("nuevo-rol").value
    };

    const marcar = (mensaje, campos) => {
        error.textContent = mensaje;
        error.classList.remove("oculto");
        for (const id of campos) document.getElementById(id).classList.add("error");
    };

    const errores = validarNuevoUsuario(datos);
    if (errores.length > 0) {
        marcar(errores[0].mensaje, errores.map(e => e.campo));
        return;
    }

    const resultado = await logica.crearUsuario({
        nombre: datos.nombre.trim(), apellidos: datos.apellidos.trim(), correo: datos.correo, rol: datos.rol
    });
    if (!resultado.correcto) {
        marcar(resultado.error, (resultado.campos || []).map(c => "nuevo-" + c));
        return;
    }

    document.getElementById("formulario-nuevo").reset();
    mostrarDialogo("dialogo-nuevo", false);
    mostrarAviso("Cuenta creada. Hemos enviado a " + datos.correo + " un correo para que elija su contraseña.", "ok");
    await recargarUsuarios(logica);
}

// --------------------------------------------------------
// logica: LogicaAdmin, selector: Elemento --> alCambiarRol()
//
// Cambia el rol del usuario de esa fila. Si el servidor no lo
// permite, deja el selector como estaba.
// --------------------------------------------------------
async function alCambiarRol(logica, selector) {
    const id = Number(selector.closest(".fila-usuario").dataset.id);
    const rol = selector.value;
    const resultado = await logica.cambiarRol(id, rol);

    if (!resultado.correcto) {
        selector.value = selector.dataset.rolAnterior;
        mostrarAviso(resultado.error, "error");
        return;
    }
    selector.dataset.rolAnterior = rol;
    mostrarAviso("Rol cambiado a " + TEXTO_ROL[rol].toLowerCase() + ".", "ok");
    await cargarConteo(logica);
}

// --------------------------------------------------------
// pedirConfirmacionBaja()
//
// Abre el diálogo de confirmación con el número de usuarios.
// --------------------------------------------------------
function pedirConfirmacionBaja() {
    const n = pantalla.seleccionados.size;
    document.getElementById("texto-baja").textContent =
        (n === 1 ? "El usuario seleccionado" : "Los " + n + " usuarios seleccionados") +
        " ya no podrán iniciar sesión ni en la web ni en la app.";
    mostrarDialogo("dialogo-baja", true);
}

// --------------------------------------------------------
// logica: LogicaAdmin --> confirmarBaja()
// --------------------------------------------------------
async function confirmarBaja(logica) {
    const ids = [...pantalla.seleccionados];
    const resultado = await logica.darDeBaja(ids);
    mostrarDialogo("dialogo-baja", false);

    if (!resultado.correcto) {
        mostrarAviso(resultado.error, "error");
        return;
    }
    mostrarAviso(ids.length === 1 ? "Usuario dado de baja." : ids.length + " usuarios dados de baja.", "ok");
    await recargarUsuarios(logica);
}

// --------------------------------------------------------
// iniciarPantallaUsuarios()
// --------------------------------------------------------
function iniciarPantallaUsuarios() {
    const logica = crearLogicaAdmin();
    const irA = url => window.location.assign(url);
    if (!comunUsuarios.comprobarAcceso(logica, irA)) return;
    comunUsuarios.conectarMenu(logica, irA);

    let espera;
    document.getElementById("buscador").addEventListener("input", evento => {
        clearTimeout(espera);
        espera = setTimeout(() => { pantalla.filtro.busqueda = evento.target.value; recargarUsuarios(logica); }, 300);
    });
    document.getElementById("filtro-estado").addEventListener("change", evento => {
        pantalla.filtro.estado = evento.target.value;
        recargarUsuarios(logica);
    });
    for (const boton of document.querySelectorAll(".grupo")) {
        boton.addEventListener("click", () => {
            document.querySelectorAll(".grupo").forEach(b => b.classList.toggle("activo", b === boton));
            pantalla.filtro.grupo = boton.dataset.grupo;
            recargarUsuarios(logica);
        });
    }

    const lista = document.getElementById("lista-usuarios");
    lista.addEventListener("change", evento => {
        const elemento = evento.target;
        if (elemento.classList.contains("casilla")) {
            const id = Number(elemento.closest(".fila-usuario").dataset.id);
            if (elemento.checked) pantalla.seleccionados.add(id);
            else pantalla.seleccionados.delete(id);
            actualizarSeleccion();
        } else if (elemento.classList.contains("selector-rol")) {
            alCambiarRol(logica, elemento);
        }
    });

    document.getElementById("boton-anterior").addEventListener("click", () => {
        pantalla.filtro.pagina--;
        cargarUsuarios(logica);
    });
    document.getElementById("boton-siguiente").addEventListener("click", () => {
        pantalla.filtro.pagina++;
        cargarUsuarios(logica);
    });
    document.getElementById("boton-ver-mas").addEventListener("click", () => {
        pantalla.filtro.pagina++;
        cargarUsuarios(logica, true);
    });

    document.getElementById("boton-anadir").addEventListener("click", () => mostrarDialogo("dialogo-nuevo", true));
    document.getElementById("formulario-nuevo").addEventListener("submit", evento => enviarNuevoUsuario(evento, logica));
    document.getElementById("boton-baja").addEventListener("click", pedirConfirmacionBaja);
    document.getElementById("boton-confirmar-baja").addEventListener("click", () => confirmarBaja(logica));
    for (const boton of document.querySelectorAll("[data-cerrar]")) {
        boton.addEventListener("click", () => mostrarDialogo(boton.dataset.cerrar, false));
    }
    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
            mostrarDialogo("dialogo-nuevo", false);
            mostrarDialogo("dialogo-baja", false);
        }
    });

    recargarUsuarios(logica);
}

if (enNodeUsuarios) {
    module.exports = {
        pantalla, formatearFecha, validarNuevoUsuario, crearFilaUsuario, actualizarSeleccion,
        cargarUsuarios, recargarUsuarios, enviarNuevoUsuario, alCambiarRol,
        pedirConfirmacionBaja, confirmarBaja, mostrarDialogo
    };
} else {
    document.addEventListener("DOMContentLoaded", iniciarPantallaUsuarios);
}