// ------------------------------------------------------------
// portada.js
// Partes interactivas de la portada (index.html, T012):
// botones que hacen bajar avisos en el móvil, plano de cobertura, esquema
// del proyecto, sensor
// con puntos para explorar, funciones de la app, probador de niveles de ozono, planes mensual/anual
// y animaciones al bajar por la página.
// Usa nivelContaminante() de inicio.js y los consejos de
// informacion.js.
// ------------------------------------------------------------

const basePortada = typeof module !== "undefined"
    ? { ...require("./inicio"), ...require("./informacion") }
    : { nivelContaminante, INFO_CONTAMINANTES };

const SEGUNDOS_AVISO_VISIBLE = 5;
const SEGUNDOS_POR_FUNCION = 6;

const CAPAS = {
    sensor: {
        titulo: "El sensor mide el ozono",
        texto: "Un nodo pequeño con un sensor de ozono toma una medición cada poco tiempo y la envía al móvil por Bluetooth Low Energy.",
        tecnologia: "C++ para Arduino · SparkFun nRF52840"
    },
    app: {
        titulo: "La app recoge y envía",
        texto: "La app de Android recibe cada medición, le añade la hora y la posición del móvil y la manda al servidor. Si no hay conexión, la guarda y la envía después.",
        tecnologia: "Java · Android"
    },
    servidor: {
        titulo: "El servidor comprueba y guarda",
        texto: "El servidor REST recibe las mediciones, comprueba que son correctas, gestiona las cuentas y envía los avisos cuando el ozono pasa del nivel que has elegido.",
        tecnologia: "Node.js · Express · API REST con JSON"
    },
    bd: {
        titulo: "La base de datos lo recuerda todo",
        texto: "Guarda los usuarios, los sensores y todas las mediciones. Con ese histórico y los datos de AEMET, un modelo de inteligencia artificial predice el ozono de las próximas 48 horas.",
        tecnologia: "SQLite · Python con scikit-learn para la previsión"
    },
    web: {
        titulo: "La web lo enseña",
        texto: "El mapa público, la información sobre los contaminantes, tu cuenta y el panel con el que los técnicos vigilan la red de nodos.",
        tecnologia: "HTML · CSS · JavaScript · Leaflet"
    }
};

const PANTALLAS_APP = [
    { src: "img/app-inicio.jpg", alt: "Pantalla de inicio de la app con la calidad del aire actual" },
    { src: "img/app-mis-datos.jpg", alt: "Pantalla Mis datos con el ozono respirado hoy" },
    { src: "img/app-prevision.jpg", alt: "Pantalla de previsión de ozono por horas" },
    { src: "img/app-ruta-limpia.jpg", alt: "Pantalla de ruta limpia sobre un mapa" }
];

const PRECIOS_PREMIUM = { mes: 2.99, anyo: 24.99 };

