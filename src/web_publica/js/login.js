// ------------------------------------------------------------
// login.js
// Controlador de la pantalla de inicio de sesión (login.html).
// No contiene lógica de negocio: todo lo que tiene que ver con
// el servidor pasa por la lógica del navegador.
// ------------------------------------------------------------

// En el navegador las funciones de validacion.js son globales;
// en las pruebas (Node) se cargan con require.
const reglas = typeof module !== "undefined" ? require("./validacion") : window;

const MENSAJE_CREDENCIALES = "Correo o contraseña incorrectos";

const PAGINA_SEGUN_ROL = {
  ADMINISTRADOR: "../web_admin/panel_nodos.html",
  TECNICO: "../web_admin/panel_nodos.html",
  PORTADOR: "mi_cuenta.html",
  PREMIUM: "mi_cuenta.html",
  CIUDADANO: "mi_cuenta.html"
};

// --------------------------------------------------------
// correo: Text, contrasena: Text --> validarFormulario()
//                                --> errores: [ ErrorCampo ]
//
// ErrorCampo = ( campo: Text, mensaje: Text )
//
// Comprueba el formato del correo y de la contraseña con las
// reglas de validacion.js. Si la lista está vacía, el
// formulario es correcto.
// --------------------------------------------------------
function validarFormulario(correo, contrasena) {
  const errores = [];

  const mensajeCorreo = reglas.errorCorreo(correo);
  if (mensajeCorreo) errores.push({ campo: "correo", mensaje: mensajeCorreo });

  const mensajeContrasena = reglas.errorContrasena(contrasena);
  if (mensajeContrasena) errores.push({ campo: "contrasena", mensaje: mensajeContrasena });

  return errores;
}

// --------------------------------------------------------
// rol: Rol --> paginaInicioSegunRol() --> url: Text
//
// Rol = { PORTADOR, PREMIUM, TECNICO, ADMINISTRADOR, CIUDADANO }
// El servidor manda el rol en minúsculas ("administrador"),
// así que se compara sin tener en cuenta mayúsculas.
// --------------------------------------------------------
function paginaInicioSegunRol(rol) {
  const pagina = PAGINA_SEGUN_ROL[String(rol).toUpperCase()];
  if (!pagina) {
    throw new Error("Rol desconocido: " + rol);
  }
  return pagina;
}

// --------------------------------------------------------
// mensaje: Text, campos: [ Text ] --> mostrarError()
//
// Muestra el aviso con el mensaje y marca en rojo los
// campos indicados (por su id).
// --------------------------------------------------------
function mostrarError(mensaje, campos) {
  document.getElementById("texto-error").textContent = mensaje;
  document.getElementById("mensaje-error").classList.remove("oculto");
  for (const id of campos) {
    document.getElementById(id).classList.add("error");
  }
}

// --------------------------------------------------------
// ocultarError()
//
// Esconde el aviso y quita la marca roja de los campos.
// --------------------------------------------------------
function ocultarError() {
  document.getElementById("mensaje-error").classList.add("oculto");
  for (const campo of document.querySelectorAll(".formulario-acceso .campo")) {
    campo.classList.remove("error");
  }
}

// --------------------------------------------------------
// alternarVisibilidadContrasena()
//
// Muestra u oculta la contraseña y cambia el icono del ojo.
// --------------------------------------------------------
function alternarVisibilidadContrasena() {
  const campo = document.getElementById("contrasena");
  const boton = document.getElementById("boton-ojo");
  const visible = campo.type === "password";

  campo.type = visible ? "text" : "password";
  boton.querySelector("img").src = visible ? "img/ojo-abierto.svg" : "img/ojo-cerrado.svg";
  boton.setAttribute("aria-pressed", String(visible));
  boton.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
}

// --------------------------------------------------------
// evento: Evento, logica: LogicaFake | LogicaReal,
// irA: (url: Text) --> enviarFormulario()
//
// Valida el formulario, intenta iniciar sesión y, si va bien,
// lleva al usuario a la página de su rol. Si va mal, muestra
// el aviso de error.
// --------------------------------------------------------
async function enviarFormulario(evento, logica, irA) {
  evento.preventDefault();
  ocultarError();

  const correo = document.getElementById("correo").value;
  const contrasena = document.getElementById("contrasena").value;

  const errores = validarFormulario(correo, contrasena);
  if (errores.length > 0) {
    mostrarError(errores[0].mensaje, errores.map(e => e.campo));
    return;
  }

  const boton = document.querySelector(".boton-acceder");
  boton.disabled = true;

  const resultado = await logica.iniciarSesion({ correo, contrasena });

  boton.disabled = false;

  if (!resultado.correcto) {
    mostrarError(resultado.error || MENSAJE_CREDENCIALES, ["correo", "contrasena"]);
    return;
  }
  irA(paginaInicioSegunRol(resultado.usuario.rol));
}

// --------------------------------------------------------
// iniciarPantalla()
//
// Conecta el formulario y el botón del ojo con sus funciones.
// --------------------------------------------------------
function iniciarPantalla() {
  const logica = crearLogica();
  const irA = url => window.location.assign(url);

  document.getElementById("formulario-login")
      .addEventListener("submit", evento => enviarFormulario(evento, logica, irA));
  document.getElementById("boton-ojo")
      .addEventListener("click", alternarVisibilidadContrasena);
}

if (typeof module !== "undefined") {
  module.exports = {
    validarFormulario,
    paginaInicioSegunRol,
    mostrarError,
    ocultarError,
    alternarVisibilidadContrasena,
    enviarFormulario
  };
} else {
  document.addEventListener("DOMContentLoaded", iniciarPantalla);
}