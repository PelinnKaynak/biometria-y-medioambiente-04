// ------------------------------------------------------------
// validacion.js
// Reglas de formato del nombre, el correo y la contraseña. Son las
// mismas que usan el servidor (src/logica/ValidadorUsuario.js)
// y la app (ValidadorRegistro.java), para que una cuenta creada
// en la app siempre pueda entrar en la web.
// ------------------------------------------------------------

const LONGITUD_MAXIMA_CORREO = 255;
const LONGITUD_MINIMA_CONTRASENA = 8;

const LONGITUD_MAXIMA_NOMBRE = 50;
const LONGITUD_MAXIMA_APELLIDOS = 100;
// Letras (con tildes, ñ…) separadas por un espacio, guion o apóstrofo
const PATRON_NOMBRE_PERSONA = /^\p{L}+([ '’-]\p{L}+)*$/u;

const PATRON_CORREO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PATRON_LETRA = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;
const PATRON_NUMERO = /[0-9]/;

const MENSAJE_CORREO_VACIO = "Escribe tu correo electrónico";
const MENSAJE_CORREO_INVALIDO = "Escribe un correo válido, por ejemplo nombre@dominio.es";
const MENSAJE_CONTRASENA_VACIA = "Escribe tu contraseña";
const MENSAJE_CONTRASENA_INVALIDA =
    "La contraseña debe tener al menos 8 caracteres, con al menos una letra y un número";

// --------------------------------------------------------
// correo: Text --> esCorreoValido() --> B
//
// Un correo es válido si, sin los espacios del principio y
// del final, tiene como mucho 255 caracteres y la forma
// nombre@dominio.ext: antes de la @ letras, números y
// . _ % + -; después un dominio con punto y una terminación
// de al menos dos letras.
// --------------------------------------------------------
function esCorreoValido(correo) {
  const texto = correo.trim();
  return texto.length > 0 &&
      texto.length <= LONGITUD_MAXIMA_CORREO &&
      PATRON_CORREO.test(texto);
}

// --------------------------------------------------------
// contrasena: Text --> esContrasenaValida() --> B
//
// Una contraseña es válida si tiene al menos 8 caracteres,
// al menos una letra y al menos un número.
// --------------------------------------------------------
function esContrasenaValida(contrasena) {
  return contrasena.length >= LONGITUD_MINIMA_CONTRASENA &&
      PATRON_LETRA.test(contrasena) &&
      PATRON_NUMERO.test(contrasena);
}

// --------------------------------------------------------
// texto: Text, longitud_maxima: N --> esNombreValido() --> B
//
// Un nombre o unos apellidos son válidos si solo tienen
// letras (con tildes) separadas por un espacio, guion o
// apóstrofo y no pasan de la longitud máxima. Sin números
// ni símbolos como _ @ .
// --------------------------------------------------------
function esNombreValido(texto, longitud_maxima) {
  const limpio = texto.trim();
  return limpio.length > 0 && limpio.length <= longitud_maxima && PATRON_NOMBRE_PERSONA.test(limpio);
}

// --------------------------------------------------------
// nombre: Text --> errorNombre() --> Text
// apellidos: Text --> errorApellidos() --> Text
//
// Devuelven el mensaje de error, o "" si el dato es válido.
// --------------------------------------------------------
function errorNombre(nombre) {
  if (nombre.trim().length === 0) return "Escribe tu nombre";
  if (!esNombreValido(nombre, LONGITUD_MAXIMA_NOMBRE)) return "El nombre solo puede tener letras";
  return "";
}

function errorApellidos(apellidos) {
  if (apellidos.trim().length === 0) return "Escribe tus apellidos";
  if (!esNombreValido(apellidos, LONGITUD_MAXIMA_APELLIDOS)) return "Los apellidos solo pueden tener letras";
  return "";
}

// --------------------------------------------------------
// correo: Text --> errorCorreo() --> Text
//
// Devuelve el mensaje de error del correo, o "" si es válido.
// --------------------------------------------------------
function errorCorreo(correo) {
  if (correo.trim().length === 0) return MENSAJE_CORREO_VACIO;
  if (!esCorreoValido(correo)) return MENSAJE_CORREO_INVALIDO;
  return "";
}

// --------------------------------------------------------
// contrasena: Text --> errorContrasena() --> Text
//
// Devuelve el mensaje de error de la contraseña, o "" si es
// válida.
// --------------------------------------------------------
function errorContrasena(contrasena) {
  if (contrasena.length === 0) return MENSAJE_CONTRASENA_VACIA;
  if (!esContrasenaValida(contrasena)) return MENSAJE_CONTRASENA_INVALIDA;
  return "";
}

if (typeof module !== "undefined") {
  module.exports = {
    esCorreoValido,
    esContrasenaValida,
    esNombreValido,
    errorNombre,
    errorApellidos,
    errorCorreo,
    errorContrasena,
    MENSAJE_CORREO_INVALIDO,
    MENSAJE_CONTRASENA_INVALIDA
  };
}