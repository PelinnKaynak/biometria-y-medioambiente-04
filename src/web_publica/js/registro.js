// ------------------------------------------------------------
// registro.js
// Controlador de la pantalla para crear una cuenta de portador
// (registro.html, T034 · H001).
// ------------------------------------------------------------

const reglasRegistro = typeof module !== "undefined" ? require("./validacion") : window;

const PAGINA_TRAS_REGISTRO = "mi_cuenta.html";

// --------------------------------------------------------
// datos: DatosRegistro, repetida: Text --> validarRegistro()
//                                     --> errores: [ ErrorCampo ]
//
// DatosRegistro = ( nombre: Text, apellidos: Text, correo: Text, contrasena: Text )
//
// Comprueba cada campo con las reglas de validacion.js (las
// mismas que el servidor y la app) y que las dos contraseñas
// coincidan.
// --------------------------------------------------------
function validarRegistro(datos, repetida) {
    const comprobaciones = [
        ["nombre", reglasRegistro.errorNombre(datos.nombre)],
        ["apellidos", reglasRegistro.errorApellidos(datos.apellidos)],
        ["correo", reglasRegistro.errorCorreo(datos.correo)],
        ["contrasena", reglasRegistro.errorContrasena(datos.contrasena)]
    ];
    const errores = comprobaciones
        .filter(([, mensaje]) => mensaje)
        .map(([campo, mensaje]) => ({ campo, mensaje }));

    if (!errores.some(e => e.campo === "contrasena") && datos.contrasena !== repetida) {
        errores.push({ campo: "repetida", mensaje: "Las dos contraseñas no coinciden" });
    }
    return errores;
}

// --------------------------------------------------------
// mensaje: Text, campos: [ Text ] --> mostrarErrorRegistro()
// --------------------------------------------------------
function mostrarErrorRegistro(mensaje, campos) {
    document.getElementById("texto-error").textContent = mensaje;
    document.getElementById("mensaje-error").classList.remove("oculto");
    for (const id of campos) {
        document.getElementById(id).classList.add("error");
    }
}

// --------------------------------------------------------
// ocultarErrorRegistro()
// --------------------------------------------------------
function ocultarErrorRegistro() {
    document.getElementById("mensaje-error").classList.add("oculto");
    document.getElementById("ayuda-correo-repetido").classList.add("oculto");
    for (const campo of document.querySelectorAll(".formulario-acceso .campo")) {
        campo.classList.remove("error");
    }
}

// --------------------------------------------------------
// boton: Elemento --> alternarVisibilidadRegistro()
//
// Muestra u oculta el campo indicado en data-campo del botón.
// --------------------------------------------------------
function alternarVisibilidadRegistro(boton) {
    const campo = document.getElementById(boton.dataset.campo);
    const visible = campo.type === "password";

    campo.type = visible ? "text" : "password";
    boton.querySelector("img").src = visible ? "img/ojo-abierto.svg" : "img/ojo-cerrado.svg";
    boton.setAttribute("aria-pressed", String(visible));
    boton.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
}

// --------------------------------------------------------
// evento: Evento, logica: LogicaFake | LogicaReal,
// irA: (url: Text) --> enviarRegistro()
//
// Valida el formulario y crea la cuenta. Si va bien, la
// sesión queda iniciada y lleva a Mi cuenta. Si el correo ya
// tiene cuenta, ofrece iniciar sesión o recuperar la contraseña.
// --------------------------------------------------------
async function enviarRegistro(evento, logica, irA) {
    evento.preventDefault();
    ocultarErrorRegistro();

    const valor = id => document.getElementById(id).value;
    const datos = {
        nombre: valor("nombre").trim(),
        apellidos: valor("apellidos").trim(),
        correo: valor("correo").trim(),
        contrasena: valor("contrasena")
    };

    const errores = validarRegistro(datos, valor("repetida"));
    if (errores.length > 0) {
        mostrarErrorRegistro(errores[0].mensaje, errores.map(e => e.campo));
        return;
    }

    const boton = document.querySelector("#formulario-registro button[type=submit]");
    boton.disabled = true;
    const resultado = await logica.registrarUsuario(datos);
    boton.disabled = false;

    if (!resultado.correcto) {
        mostrarErrorRegistro(resultado.error, resultado.campos || []);
        if (resultado.correoRepetido) {
            document.getElementById("ayuda-correo-repetido").classList.remove("oculto");
        }
        return;
    }
    irA(PAGINA_TRAS_REGISTRO);
}

// --------------------------------------------------------
// iniciarPantallaRegistro()
// --------------------------------------------------------
function iniciarPantallaRegistro() {
    const logica = crearLogica();
    const irA = url => window.location.assign(url);

    document.getElementById("formulario-registro")
        .addEventListener("submit", evento => enviarRegistro(evento, logica, irA));
    for (const boton of document.querySelectorAll(".boton-ojo")) {
        boton.addEventListener("click", () => alternarVisibilidadRegistro(boton));
    }
}

if (typeof module !== "undefined") {
    module.exports = { validarRegistro, enviarRegistro, alternarVisibilidadRegistro };
} else {
    document.addEventListener("DOMContentLoaded", iniciarPantallaRegistro);
}