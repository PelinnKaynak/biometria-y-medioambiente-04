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

    it('los tokens son aleatorios, de 64 caracteres, y su hash es SHA-256', function () {
        const a = Seguridad.generarToken();
        const b = Seguridad.generarToken();
        assert.match(a, /^[0-9a-f]{64}$/);
        assert.notStrictEqual(a, b);
        assert.match(Seguridad.hashToken(a), /^[0-9a-f]{64}$/);
        assert.notStrictEqual(Seguridad.hashToken(a), a);
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