// Vistas del sensor (concepto 4 de la carcasa). x e y de cada
// punto en porcentaje sobre la imagen.
const VISTAS_SENSOR = {
    exterior: {
        imagen: "img/sensor-principal.jpg",
        alt: "Sensor AERIS con forma de gota, rejilla frontal en espiral y anilla metálica",
        pie: "",
        piezas: [
            { clave: "anilla", x: 70, y: 6, titulo: "Anilla metálica", texto: "Para colgarlo de la mochila, de una correa o de las llaves." },
            { clave: "forma", x: 34, y: 33, titulo: "Forma de gota", texto: "Inspirada en una hoja y en el aire limpio. Es redondeada para que no se enganche y quepa en la mano." },
            { clave: "rejilla", x: 66, y: 49, titulo: "Rejilla en espiral", texto: "La tapa frontal deja pasar el aire hacia el sensor. La espiral recuerda a un remolino de aire." },
            { clave: "o3", x: 40, y: 65, titulo: "Símbolo O₃", texto: "Tres círculos unidos, como la molécula de ozono. Es la marca del sensor." },
            { clave: "canales", x: 91, y: 55, titulo: "Canales de aire", texto: "Por los laterales entra el aire, pasa por el sensor y vuelve a salir." },
            { clave: "ventilacion", x: 84, y: 88, titulo: "Ranuras de ventilación", texto: "Más entradas de aire para que el sensor mida el aire de alrededor y no el que se queda dentro." }
        ]
    },
    medidas: {
        imagen: "img/sensor-vistas.jpg",
        alt: "Vistas frontal, lateral y trasera del sensor con sus medidas",
        pie: "De izquierda a derecha: vista frontal, lateral y trasera. Mide unos 62 mm de alto, 48 mm de ancho y 22 mm de grosor.",
        piezas: [
            { clave: "frontal", x: 16, y: 45, titulo: "Vista frontal", texto: "48 mm de ancho y 62 mm de alto, más o menos como una caja de cerillas." },
            { clave: "lateral", x: 49, y: 45, titulo: "Vista lateral", texto: "Solo 22 mm de grosor, así que apenas abulta colgado de la mochila." },
            { clave: "clip", x: 85, y: 38, titulo: "Clip trasero", texto: "Para llevarlo en el cinturón, en una correa o en el bolsillo." },
            { clave: "trasera", x: 77, y: 64, titulo: "Ventilación trasera", texto: "El aire también entra por detrás y atraviesa el sensor." }
        ]
    },
    interior: {
        imagen: "img/sensor-despiece.jpg",
        alt: "Vista despiezada del sensor: tapa frontal, filtro, módulo con el sensor y carcasa trasera",
        pie: "La tapa se quita para cambiar el filtro, cargar la batería o revisar el sensor.",
        piezas: [
            { clave: "tapa", x: 14, y: 48, titulo: "Tapa frontal", texto: "Con la rejilla en espiral y el símbolo O₃. Se desmonta sin herramientas." },
            { clave: "filtro", x: 37, y: 50, titulo: "Filtro de polvo", texto: "Opcional. Evita que entre suciedad y alarga la vida del sensor." },
            { clave: "modulo", x: 59, y: 54, titulo: "Módulo de medición", texto: "El sensor de ozono SPEC y la placa SparkFun nRF52840, que lo lee y envía las mediciones al móvil por Bluetooth. Al lado va la batería." },
            { clave: "carcasa", x: 90, y: 50, titulo: "Carcasa trasera", texto: "Con las ranuras de ventilación y el soporte del clip." }
        ]
    }
};

// Plano de ejemplo de «Qué es AERIS»: 12 barrios (4 x 3), dos
// estaciones oficiales y los portadores repartidos por las calles.
// Coordenadas en el viewBox del SVG (600 x 380).
const PLANO = {
    barrio: { ancho: 128, alto: 104, calle: 18, origenX: 22, origenY: 22, columnas: 4, filas: 3 },
    radioEstacion: 80,
    radioPortador: 60,
    estaciones: [{ x: 232, y: 196 }, { x: 524, y: 74 }],
    // Repartidos por la ciudad, salvo en el barrio de abajo a la izquierda
    portadores: [
        { x: 116, y: 46 }, { x: 198, y: 96 }, { x: 404, y: 108 }, { x: 496, y: 44 },
        { x: 124, y: 206 }, { x: 212, y: 160 }, { x: 408, y: 226 }, { x: 488, y: 214 },
        { x: 266, y: 294 }, { x: 348, y: 348 }, { x: 546, y: 354 }
    ]
};

// ============================================================
// Funciones sin DOM
// ============================================================

// --------------------------------------------------------
// plano: Plano --> barriosDelPlano() --> [ Barrio ]
//
// Barrio = ( x: R, y: R, ancho: R, alto: R, cx: R, cy: R )
// --------------------------------------------------------
function barriosDelPlano(plano) {
    const b = plano.barrio;
    const barrios = [];
    for (let fila = 0; fila < b.filas; fila++) {
        for (let col = 0; col < b.columnas; col++) {
            const x = b.origenX + col * (b.ancho + b.calle);
            const y = b.origenY + fila * (b.alto + b.calle);
            barrios.push({ x, y, ancho: b.ancho, alto: b.alto, cx: x + b.ancho / 2, cy: y + b.alto / 2 });
        }
    }
    return barrios;
}

