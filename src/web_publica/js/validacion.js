// ------------------------------------------------------------
// validacion.js
// Reglas de formato del correo y de la contraseña. Las usan
// todas las pantallas de acceso para que la regla sea la misma
// en toda la web.
// ------------------------------------------------------------

const LONGITUD_MAXIMA_CORREO = 254;
const LONGITUD_MINIMA_CONTRASENA = 8;
const LONGITUD_MAXIMA_CONTRASENA = 64;

const MENSAJE_CORREO_VACIO = "Escribe tu correo electrónico";
const MENSAJE_CORREO_INVALIDO = "Escribe un correo válido, por ejemplo nombre@dominio.es";
const MENSAJE_CONTRASENA_VACIA = "Escribe tu contraseña";
const MENSAJE_CONTRASENA_INVALIDA =
  "La contraseña debe tener entre 8 y 64 caracteres, al menos una letra y un número, y ningún espacio";

// --------------------------------------------------------
// correo: Text --> esCorreoValido() --> B
//
// Un correo es válido si:
//  - tiene como mucho 254 caracteres,
//  - tiene una sola @, con texto antes y después,
//  - antes de la @ solo hay letras, números y . _ % + -,
//    sin empezar ni acabar en punto y sin dos puntos seguidos,
//  - después de la @ hay un dominio con al menos un punto y
//    una terminación de dos letras o más (.es, .com, .upv.es).
// --------------------------------------------------------
function esCorreoValido(correo) {
  const texto = correo.trim();
  if (texto.length === 0 || texto.length > LONGITUD_MAXIMA_CORREO) return false;

  const formato = /^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
  return formato.test(texto);
}

// --------------------------------------------------------
// contrasena: Text --> esContrasenaValida() --> B
//
// Una contraseña es válida si tiene entre 8 y 64 caracteres,
// al menos una letra, al menos un número y ningún espacio.
// --------------------------------------------------------
function esContrasenaValida(contrasena) {
  return contrasena.length >= LONGITUD_MINIMA_CONTRASENA &&
    contrasena.length <= LONGITUD_MAXIMA_CONTRASENA &&
    /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(contrasena) &&
    /[0-9]/.test(contrasena) &&
    !/\s/.test(contrasena);
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
    errorCorreo,
    errorContrasena,
    MENSAJE_CORREO_INVALIDO,
    MENSAJE_CONTRASENA_INVALIDA
  };
}
