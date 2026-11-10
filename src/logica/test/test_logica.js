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
const fs = require('fs');
const { Logica } = require('../Logica');
const Seguridad = require('../Seguridad');
const { crearCorreoBienvenida } = require('../CorreoBienvenida');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('./bdPruebas');

const URL_RESTABLECER = 'http://localhost:8080/restablecer.html';
const CLAVE = 'clave-de-pruebas';

describe('Logica (usuarios y autenticación)', function () {

    let logica;
    let correos;        // correos de recuperación "enviados" en cada test
    let bienvenidas;    // correos de bienvenida

    before(async function () {
        await crearBDPruebas();     // también prueba que el script SQL funciona en una BD vacía
        logica = await Logica.crear(CONFIG_BD_PRUEBAS,
            async (destinatario, asunto, texto, extra) => {
                (asunto.includes('bienvenida') ? bienvenidas : correos).push({ destinatario, asunto, texto, extra });
            },
            URL_RESTABLECER, CLAVE);
    });

    beforeEach(async function () {
        correos = [];
        bienvenidas = [];
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

    it('obtenerUsuario() devuelve alertas = true por defecto', async function () {
        const sesion = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        assert.strictEqual((await logica.obtenerUsuario(sesion.idUsuario)).alertas, true);
    });

    it('cambiarAlertas() guarda el valor nuevo y se puede volver a activar', async function () {
        const sesion = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        await logica.cambiarAlertas(sesion.idUsuario, false);
        assert.strictEqual((await logica.obtenerUsuario(sesion.idUsuario)).alertas, false);
        await logica.cambiarAlertas(sesion.idUsuario, true);
        assert.strictEqual((await logica.obtenerUsuario(sesion.idUsuario)).alertas, true);
    });

    it('cambiarAlertas() con un valor que no es true ni false lanza DATOS_NO_VALIDOS', async function () {
        const sesion = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        await assert.rejects(logica.cambiarAlertas(sesion.idUsuario, 'no'), { codigo: 'DATOS_NO_VALIDOS' });
        assert.strictEqual((await logica.obtenerUsuario(sesion.idUsuario)).alertas, true);
    });

    it('actualizarDatos() cambia nombre, apellidos y correo (normalizado)', async function () {
        const sesion = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        const datos = await logica.actualizarDatos(sesion.idUsuario, ' María ', 'García-López', ' Maria@AERIS.es ');
        assert.deepStrictEqual(datos, { nombre: 'María', apellidos: 'García-López', correo: 'maria@aeris.es' });
        const usuario = await logica.obtenerUsuario(sesion.idUsuario);
        assert.strictEqual(usuario.correo, 'maria@aeris.es');
        assert.strictEqual(usuario.nombre, 'María');
        await logica.iniciarSesion('maria@aeris.es', 'aire2026');   // el correo nuevo sirve para entrar
    });

    it('actualizarDatos() con datos no válidos o con el correo de otra cuenta lanza un error', async function () {
        const sesion = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        await logica.registrarUsuario('Ana', 'Ruiz', 'ana@aeris.es', 'aire2026');
        await assert.rejects(logica.actualizarDatos(sesion.idUsuario, 'P3lin', '', 'mal'),
            (e) => e.codigo === 'DATOS_NO_VALIDOS' && e.campos.join() === 'nombre,apellidos,correo');
        await assert.rejects(logica.actualizarDatos(sesion.idUsuario, 'Pelin', 'Kaynak', 'ana@aeris.es'),
            { codigo: 'CORREO_YA_REGISTRADO' });
    });

    it('cambiarContrasenya() con la actual correcta: la nueva funciona y da un token nuevo', async function () {
        const sesion = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        const nueva = await logica.cambiarContrasenya(sesion.idUsuario, 'aire2026', 'ozono2027');
        assert.ok(await logica.comprobarSesion(nueva.token));
        assert.strictEqual(await logica.comprobarSesion(sesion.token), null);   // la sesión vieja se cierra
        await logica.iniciarSesion('pelin@aeris.es', 'ozono2027');
    });

    it('restablecerContrasenya() con la misma contraseña que la actual lanza DATOS_NO_VALIDOS', async function () {
        await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        await logica.solicitarRecuperacion('pelin@aeris.es');
        const token = correos[0].texto.match(/token=(\S+)/)[1];
        await assert.rejects(logica.restablecerContrasenya(token, 'aire2026'),
            (e) => e.codigo === 'DATOS_NO_VALIDOS' && e.message.includes('distinta de la actual'));
        await logica.restablecerContrasenya(token, 'ozono2027');      // el enlace sigue valiendo
    });

    it('cambiarContrasenya() con la misma contraseña que la actual lanza DATOS_NO_VALIDOS', async function () {
        const sesion = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        await assert.rejects(logica.cambiarContrasenya(sesion.idUsuario, 'aire2026', 'aire2026'),
            { codigo: 'DATOS_NO_VALIDOS' });
    });

    it('cambiarContrasenya() con la actual incorrecta o una nueva débil lanza un error', async function () {
        const sesion = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        await assert.rejects(logica.cambiarContrasenya(sesion.idUsuario, 'otra1234', 'ozono2027'),
            { codigo: 'CONTRASENA_INCORRECTA' });
        await assert.rejects(logica.cambiarContrasenya(sesion.idUsuario, 'aire2026', 'corta'),
            { codigo: 'DATOS_NO_VALIDOS' });
        await logica.iniciarSesion('pelin@aeris.es', 'aire2026');   // no ha cambiado
    });

    it('cambiarFoto() guarda un JPEG en base64, lo quita con null y rechaza lo que no es imagen', async function () {
        const sesion = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        assert.strictEqual((await logica.obtenerUsuario(sesion.idUsuario)).foto, null);
        await logica.cambiarFoto(sesion.idUsuario, '/9j/4AAQSkZJRgABAQ==');
        assert.strictEqual((await logica.obtenerUsuario(sesion.idUsuario)).foto, '/9j/4AAQSkZJRgABAQ==');
        await logica.cambiarFoto(sesion.idUsuario, null);
        assert.strictEqual((await logica.obtenerUsuario(sesion.idUsuario)).foto, null);
        for (const mala of ['', 'hola', '<script>', '/9j/' + 'A'.repeat(200000), 123]) {
            await assert.rejects(logica.cambiarFoto(sesion.idUsuario, mala), { codigo: 'DATOS_NO_VALIDOS' });
        }
    });

    it('registrarUsuario() envía el correo de bienvenida con los dos logos', async function () {
        await logica.registrarUsuario('Pelin', 'Kaynak', ' Pelin@AERIS.es ', 'aire2026');
        await new Promise((r) => setImmediate(r));      // se envía sin esperar
        assert.strictEqual(bienvenidas.length, 1);
        const c = bienvenidas[0];
        assert.strictEqual(c.destinatario, 'pelin@aeris.es');
        assert.strictEqual(c.asunto, 'Te damos la bienvenida a AERIS');
        assert.ok(c.texto.includes('Hola, Pelin'));
        assert.ok(c.extra.html.includes('cid:logo-aeris') && c.extra.html.includes('cid:logo-sensetech'));
        assert.deepStrictEqual(c.extra.adjuntos.map((a) => a.cid), ['logo-aeris', 'logo-sensetech']);
        for (const a of c.extra.adjuntos) assert.ok(fs.existsSync(a.path), a.path);
    });

    it('si el correo de bienvenida falla, el registro sigue funcionando', async function () {
        const otra = new Logica(logica.conexion, async () => { throw new Error('Gmail caído'); }, URL_RESTABLECER, CLAVE);
        const errorOriginal = console.error;
        console.error = () => {};
        try {
            const sesion = await otra.registrarUsuario('Ana', 'Ruiz', 'ana@aeris.es', 'aire2026');
            assert.ok(sesion.token);
            await new Promise((r) => setImmediate(r));
        } finally {
            console.error = errorOriginal;
        }
    });

    it('el correo de recuperación lleva el enlace en el texto y en el botón del HTML, con los logos', async function () {
        await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        await logica.solicitarRecuperacion('pelin@aeris.es');
        const c = correos[0];
        const enlace = c.texto.match(/(http\S+token=\S+)/)[1];
        assert.ok(c.extra.html.includes(`href="${enlace}"`));
        assert.ok(c.extra.html.includes('Crear contraseña nueva'));
        assert.deepStrictEqual(c.extra.adjuntos.map((a) => a.cid), ['logo-aeris', 'logo-sensetech']);
    });

    it('el nombre no puede meter HTML en el correo de bienvenida', function () {
        const { html } = crearCorreoBienvenida('<b>Pelin</b>');
        assert.ok(!html.includes('<b>Pelin</b>'));
        assert.ok(html.includes('&lt;b&gt;Pelin&lt;/b&gt;'));
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
        await logica.solicitarRecuperacion('Pelin@aeris.es');
        assert.strictEqual(correos.length, 1);
        assert.strictEqual(correos[0].destinatario, 'pelin@aeris.es');
        assert.ok(correos[0].texto.includes(URL_RESTABLECER + '?token='));
        const datos = Seguridad.leerToken(tokenDelUltimoCorreo(), CLAVE);
        assert.ok(datos);
        const minutos = (datos.exp - Date.now() / 1000) / 60;
        assert.ok(minutos > 29 && minutos <= 30, 'el enlace caduca a los 30 minutos');
        assert.ok(correos[0].texto.includes('30 minutos'));
    });

    it('solicitarRecuperacion() con un correo no registrado lanza CORREO_NO_REGISTRADO y no envía nada', async function () {
        await assert.rejects(logica.solicitarRecuperacion('nadie@aeris.es'), { codigo: 'CORREO_NO_REGISTRADO' });
        await assert.rejects(logica.solicitarRecuperacion('no-es-un-correo'), { codigo: 'DATOS_NO_VALIDOS' });
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