// --------------------------------------------------------
// barrio: Barrio, puntos: [ Punto ], radio: R --> barrioCubierto() --> B
//
// Un barrio tiene datos cerca si algún punto de medición está a
// menos de radio de su centro.
// --------------------------------------------------------
function barrioCubierto(barrio, puntos, radio) {
    return puntos.some(p => Math.hypot(p.x - barrio.cx, p.y - barrio.cy) <= radio);
}

// --------------------------------------------------------
// plano: Plano, red: Text --> coberturaRed() --> [ B ]
//
// red = "oficial" | "aeris". Con AERIS cuentan las estaciones y
// los portadores.
// --------------------------------------------------------
function coberturaRed(plano, red) {
    return barriosDelPlano(plano).map(barrio =>
        barrioCubierto(barrio, plano.estaciones, plano.radioEstacion) ||
        (red === "aeris" && barrioCubierto(barrio, plano.portadores, plano.radioPortador)));
}

// --------------------------------------------------------
// actual: N, total: N --> siguienteIndice() --> N
// --------------------------------------------------------
function siguienteIndice(actual, total) {
    return (actual + 1) % total;
}

// --------------------------------------------------------
// euros: R --> formatearEuros() --> Text
//
// 2.99 → "2,99 €"
// --------------------------------------------------------
function formatearEuros(euros) {
    return euros.toFixed(2).replace(".", ",") + " €";
}

// --------------------------------------------------------
// periodo: Text --> precioPremium() --> ( precio: Text, periodo: Text )
//
// periodo = "mes" | "anyo"
// --------------------------------------------------------
function precioPremium(periodo) {
    if (periodo === "anyo") {
        return { precio: formatearEuros(PRECIOS_PREMIUM.anyo), periodo: "al año" };
    }
    return { precio: formatearEuros(PRECIOS_PREMIUM.mes), periodo: "al mes" };
}

// --------------------------------------------------------
// mensual: R, anual: R --> porcentajeAhorro() --> N
//
// Cuánto se ahorra pagando un año de golpe frente a doce meses.
// --------------------------------------------------------
function porcentajeAhorro(mensual, anual) {
    return Math.round((1 - anual / (mensual * 12)) * 100);
}

// --------------------------------------------------------
// valor: R --> resultadoOzono() --> ( nivel: Nivel, consejo: Text )
// --------------------------------------------------------
function resultadoOzono(valor) {
    const nivel = basePortada.nivelContaminante("O3", valor);
    const indice = ["bueno", "moderado", "malo", "muy-malo"].indexOf(nivel.clase);
    return { nivel, consejo: basePortada.INFO_CONTAMINANTES.O3.consejos[indice] };
}

// ============================================================
// Página
// ============================================================

// --------------------------------------------------------
// --> pintarPlano()
//
// Dibuja los barrios, las estaciones y los portadores en el SVG.
// --------------------------------------------------------
function pintarPlano() {
    const svg = document.getElementById("plano-red");
    const ns = "http://www.w3.org/2000/svg";
    const crear = (tipo, atributos) => {
        const el = document.createElementNS(ns, tipo);
        for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
        return el;
    };
    svg.replaceChildren();
    barriosDelPlano(PLANO).forEach((b, i) => {
        svg.appendChild(crear("rect", { x: b.x, y: b.y, width: b.ancho, height: b.alto, rx: 14, class: "barrio", "data-barrio": i }));
    });
    for (const p of PLANO.portadores) {
        const g = crear("g", { class: "portador" });
        g.appendChild(crear("circle", { cx: p.x, cy: p.y, r: 16, class: "onda-portador" }));
        g.appendChild(crear("circle", { cx: p.x, cy: p.y, r: 6, class: "punto-portador" }));
        svg.appendChild(g);
    }
    for (const e of PLANO.estaciones) {
        svg.appendChild(crear("rect", { x: e.x - 11, y: e.y - 11, width: 22, height: 22, rx: 6, class: "estacion" }));
    }
}

