// ------------------------------------------------------------
// inicio.js
// Controlador de la página principal pública (index.html, T012):
// mapa de la calidad del aire, «Tu zona ahora», capas, buscador
// y menú.
// ------------------------------------------------------------

// Límites de cada nivel (bueno, moderado, malo). Por encima del
// último es «muy malo». Ozono: valor guía de la OMS, umbral de
// información y umbral de alerta. El resto, bandas del índice
// europeo de calidad del aire.
const LIMITES_NIVEL = {
    O3: [100, 180, 240],
    NO2: [40, 90, 230],
    PM10: [20, 50, 100],
    CO: [4, 7, 10]
};

const NIVELES = [
    { texto: "Bueno", clase: "bueno" },
    { texto: "Moderado", clase: "moderado" },
    { texto: "Malo", clase: "malo" },
    { texto: "Muy malo", clase: "muy-malo" }
];

const COLOR_NIVEL = { bueno: "#4E9C83", moderado: "#E3B341", malo: "#D9636B", "muy-malo": "#8E3B5B" };

const NOMBRE_CONTAMINANTE = { O3: "Ozono", NO2: "NO₂", PM10: "PM10", CO: "CO" };

// «Tu zona» empieza en Gandia. El buscador la cambia.
const ZONA_POR_DEFECTO = { municipio: "Gandia", lat: 38.967, lon: -0.181 };

// El mapa se abre acercado a Gandia. Se puede alejar hasta ver
// toda España (y un poco más) con el botón − o pellizcando.
const ZOOM_INICIAL = 12;
const ZOOM_MINIMO = 5;
const RADIO_MANCHA_PX = 55;

const MESES_INICIO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// ============================================================
// Funciones sin DOM
// ============================================================

// --------------------------------------------------------
// contaminante: Text, valor: R --> nivelContaminante() --> Nivel
//
// Nivel = ( texto: Text, clase: Text )
// --------------------------------------------------------
function nivelContaminante(contaminante, valor) {
    const limites = LIMITES_NIVEL[contaminante] || LIMITES_NIVEL.O3;
    const indice = limites.findIndex(limite => valor <= limite);
    return NIVELES[indice === -1 ? NIVELES.length - 1 : indice];
}

