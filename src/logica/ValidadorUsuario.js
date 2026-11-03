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
const PATRON_LETRA = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;
const PATRON_NUMERO = /[0-9]/;

// ---------------------------------------------------------------------------
// nombre: Texto, apellidos: Texto, correo: Texto, contrasena: Texto
//     --> validarRegistro() --> Lista<Texto>
// What it does: returns the names of the wrong fields (empty list if all ok).
// ---------------------------------------------------------------------------
function validarRegistro(nombre, apellidos, correo, contrasena) {
    const erroneos = [];
    if (estaVacio(nombre) || nombre.trim().length > LONGITUD_MAXIMA.nombre) {
        erroneos.push('nombre');
    }
    if (estaVacio(apellidos) || apellidos.trim().length > LONGITUD_MAXIMA.apellidos) {
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
    validarRegistro, estaVacio, esCorreoValido, esContrasenaSegura, normalizarCorreo
};
