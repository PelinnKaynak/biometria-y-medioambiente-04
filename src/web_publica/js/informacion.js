// ------------------------------------------------------------
// informacion.js
// Controlador de las páginas de información (T012):
// contaminantes.html, normativa.html y consejos.html.
// Reutiliza los niveles y la cabecera de inicio.js.
// ------------------------------------------------------------

// En el navegador, LIMITES_NIVEL y NIVELES son constantes globales de
// inicio.js (no están en window, así que se nombran directamente).
const baseInfo = typeof module !== "undefined"
    ? require("./inicio")
    : { LIMITES_NIVEL, NIVELES, pintarCabecera };

// Texto y recomendación de cada nivel, por contaminante
const INFO_CONTAMINANTES = {
    O3: {
        titulo: "Ozono",
        unidad: "µg/m³",
        explicacion: "Se forma con el sol a partir de los gases del tráfico y de la industria. Irrita los ojos y las vías respiratorias. Es lo que mide el sensor de AERIS.",
        consejos: [
            "Disfruta del aire libre con normalidad.",
            "Personas sensibles: reduce el esfuerzo intenso.",
            "Evita el ejercicio intenso al aire libre.",
            "Permanece en interiores y ventila poco."
        ]
    },
    NO2: {
        titulo: "Dióxido de nitrógeno",
        unidad: "µg/m³",
        explicacion: "Sale sobre todo de los tubos de escape de los coches diésel y de las calefacciones. Es más alto en las calles con mucho tráfico.",
        consejos: [
            "Disfruta del aire libre con normalidad.",
            "Personas sensibles: evita las calles con mucho tráfico.",
            "Evita hacer deporte cerca de las vías con mucho tráfico.",
            "Reduce el tiempo al aire libre y aléjate del tráfico."
        ]
    },
    PM10: {
        titulo: "Partículas PM",
        unidad: "µg/m³",
        explicacion: "Polvo muy fino que viene del tráfico, las obras, las quemas y, a veces, de las intrusiones de polvo africano. Entra en los pulmones.",
        consejos: [
            "Disfruta del aire libre con normalidad.",
            "Personas sensibles: reduce el esfuerzo intenso.",
            "Evita el ejercicio intenso y cierra las ventanas.",
            "Permanece en interiores. Si sales, usa mascarilla FFP2."
        ]
    },
    CO: {
        titulo: "Monóxido de carbono",
        unidad: "mg/m³",
        explicacion: "Gas sin olor que sale de los motores y de las combustiones incompletas. En la calle suele estar bajo; el peligro está en los sitios cerrados.",
        consejos: [
            "Disfruta del aire libre con normalidad.",
            "Personas con problemas de corazón: reduce el esfuerzo.",
            "Evita los túneles y los aparcamientos cerrados.",
            "Permanece en interiores y no uses braseros ni estufas de gas."
        ]
    }
};

// --------------------------------------------------------
// contaminante: Text --> filasNiveles() --> [ FilaNivel ]
//
// FilaNivel = ( nivel: Nivel, rango: Text, consejo: Text )
// "0 – 100", "101 – 180"... y "> 240" para el último.
// Los decimales (CO) se escriben con coma.
// --------------------------------------------------------
function filasNiveles(contaminante) {
    const limites = baseInfo.LIMITES_NIVEL[contaminante];
    const info = INFO_CONTAMINANTES[contaminante];
    const decimal = limites.some(l => l < 20);
    const numero = n => String(n).replace(".", ",");
    const siguiente = n => decimal ? numero(n + 0.1) : String(n + 1);

    return baseInfo.NIVELES.map((nivel, i) => {
        let rango;
        if (i === 0) rango = "0 – " + numero(limites[0]);
        else if (i < limites.length) rango = siguiente(limites[i - 1]) + " – " + numero(limites[i]);
        else rango = "> " + numero(limites[limites.length - 1]);
        return { nivel, rango, consejo: info.consejos[i] };
    });
}

// --------------------------------------------------------
// contaminante: Text --> pintarNiveles()
// --------------------------------------------------------
function pintarNiveles(contaminante) {
    const info = INFO_CONTAMINANTES[contaminante];
    document.getElementById("titulo-niveles").textContent = info.titulo + ": niveles y qué hacer";
    document.getElementById("explicacion-contaminante").textContent = info.explicacion;
    document.getElementById("unidad-niveles").textContent = info.unidad;

    const cuerpo = document.getElementById("cuerpo-niveles");
    cuerpo.replaceChildren(...filasNiveles(contaminante).map(fila => {
        const tr = document.createElement("tr");
        const nivel = document.createElement("td");
        nivel.innerHTML = `<span class="punto punto-${fila.nivel.clase}"></span>`;
        nivel.append(fila.nivel.texto);
        const rango = document.createElement("td");
        rango.className = "rango";
        rango.textContent = fila.rango;
        rango.dataset.unidad = info.unidad;
        const consejo = document.createElement("td");
        consejo.textContent = fila.consejo;
        tr.append(nivel, rango, consejo);
        return tr;
    }));

    for (const tarjeta of document.querySelectorAll("[data-contaminante]")) {
        const activa = tarjeta.dataset.contaminante === contaminante;
        tarjeta.classList.toggle("activa", activa);
        tarjeta.setAttribute("aria-pressed", String(activa));
    }
}

// --------------------------------------------------------
// usuario: Usuario | null --> iniciarCabeceraInfo()
//
// Botón de acceso según la sesión y menú del móvil.
// --------------------------------------------------------
function iniciarCabeceraInfo(usuario) {
    baseInfo.pintarCabecera(usuario);
    const boton = document.getElementById("boton-menu-inicio");
    const menu = document.getElementById("menu-inicio");
    boton.addEventListener("click", () => {
        const abierto = menu.classList.toggle("abierto");
        boton.setAttribute("aria-expanded", String(abierto));
        boton.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
    });
}

function iniciarPaginaInfo() {
    iniciarCabeceraInfo(crearLogicaMapa().usuarioActual());
    if (!document.getElementById("cuerpo-niveles")) return;

    for (const tarjeta of document.querySelectorAll("[data-contaminante]")) {
        tarjeta.addEventListener("click", () => pintarNiveles(tarjeta.dataset.contaminante));
    }
    pintarNiveles("O3");
}

if (typeof module !== "undefined") {
    module.exports = { filasNiveles, pintarNiveles, iniciarCabeceraInfo, INFO_CONTAMINANTES };
} else {
    document.addEventListener("DOMContentLoaded", iniciarPaginaInfo);
}