// --------------------------------------------------------
// a: Punto, b: Punto --> distanciaKm() --> R
//
// Punto = ( lat: R, lon: R ). Distancia en línea recta
// (fórmula del haversine).
// --------------------------------------------------------
function distanciaKm(a, b) {
    const rad = g => g * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// --------------------------------------------------------
// mediciones: [ MedicionMapa ], punto: Punto --> medicionMasCercana()
//                                           --> MedicionMapa | null
// --------------------------------------------------------
function medicionMasCercana(mediciones, punto) {
    let mejor = null;
    let mejorDistancia = Infinity;
    for (const m of mediciones) {
        const d = distanciaKm(punto, m);
        if (d < mejorDistancia) {
            mejor = m;
            mejorDistancia = d;
        }
    }
    return mejor;
}

// --------------------------------------------------------
// texto: Text --> normalizar() --> Text
//
// Sin mayúsculas ni tildes, para buscar «castello» y encontrar
// «Castelló de la Plana».
// --------------------------------------------------------
function normalizar(texto) {
    return String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// --------------------------------------------------------
// texto: Text, mediciones: [ MedicionMapa ] --> buscarMunicipio()
//                                           --> MedicionMapa | null
//
// Primero busca el nombre exacto y después el que empieza
// o contiene lo escrito.
// --------------------------------------------------------
function buscarMunicipio(texto, mediciones) {
    const buscado = normalizar(texto);
    if (!buscado) return null;
    const nombre = m => normalizar(m.municipio);
    return mediciones.find(m => nombre(m) === buscado)
        || mediciones.find(m => nombre(m).startsWith(buscado))
        || mediciones.find(m => nombre(m).includes(buscado))
        || null;
}

// --------------------------------------------------------
// mediciones: [ MedicionMapa ] --> listaMunicipios() --> [ Text ]
//
// Municipios sin repetir y por orden alfabético.
// --------------------------------------------------------
function listaMunicipios(mediciones) {
    return [...new Set(mediciones.map(m => m.municipio))].sort((a, b) => a.localeCompare(b, "es"));
}

// --------------------------------------------------------
// fechaISO: Text, ahora: Fecha --> textoActualizado() --> Text
//
// "Actualizado hoy a las 18:42", "ayer a las 9:05" o "el 3 nov a las 9:05".
// --------------------------------------------------------
function textoActualizado(fechaISO, ahora = new Date()) {
    const f = new Date(fechaISO);
    const hora = f.getHours() + ":" + String(f.getMinutes()).padStart(2, "0");
    const mismoDia = (a, b) => a.toDateString() === b.toDateString();
    const ayer = new Date(ahora.getTime() - 86400000);

    if (mismoDia(f, ahora)) return "Actualizado hoy a las " + hora;
    if (mismoDia(f, ayer)) return "Actualizado ayer a las " + hora;
    return "Actualizado el " + f.getDate() + " " + MESES_INICIO[f.getMonth()] + " a las " + hora;
}

// --------------------------------------------------------
// usuario: Usuario | null --> accesoCabecera() --> Acceso
//
// Acceso = ( texto: Text, url: Text )
// Sin sesión, «Acceder». Con sesión, el acceso a su página.
// --------------------------------------------------------
function accesoCabecera(usuario) {
    if (!usuario) return { texto: "Acceder", url: "login.html" };
    const rol = String(usuario.rol).toUpperCase();
    if (rol === "ADMINISTRADOR" || rol === "TECNICO") {
        return { texto: "Panel", url: "../web_admin/panel_nodos.html" };
    }
    return { texto: "Mi cuenta", url: "mi_cuenta.html" };
}

// --------------------------------------------------------
// mediciones: [ MedicionMapa ], tipos: [ Text ] --> filtrarPorTipo()
//                                           --> [ MedicionMapa ]
// --------------------------------------------------------
function filtrarPorTipo(mediciones, tipos) {
    return mediciones.filter(m => tipos.includes(m.tipo));
}

// ============================================================
// Página
// ============================================================

const $i = id => document.getElementById(id);

// --------------------------------------------------------
// estado: EstadoInicio --> pintarZona()
//
// EstadoInicio = ( contaminante: Text, mediciones: [ MedicionMapa ],
//                  tipos: [ Text ], zona: ( municipio: Text, lat: R, lon: R ),
//                  ahora: Fecha )
// --------------------------------------------------------
function pintarZona(estado) {
    const visibles = filtrarPorTipo(estado.mediciones, estado.tipos);
    const medicion = medicionMasCercana(visibles, estado.zona);

    $i("titulo-zona").textContent = "Tu zona ahora · " + estado.zona.municipio;
    const nivel = $i("nivel-zona");

    if (!medicion) {
        nivel.textContent = "Sin datos";
        nivel.className = "nivel-zona";
        $i("valor-zona").textContent = "Todavía no hay mediciones de " + NOMBRE_CONTAMINANTE[estado.contaminante] + " en el mapa.";
        $i("hora-zona").textContent = "";
        return;
    }

    const n = nivelContaminante(estado.contaminante, medicion.valor);
    nivel.textContent = n.texto;
    nivel.className = "nivel-zona nivel-" + n.clase;
    const lejos = distanciaKm(estado.zona, medicion) > 15 ? " (medido en " + medicion.municipio + ")" : "";
    $i("valor-zona").textContent = NOMBRE_CONTAMINANTE[estado.contaminante] + ": " +
        formatearValor(medicion.valor, estado.contaminante) + " " + medicion.unidad + lejos;
    $i("hora-zona").textContent = textoActualizado(medicion.fecha, estado.ahora);
}

function formatearValor(valor, contaminante) {
    return contaminante === "CO" ? String(valor).replace(".", ",") : String(Math.round(valor));
}

// --------------------------------------------------------
// estado: EstadoInicio --> pintarAvisoMapa()
// --------------------------------------------------------
function pintarAvisoMapa(estado, error = "") {
    const aviso = $i("aviso-mapa");
    if (error) {
        aviso.textContent = error;
    } else if (estado.mediciones.length === 0) {
        aviso.textContent = "Todavía no hay mediciones para mostrar en el mapa.";
    } else {
        aviso.textContent = "";
    }
    aviso.classList.toggle("oculto", aviso.textContent === "");
}

// --------------------------------------------------------
// mapa: MapaLeaflet | null, capas: Capas, estado: EstadoInicio --> pintarMapa()
//
// Capas = ( zonas: CapaLeaflet, puntos: CapaLeaflet )
// Cada medición es un círculo difuminado de tamaño fijo en pantalla
// (la mancha de color) y un punto pequeño que al pulsarlo enseña el valor.
// --------------------------------------------------------
function pintarMapa(mapa, capas, estado) {
    if (!mapa) return;
    capas.zonas.clearLayers();
    capas.puntos.clearLayers();

    for (const m of filtrarPorTipo(estado.mediciones, estado.tipos)) {
        const n = nivelContaminante(estado.contaminante, m.valor);
        const color = COLOR_NIVEL[n.clase];

        // Radio en píxeles: la mancha mide lo mismo en pantalla con cualquier zoom
        L.circleMarker([m.lat, m.lon], {
            radius: RADIO_MANCHA_PX, stroke: false, fillColor: color, fillOpacity: 0.6, pane: "zonas", interactive: false
        }).addTo(capas.zonas);

        const tipo = m.tipo === "oficial" ? "Estación oficial" : "Sensor ciudadano";
        L.circleMarker([m.lat, m.lon], {
            radius: m.tipo === "oficial" ? 6 : 5,
            color: "#FFFFFF", weight: 2, fillColor: "#3A2853", fillOpacity: 1
        }).bindPopup(
            `<strong>${m.municipio}</strong><br>${n.texto} · ${formatearValor(m.valor, estado.contaminante)} ${m.unidad}` +
            `<br><span class="popup-detalle">${tipo} · ${textoActualizado(m.fecha, estado.ahora).replace("Actualizado ", "")}</span>`
        ).addTo(capas.puntos);
    }
}

// --------------------------------------------------------
// logica: LogicaMapa, estado: EstadoInicio, contaminante: Text,
// pintar: () --> cambiarContaminante()
// --------------------------------------------------------
async function cambiarContaminante(logica, estado, contaminante, pintar) {
    for (const boton of document.querySelectorAll("[data-contaminante]")) {
        const activo = boton.dataset.contaminante === contaminante;
        boton.classList.toggle("activo", activo);
        boton.setAttribute("aria-pressed", String(activo));
    }
    const resultado = await logica.obtenerMediciones(contaminante);
    estado.contaminante = contaminante;
    estado.mediciones = resultado.correcto ? resultado.mediciones : [];
    rellenarMunicipios(estado.mediciones);
    pintarAvisoMapa(estado, resultado.correcto ? "" : resultado.error);
    pintarZona(estado);
    pintar();
}

function rellenarMunicipios(mediciones) {
    $i("lista-municipios").replaceChildren(...listaMunicipios(mediciones).map(nombre => {
        const opcion = document.createElement("option");
        opcion.value = nombre;
        return opcion;
    }));
}

// --------------------------------------------------------
// estado: EstadoInicio, texto: Text, irAPunto: (Punto) --> buscar() --> B
//
// Si encuentra el municipio, lo pone como «Tu zona» y mueve
// el mapa. Si no, avisa.
// --------------------------------------------------------
function buscar(estado, texto, irAPunto) {
    const aviso = $i("aviso-buscar");
    const encontrada = buscarMunicipio(texto, estado.mediciones);
    if (!encontrada) {
        aviso.textContent = texto.trim() ? "No hay mediciones en «" + texto.trim() + "»" : "";
        aviso.classList.toggle("oculto", !texto.trim());
        return false;
    }
    aviso.classList.add("oculto");
    estado.zona = { municipio: encontrada.municipio, lat: encontrada.lat, lon: encontrada.lon };
    pintarZona(estado);
    irAPunto(estado.zona);
    return true;
}

// --------------------------------------------------------
// usuario: Usuario | null --> pintarCabecera()
// --------------------------------------------------------
function pintarCabecera(usuario) {
    const acceso = accesoCabecera(usuario);
    const boton = $i("boton-acceder");
    boton.textContent = acceso.texto;
    boton.href = acceso.url;
}

function conectarMenus() {
    const alternar = (botonId, panelId, etiqueta) => {
        const boton = $i(botonId);
        boton.addEventListener("click", () => {
            const abierto = $i(panelId).classList.toggle("abierto");
            boton.setAttribute("aria-expanded", String(abierto));
            if (etiqueta) boton.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
        });
    };
    alternar("boton-menu-inicio", "menu-inicio", true);
    alternar("boton-capas-movil", "capas", false);
    for (const enlace of document.querySelectorAll("#menu-inicio a")) {
        enlace.addEventListener("click", () => $i("menu-inicio").classList.remove("abierto"));
    }
}

// --------------------------------------------------------
// --> crearMapa() --> ( mapa: MapaLeaflet, capas: Capas ) | null
// --------------------------------------------------------
function crearMapa() {
    if (typeof L === "undefined") return null;
    const mapa = L.map("mapa", { zoomControl: false, scrollWheelZoom: false, minZoom: ZOOM_MINIMO })
        .setView([ZONA_POR_DEFECTO.lat, ZONA_POR_DEFECTO.lon], ZOOM_INICIAL);
    L.control.zoom({ position: "bottomright" }).addTo(mapa);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap"
    }).addTo(mapa);
    mapa.createPane("zonas");
    mapa.getPane("zonas").classList.add("capa-zonas");
    return { mapa, capas: { zonas: L.layerGroup().addTo(mapa), puntos: L.layerGroup().addTo(mapa) } };
}

