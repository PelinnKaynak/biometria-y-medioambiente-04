// ---------------------------------------------------------------------------
// Fichero:     Seguridad.js
// Descripción: Funciones de seguridad de la lógica: hash de contraseñas con
//              scrypt (módulo crypto de Node, sin dependencias) y tokens
//              aleatorios para sesiones y recuperación de contraseña.
//              Diseño en doc/logica_design.md. Tarea T016.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const crypto = require('crypto');

const LONGITUD_SAL = 16;       // bytes
const LONGITUD_CLAVE = 64;     // bytes
const LONGITUD_TOKEN = 32;     // bytes -> 64 caracteres hexadecimales

// ---------------------------------------------------------------------------
// contrasena: Texto --> calcularHash() --> Texto
// What it does: returns "scrypt$<salt>$<hash>" (hex). A new random salt is used
//               every time, so the same password gives different hashes.
// ---------------------------------------------------------------------------
async function calcularHash(contrasena) {
    const sal = crypto.randomBytes(LONGITUD_SAL).toString('hex');
    const clave = await scrypt(contrasena, sal);
    return `scrypt$${sal}$${clave.toString('hex')}`;
}

// ---------------------------------------------------------------------------
// contrasena: Texto, hashGuardado: Texto --> comprobarContrasenya() --> V/F
// What it does: true if the password gives the saved hash. Compares in
//               constant time.
// ---------------------------------------------------------------------------
async function comprobarContrasenya(contrasena, hashGuardado) {
    const partes = String(hashGuardado).split('$');
    if (partes.length !== 3 || partes[0] !== 'scrypt') {
        return false;
    }
    const [, sal, claveHex] = partes;
    const claveGuardada = Buffer.from(claveHex, 'hex');
    const clave = await scrypt(contrasena, sal);
    return claveGuardada.length === clave.length && crypto.timingSafeEqual(clave, claveGuardada);
}

// ---------------------------------------------------------------------------
// --> generarToken() --> Texto
// What it does: returns a random token of 64 hexadecimal characters.
// ---------------------------------------------------------------------------
function generarToken() {
    return crypto.randomBytes(LONGITUD_TOKEN).toString('hex');
}

// ---------------------------------------------------------------------------
// token: Texto --> hashToken() --> Texto
// What it does: SHA-256 of the token (hex). The BD stores this, not the token.
// ---------------------------------------------------------------------------
function hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// ---------------------------------------------------------------------------
// contrasena: Texto, sal: Texto --> scrypt() --> Buffer
// What it does: promise version of crypto.scrypt.
// ---------------------------------------------------------------------------
function scrypt(contrasena, sal) {
    return new Promise((resolver, rechazar) => {
        crypto.scrypt(String(contrasena), sal, LONGITUD_CLAVE, (error, clave) =>
            error ? rechazar(error) : resolver(clave));
    });
}

module.exports = { calcularHash, comprobarContrasenya, generarToken, hashToken };