// --------------------------------------------------------
// red: Text --> mostrarRed()
// --------------------------------------------------------
function mostrarRed(red) {
    const cobertura = coberturaRed(PLANO, red);
    document.querySelectorAll("#plano-red .barrio").forEach((rect, i) => {
        rect.classList.toggle("cubierto", cobertura[i]);
    });
    document.getElementById("plano-red").classList.toggle("con-aeris", red === "aeris");
    const cubiertos = cobertura.filter(Boolean).length;
    document.getElementById("barrios-cubiertos").textContent = String(cubiertos);
    document.getElementById("barrios-total").textContent = String(cobertura.length);
    document.getElementById("relleno-cobertura").style.width = Math.round(cubiertos / cobertura.length * 100) + "%";
    for (const boton of document.querySelectorAll("[data-red]")) {
        const activo = boton.dataset.red === red;
        boton.classList.toggle("activo", activo);
        boton.setAttribute("aria-pressed", String(activo));
    }
}

// --------------------------------------------------------
// vista: Text, clave: Text --> mostrarPieza()
//
// Marca el punto y la pieza de la lista y abre su explicación.
// --------------------------------------------------------
function mostrarPieza(vista, clave) {
    for (const el of document.querySelectorAll("[data-pieza]")) {
        const activa = el.dataset.pieza === clave;
        el.classList.toggle("activa", activa);
        if (el.tagName === "BUTTON") el.setAttribute("aria-expanded", String(activa));
    }
}

// --------------------------------------------------------
// vista: Text --> mostrarVistaSensor()
//
// vista = "exterior" | "medidas" | "interior"
// Cambia la imagen, pinta sus puntos numerados y la lista de
// piezas, y abre la primera.
// --------------------------------------------------------
function mostrarVistaSensor(vista) {
    const datos = VISTAS_SENSOR[vista];
    const caja = document.getElementById("imagen-sensor");
    const foto = document.getElementById("foto-sensor");
    caja.className = "imagen-sensor vista-" + vista;
    foto.src = datos.imagen;
    foto.alt = datos.alt;
    const pie = document.getElementById("pie-sensor");
    pie.textContent = datos.pie;
    pie.hidden = !datos.pie;

    const puntos = document.getElementById("puntos-sensor");
    const lista = document.getElementById("lista-piezas");
    puntos.replaceChildren();
    lista.replaceChildren();

    datos.piezas.forEach((pieza, i) => {
        const punto = document.createElement("button");
        punto.type = "button";
        punto.className = "punto-sensor";
        punto.dataset.pieza = pieza.clave;
        punto.style.left = pieza.x + "%";
        punto.style.top = pieza.y + "%";
        punto.textContent = String(i + 1);
        punto.setAttribute("aria-label", pieza.titulo);
        punto.addEventListener("click", () => mostrarPieza(vista, pieza.clave));
        puntos.appendChild(punto);

        const item = document.createElement("li");
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "pieza";
        boton.dataset.pieza = pieza.clave;
        boton.innerHTML = '<span class="numero-pieza"></span><span class="textos-pieza"><strong></strong><span></span></span>';
        boton.querySelector(".numero-pieza").textContent = String(i + 1);
        boton.querySelector("strong").textContent = pieza.titulo;
        boton.querySelector(".textos-pieza > span").textContent = pieza.texto;
        boton.addEventListener("click", () => mostrarPieza(vista, pieza.clave));
        boton.addEventListener("mouseenter", () => mostrarPieza(vista, pieza.clave));
        item.appendChild(boton);
        lista.appendChild(item);
    });

    pintarPlano();
    mostrarRed("oficial");
    for (const boton of document.querySelectorAll("[data-red]")) {
        boton.addEventListener("click", () => mostrarRed(boton.dataset.red));
    }

    for (const pestana of document.querySelectorAll("[data-vista]")) {
        const activa = pestana.dataset.vista === vista;
        pestana.classList.toggle("activa", activa);
        pestana.setAttribute("aria-selected", String(activa));
    }
    mostrarPieza(vista, datos.piezas[0].clave);
}

