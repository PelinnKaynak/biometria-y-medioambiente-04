// ---------------------------------------------------------------------------
// Fichero:     test_logica.js
// Descripción: Tests de Logica.js contra la base de datos de pruebas
//              aeris_test (MySQL de XAMPP en marcha). El envío de correos se
//              sustituye por una función que los apunta.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../Logica');
const Seguridad = require('../Seguridad');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('./bdPruebas');

const URL_RESTABLECER = 'http://localhost:8080/restablecer.html';
const CLAVE = 'clave-de-pruebas';

describe('Logica (usuarios y autenticación)', function () {

    let logica;
    let correos;    // correos "enviados" en cada test

    before(async function () {
        await crearBDPruebas();     // también prueba que el script SQL funciona en una BD vacía
        logica = await Logica.crear(CONFIG_BD_PRUEBAS,
            async (destinatario, asunto, texto) => { correos.push({ destinatario, asunto, texto }); },
            URL_RESTABLECER, CLAVE);
    });

    beforeEach(async function () {
        correos = [];
        await vaciarTablas(logica.conexion);
    });

    after(async function () {
        await logica.cerrar();
    });

    // token del enlace del último correo enviado
    function tokenDelUltimoCorreo() {
        return correos[correos.length - 1].texto.match(/token=(\S+)/)[1];
    }

    // --- registro -----------------------------------------------------------

    it('registrarUsuario() crea el usuario como portador y abre su sesión', async function () {
        const sesion = await logica.registrarUsuario('Pelin', 'Kaynak', ' Pelin@AERIS.es ', 'aire2026');
        assert.ok(sesion.idUsuario > 0);
        assert.strictEqual(sesion.rol, 'portador');
        assert.strictEqual(sesion.nombre, 'Pelin');
        assert.ok(Seguridad.leerToken(sesion.token, CLAVE));

        const usuario = await logica.obtenerUsuario(sesion.idUsuario);
        assert.strictEqual(usuario.correo, 'pelin@aeris.es');
        assert.strictEqual(usuario.apellidos, 'Kaynak');
        assert.strictEqual(usuario.hashContrasenya, undefined);
    });

    it('registrarUsuario() guarda la contraseña cifrada, nunca en claro', async function () {
        await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        const [filas] = await logica.conexion.query('SELECT passwordHash FROM Usuarios');
        assert.ok(filas[0].passwordHash.startsWith('scrypt$'));
        assert.ok(!filas[0].passwordHash.includes('aire2026'));
    });

    it('registrarUsuario() con un correo ya registrado lanza CORREO_YA_REGISTRADO', async function () {
        await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        await assert.rejects(
            logica.registrarUsuario('Otra', 'Persona', 'PELIN@aeris.es', 'otra2026'),
            { codigo: 'CORREO_YA_REGISTRADO' });
    });

    it('registrarUsuario() con datos incorrectos lanza DATOS_NO_VALIDOS y no guarda nada', async function () {
        await assert.rejects(
            logica.registrarUsuario('', 'Kaynak', 'pelin@', 'corta'),
            { codigo: 'DATOS_NO_VALIDOS', campos: ['nombre', 'correo', 'contrasena'] });
        const [filas] = await logica.conexion.query('SELECT COUNT(*) AS n FROM Usuarios');
        assert.strictEqual(filas[0].n, 0);
    });

    // --- inicio y cierre de sesión ------------------------------------------

    it('iniciarSesion() con correo y contraseña correctos devuelve token y rol', async function () {
        await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        const sesion = await logica.iniciarSesion('PELIN@aeris.es', 'aire2026');
        assert.strictEqual(sesion.rol, 'portador');
        assert.deepStrictEqual(await logica.comprobarSesion(sesion.token),
            { idUsuario: sesion.idUsuario, rol: 'portador' });
    });

    it('iniciarSesion() con contraseña incorrecta o correo desconocido lanza CREDENCIALES_INCORRECTAS', async function () {
        await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        await assert.rejects(logica.iniciarSesion('pelin@aeris.es', 'aire2027'), { codigo: 'CREDENCIALES_INCORRECTAS' });
        await assert.rejects(logica.iniciarSesion('nadie@aeris.es', 'aire2026'), { codigo: 'CREDENCIALES_INCORRECTAS' });
        await assert.rejects(logica.iniciarSesion('', ''), { codigo: 'CREDENCIALES_INCORRECTAS' });
    });

    it('comprobarSesion() devuelve el rol actual del usuario', async function () {
        const sesion = await logica.registrarUsuario('Ana', 'Admin', 'ana@aeris.es', 'admin2026');
        await logica.conexion.query("UPDATE Usuarios SET role = 'administrador' WHERE idUsuario = ?", [sesion.idUsuario]);
        assert.strictEqual((await logica.comprobarSesion(sesion.token)).rol, 'administrador');
    });

    it('comprobarSesion() devuelve null con un token inventado, vacío o caducado', async function () {
        const sesion = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        assert.strictEqual(await logica.comprobarSesion('a'.repeat(64)), null);
        assert.strictEqual(await logica.comprobarSesion(''), null);
        assert.strictEqual(await logica.comprobarSesion(undefined), null);
        const caducado = Seguridad.firmarToken(
            { ...Seguridad.leerToken(sesion.token, CLAVE), exp: Math.floor(Date.now() / 1000) - 1 }, CLAVE);
        assert.strictEqual(await logica.comprobarSesion(caducado), null);
        assert.strictEqual(await logica.comprobarSesion(sesion.token.replace(/.$/, c => c === 'A' ? 'B' : 'A')), null);
    });

    it('un enlace de recuperación no sirve como sesión', async function () {
        await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        await logica.solicitarRecuperacion('pelin@aeris.es');
        assert.strictEqual(await logica.comprobarSesion(tokenDelUltimoCorreo()), null);
    });

    it('no hay tablas de sesiones: la BD solo tiene Usuarios', async function () {
        const [tablas] = await logica.conexion.query('SHOW TABLES');
        assert.deepStrictEqual(tablas.map(t => Object.values(t)[0].toLowerCase()), ['usuarios']);
    });

    // --- recuperación de contraseña -----------------------------------------

    it('solicitarRecuperacion() con un correo registrado envía el enlace', async function () {
        await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        assert.strictEqual(await logica.solicitarRecuperacion('Pelin@aeris.es'), true);
        assert.strictEqual(correos.length, 1);
        assert.strictEqual(correos[0].destinatario, 'pelin@aeris.es');
        assert.ok(correos[0].texto.includes(URL_RESTABLECER + '?token='));
        assert.ok(Seguridad.leerToken(tokenDelUltimoCorreo(), CLAVE));
    });

    it('solicitarRecuperacion() con un correo no registrado no envía nada', async function () {
        assert.strictEqual(await logica.solicitarRecuperacion('nadie@aeris.es'), false);
        assert.strictEqual(await logica.solicitarRecuperacion('no-es-un-correo'), false);
        assert.strictEqual(correos.length, 0);
    });

    it('restablecerContrasenya() cambia la contraseña y cierra las sesiones abiertas', async function () {
        const sesion = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        await logica.solicitarRecuperacion('pelin@aeris.es');
        await logica.restablecerContrasenya(tokenDelUltimoCorreo(), 'nueva2026');

        assert.strictEqual(await logica.comprobarSesion(sesion.token), null);
        await assert.rejects(logica.iniciarSesion('pelin@aeris.es', 'aire2026'), { codigo: 'CREDENCIALES_INCORRECTAS' });
        assert.ok((await logica.iniciarSesion('pelin@aeris.es', 'nueva2026')).token);
    });

    it('el enlace de recuperación solo se puede usar una vez', async function () {
        await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        await logica.solicitarRecuperacion('pelin@aeris.es');
        const token = tokenDelUltimoCorreo();
        await logica.restablecerContrasenya(token, 'nueva2026');
        await assert.rejects(logica.restablecerContrasenya(token, 'otra2026'), { codigo: 'TOKEN_NO_VALIDO' });
    });

    it('restablecerContrasenya() rechaza un enlace caducado, inventado o una contraseña débil', async function () {
        await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        await logica.solicitarRecuperacion('pelin@aeris.es');
        const token = tokenDelUltimoCorreo();

        await assert.rejects(logica.restablecerContrasenya(token, 'corta'), { codigo: 'DATOS_NO_VALIDOS' });
        await assert.rejects(logica.restablecerContrasenya('b'.repeat(64), 'nueva2026'), { codigo: 'TOKEN_NO_VALIDO' });
        const caducado = Seguridad.firmarToken(
            { ...Seguridad.leerToken(token, CLAVE), exp: Math.floor(Date.now() / 1000) - 1 }, CLAVE);
        await assert.rejects(logica.restablecerContrasenya(caducado, 'nueva2026'), { codigo: 'TOKEN_NO_VALIDO' });
    });
});
