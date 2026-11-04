// ------------------------------------------------------------
// panel_nodos.js
// Controlador del panel de nodos (panel_nodos.html, T014).
// Muestra los totales, la lista de nodos ordenada por tiempo
// sin enviar datos y el mapa con el estado de cada nodo.
// ------------------------------------------------------------

const enNode = typeof module !== "undefined";
const herramientasNodos = enNode ? require("./nodos") : window;
const comun = enNode ? require("./admin_comun") : window;

const NODOS_POR_PAGINA = 10;
const COLOR_ESTADO = { ACTIVO: "#4E9C83", INACTIVO: "#D9636B", CALIBRAR: "#E3B341" };

// Estado de la pantalla: filtro actual y nodos que se ven
const panel = {
    filtro: { busqueda: "", estado: "todos", pagina: 1, porPagina: NODOS_POR_PAGINA },
    nodos: [],
    total: 0,
    mapa: null,
    capaMarcadores: null,
    limitesMapa: null
};

// --------------------------------------------------------
// resumen: ResumenNodos --> pintarResumen()
// --------------------------------------------------------
function pintarResumen(resumen) {
    const campos = ["total", "activos", "inactivos24h", "inactivos7d", "porCalibrar"];
    for (const campo of campos) {
        document.getElementById("dato-" + campo).textContent =
            herramientasNodos.formatearNumero(resumen[campo]);
    }
}

// --------------------------------------------------------
// nodo: Nodo, ahora: Fecha --> crearFilaNodo() --> Elemento
//
// Crea la fila de la lista. En escritorio se ve como una
// fila de tabla y en móvil como una tarjeta (lo decide el CSS).
// Los nodos inactivos llevan la clase "inactivo".
// --------------------------------------------------------
function crearFilaNodo(nodo, ahora) {
    const estado = herramientasNodos.estadoNodo(nodo, ahora);
    const minutos = herramientasNodos.minutosSinDatos(nodo.ultimaMedicion, ahora);

    const fila = document.createElement("li");
    fila.className = "fila-nodo";
    if (estado === herramientasNodos.EstadoNodo.INACTIVO) fila.classList.add("inactivo");

    const celdas = [
        ["celda-id", nodo.id],
        ["celda-portador", nodo.portador],
        ["celda-tiempo", herramientasNodos.textoTiempoSinDatos(minutos)],
        ["celda-bateria", nodo.bateria + " %"]
    ];
    for (const [clase, texto] of celdas) {
        const celda = document.createElement("span");
        celda.className = clase;
        celda.textContent = texto;
        fila.appendChild(celda);
    }
    fila.querySelector(".celda-bateria").classList.toggle("bateria-baja", nodo.bateria < 20);

    const aviso = document.createElement("span");
    aviso.className = "celda-aviso";
    if (estado === herramientasNodos.EstadoNodo.INACTIVO) {
        aviso.innerHTML = '<span class="etiqueta etiqueta-inactivo">Inactivo</span>';
    } else if (nodo.necesitaCalibrar) {
        aviso.innerHTML = '<span class="etiqueta etiqueta-calibrar">Calibrar</span>';
    }
    fila.appendChild(aviso);
    return fila;
}

// --------------------------------------------------------
// nodos: [ Nodo ], ahora: Fecha, anadir: B --> pintarLista()
//
// Si anadir es true, añade los nodos al final (botón «Ver
// más» del móvil); si no, sustituye los que había.
// --------------------------------------------------------
function pintarLista(nodos, ahora, anadir) {
    const lista = document.getElementById("lista-nodos");
    if (!anadir) lista.innerHTML = "";
    for (const nodo of nodos) {
        lista.appendChild(crearFilaNodo(nodo, ahora));
    }
    document.getElementById("sin-resultados").classList.toggle("oculto", lista.children.length > 0);
}

// --------------------------------------------------------
// pagina: N, porPagina: N, total: N --> textoPaginacion() --> Text
//
// 1, 10, 1248 → "1-10 de 1.248"
// --------------------------------------------------------
function textoPaginacion(pagina, porPagina, total) {
    if (total === 0) return "0 de 0";
    const desde = (pagina - 1) * porPagina + 1;
    const hasta = Math.min(pagina * porPagina, total);
    return desde + "-" + hasta + " de " + herramientasNodos.formatearNumero(total);
}

// --------------------------------------------------------
// pintarPaginacion()
// --------------------------------------------------------
function pintarPaginacion() {
    const { pagina, porPagina } = panel.filtro;
    const hayMas = pagina * porPagina < panel.total;

    document.getElementById("texto-paginacion").textContent =
        textoPaginacion(pagina, porPagina, panel.total);
    document.getElementById("boton-anterior").disabled = pagina <= 1;
    document.getElementById("boton-siguiente").disabled = !hayMas;
    document.getElementById("boton-ver-mas").classList.toggle("oculto", !hayMas);
}

// --------------------------------------------------------
// nodos: [ Nodo ], ahora: Fecha --> pintarMapa()
//
// Pone un punto por nodo con el color de su estado. Usa la
// librería Leaflet; si no está cargada (por ejemplo en las
// pruebas), no hace nada.
// --------------------------------------------------------
function pintarMapa(nodos, ahora) {
    if (typeof L === "undefined") return;

    if (!panel.mapa) {
        panel.mapa = L.map("mapa", { zoomControl: true }).setView([39.2, -0.4], 8);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution: "© OpenStreetMap"
        }).addTo(panel.mapa);
        panel.capaMarcadores = L.layerGroup().addTo(panel.mapa);
    }

    panel.capaMarcadores.clearLayers();
    for (const nodo of nodos) {
        const estado = herramientasNodos.estadoNodo(nodo, ahora);
        L.circleMarker([nodo.latitud, nodo.longitud], {
            radius: 7, color: "#FFFFFF", weight: 2, fillColor: COLOR_ESTADO[estado], fillOpacity: 1
        })
            .bindTooltip(nodo.id + " · " + nodo.portador)
            .addTo(panel.capaMarcadores);
    }
    panel.limitesMapa = nodos.length > 0 ? nodos.map(n => [n.latitud, n.longitud]) : null;
    ajustarMapa();
}

