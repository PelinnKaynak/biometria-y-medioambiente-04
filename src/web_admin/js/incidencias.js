// ------------------------------------------------------------
// incidencias.js · gestión de incidencias del panel (T044)
// ------------------------------------------------------------

const enNodeIncidencias = typeof module !== "undefined" && module.exports;
const comunIncidencias = typeof module !== "undefined" ? require("./admin_comun") : window;
const TIPOS_INCIDENCIA = {
    sensor: "Sensor",
    datos: "Datos",
    cuenta: "Cuenta",
    otra: "Otra"
};
const ESTADOS_INCIDENCIA = {
    abierta: "Abierta",
    "en curso": "En curso",
    resuelta: "Resuelta"
};

const pantallaIncidencias = {
    incidencias: [],
    idSeleccionada: null,
    solicitudLista: 0,
    solicitudDetalle: 0
};

function mostrarAvisoIncidencias(id, texto) {
    const aviso = document.getElementById(id);
    aviso.textContent = texto;
    aviso.classList.toggle("oculto", !texto);
}

function formatearFechaIncidencia(fecha) {
    if (!fecha) return "Sin fecha";
    const fechaValida = new Date(fecha);
    if (Number.isNaN(fechaValida.getTime())) return "Sin fecha";
    return new Intl.DateTimeFormat("es-ES", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    }).format(fechaValida);
}

function crearBotonIncidencia(incidencia, seleccionada) {
    const elemento = document.createElement("li");
    elemento.className = "incidencia-lista-item";
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton-incidencia";
    boton.dataset.id = String(incidencia.idIncidencia);
    boton.setAttribute("aria-current", String(seleccionada));

    const etiquetas = document.createElement("span");
    etiquetas.className = "fila-etiquetas";
    const tipo = document.createElement("span");
    tipo.className = "etiqueta-tipo";
    tipo.textContent = TIPOS_INCIDENCIA[incidencia.tipo] || incidencia.tipo;
    const estado = document.createElement("span");
    estado.className = "etiqueta-estado " + claseEstado(incidencia.estado);
    estado.textContent = ESTADOS_INCIDENCIA[incidencia.estado] || incidencia.estado;
    etiquetas.append(tipo, estado);

    const asunto = document.createElement("span");
    asunto.className = "asunto-lista";
    asunto.textContent = incidencia.asunto;
    const fecha = document.createElement("span");
    fecha.className = "fecha-lista";
    fecha.textContent = formatearFechaIncidencia(incidencia.fechaCreacion);
    boton.append(etiquetas, asunto, fecha);
    elemento.appendChild(boton);
    return elemento;
}

function pintarListaIncidencias() {
    const lista = document.getElementById("lista-incidencias");
    lista.replaceChildren();
    for (const incidencia of pantallaIncidencias.incidencias) {
        lista.appendChild(crearBotonIncidencia(
            incidencia, incidencia.idIncidencia === pantallaIncidencias.idSeleccionada));
    }
    document.getElementById("total-incidencias").textContent = String(pantallaIncidencias.incidencias.length);
    document.getElementById("sin-incidencias").classList.toggle("oculto", pantallaIncidencias.incidencias.length > 0);
}

async function cargarIncidencias(logica) {
    const solicitud = ++pantallaIncidencias.solicitudLista;
    mostrarAvisoIncidencias("aviso-error", "");
    mostrarAvisoIncidencias("aviso-ok", "");
    const resultado = await logica.obtenerIncidencias({
        estado: document.getElementById("filtro-estado").value,
        tipo: document.getElementById("filtro-tipo").value
    });
    if (solicitud !== pantallaIncidencias.solicitudLista) return;
    if (!resultado.correcto) {
        pantallaIncidencias.incidencias = [];
        pantallaIncidencias.idSeleccionada = null;
        pintarListaIncidencias();
        mostrarDetalleVacio();
        mostrarAvisoIncidencias("aviso-error", resultado.error);
        return;
    }

    pantallaIncidencias.incidencias = resultado.incidencias;
    const seleccionadaExiste = pantallaIncidencias.incidencias.some(
        incidencia => incidencia.idIncidencia === pantallaIncidencias.idSeleccionada);
    if (!seleccionadaExiste) {
        pantallaIncidencias.idSeleccionada = pantallaIncidencias.incidencias.length
            ? pantallaIncidencias.incidencias[0].idIncidencia : null;
    }
    pintarListaIncidencias();
    if (pantallaIncidencias.idSeleccionada === null) mostrarDetalleVacio();
    else await cargarDetalleIncidencia(logica, pantallaIncidencias.idSeleccionada);
}

function mostrarDetalleVacio() {
    document.getElementById("detalle-vacio").classList.remove("oculto");
    document.getElementById("detalle-contenido").classList.add("oculto");
}

function claseEstado(estado) {
    return estado === "en curso" ? "en-curso" : estado;
}

