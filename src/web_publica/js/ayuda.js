// ------------------------------------------------------------
// ayuda.js
// Controlador de la pantalla Ayuda (ayuda.html, T042 · H038).
// Gestiona las preguntas frecuentes, el formulario de incidencias
// y la lista de Mis incidencias con su estado y respuesta.
// ------------------------------------------------------------

// Consultas de los roles (roles.js): globales en el navegador, require en Node
const rolesAyuda = typeof module !== "undefined" ? require("./roles") : window;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// --------------------------------------------------------
// isoString: Text, conHora: B --> formatearFecha() --> Text
// --------------------------------------------------------
function formatearFecha(isoString, conHora = false) {
    if (!isoString) return "";
    const fecha = new Date(isoString);
    if (isNaN(fecha.getTime())) return isoString;

    const dia = fecha.getDate();
    const mes = MESES[fecha.getMonth()];
    if (!conHora) return `${dia} ${mes}`;

    const horas = String(fecha.getHours()).padStart(2, "0");
    const minutos = String(fecha.getMinutes()).padStart(2, "0");
    return `${dia} ${mes} · ${horas}:${minutos}`;
}

// --------------------------------------------------------
// estado: Text --> textoEstado() --> { texto: Text, clase: Text }
// --------------------------------------------------------
function textoEstado(estado) {
    const est = (estado || "").toLowerCase().trim();
    if (est === "resuelta") {
        return { texto: "Resuelta", clase: "resuelta" };
    }
    if (est === "en curso" || est === "en_curso") {
        return { texto: "En curso", clase: "en-curso" };
    }
    return { texto: "Abierta", clase: "abierta" };
}

// --------------------------------------------------------
// tipo: Text --> textoTipo() --> Text
// --------------------------------------------------------
function textoTipo(tipo) {
    const t = (tipo || "").toLowerCase().trim();
    switch (t) {
        case "sensor": return "Sensor";
        case "datos": return "Mediciones";
        case "cuenta": return "Cuenta";
        default: return "Consulta";
    }
}

// --------------------------------------------------------
// datos: { asunto, descripcion } --> validarIncidencia() --> { valido: B, error: Text, campo: Text }
//
// Validación obligatoria: Con el mensaje vacío no se envía.
// --------------------------------------------------------
function validarIncidencia(datos) {
    const asunto = (datos.asunto || "").trim();
    const descripcion = (datos.descripcion || "").trim();

    if (!asunto) {
        return { valido: false, error: "Escribe un asunto para la incidencia", campo: "asunto" };
    }
    if (!descripcion) {
        return { valido: false, error: "Escribe un mensaje explicando tu incidencia", campo: "descripcion" };
    }
    return { valido: true, error: "", campo: "" };
}

// --------------------------------------------------------
// contenedor: HTMLElement, lista: [ Incidencia ] --> pintarIncidencias()
// --------------------------------------------------------
function pintarIncidencias(contenedor, lista) {
    contenedor.innerHTML = "";

    if (!lista || lista.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "sin-incidencias";
        vacio.id = "texto-sin-incidencias";
        vacio.textContent = "Aún no has enviado ninguna incidencia.";
        contenedor.appendChild(vacio);
        return;
    }

    const listaElemento = document.createElement("div");
    listaElemento.className = "lista-incidencias";

    for (const item of lista) {
        const est = textoEstado(item.estado);
        const tipoLabel = textoTipo(item.tipo);
        const fechaTxt = formatearFecha(item.fechaCreacion, true);

        const tarjeta = document.createElement("article");
        tarjeta.className = "tarjeta-incidencia";
        tarjeta.dataset.id = String(item.idIncidencia);

        // Cabecera de la tarjeta
        const cabecera = document.createElement("div");
        cabecera.className = "cabecera-incidencia";

        const tipoYFecha = document.createElement("div");
        tipoYFecha.className = "tipo-y-fecha";
        tipoYFecha.innerHTML = `<span class="etiqueta-tipo">${tipoLabel}</span><span>${fechaTxt}</span>`;

        const badgeEstado = document.createElement("span");
        badgeEstado.className = `etiqueta-estado ${est.clase}`;
        badgeEstado.textContent = est.texto;

        cabecera.appendChild(tipoYFecha);
        cabecera.appendChild(badgeEstado);

        // Asunto y descripción
        const asunto = document.createElement("h3");
        asunto.className = "asunto-incidencia";
        asunto.textContent = item.asunto;

        const desc = document.createElement("p");
        desc.className = "descripcion-incidencia";
        desc.textContent = item.descripcion;

        tarjeta.appendChild(cabecera);
        tarjeta.appendChild(asunto);
        tarjeta.appendChild(desc);

        // Bloque de respuesta o aviso de pendiente
        if (item.respuesta) {
            const respBloque = document.createElement("div");
            respBloque.className = "bloque-respuesta";

            const respCabecera = document.createElement("div");
            respCabecera.className = "cabecera-respuesta";

            const nombreResp = item.responsable && item.responsable.nombre
                ? `${item.responsable.nombre} (${item.responsable.rol || "soporte"})`
                : "Equipo de soporte";
            const fechaResp = item.fechaRespuesta ? ` · ${formatearFecha(item.fechaRespuesta)}` : "";

            respCabecera.textContent = `Respuesta de ${nombreResp}${fechaResp}`;

            const respTexto = document.createElement("p");
            respTexto.className = "texto-respuesta";
            respTexto.textContent = item.respuesta;

            respBloque.appendChild(respCabecera);
            respBloque.appendChild(respTexto);
            tarjeta.appendChild(respBloque);
        } else {
            const pendiente = document.createElement("p");
            pendiente.className = "pendiente-respuesta";
            pendiente.textContent = "⏳ Tu incidencia está siendo revisada por nuestro equipo técnico.";
            tarjeta.appendChild(pendiente);
        }

        listaElemento.appendChild(tarjeta);
    }

    contenedor.appendChild(listaElemento);
}

