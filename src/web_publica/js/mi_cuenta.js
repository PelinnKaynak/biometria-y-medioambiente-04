// ------------------------------------------------------------
// mi_cuenta.js
// Controlador de la página Mi cuenta del portador
// (mi_cuenta.html, T018 · H035).
// ------------------------------------------------------------

const reglasCuenta = typeof module !== "undefined" ? require("./validacion") : window;

const UMBRAL_AVISO = 180;        // µg/m³, umbral de aviso por defecto
const VALOR_GUIA_OMS = 100;      // µg/m³, valor guía de la OMS (8 h)
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// ============================================================
// Funciones de formato (sin DOM)
// ============================================================

// --------------------------------------------------------
// ozono: R --> nivelOzono() --> Nivel
//
// Nivel = ( texto: Text, clase: Text )
// Hasta 100 µg/m³ es bueno (valor guía de la OMS), hasta
// 180 moderado y por encima malo (umbral de información).
// --------------------------------------------------------
function nivelOzono(ozono) {
    if (ozono <= VALOR_GUIA_OMS) return { texto: "Bueno", clase: "bueno" };
    if (ozono <= UMBRAL_AVISO) return { texto: "Moderado", clase: "moderado" };
    return { texto: "Malo", clase: "malo" };
}

// --------------------------------------------------------
// n: R --> formatearNumero() --> Text
//
// 1284 → "1.284". No depende del idioma del navegador.
// --------------------------------------------------------
function formatearNumero(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// --------------------------------------------------------
// fechaISO: Text, conHora: B --> formatearFecha() --> Text
//
// "2 nov" o, con hora, "2 nov · 12:10".
// --------------------------------------------------------
function formatearFecha(fechaISO, conHora = false) {
    const f = new Date(fechaISO);
    const dia = f.getDate() + " " + MESES_CORTOS[f.getMonth()];
    if (!conHora) return dia;
    const dos = n => String(n).padStart(2, "0");
    return dia + " · " + dos(f.getHours()) + ":" + dos(f.getMinutes());
}

// --------------------------------------------------------
// fechaISO: Text, ahora: Fecha --> textoHace() --> Text
//
// "hace 5 minutos", "hace 2 horas", "hace 3 días".
// --------------------------------------------------------
function textoHace(fechaISO, ahora = new Date()) {
    const minutos = Math.max(0, Math.round((ahora - new Date(fechaISO)) / 60000));
    const plural = (n, palabra) => n + " " + palabra + (n === 1 ? "" : (palabra.endsWith("s") ? "" : "s"));
    if (minutos < 1) return "ahora mismo";
    if (minutos < 60) return "hace " + plural(minutos, "minuto");
    const horas = Math.round(minutos / 60);
    if (horas < 24) return "hace " + plural(horas, "hora");
    return "hace " + plural(Math.round(horas / 24), "día");
}

// --------------------------------------------------------
// actual: N, anterior: N, ahora: Fecha --> textoVariacion() --> Text
//
// "12 % más que en octubre". Sin datos del mes anterior
// devuelve "Primer mes con mediciones".
// --------------------------------------------------------
function textoVariacion(actual, anterior, ahora = new Date()) {
    if (!anterior) return "Primer mes con mediciones";
    const mesAnterior = MESES_LARGOS[(ahora.getMonth() + 11) % 12];
    const porcentaje = Math.round((actual - anterior) / anterior * 100);
    if (porcentaje === 0) return "Igual que en " + mesAnterior;
    return Math.abs(porcentaje) + " % " + (porcentaje > 0 ? "más" : "menos") + " que en " + mesAnterior;
}

// --------------------------------------------------------
// nombre: Text, apellidos: Text --> nombreCorto() --> Text
//
// "Laura" + "Martínez Pons" → "Laura M."
// --------------------------------------------------------
function nombreCorto(nombre, apellidos) {
    const inicial = String(apellidos || "").trim().charAt(0);
    return inicial ? nombre + " " + inicial.toUpperCase() + "." : nombre;
}

// --------------------------------------------------------
// perfil: Perfil, ahora: Fecha --> textoPlan() --> Text
// --------------------------------------------------------
function textoPlan(perfil, ahora = new Date()) {
    if (perfil.premiumHasta && new Date(perfil.premiumHasta) > ahora) {
        return "Premium hasta el " + formatearFecha(perfil.premiumHasta);
    }
    return "Gratuito";
}

// --------------------------------------------------------
// puntos: [ PuntoExposicion ], umbral: R --> calcularGrafica() --> Grafica
//
// Grafica = ( maximoY: N, ruta: Text, marcasY: [ N ],
//             maximo: ( x: R, y: R, punto: PuntoExposicion ),
//             etiquetasX: [ ( x: R, texto: Text ) ] )
//
// Las coordenadas van en un lienzo de 1000 x 300, y x e y del
// máximo en porcentaje para colocar el punto y el globo.
// --------------------------------------------------------
function calcularGrafica(puntos, umbral = UMBRAL_AVISO) {
    const mayor = Math.max(umbral, ...puntos.map(p => p.ozono));
    const maximoY = Math.max(240, Math.ceil(mayor / 60) * 60);
    const n = puntos.length;
    const x = i => n === 1 ? 500 : i / (n - 1) * 1000;
    const y = valor => 300 - valor / maximoY * 300;

    const ruta = puntos.map((p, i) => (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(p.ozono).toFixed(1)).join(" ");

    let indiceMaximo = 0;
    puntos.forEach((p, i) => { if (p.ozono > puntos[indiceMaximo].ozono) indiceMaximo = i; });

    const numeroEtiquetas = Math.min(5, n);
    const etiquetasX = [];
    for (let k = 0; k < numeroEtiquetas; k++) {
        const i = numeroEtiquetas === 1 ? 0 : Math.round(k * (n - 1) / (numeroEtiquetas - 1));
        etiquetasX.push({ x: x(i) / 10, texto: formatearFecha(puntos[i].fecha) });
    }

    return {
        maximoY,
        ruta,
        marcasY: [maximoY, umbral, VALOR_GUIA_OMS, 0],
        maximo: { x: x(indiceMaximo) / 10, y: y(puntos[indiceMaximo].ozono) / 3, punto: puntos[indiceMaximo] },
        etiquetasX
    };
}

// ============================================================
// Pintar la página
// ============================================================

const $ = id => document.getElementById(id);

function mostrar(id, visible = true) {
    $(id).classList.toggle("oculto", !visible);
}

// --------------------------------------------------------
// perfil: Perfil --> pintarPerfil()
// --------------------------------------------------------
function pintarPerfil(perfil) {
    $("saludo").textContent = "Hola, " + perfil.nombre;
    $("nombre-cabecera").textContent = nombreCorto(perfil.nombre, perfil.apellidos);

    const avatar = $("avatar");
    avatar.textContent = "";
    if (perfil.foto) {
        const img = document.createElement("img");
        img.src = perfil.foto.startsWith("data:") ? perfil.foto : "data:image/jpeg;base64," + perfil.foto;
        img.alt = "";
        avatar.appendChild(img);
    } else {
        avatar.textContent = perfil.nombre.charAt(0).toUpperCase();
    }

    $("perfil-nombre").textContent = perfil.nombre + " " + perfil.apellidos;
    $("perfil-correo").textContent = perfil.correo;
    $("perfil-aviso").textContent = perfil.alertas ? "A partir de " + UMBRAL_AVISO + " µg/m³" : "Desactivado";
    $("perfil-plan").textContent = textoPlan(perfil);
}

// --------------------------------------------------------
// clase: Text, texto: Text --> crearNivel() --> Elemento
// --------------------------------------------------------
function crearNivel(nivel, texto = nivel.texto) {
    const span = document.createElement("span");
    span.className = "nivel nivel-" + nivel.clase;
    span.textContent = texto;
    return span;
}

// --------------------------------------------------------
// resumen: Resumen | null, ahora: Fecha --> pintarResumen()
//
// Sin resumen (sensor sin vincular o T024 sin hacer) muestra
// el aviso de que todavía no hay mediciones.
// --------------------------------------------------------
function pintarResumen(resumen, ahora = new Date()) {
    const hayDatos = Boolean(resumen);
    mostrar("sin-datos", !hayDatos);
    document.querySelector(".rejilla-cuenta").classList.toggle("solo-perfil", !hayDatos);
    for (const id of ["indicadores", "tarjeta-grafica", "tarjeta-lugares", "tarjeta-recompensas", "tarjeta-mediciones"]) {
        mostrar(id, hayDatos);
    }
    if (!hayDatos) {
        $("estado-nodo").textContent = "Todavía no tienes datos de ningún sensor.";
        return;
    }

    const sincronizado = textoHace(resumen.ultimaSincronizacion, ahora);
    $("estado-nodo").innerHTML = "";
    $("estado-nodo").append(
        "Nodo " + resumen.nodo + " · ",
        textoConVersion("Última sincronización " + sincronizado + ". Los datos llegan desde la app cuando el sensor está conectado.",
            "Sincronizado " + sincronizado.replace("minutos", "min").replace("minuto", "min"))
    );

    $("dato-mediciones").textContent = formatearNumero(resumen.medicionesMes);
    $("detalle-mediciones").textContent = textoVariacion(resumen.medicionesMes, resumen.medicionesMesAnterior, ahora);

    $("dato-puntos").textContent = formatearNumero(resumen.puntos);
    $("detalle-puntos").textContent = "Nivel " + resumen.nivel;

    const nivel = nivelOzono(resumen.exposicionMedia);
    $("dato-exposicion").textContent = Math.round(resumen.exposicionMedia) + " µg/m³";
    $("detalle-exposicion").replaceChildren(crearNivel(nivel));

    $("dato-horas").textContent = resumen.horasOzonoAlto + " h";
    $("detalle-horas").replaceChildren(
        textoConVersion("Esta semana, por encima de " + UMBRAL_AVISO + " µg/m³", "Esta semana"));

    pintarLugares(resumen.lugares);
    pintarRecompensas(resumen);
    pintarUltimasMediciones(resumen.ultimasMediciones);
}

// --------------------------------------------------------
// largo: Text, corto: Text --> textoConVersion() --> Elemento
//
// Texto con una versión corta para el móvil.
// --------------------------------------------------------
function textoConVersion(largo, corto) {
    const span = document.createElement("span");
    const l = document.createElement("span");
    const c = document.createElement("span");
    l.className = "texto-largo";
    c.className = "texto-corto";
    l.textContent = largo;
    c.textContent = corto;
    span.append(l, c);
    return span;
}

function pintarLugares(lugares) {
    const lista = $("lista-lugares");
    lista.replaceChildren();
    if (lugares.length === 0) {
        const li = document.createElement("li");
        li.className = "vacio";
        li.textContent = "Aún no has guardado ningún lugar.";
        lista.appendChild(li);
        return;
    }
    for (const lugar of lugares) {
        const li = document.createElement("li");
        const nombre = document.createElement("span");
        nombre.className = "nombre-lugar";
        nombre.innerHTML = "<strong></strong><span class='zona'></span>";
        nombre.querySelector("strong").textContent = lugar.nombre;
        nombre.querySelector(".zona").textContent = " · " + lugar.zona;
        const nivel = nivelOzono(lugar.ozono);
        li.append(nombre, crearNivel(nivel, nivel.texto + " · " + Math.round(lugar.ozono) + " µg/m³"));
        lista.appendChild(li);
    }
}

function pintarRecompensas(resumen) {
    const faltan = Math.max(0, resumen.puntosSiguienteNivel - resumen.puntos);
    const porcentaje = Math.min(100, Math.round(resumen.puntos / resumen.puntosSiguienteNivel * 100));
    $("texto-recompensas").textContent = faltan > 0
        ? "Te faltan " + formatearNumero(faltan) + " puntos para el nivel " + resumen.siguienteNivel
        : "Ya has llegado al nivel " + resumen.siguienteNivel;
    $("relleno-recompensas").style.width = porcentaje + "%";
    $("barra-recompensas").setAttribute("aria-valuenow", String(porcentaje));
}

function pintarUltimasMediciones(mediciones) {
    const cuerpo = $("tabla-mediciones");
    cuerpo.replaceChildren();
    for (const m of mediciones) {
        const fila = document.createElement("tr");
        const celdas = [formatearFecha(m.fecha, true), m.lugar, Math.round(m.ozono) + " µg/m³"];
        for (const texto of celdas) {
            const td = document.createElement("td");
            td.textContent = texto;
            fila.appendChild(td);
        }
        const td = document.createElement("td");
        td.appendChild(crearNivel(nivelOzono(m.ozono)));
        fila.appendChild(td);
        cuerpo.appendChild(fila);
    }
}

// --------------------------------------------------------
// puntos: [ PuntoExposicion ] --> pintarGrafica()
// --------------------------------------------------------
function pintarGrafica(puntos) {
    const vacia = puntos.length === 0;
    mostrar("grafica-vacia", vacia);
    document.querySelector(".zona-grafica").classList.toggle("oculto", vacia);
    if (vacia) return;

    const g = calcularGrafica(puntos);
    const y = valor => (300 - valor / g.maximoY * 300).toFixed(1);
    const linea = (valor, clase) =>
        `<line x1="0" x2="1000" y1="${y(valor)}" y2="${y(valor)}" class="${clase}" vector-effect="non-scaling-stroke"/>`;

    $("svg-grafica").innerHTML =
        linea(g.maximoY, "rejilla") + linea(0, "rejilla") +
        linea(VALOR_GUIA_OMS, "linea-oms") + linea(UMBRAL_AVISO, "linea-umbral") +
        `<path d="${g.ruta}" class="linea-datos" vector-effect="non-scaling-stroke"/>`;

    $("eje-y").replaceChildren(...g.marcasY.map(valor => {
        const s = document.createElement("span");
        s.textContent = valor;
        s.style.top = (100 - valor / g.maximoY * 100) + "%";
        return s;
    }));

    $("eje-x").replaceChildren(...g.etiquetasX.map(e => {
        const s = document.createElement("span");
        s.textContent = e.texto;
        s.style.left = e.x + "%";
        return s;
    }));

    const nivel = nivelOzono(g.maximo.punto.ozono);
    const marca = $("punto-maximo");
    marca.className = "punto-maximo punto-" + nivel.clase;
    marca.style.left = g.maximo.x + "%";
    marca.style.top = g.maximo.y + "%";

    const globo = $("globo");
    const lineaFecha = document.createElement("span");
    lineaFecha.textContent = "Máximo · " + formatearFecha(g.maximo.punto.fecha);
    const lineaValor = document.createElement("strong");
    lineaValor.textContent = Math.round(g.maximo.punto.ozono) + " µg/m³ · " + nivel.texto;
    globo.replaceChildren(lineaFecha, lineaValor);
    globo.style.left = Math.min(Math.max(g.maximo.x, 12), 88) + "%";
    globo.style.top = g.maximo.y + "%";
    globo.classList.remove("oculto");
}

// ============================================================
// Editar perfil
// ============================================================

// --------------------------------------------------------
// datos: DatosPerfil --> validarPerfil() --> [ ErrorCampo ]
// --------------------------------------------------------
function validarPerfil(datos) {
    return [
        ["editar-nombre", reglasCuenta.errorNombre(datos.nombre)],
        ["editar-apellidos", reglasCuenta.errorApellidos(datos.apellidos)],
        ["editar-correo", reglasCuenta.errorCorreo(datos.correo)]
    ].filter(([, mensaje]) => mensaje).map(([campo, mensaje]) => ({ campo, mensaje }));
}

function mostrarErrorPerfil(mensaje, campos) {
    $("error-perfil").textContent = mensaje;
    mostrar("error-perfil");
    for (const id of campos) $(id).classList.add("error");
}

function limpiarErrorPerfil() {
    mostrar("error-perfil", false);
    for (const id of ["editar-nombre", "editar-apellidos", "editar-correo"]) $(id).classList.remove("error");
}

// --------------------------------------------------------
// perfil: Perfil --> abrirEdicion()
// --------------------------------------------------------
function abrirEdicion(perfil) {
    limpiarErrorPerfil();
    $("editar-nombre").value = perfil.nombre;
    $("editar-apellidos").value = perfil.apellidos;
    $("editar-correo").value = perfil.correo;
    const dialogo = $("dialogo-perfil");
    if (typeof dialogo.showModal === "function") dialogo.showModal();
    else dialogo.setAttribute("open", "");
}

function cerrarEdicion() {
    const dialogo = $("dialogo-perfil");
    if (typeof dialogo.close === "function") dialogo.close();
    else dialogo.removeAttribute("open");
}

// --------------------------------------------------------
// evento: Evento, logica: LogicaCuenta, estado: Estado --> guardarPerfil()
//
// Estado = ( perfil: Perfil )
// Los errores del servidor usan los nombres de campo
// "nombre", "apellidos" y "correo".
// --------------------------------------------------------
async function guardarPerfil(evento, logica, estado) {
    evento.preventDefault();
    limpiarErrorPerfil();

    const datos = {
        nombre: $("editar-nombre").value.trim(),
        apellidos: $("editar-apellidos").value.trim(),
        correo: $("editar-correo").value.trim()
    };
    const errores = validarPerfil(datos);
    if (errores.length > 0) {
        mostrarErrorPerfil(errores[0].mensaje, errores.map(e => e.campo));
        return;
    }

    const boton = document.querySelector("#formulario-perfil button[type=submit]");
    boton.disabled = true;
    const resultado = await logica.actualizarDatos(datos);
    boton.disabled = false;

    if (!resultado.correcto) {
        mostrarErrorPerfil(resultado.error, (resultado.campos || []).map(c => "editar-" + c));
        return;
    }
    estado.perfil = { ...estado.perfil, ...resultado.perfil };
    pintarPerfil(estado.perfil);
    cerrarEdicion();
}

// ============================================================
// Arranque
// ============================================================

// --------------------------------------------------------
// logica: LogicaCuenta, periodo: Text, botones: [ Elemento ] --> cambiarPeriodo()
// --------------------------------------------------------
async function cambiarPeriodo(logica, periodo) {
    for (const boton of document.querySelectorAll("[data-periodo]")) {
        const activo = boton.dataset.periodo === periodo;
        boton.classList.toggle("activo", activo);
        boton.setAttribute("aria-pressed", String(activo));
    }
    const resultado = await logica.obtenerExposicion(periodo);
    pintarGrafica(resultado.puntos || []);
}

// --------------------------------------------------------
// logica: LogicaCuenta, irA: (url: Text) --> cargarCuenta() --> Estado | null
//
// Sin sesión, o con la sesión caducada, vuelve al login.
// --------------------------------------------------------
async function cargarCuenta(logica, irA) {
    if (!logica.usuarioActual()) {
        irA("login.html");
        return null;
    }

    const [rPerfil, rResumen] = await Promise.all([logica.obtenerPerfil(), logica.obtenerResumen()]);
    mostrar("cargando", false);

    if (!rPerfil.correcto) {
        if (rPerfil.sinSesion) {
            logica.cerrarSesion();
            irA("login.html");
            return null;
        }
        $("error-carga").textContent = rPerfil.error;
        mostrar("error-carga");
        return null;
    }

    const estado = { perfil: rPerfil.perfil };
    pintarPerfil(estado.perfil);
    pintarResumen(rResumen.correcto ? rResumen.resumen : null);
    mostrar("cuenta");

    if (rResumen.correcto && rResumen.resumen) {
        await cambiarPeriodo(logica, "mes");
    }
    return estado;
}

// --------------------------------------------------------
// logica: LogicaCuenta, irA: (url: Text) --> conectarCabecera()
// --------------------------------------------------------
function conectarCabecera(logica, irA) {
    const botonMenu = $("boton-menu");
    botonMenu.addEventListener("click", () => {
        const abierto = $("menu-cuenta").classList.toggle("abierto");
        botonMenu.setAttribute("aria-expanded", String(abierto));
        botonMenu.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
    });
    for (const enlace of document.querySelectorAll("[data-salir]")) {
        enlace.addEventListener("click", evento => {
            evento.preventDefault();
            logica.cerrarSesion();
            irA("login.html");
        });
    }
}

async function iniciarMiCuenta() {
    const logica = crearLogicaCuenta();
    const irA = url => window.location.assign(url);

    conectarCabecera(logica, irA);
    const estado = await cargarCuenta(logica, irA);
    if (!estado) return;

    for (const boton of document.querySelectorAll("[data-periodo]")) {
        boton.addEventListener("click", () => cambiarPeriodo(logica, boton.dataset.periodo));
    }
    $("boton-editar").addEventListener("click", () => abrirEdicion(estado.perfil));
    $("cancelar-perfil").addEventListener("click", cerrarEdicion);
    $("formulario-perfil").addEventListener("submit", evento => guardarPerfil(evento, logica, estado));
}

if (typeof module !== "undefined") {
    module.exports = {
        nivelOzono, formatearNumero, formatearFecha, textoHace, textoVariacion, nombreCorto, textoPlan,
        calcularGrafica, validarPerfil, cargarCuenta, guardarPerfil, cambiarPeriodo, conectarCabecera,
        abrirEdicion, UMBRAL_AVISO
    };
} else {
    document.addEventListener("DOMContentLoaded", iniciarMiCuenta);
}