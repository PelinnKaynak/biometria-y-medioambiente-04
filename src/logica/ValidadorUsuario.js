// ---------------------------------------------------------------------------
// Fichero:     ValidadorUsuario.js
// Descripción: Comprueba los datos de registro y las contraseñas con las
//              mismas reglas que la app (ValidadorRegistro.java). El servidor
//              no se fía de lo que llega: vuelve a comprobarlo todo.
//              Diseño en doc/logica_design.md. Tarea T016.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const LONGITUD_MINIMA_CONTRASENA = 8;
const LONGITUD_MAXIMA = { nombre: 50, apellidos: 100, correo: 255 };
// Mismos patrones que ValidadorRegistro.java (app)
const PATRON_CORREO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
// Letras (con tilde, ñ…) separadas por un espacio, guion o apóstrofo, como en la app
const PATRON_NOMBRE = /^\p{L}+([ '’-]\p{L}+)*$/u;
const PATRON_LETRA = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;
const PATRON_NUMERO = /[0-9]/;

// ---------------------------------------------------------------------------
// nombre: Texto, apellidos: Texto, correo: Texto, contrasena: Texto
//     --> validarRegistro() --> Lista<Texto>
// What it does: returns the names of the wrong fields (empty list if all ok).
// ---------------------------------------------------------------------------
function validarRegistro(nombre, apellidos, correo, contrasena) {
    const erroneos = [];
    if (!esNombreValido(nombre, LONGITUD_MAXIMA.nombre)) {
        erroneos.push('nombre');
    }
    if (!esNombreValido(apellidos, LONGITUD_MAXIMA.apellidos)) {
        erroneos.push('apellidos');
    }
    if (!esCorreoValido(correo)) {
        erroneos.push('correo');
    }
    if (!esContrasenaSegura(contrasena)) {
        erroneos.push('contrasena');
    }
    return erroneos;
}

// ---------------------------------------------------------------------------
// texto: Texto --> estaVacio() --> V/F
// What it does: true if it is not text or has only spaces.
// ---------------------------------------------------------------------------
function estaVacio(texto) {
    return typeof texto !== 'string' || texto.trim().length === 0;
}

// ---------------------------------------------------------------------------
// texto: Texto, longitudMaxima: N --> esNombreValido() --> V/F
// What it does: true if it only has letters (accents included) separated by
//               one space, hyphen or apostrophe, and is not too long.
//               Numbers and symbols such as _ @ . are not allowed.
// ---------------------------------------------------------------------------
function esNombreValido(texto, longitudMaxima) {
    if (estaVacio(texto)) {
        return false;
    }
    const limpio = texto.trim();
    return limpio.length <= longitudMaxima && PATRON_NOMBRE.test(limpio);
}

// ---------------------------------------------------------------------------
// correo: Texto --> esCorreoValido() --> V/F
// What it does: true if it looks like name@domain.ext and is not too long.
// ---------------------------------------------------------------------------
function esCorreoValido(correo) {
    return !estaVacio(correo)
        && correo.trim().length <= LONGITUD_MAXIMA.correo
        && PATRON_CORREO.test(correo.trim());
}

// ---------------------------------------------------------------------------
// contrasena: Texto --> esContrasenaSegura() --> V/F
// What it does: true if it has at least 8 characters, a letter and a number.
// ---------------------------------------------------------------------------
function esContrasenaSegura(contrasena) {
    return typeof contrasena === 'string'
        && contrasena.length >= LONGITUD_MINIMA_CONTRASENA
        && PATRON_LETRA.test(contrasena)
        && PATRON_NUMERO.test(contrasena);
}

// ---------------------------------------------------------------------------
// correo: Texto --> normalizarCorreo() --> Texto
// What it does: removes spaces and puts the email in lower case (as the app).
// ---------------------------------------------------------------------------
function normalizarCorreo(correo) {
    return String(correo).trim().toLowerCase();
}

module.exports = {
    LONGITUD_MINIMA_CONTRASENA,
    validarRegistro, estaVacio, esNombreValido, esCorreoValido, esContrasenaSegura, normalizarCorreo
};
