// ---------------------------------------------------------------------------
// Fichero:     Seguridad.js
// Descripción: Funciones de seguridad de la lógica: hash de contraseñas con
//              scrypt (módulo crypto de Node, sin dependencias) y tokens
//              firmados (HMAC) para las sesiones y la recuperación de
//              contraseña, sin guardar nada en la base de datos.
//              Diseño en doc/logica_design.md. Tarea T016.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const crypto = require('crypto');

const LONGITUD_SAL = 16;       // bytes
const LONGITUD_CLAVE = 64;     // bytes

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
// datos: Objeto, clave: Texto --> firmarToken() --> Texto
// What it does: returns "<datos en base64url>.<firma>", where the signature is
//               HMAC-SHA256 with the server's secret key. Nobody without the
//               key can make or change a token. Nothing is saved in the BD.
// ---------------------------------------------------------------------------
function firmarToken(datos, clave) {
    const parteDatos = Buffer.from(JSON.stringify(datos)).toString('base64url');
    return `${parteDatos}.${firmar(parteDatos, clave)}`;
}

// ---------------------------------------------------------------------------
// token: Texto, clave: Texto --> leerToken() --> Objeto | null
// What it does: returns the data of the token if the signature is right and
//               it has not expired (field exp, in seconds); null if not.
// ---------------------------------------------------------------------------
function leerToken(token, clave) {
    const partes = String(token || '').split('.');
    if (partes.length !== 2) {
        return null;
    }
    const [parteDatos, firma] = partes;
    const firmaEsperada = Buffer.from(firmar(parteDatos, clave));
    const firmaRecibida = Buffer.from(firma);
    if (firmaRecibida.length !== firmaEsperada.length || !crypto.timingSafeEqual(firmaRecibida, firmaEsperada)) {
        return null;
    }
    let datos;
    try {
        datos = JSON.parse(Buffer.from(parteDatos, 'base64url').toString('utf8'));
    } catch (error) {
        return null;
    }
    if (typeof datos.exp !== 'number' || datos.exp <= Math.floor(Date.now() / 1000)) {
        return null;
    }
    return datos;
}

// ---------------------------------------------------------------------------
// passwordHash: Texto --> huellaContrasenya() --> Texto
// What it does: 16 hex characters that change when the password changes.
//               Tokens carry it, so changing the password cancels them.
// ---------------------------------------------------------------------------
function huellaContrasenya(passwordHash) {
    return crypto.createHash('sha256').update(String(passwordHash)).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// texto: Texto, clave: Texto --> firmar() --> Texto
// What it does: HMAC-SHA256 of the text in base64url.
// ---------------------------------------------------------------------------
function firmar(texto, clave) {
    return crypto.createHmac('sha256', String(clave)).update(texto).digest('base64url');
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

module.exports = { calcularHash, comprobarContrasenya, firmarToken, leerToken, huellaContrasenya };