// --------------------------------------------------------
// clave: Text --> mostrarCapa()
// --------------------------------------------------------
function mostrarCapa(clave) {
    const capa = CAPAS[clave];
    document.getElementById("titulo-capa").textContent = capa.titulo;
    document.getElementById("texto-capa").textContent = capa.texto;
    document.getElementById("tecnologia-capa").textContent = capa.tecnologia;
    for (const boton of document.querySelectorAll("[data-capa]")) {
        const activa = boton.dataset.capa === clave;
        boton.classList.toggle("activa", activa);
        boton.setAttribute("aria-selected", String(activa));
    }
}

// --------------------------------------------------------
// indice: N --> mostrarFuncion()
// --------------------------------------------------------
function mostrarFuncion(indice) {
    const imagen = document.getElementById("pantalla-app");
    imagen.src = PANTALLAS_APP[indice].src;
    imagen.alt = PANTALLAS_APP[indice].alt;
    for (const boton of document.querySelectorAll("[data-funcion]")) {
        const activa = Number(boton.dataset.funcion) === indice;
        boton.classList.toggle("activa", activa);
        boton.setAttribute("aria-selected", String(activa));
    }
}

// --------------------------------------------------------
// valor: R --> mostrarOzono()
// --------------------------------------------------------
function mostrarOzono(valor) {
    const { nivel, consejo } = resultadoOzono(valor);
    document.getElementById("salida-ozono").textContent = Math.round(valor) + " µg/m³";
    const resultado = document.getElementById("resultado-ozono");
    resultado.className = "resultado-ozono nivel-" + nivel.clase;
    resultado.innerHTML = `<span class="punto punto-${nivel.clase}"></span><strong></strong> · `;
    resultado.querySelector("strong").textContent = nivel.texto;
    resultado.append(consejo);
    for (const fila of document.querySelectorAll(".fila-nivel")) {
        fila.classList.toggle("resaltada", fila.dataset.nivel === nivel.clase);
    }
    const deslizador = document.getElementById("valor-ozono");
    deslizador.style.setProperty("--avance", (valor / Number(deslizador.max) * 100) + "%");
}

// --------------------------------------------------------
// periodo: Text --> mostrarPeriodo()
// --------------------------------------------------------
function mostrarPeriodo(periodo) {
    const { precio, periodo: texto } = precioPremium(periodo);
    document.getElementById("precio-premium").textContent = precio;
    document.getElementById("periodo-premium").textContent = texto;
    for (const boton of document.querySelectorAll("[data-periodo]")) {
        const activo = boton.dataset.periodo === periodo;
        boton.classList.toggle("activo", activo);
        boton.setAttribute("aria-pressed", String(activo));
    }
}

// --------------------------------------------------------
// avisos: [ Elemento ], indice: N --> mostrarAviso()
// --------------------------------------------------------
function mostrarAviso(avisos, indice) {
    avisos.forEach((aviso, i) => aviso.classList.toggle("visible", i === indice));
}

