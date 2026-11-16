// ------------------------------------------------------------
// recuperar.js
// Controlador de la pantalla para recuperar la contraseña
// (recuperar.html). Tiene dos pasos: pedir el correo y
// confirmar que se ha enviado el enlace.
// ------------------------------------------------------------

const reglasRecuperar = typeof module !== "undefined" ? require("./validacion") : window;

// --------------------------------------------------------
// mensaje: Text --> mostrarErrorCorreo()
//
// Muestra el aviso de error y marca el campo del correo.
// --------------------------------------------------------
function mostrarErrorCorreo(mensaje) {
  document.getElementById("texto-error").textContent = mensaje;
  document.getElementById("mensaje-error").classList.remove("oculto");
  document.getElementById("correo").classList.add("error");
}

// --------------------------------------------------------
// ocultarErrorCorreo()
// --------------------------------------------------------
function ocultarErrorCorreo() {
  document.getElementById("mensaje-error").classList.add("oculto");
  document.getElementById("correo").classList.remove("error");
}

// --------------------------------------------------------
// correo: Text --> mostrarPasoEnviado()
//
// Esconde el formulario y muestra la confirmación con el
// correo al que se ha enviado el enlace.
// --------------------------------------------------------
function mostrarPasoEnviado(correo) {
  document.getElementById("correo-enviado").textContent = correo;
  document.getElementById("paso-formulario").classList.add("oculto");
  document.getElementById("paso-enviado").classList.remove("oculto");
}

// --------------------------------------------------------
// evento: Evento, logica: LogicaFake | LogicaReal
//   --> enviarSolicitud()
//
// Comprueba el formato del correo y pide a la lógica que
// envíe el enlace. Si va bien, pasa a la confirmación.
// --------------------------------------------------------
async function enviarSolicitud(evento, logica) {
  evento.preventDefault();
  ocultarErrorCorreo();

  const correo = document.getElementById("correo").value.trim();
  const error = reglasRecuperar.errorCorreo(correo);
  if (error) {
    mostrarErrorCorreo(error);
    return;
  }

  const boton = document.querySelector("#formulario-recuperar button[type=submit]");
  boton.disabled = true;
  const resultado = await logica.solicitarRecuperacion(correo);
  boton.disabled = false;

  if (!resultado.correcto) {
    mostrarErrorCorreo(resultado.error);
    return;
  }
  mostrarPasoEnviado(correo);
}

// --------------------------------------------------------
// logica: LogicaFake | LogicaReal --> reenviarEnlace()
//
// Vuelve a pedir el enlace para el mismo correo y muestra
// un aviso de que se ha enviado otro.
// --------------------------------------------------------
async function reenviarEnlace(logica) {
  const correo = document.getElementById("correo-enviado").textContent;
  const boton = document.getElementById("boton-reenviar");

  boton.disabled = true;
  const resultado = await logica.solicitarRecuperacion(correo);
  boton.disabled = false;

  const aviso = document.getElementById("aviso-reenviado");
  aviso.textContent = resultado.correcto ? "Te hemos enviado otro enlace." : resultado.error;
  aviso.classList.remove("oculto");
}

// --------------------------------------------------------
// iniciarPantallaRecuperar()
//
// Conecta el formulario y el enlace de reenviar con sus
// funciones.
// --------------------------------------------------------
function iniciarPantallaRecuperar() {
  const logica = crearLogica();
  document.getElementById("formulario-recuperar")
    .addEventListener("submit", evento => enviarSolicitud(evento, logica));
  document.getElementById("boton-reenviar")
    .addEventListener("click", () => reenviarEnlace(logica));
}

if (typeof module !== "undefined") {
  module.exports = { enviarSolicitud, reenviarEnlace, mostrarPasoEnviado };
} else {
  document.addEventListener("DOMContentLoaded", iniciarPantallaRecuperar);
}
