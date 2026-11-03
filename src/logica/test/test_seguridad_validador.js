// ---------------------------------------------------------------------------
// Fichero:     test_seguridad_validador.js
// Descripción: Tests de Seguridad.js y ValidadorUsuario.js (no usan la BD).
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const Seguridad = require('../Seguridad');
const Validador = require('../ValidadorUsuario');

describe('Seguridad', function () {

    it('el hash no contiene la contraseña y se puede comprobar', async function () {
        const hash = await Seguridad.calcularHash('aire2026');
        assert.ok(hash.startsWith('scrypt$'));
        assert.ok(!hash.includes('aire2026'));
        assert.strictEqual(await Seguridad.comprobarContrasenya('aire2026', hash), true);
        assert.strictEqual(await Seguridad.comprobarContrasenya('aire2027', hash), false);
    });

    it('la misma contraseña da hashes distintos (sal aleatoria)', async function () {
        assert.notStrictEqual(await Seguridad.calcularHash('aire2026'), await Seguridad.calcularHash('aire2026'));
    });

    it('un hash con formato incorrecto no se acepta', async function () {
        assert.strictEqual(await Seguridad.comprobarContrasenya('aire2026', 'aire2026'), false);
    });

    it('firmarToken() y leerToken(): solo vale con la misma clave y sin modificar', function () {
        const exp = Math.floor(Date.now() / 1000) + 60;
        const token = Seguridad.firmarToken({ u: 7, t: 'sesion', exp }, 'clave');
        assert.deepStrictEqual(Seguridad.leerToken(token, 'clave'), { u: 7, t: 'sesion', exp });
        assert.strictEqual(Seguridad.leerToken(token, 'otra clave'), null);

        const [datos, firma] = token.split('.');
        const datosCambiados = Buffer.from(JSON.stringify({ u: 1, t: 'sesion', exp })).toString('base64url');
        assert.strictEqual(Seguridad.leerToken(`${datosCambiados}.${firma}`, 'clave'), null);
        assert.strictEqual(Seguridad.leerToken('no-es-un-token', 'clave'), null);
        assert.strictEqual(Seguridad.leerToken(undefined, 'clave'), null);
    });

    it('leerToken() rechaza un token caducado', function () {
        const token = Seguridad.firmarToken({ u: 7, exp: Math.floor(Date.now() / 1000) - 1 }, 'clave');
        assert.strictEqual(Seguridad.leerToken(token, 'clave'), null);
    });

    it('huellaContrasenya() cambia si cambia el hash', function () {
        assert.match(Seguridad.huellaContrasenya('scrypt$a$b'), /^[0-9a-f]{16}$/);
        assert.notStrictEqual(Seguridad.huellaContrasenya('scrypt$a$b'), Seguridad.huellaContrasenya('scrypt$a$c'));
    });
});

describe('ValidadorUsuario', function () {

    it('datos correctos: no hay campos erróneos', function () {
        assert.deepStrictEqual(Validador.validarRegistro('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026'), []);
    });

    it('campos vacíos o que faltan', function () {
        assert.deepStrictEqual(Validador.validarRegistro('  ', undefined, '', null),
            ['nombre', 'apellidos', 'correo', 'contrasena']);
    });

    it('correo con formato incorrecto', function () {
        assert.strictEqual(Validador.esCorreoValido('pelin@'), false);
        assert.strictEqual(Validador.esCorreoValido('pelin@aeris'), false);
        assert.strictEqual(Validador.esCorreoValido(' Pelin@AERIS.es '), true);
    });

    it('contraseña débil: corta, sin número o sin letra', function () {
        assert.strictEqual(Validador.esContrasenaSegura('aire20'), false);
        assert.strictEqual(Validador.esContrasenaSegura('airelimpio'), false);
        assert.strictEqual(Validador.esContrasenaSegura('12345678'), false);
        assert.strictEqual(Validador.esContrasenaSegura('aire2026'), true);
    });

    it('normaliza el correo como la app', function () {
        assert.strictEqual(Validador.normalizarCorreo('  Pelin@AERIS.es '), 'pelin@aeris.es');
    });
});
