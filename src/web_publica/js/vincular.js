// ------------------------------------------------------------
// vincular.js
// Vinculación del sensor desde la web (T045 · H019, H037).
// ------------------------------------------------------------

const rolesVincular = typeof module !== "undefined" ? require("./roles") : window;

function leerCodigoSensor(texto) {
    const limpio = String(texto || "").trim();
    if (/^\d{12}$/.test(limpio)) {
        return {
            numeroSerie: limpio,
            modelo: "",
            gas: "",
            fecha: "",
            fechaFabricacion: null,
            sensibilidad: null
        };
    }

    const partes = limpio.split(/\s+/);
    if (partes.length !== 5
            || !/^\d{12}$/.test(partes[0])
            || !/^\d{6}$/.test(partes[1])
            || !/^[A-Za-z0-9]{2,3}$/.test(partes[2])
            || !/^\d{4}$/.test(partes[3])
            || !/^-?\d+(?:[.,]\d+)?$/.test(partes[4])) {
        return null;
    }

    const mes = Number(partes[3].slice(2));
    const sensibilidad = Number(partes[4].replace(",", "."));
    if (mes < 1 || mes > 12 || !Number.isFinite(sensibilidad)) return null;

    return {
        numeroSerie: partes[0],
        modelo: partes[1],
        gas: partes[2].toUpperCase(),
        fecha: partes[3],
        fechaFabricacion: partes[3].slice(2) + "/20" + partes[3].slice(0, 2),
        sensibilidad
    };
}

function conectarCabeceraVincular(logica, irA) {
    const usuario = logica.usuarioActual();
    const nombre = String(usuario.nombre || "").trim();
    document.getElementById("nombre-cabecera").textContent = nombre;
    document.getElementById("avatar").textContent = nombre.charAt(0).toUpperCase();
    document.getElementById("enlace-panel").hidden = !rolesVincular.tieneAccesoPanel(usuario);

    const botonMenu = document.getElementById("boton-menu");
    botonMenu.addEventListener("click", () => {
        const abierto = document.getElementById("menu-cuenta").classList.toggle("abierto");
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

function mostrarPaso(id, visible) {
    document.getElementById(id).classList.toggle("oculto", !visible);
}

function mostrarSensorLeido(sensor) {
    document.getElementById("serie-leida").textContent = sensor.numeroSerie;
    document.getElementById("fecha-leida").textContent =
        sensor.fechaFabricacion || "No disponible en este código";

    const filaModelo = document.getElementById("fila-modelo");
    filaModelo.classList.toggle("oculto", !sensor.modelo);
    document.getElementById("modelo-leido").textContent = sensor.modelo;

    const filaGas = document.getElementById("fila-gas");
    filaGas.classList.toggle("oculto", !sensor.gas);
    document.getElementById("gas-leido").textContent =
        sensor.gas === "O3" || sensor.gas === "03" ? "Ozono (O₃)" : sensor.gas;

    document.getElementById("error-vincular").classList.add("oculto");
    mostrarPaso("paso-entrada", false);
    mostrarPaso("paso-sensor", true);
}

async function confirmarVinculacion(logica, sensor, irA) {
    const boton = document.getElementById("boton-vincular");
    const error = document.getElementById("error-vincular");
    boton.disabled = true;
    error.classList.add("oculto");

    try {
        const resultado = await logica.solicitarVinculacion(sensor);
        if (resultado.correcto) {
            irA("mi_cuenta.html");
            return true;
        }
        if (resultado.sinSesion) {
            logica.cerrarSesion();
            irA("login.html");
            return false;
        }
        error.textContent = resultado.error;
        error.classList.remove("oculto");
        return false;
    } catch (causa) {
        console.error("No se pudo completar la vinculación del sensor", causa);
        error.textContent = "No se ha podido completar la vinculación. Inténtalo de nuevo.";
        error.classList.remove("oculto");
        return false;
    } finally {
        boton.disabled = false;
    }
}

function iniciarVincularSensor(logica = crearLogicaCuenta(), irA = url => window.location.assign(url)) {
    const usuario = logica.usuarioActual();
    if (!usuario) {
        irA("login.html");
        return null;
    }

    conectarCabeceraVincular(logica, irA);
    const formulario = document.getElementById("formulario-codigo");
    const campo = document.getElementById("codigo-etiqueta");
    const errorCodigo = document.getElementById("error-codigo");
    let sensorLeido = null;

    formulario.addEventListener("submit", evento => {
        evento.preventDefault();
        errorCodigo.classList.add("oculto");
        const sensor = leerCodigoSensor(campo.value);
        if (!sensor) {
            errorCodigo.textContent = "El código no es válido. Revisa la línea completa de la etiqueta.";
            errorCodigo.classList.remove("oculto");
            campo.focus();
            return;
        }
        sensorLeido = sensor;
        mostrarSensorLeido(sensor);
    });

    document.getElementById("boton-volver-codigo").addEventListener("click", () => {
        mostrarPaso("paso-sensor", false);
        mostrarPaso("paso-entrada", true);
        document.getElementById("error-vincular").classList.add("oculto");
        campo.focus();
    });
    document.getElementById("boton-vincular").addEventListener("click", () => {
        if (sensorLeido) confirmarVinculacion(logica, sensorLeido, irA);
    });

    return { logica };
}

if (typeof module !== "undefined") {
    module.exports = {
        leerCodigoSensor, mostrarSensorLeido, confirmarVinculacion, iniciarVincularSensor
    };
} else {
    document.addEventListener("DOMContentLoaded", () => iniciarVincularSensor());
}