// --------------------------------------------------------
// logica: LogicaAyudaFake | LogicaAyudaReal --> cargarMisIncidencias()
// --------------------------------------------------------
async function cargarMisIncidencias(logica) {
    const contenedor = document.getElementById("contenedor-mis-incidencias");
    if (!contenedor) return;

    const usuario = logica.usuarioActual();
    const avisoSinSesion = document.getElementById("aviso-sin-sesion");

    if (!usuario) {
        if (avisoSinSesion) avisoSinSesion.classList.remove("oculto");
        contenedor.innerHTML = '<p class="sin-incidencias" id="texto-sin-sesion">Inicia sesión para consultar tus incidencias y respuestas de soporte.</p>';
        return;
    }

    if (avisoSinSesion) avisoSinSesion.classList.add("oculto");

    const resultado = await logica.obtenerMisIncidencias();
    if (!resultado.correcto) {
        contenedor.innerHTML = `<p class="aviso-error">${resultado.error || "Error al cargar incidencias"}</p>`;
        return;
    }

    pintarIncidencias(contenedor, resultado.incidencias);
}

// --------------------------------------------------------
// evento: Event, logica: LogicaAyuda --> enviarIncidenciaFormulario()
// --------------------------------------------------------
async function enviarIncidenciaFormulario(evento, logica) {
    if (evento) evento.preventDefault();

    const campoAsunto = document.getElementById("asunto-incidencia");
    const campoDesc = document.getElementById("descripcion-incidencia");
    const campoTipo = document.getElementById("tipo-incidencia");
    const errorMsg = document.getElementById("error-formulario");
    const exitoMsg = document.getElementById("exito-formulario");
    const botonEnviar = document.getElementById("boton-enviar");

    if (errorMsg) errorMsg.classList.add("oculto");
    if (exitoMsg) exitoMsg.classList.add("oculto");
    if (campoAsunto) campoAsunto.classList.remove("error");
    if (campoDesc) campoDesc.classList.remove("error");

    const asunto = campoAsunto ? campoAsunto.value : "";
    const descripcion = campoDesc ? campoDesc.value : "";
    const tipo = campoTipo ? campoTipo.value : "otra";

    // Validación obligatoria: Con el mensaje vacío no se envía
    const validacion = validarIncidencia({ asunto, descripcion });
    if (!validacion.valido) {
        if (errorMsg) {
            errorMsg.textContent = validacion.error;
            errorMsg.classList.remove("oculto");
        }
        if (validacion.campo === "asunto" && campoAsunto) {
            campoAsunto.classList.add("error");
            campoAsunto.focus();
        } else if (validacion.campo === "descripcion" && campoDesc) {
            campoDesc.classList.add("error");
            campoDesc.focus();
        }
        return false;
    }

    if (botonEnviar) botonEnviar.disabled = true;

    const resultado = await logica.crearIncidencia({ tipo, asunto, descripcion });

    if (botonEnviar) botonEnviar.disabled = false;

    if (!resultado.correcto) {
        if (errorMsg) {
            errorMsg.textContent = resultado.error || "No se ha podido enviar la incidencia.";
            errorMsg.classList.remove("oculto");
        }
        return false;
    }

    // Éxito: limpiar campos y recargar lista
    if (campoAsunto) campoAsunto.value = "";
    if (campoDesc) campoDesc.value = "";
    if (exitoMsg) exitoMsg.classList.remove("oculto");

    await cargarMisIncidencias(logica);
    return true;
}

// --------------------------------------------------------
// iniciarPantallaAyuda()
// --------------------------------------------------------
function iniciarPantallaAyuda() {
    const logica = typeof crearLogicaAyuda === "function" ? crearLogicaAyuda() : new LogicaAyudaFake();

    // Conectar menú responsive
    const botonMenu = document.getElementById("boton-menu-inicio");
    const menu = document.getElementById("menu-inicio");
    if (botonMenu && menu) {
        botonMenu.addEventListener("click", () => {
            const abierto = menu.classList.toggle("abierto");
            botonMenu.setAttribute("aria-expanded", String(abierto));
            botonMenu.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
        });
    }

    // Conectar estado de usuario en cabecera
    const usuario = logica.usuarioActual();
    const botonAcceder = document.getElementById("boton-acceder");
    if (botonAcceder) {
        if (usuario) {
            const esAdmin = rolesAyuda.tieneAccesoPanel(usuario);
            botonAcceder.textContent = esAdmin ? "Panel" : "Mi cuenta";
            botonAcceder.href = esAdmin ? "../web_admin/panel_nodos.html" : "mi_cuenta.html";
        } else {
            botonAcceder.textContent = "Acceder";
            botonAcceder.href = "login.html";
        }
    }

    // Conectar formulario
    const formulario = document.getElementById("formulario-incidencia");
    if (formulario) {
        formulario.addEventListener("submit", evento => enviarIncidenciaFormulario(evento, logica));
    }

    // Cargar incidencias al entrar
    cargarMisIncidencias(logica);
}

if (typeof module !== "undefined") {
    module.exports = {
        formatearFecha,
        textoEstado,
        textoTipo,
        validarIncidencia,
        pintarIncidencias,
        cargarMisIncidencias,
        enviarIncidenciaFormulario
    };
} else {
    document.addEventListener("DOMContentLoaded", iniciarPantallaAyuda);
}