// --------------------------------------------------------
// ajustarMapa()
//
// Recalcula el tamaño del mapa y encuadra todos los nodos.
// Hace falta cuando el mapa estaba oculto (pestaña del móvil).
// --------------------------------------------------------
function ajustarMapa() {
    if (!panel.mapa) return;
    panel.mapa.invalidateSize();
    if (panel.limitesMapa) {
        panel.mapa.fitBounds(panel.limitesMapa, { padding: [30, 30], maxZoom: 12 });
    }
}

// --------------------------------------------------------
// mensaje: Text --> mostrarErrorPanel()
// --------------------------------------------------------
function mostrarErrorPanel(mensaje) {
    const aviso = document.getElementById("aviso-error");
    aviso.textContent = mensaje;
    aviso.classList.toggle("oculto", !mensaje);
}

// --------------------------------------------------------
// logica: LogicaAdmin, ahora: Fecha --> cargarMapa()
//
// Pide todos los nodos del filtro actual (sin paginar) y los
// pinta en el mapa.
// --------------------------------------------------------
async function cargarMapa(logica, ahora) {
    const resultado = await logica.obtenerNodosMapa(panel.filtro);
    if (resultado.correcto) pintarMapa(resultado.nodos, ahora);
}

// --------------------------------------------------------
// logica: LogicaAdmin, ahora: Fecha, anadir: B --> cargarNodos()
//
// Pide al servidor la página de nodos del filtro actual y la
// pinta en la lista.
// --------------------------------------------------------
async function cargarNodos(logica, ahora, anadir = false) {
    const resultado = await logica.obtenerNodos(panel.filtro);
    if (!resultado.correcto) {
        mostrarErrorPanel(resultado.error);
        return;
    }
    mostrarErrorPanel("");
    panel.nodos = anadir ? panel.nodos.concat(resultado.nodos) : resultado.nodos;
    panel.total = resultado.total;

    pintarLista(resultado.nodos, ahora, anadir);
    pintarPaginacion();
}

// --------------------------------------------------------
// logica: LogicaAdmin, ahora: Fecha --> cargarPanel()
//
// Carga los totales y la primera página de nodos.
// --------------------------------------------------------
async function cargarPanel(logica, ahora) {
    const resultado = await logica.obtenerResumenNodos();
    if (resultado.correcto) {
        pintarResumen(resultado.resumen);
    } else {
        mostrarErrorPanel(resultado.error);
    }
    await Promise.all([cargarNodos(logica, ahora), cargarMapa(logica, ahora)]);
}

// --------------------------------------------------------
// vista: Text --> mostrarVistaMovil()
//
// En móvil cambia entre la pestaña «Lista» y la de «Mapa».
// --------------------------------------------------------
function mostrarVistaMovil(vista) {
    document.getElementById("zona-datos").dataset.vista = vista;
    for (const boton of document.querySelectorAll(".pestana")) {
        boton.classList.toggle("activa", boton.dataset.vista === vista);
        boton.setAttribute("aria-selected", String(boton.dataset.vista === vista));
    }
    if (vista === "mapa") ajustarMapa();
}

// --------------------------------------------------------
// iniciarPanelNodos()
//
// Comprueba el acceso y conecta el buscador, el filtro de
// estado, la paginación, las pestañas y el menú.
// --------------------------------------------------------
function iniciarPanelNodos() {
    const logica = crearLogicaAdmin();
    const irA = url => window.location.assign(url);
    if (!comun.comprobarAcceso(logica, irA)) return;

    // El menú se conecta lo primero, para que funcione aunque
    // luego falle la carga de los datos o del mapa.
    comun.conectarMenu(logica, irA);
    const recargar = () => {
        panel.filtro.pagina = 1;
        cargarNodos(logica, new Date());
        cargarMapa(logica, new Date());
    };

    let espera;
    document.getElementById("buscador").addEventListener("input", evento => {
        clearTimeout(espera);
        espera = setTimeout(() => { panel.filtro.busqueda = evento.target.value; recargar(); }, 300);
    });
    document.getElementById("filtro-estado").addEventListener("change", evento => {
        panel.filtro.estado = evento.target.value;
        recargar();
    });
    document.getElementById("boton-anterior").addEventListener("click", () => {
        panel.filtro.pagina--;
        cargarNodos(logica, new Date());
    });
    document.getElementById("boton-siguiente").addEventListener("click", () => {
        panel.filtro.pagina++;
        cargarNodos(logica, new Date());
    });
    document.getElementById("boton-ver-mas").addEventListener("click", () => {
        panel.filtro.pagina++;
        cargarNodos(logica, new Date(), true);
    });
    for (const boton of document.querySelectorAll(".pestana")) {
        boton.addEventListener("click", () => mostrarVistaMovil(boton.dataset.vista));
    }

    cargarPanel(logica, new Date());
}

if (enNode) {
    module.exports = {
        panel, pintarResumen, crearFilaNodo, pintarLista, textoPaginacion,
        cargarNodos, cargarMapa, cargarPanel, mostrarVistaMovil, NODOS_POR_PAGINA
    };
} else {
    document.addEventListener("DOMContentLoaded", iniciarPanelNodos);
}