async function iniciarPaginaInicio() {
    const logica = crearLogicaMapa();
    const estado = {
        contaminante: "O3", mediciones: [], tipos: ["ciudadano", "oficial"],
        zona: { ...ZONA_POR_DEFECTO }, ahora: new Date()
    };

    pintarCabecera(logica.usuarioActual());
    conectarMenus();

    const creado = crearMapa();
    const pintar = () => creado && pintarMapa(creado.mapa, creado.capas, estado);
    const irAPunto = punto => creado && creado.mapa.flyTo([punto.lat, punto.lon], 10, { duration: 0.8 });

    for (const boton of document.querySelectorAll("[data-contaminante]")) {
        boton.addEventListener("click", () => cambiarContaminante(logica, estado, boton.dataset.contaminante, pintar));
    }
    for (const casilla of document.querySelectorAll("#capas input")) {
        casilla.addEventListener("change", () => {
            estado.tipos = [...document.querySelectorAll("#capas input:checked")].map(c => c.dataset.tipo);
            pintarZona(estado);
            pintar();
        });
    }
    $i("buscador").addEventListener("submit", evento => {
        evento.preventDefault();
        buscar(estado, $i("campo-buscar").value, irAPunto);
    });
    $i("campo-buscar").addEventListener("change", () => buscar(estado, $i("campo-buscar").value, irAPunto));

    await cambiarContaminante(logica, estado, "O3", pintar);
}

if (typeof module !== "undefined") {
    module.exports = {
        nivelContaminante, distanciaKm, medicionMasCercana, normalizar, buscarMunicipio, listaMunicipios,
        textoActualizado, accesoCabecera, filtrarPorTipo, pintarZona, cambiarContaminante, buscar, pintarCabecera,
        ZONA_POR_DEFECTO, ZOOM_INICIAL, ZOOM_MINIMO, LIMITES_NIVEL, NIVELES
    };
} else {
    // inicio.js también lo cargan las páginas de información para reutilizar
    // los niveles y la cabecera; el mapa solo se arranca en index.html.
    document.addEventListener("DOMContentLoaded", () => {
        if (document.getElementById("mapa")) iniciarPaginaInicio();
    });
}