function pintarDetalleIncidencia(incidencia) {
    document.getElementById("detalle-vacio").classList.add("oculto");
    document.getElementById("detalle-contenido").classList.remove("oculto");
    document.getElementById("detalle-tipo").textContent = TIPOS_INCIDENCIA[incidencia.tipo] || incidencia.tipo;
    const estado = document.getElementById("detalle-estado");
    estado.textContent = ESTADOS_INCIDENCIA[incidencia.estado] || incidencia.estado;
    estado.className = "etiqueta-estado " + claseEstado(incidencia.estado);
    document.getElementById("asunto-incidencia").textContent = incidencia.asunto;
    document.getElementById("descripcion-incidencia").textContent = incidencia.descripcion;
    document.getElementById("usuario-incidencia").textContent =
        [incidencia.usuario.nombre, incidencia.usuario.apellidos].filter(Boolean).join(" ");
    document.getElementById("correo-incidencia").textContent = incidencia.usuario.correo || "Sin correo";

    const sensor = incidencia.sensor;
    document.getElementById("sensor-incidencia").textContent = sensor
        ? [sensor.nombre, sensor.numeroSerie].filter(Boolean).join(" · ")
        : "Sin sensor asociado";
    document.getElementById("bateria-incidencia").textContent = sensor
        ? "Batería: " + (sensor.bateria === null || sensor.bateria === undefined ? "Sin dato" : sensor.bateria + "%")
        : "Batería: —";
    document.getElementById("conexion-incidencia").textContent = sensor
        ? "Última conexión: " + formatearFechaIncidencia(sensor.ultimaConexion)
        : "Última conexión: —";

    const respuestaPanel = document.getElementById("respuesta-actual-panel");
    respuestaPanel.classList.toggle("oculto", !incidencia.respuesta);
    document.getElementById("respuesta-actual").textContent = incidencia.respuesta || "";
    document.getElementById("nuevo-estado").value = incidencia.estado;
    document.getElementById("texto-respuesta").value = "";
    document.getElementById("error-respuesta").classList.add("oculto");
}

async function cargarDetalleIncidencia(logica, idIncidencia) {
    pantallaIncidencias.idSeleccionada = idIncidencia;
    const solicitud = ++pantallaIncidencias.solicitudDetalle;
    pintarListaIncidencias();
    const resultado = await logica.obtenerIncidencia(idIncidencia);
    if (solicitud !== pantallaIncidencias.solicitudDetalle ||
        idIncidencia !== pantallaIncidencias.idSeleccionada) return;
    if (!resultado.correcto) {
        mostrarDetalleVacio();
        mostrarAvisoIncidencias("aviso-error", resultado.error);
        return;
    }
    pintarDetalleIncidencia(resultado.incidencia);
}

async function enviarRespuestaIncidencia(evento, logica) {
    evento.preventDefault();
    const error = document.getElementById("error-respuesta");
    const boton = document.getElementById("boton-guardar-respuesta");
    const respuesta = document.getElementById("texto-respuesta").value.trim();
    const estado = document.getElementById("nuevo-estado").value;
    const incidencia = pantallaIncidencias.incidencias.find(
        item => item.idIncidencia === pantallaIncidencias.idSeleccionada);
    if (!incidencia) return;
    if (!respuesta && estado === incidencia.estado) {
        error.textContent = "Escribe una respuesta o cambia el estado antes de guardar.";
        error.classList.remove("oculto");
        return;
    }

    error.classList.add("oculto");
    boton.disabled = true;
    const cambios = { idIncidencia: incidencia.idIncidencia, estado };
    if (respuesta) cambios.respuesta = respuesta;
    const resultado = await logica.responderIncidencia(cambios);
    boton.disabled = false;
    if (!resultado.correcto) {
        error.textContent = resultado.error;
        error.classList.remove("oculto");
        return;
    }

    await cargarIncidencias(logica);
    await comunIncidencias.actualizarContadorIncidencias(logica);
    mostrarAvisoIncidencias("aviso-ok", respuesta
        ? (resultado.modoDemo
            ? "Respuesta guardada en datos de prueba; no se envió correo."
            : "La respuesta se guardó en Ayuda y se envió por correo.")
        : "Se actualizó el estado de la incidencia.");
}

function iniciarPantallaIncidencias() {
    const logica = crearLogicaAdmin();
    const irA = url => window.location.assign(url);
    if (!comunIncidencias.comprobarAcceso(logica, irA)) return;
    comunIncidencias.conectarMenu(logica, irA);

    document.getElementById("filtro-estado").addEventListener("change", () => cargarIncidencias(logica));
    document.getElementById("filtro-tipo").addEventListener("change", () => cargarIncidencias(logica));
    document.getElementById("lista-incidencias").addEventListener("click", evento => {
        const boton = evento.target.closest(".boton-incidencia");
        if (boton) cargarDetalleIncidencia(logica, Number(boton.dataset.id));
    });
    document.getElementById("formulario-respuesta").addEventListener("submit", evento => {
        enviarRespuestaIncidencia(evento, logica);
    });
    cargarIncidencias(logica);
}

if (enNodeIncidencias) {
    module.exports = {
        pantallaIncidencias, formatearFechaIncidencia, crearBotonIncidencia,
        pintarListaIncidencias, cargarIncidencias, cargarDetalleIncidencia,
        pintarDetalleIncidencia, enviarRespuestaIncidencia, claseEstado
    };
} else {
    document.addEventListener("DOMContentLoaded", iniciarPantallaIncidencias);
}