function sinAnimaciones() {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// --------------------------------------------------------
// indice: N, temporizador: Estado --> lanzarAviso()
//
// Estado = ( id: N | null )
// Baja el aviso elegido en el móvil, hace vibrar el móvil y
// lo esconde a los pocos segundos.
// --------------------------------------------------------
function lanzarAviso(indice, temporizador) {
    const avisos = [...document.querySelectorAll(".notificacion")];
    const telefono = document.getElementById("telefono-portada");

    mostrarAviso(avisos, -1);
    // Un instante después, para que se vea bajar aunque ya hubiera otro
    setTimeout(() => mostrarAviso(avisos, indice), 120);

    telefono.classList.remove("vibra");
    void telefono.offsetWidth;             // reinicia la animación
    if (!sinAnimaciones()) {
        telefono.classList.add("vibra");
        // Al acabar de vibrar vuelve a flotar
        telefono.addEventListener("animationend", () => telefono.classList.remove("vibra"), { once: true });
    }

    for (const boton of document.querySelectorAll("[data-aviso]")) {
        boton.classList.toggle("activo", Number(boton.dataset.aviso) === indice);
    }

    clearTimeout(temporizador.id);
    temporizador.id = setTimeout(() => {
        mostrarAviso(avisos, -1);
        document.querySelectorAll("[data-aviso]").forEach(b => b.classList.remove("activo"));
    }, SEGUNDOS_AVISO_VISIBLE * 1000);
}

function iniciarAvisos() {
    const temporizador = { id: null };
    for (const boton of document.querySelectorAll("[data-aviso]")) {
        boton.addEventListener("click", () => lanzarAviso(Number(boton.dataset.aviso), temporizador));
    }
}

function iniciarFunciones() {
    let indice = 0;
    let automatico = !sinAnimaciones();
    const zona = document.querySelector(".app-interactiva");
    zona.classList.toggle("automatico", automatico);

    for (const boton of document.querySelectorAll("[data-funcion]")) {
        boton.addEventListener("click", () => {
            automatico = false;
            zona.classList.remove("automatico");
            indice = Number(boton.dataset.funcion);
            mostrarFuncion(indice);
        });
    }
    setInterval(() => {
        if (!automatico) return;
        indice = siguienteIndice(indice, PANTALLAS_APP.length);
        mostrarFuncion(indice);
    }, SEGUNDOS_POR_FUNCION * 1000);
}

function iniciarAparicion() {
    const elementos = document.querySelectorAll(".aparece");
    if (sinAnimaciones() || typeof IntersectionObserver === "undefined") {
        elementos.forEach(e => e.classList.add("visible"));
        return;
    }
    const observador = new IntersectionObserver(entradas => {
        for (const entrada of entradas) {
            if (entrada.isIntersecting) {
                entrada.target.classList.add("visible");
                observador.unobserve(entrada.target);
            }
        }
    }, { threshold: 0.15 });
    elementos.forEach(e => observador.observe(e));
}

function iniciarPortada() {
    document.documentElement.classList.add("con-js");

    // Sombra en el menú fijo cuando ya se ha bajado un poco
    const cabecera = document.querySelector(".cabecera-inicio");
    const actualizarCabecera = () => cabecera.classList.toggle("desplazada", window.scrollY > 10);
    window.addEventListener("scroll", actualizarCabecera, { passive: true });
    actualizarCabecera();
    iniciarAvisos();
    iniciarFunciones();
    iniciarAparicion();

    for (const boton of document.querySelectorAll("[data-capa]")) {
        boton.addEventListener("click", () => mostrarCapa(boton.dataset.capa));
    }

    for (const pestana of document.querySelectorAll("[data-vista]")) {
        pestana.addEventListener("click", () => mostrarVistaSensor(pestana.dataset.vista));
    }
    mostrarVistaSensor("exterior");

    const deslizador = document.getElementById("valor-ozono");
    deslizador.addEventListener("input", () => mostrarOzono(Number(deslizador.value)));
    mostrarOzono(Number(deslizador.value));

    document.getElementById("ahorro-anual").textContent =
        "−" + porcentajeAhorro(PRECIOS_PREMIUM.mes, PRECIOS_PREMIUM.anyo) + " %";
    for (const boton of document.querySelectorAll("[data-periodo]")) {
        boton.addEventListener("click", () => mostrarPeriodo(boton.dataset.periodo));
    }
}

if (typeof module !== "undefined") {
    module.exports = {
        siguienteIndice, formatearEuros, precioPremium, porcentajeAhorro, resultadoOzono,
        mostrarCapa, mostrarFuncion, mostrarOzono, mostrarPeriodo, mostrarAviso, lanzarAviso,
        mostrarVistaSensor, mostrarPieza, VISTAS_SENSOR,
        barriosDelPlano, barrioCubierto, coberturaRed, pintarPlano, mostrarRed, PLANO,
        CAPAS, PANTALLAS_APP, PRECIOS_PREMIUM
    };
} else {
    document.addEventListener("DOMContentLoaded", iniciarPortada);
}