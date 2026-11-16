// ------------------------------------------------------------
// restablecer.js
// Controlador de la pantalla para crear una contraseña nueva
// (restablecer.html). Se abre desde el enlace del correo de
// recuperación, que lleva el token: restablecer.html?token=...
// ------------------------------------------------------------

const reglasRestablecer = typeof module !== "undefined" ? require("./validacion") : window;

const MENSAJE_NO_COINCIDEN = "Las dos contraseñas no coinciden";
const MENSAJE_SIN_TOKEN = "El enlace no es válido. Pide uno nuevo desde «Recuperar contraseña»";

// --------------------------------------------------------
// busqueda: Text --> leerToken() --> token: Text
//
// Saca el token de la parte ?token=... de la dirección.
// Devuelve "" si no hay.
// --------------------------------------------------------
function leerToken(busqueda) {
    return new URLSearchParams(busqueda).get("token") || "";
}

// --------------------------------------------------------
// nueva: Text, repetida: Text --> validarContrasenas()
//                             --> errores: [ ErrorCampo ]
//
// La contraseña nueva tiene que cumplir el formato de
// validacion.js y las dos tienen que ser iguales.
// --------------------------------------------------------
function validarContrasenas(nueva, repetida) {
    const mensaje = reglasRestablecer.errorContrasena(nueva);
    if (mensaje) return [{ campo: "contrasena", mensaje }];
    if (nueva !== repetida) return [{ campo: "repetida", mensaje: MENSAJE_NO_COINCIDEN }];
    return [];
}

// --------------------------------------------------------
// mensaje: Text, campos: [ Text ] --> mostrarErrorRestablecer()
// --------------------------------------------------------
function mostrarErrorRestablecer(mensaje, campos) {
    document.getElementById("texto-error").textContent = mensaje;
    document.getElementById("mensaje-error").classList.remove("oculto");
    for (const id of campos) {
        document.getElementById(id).classList.add("error");
    }
}

// --------------------------------------------------------
// ocultarErrorRestablecer()
// --------------------------------------------------------
function ocultarErrorRestablecer() {
    document.getElementById("mensaje-error").classList.add("oculto");
    document.getElementById("enlace-pedir-otro").classList.add("oculto");
    for (const campo of document.querySelectorAll(".formulario-acceso .campo")) {
        campo.classList.remove("error");
    }
}

// --------------------------------------------------------
// boton: Elemento --> alternarVisibilidad()
//
// Muestra u oculta el campo indicado en data-campo del botón
// y cambia el icono del ojo.
// --------------------------------------------------------
function alternarVisibilidad(boton) {
    const campo = document.getElementById(boton.dataset.campo);
    const visible = campo.type === "password";

    campo.type = visible ? "text" : "password";
    boton.querySelector("img").src = visible ? "img/ojo-abierto.svg" : "img/ojo-cerrado.svg";
    boton.setAttribute("aria-pressed", String(visible));
    boton.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
}

// --------------------------------------------------------
// evento: Evento, logica: LogicaFake | LogicaReal, token: Text
//   --> guardarContrasena()
//
// Comprueba las contraseñas y pide a la lógica que cambie la
// contraseña. Si va bien, muestra «Contraseña cambiada». Si
// el enlace no vale, lo dice y ofrece pedir otro.
// --------------------------------------------------------
async function guardarContrasena(evento, logica, token) {
    evento.preventDefault();
    ocultarErrorRestablecer();

    if (!token) {
        mostrarErrorRestablecer(MENSAJE_SIN_TOKEN, []);
        document.getElementById("enlace-pedir-otro").classList.remove("oculto");
        return;
    }

    const nueva = document.getElementById("contrasena").value;
    const repetida = document.getElementById("repetida").value;
    const errores = validarContrasenas(nueva, repetida);
    if (errores.length > 0) {
        mostrarErrorRestablecer(errores[0].mensaje, errores.map(e => e.campo));
        return;
    }

    const boton = document.querySelector("#formulario-restablecer button[type=submit]");
    boton.disabled = true;
    const resultado = await logica.restablecerContrasena(token, nueva);
    boton.disabled = false;

    if (!resultado.correcto) {
        mostrarErrorRestablecer(resultado.error, []);
        document.getElementById("enlace-pedir-otro").classList.remove("oculto");
        return;
    }
    document.getElementById("paso-formulario").classList.add("oculto");
    document.getElementById("paso-hecho").classList.remove("oculto");
}

// --------------------------------------------------------
// iniciarPantallaRestablecer()
// --------------------------------------------------------
function iniciarPantallaRestablecer() {
    const logica = crearLogica();
    const token = leerToken(window.location.search);

    document.getElementById("formulario-restablecer")
        .addEventListener("submit", evento => guardarContrasena(evento, logica, token));
    for (const boton of document.querySelectorAll(".boton-ojo")) {
        boton.addEventListener("click", () => alternarVisibilidad(boton));
    }
}

if (typeof module !== "undefined") {
    module.exports = { leerToken, validarContrasenas, alternarVisibilidad, guardarContrasena };
} else {
    document.addEventListener("DOMContentLoaded", iniciarPantallaRestablecer);
}