// ---------------------------------------------------------------------------
// Fichero:     test_api.js
// Descripción: Tests de la API REST de usuarios y autenticación. Arranca el
//              servidor en un puerto libre con la BD de pruebas aeris_test
//              (MySQL de XAMPP en marcha) y le hace peticiones HTTP reales.
//              Los correos no se envían: se apuntan.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../../logica/Logica');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('../../logica/test/bdPruebas');
const { crearServidor } = require('../ServidorREST');
const { requiereSesion, extraerToken } = require('../Autorizacion');

describe('API REST de usuarios y autenticación', function () {

    let logica, conexion, url;
    let correos;

    // ---- ayuda: petición HTTP con JSON ----
    async function peticion(metodo, ruta, cuerpo, token) {
        const cabeceras = { 'Content-Type': 'application/json' };
        if (token) {
            cabeceras.Authorization = `Bearer ${token}`;
        }
        const r = await fetch(url + ruta, {
            method: metodo, headers: cabeceras,
            body: cuerpo === undefined ? undefined : (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo))
        });
        const texto = await r.text();
        return { codigo: r.status, cuerpo: texto ? JSON.parse(texto) : null };
    }

    const PELIN = { nombre: 'Pelin', apellidos: 'Kaynak', correo: 'pelin@aeris.es', contrasena: 'aire2026' };

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS,
            async (destinatario, asunto, texto, extra) => {
                if (!extra) correos.push({ destinatario, texto });   // la bienvenida (con HTML) no se apunta aquí
            },
            'http://localhost:8080/restablecer.html', 'clave-de-pruebas');

        // Rutas solo para probar los roles (no existen en el servidor real)
        const servidor = crearServidor(logica, (s) => {
            s.get('/pruebaSoloAdmin', requiereSesion(logica, ['administrador', 'tecnico']),
                (p, r) => r.json({ ok: true, usuario: p.usuario }));
        });
        conexion = servidor.listen(0);
        url = `http://127.0.0.1:${conexion.address().port}`;
    });

    beforeEach(async function () {
        correos = [];
        await vaciarTablas(logica.conexion);
    });

    after(async function () {
        conexion.close();
        await logica.cerrar();
    });

    // --- POST /registrarUsuario ---------------------------------------------

    it('POST /registrarUsuario válido: 201, crea el usuario con la contraseña cifrada', async function () {
        const r = await peticion('POST', '/registrarUsuario', PELIN);
        assert.strictEqual(r.codigo, 201);
        assert.strictEqual(r.cuerpo.rol, 'portador');
        assert.match(r.cuerpo.token, /^[\w-]+\.[\w-]+$/);

        const [filas] = await logica.conexion.query('SELECT email, passwordHash FROM Usuarios');
        assert.strictEqual(filas.length, 1);
        assert.strictEqual(filas[0].email, 'pelin@aeris.es');
        assert.ok(!filas[0].passwordHash.includes('aire2026'));
    });

    it('POST /registrarUsuario con el JSON que envía la app (LogicaFakeRegistro.crearJSON)', async function () {
        const r = await peticion('POST', '/registrarUsuario',
            '{"nombre":"Pelin","apellidos":"Kaynak","correo":"pelin@aeris.es","contrasena":"aire2026"}');
        assert.strictEqual(r.codigo, 201);
    });

    it('POST /registrarUsuario con un correo ya registrado: 409', async function () {
        await peticion('POST', '/registrarUsuario', PELIN);
        const r = await peticion('POST', '/registrarUsuario', { ...PELIN, correo: 'PELIN@aeris.es' });
        assert.strictEqual(r.codigo, 409);
    });

    it('POST /registrarUsuario con datos incorrectos: 400 con los campos erróneos', async function () {
        const r = await peticion('POST', '/registrarUsuario', { nombre: 'Pelin', correo: 'pelin@', contrasena: '123' });
        assert.strictEqual(r.codigo, 400);
        assert.deepStrictEqual(r.cuerpo.campos, ['apellidos', 'correo', 'contrasena']);
    });

    it('POST /registrarUsuario con números o símbolos en el nombre: 400 y no se guarda', async function () {
        const r = await peticion('POST', '/registrarUsuario', { ...PELIN, nombre: 'Pelin_2', apellidos: 'Kaynak3' });
        assert.strictEqual(r.codigo, 400);
        assert.deepStrictEqual(r.cuerpo.campos, ['nombre', 'apellidos']);
        const [filas] = await logica.conexion.query('SELECT COUNT(*) AS n FROM Usuarios');
        assert.strictEqual(filas[0].n, 0);
    });

    it('JSON mal formado: 400 · ruta que no existe: 404', async function () {
        assert.strictEqual((await peticion('POST', '/registrarUsuario', '{nombre:')).codigo, 400);
        assert.strictEqual((await peticion('GET', '/noExiste')).codigo, 404);
    });

    // --- POST /iniciarSesion ------------------------------------------------

    it('POST /iniciarSesion correcto: 200 con token y rol', async function () {
        await peticion('POST', '/registrarUsuario', PELIN);
        const r = await peticion('POST', '/iniciarSesion', { correo: 'Pelin@AERIS.es', contrasena: 'aire2026' });
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(r.cuerpo.rol, 'portador');
        assert.strictEqual(r.cuerpo.nombre, 'Pelin');
        assert.match(r.cuerpo.token, /^[\w-]+\.[\w-]+$/);
    });

    it('POST /iniciarSesion incorrecto: 401 (mismo mensaje si el correo no existe)', async function () {
        await peticion('POST', '/registrarUsuario', PELIN);
        const a = await peticion('POST', '/iniciarSesion', { correo: 'pelin@aeris.es', contrasena: 'mala2026' });
        const b = await peticion('POST', '/iniciarSesion', { correo: 'nadie@aeris.es', contrasena: 'aire2026' });
        assert.strictEqual(a.codigo, 401);
        assert.strictEqual(b.codigo, 401);
        assert.deepStrictEqual(a.cuerpo, b.cuerpo);
    });

    // --- sesión y roles -----------------------------------------------------

    it('GET /usuarioActual con sesión: 200 con los datos, sin la contraseña', async function () {
        const { cuerpo } = await peticion('POST', '/registrarUsuario', PELIN);
        const r = await peticion('GET', '/usuarioActual', undefined, cuerpo.token);
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(r.cuerpo.correo, 'pelin@aeris.es');
        assert.strictEqual(r.cuerpo.rol, 'portador');
        assert.ok(!JSON.stringify(r.cuerpo).includes('scrypt'));
    });

    it('petición sin sesión o con un token inventado: 401', async function () {
        assert.strictEqual((await peticion('GET', '/usuarioActual')).codigo, 401);
        assert.strictEqual((await peticion('GET', '/usuarioActual', undefined, 'c'.repeat(64))).codigo, 401);
        assert.strictEqual((await peticion('GET', '/pruebaSoloAdmin')).codigo, 401);
    });

    it('rol sin permiso: 403 · rol con permiso: 200', async function () {
        const { cuerpo } = await peticion('POST', '/registrarUsuario', PELIN);
        assert.strictEqual((await peticion('GET', '/pruebaSoloAdmin', undefined, cuerpo.token)).codigo, 403);

        await logica.conexion.query("UPDATE Usuarios SET role = 'administrador' WHERE idUsuario = ?", [cuerpo.idUsuario]);
        const r = await peticion('GET', '/pruebaSoloAdmin', undefined, cuerpo.token);
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(r.cuerpo.usuario.rol, 'administrador');
    });

    // --- alertas del perfil (T010) -------------------------------------------

    it('POST /cambiarAlertas con sesión: 204 y GET /usuarioActual devuelve el valor nuevo', async function () {
        const { cuerpo } = await peticion('POST', '/registrarUsuario', PELIN);
        assert.strictEqual((await peticion('GET', '/usuarioActual', undefined, cuerpo.token)).cuerpo.alertas, true);
        const r = await peticion('POST', '/cambiarAlertas', { alertas: false }, cuerpo.token);
        assert.strictEqual(r.codigo, 204);
        assert.strictEqual((await peticion('GET', '/usuarioActual', undefined, cuerpo.token)).cuerpo.alertas, false);
    });

    it('POST /cambiarAlertas sin sesión: 401 · con un valor no válido: 400', async function () {
        assert.strictEqual((await peticion('POST', '/cambiarAlertas', { alertas: false })).codigo, 401);
        const { cuerpo } = await peticion('POST', '/registrarUsuario', PELIN);
        assert.strictEqual((await peticion('POST', '/cambiarAlertas', { alertas: 'si' }, cuerpo.token)).codigo, 400);
    });

    // --- editar mis datos y foto (T010) --------------------------------------

    it('POST /actualizarDatos: 200 con los datos nuevos · 400 · 409 · 401', async function () {
        const { cuerpo } = await peticion('POST', '/registrarUsuario', PELIN);
        await peticion('POST', '/registrarUsuario', { ...PELIN, correo: 'ana@aeris.es' });
        const r = await peticion('POST', '/actualizarDatos',
            { nombre: 'Pelin', apellidos: 'Kaynak Demir', correo: 'pelin.k@aeris.es' }, cuerpo.token);
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(r.cuerpo.correo, 'pelin.k@aeris.es');
        const mal = await peticion('POST', '/actualizarDatos', { nombre: '', apellidos: 'K', correo: 'x' }, cuerpo.token);
        assert.strictEqual(mal.codigo, 400);
        assert.deepStrictEqual(mal.cuerpo.campos, ['nombre', 'correo']);
        assert.strictEqual((await peticion('POST', '/actualizarDatos',
            { nombre: 'Pelin', apellidos: 'Kaynak', correo: 'ana@aeris.es' }, cuerpo.token)).codigo, 409);
        assert.strictEqual((await peticion('POST', '/actualizarDatos', { nombre: 'Pelin' })).codigo, 401);
    });

    it('POST /cambiarContrasenya: 200 con token nuevo · 403 actual incorrecta · 400 débil', async function () {
        const { cuerpo } = await peticion('POST', '/registrarUsuario', PELIN);
        assert.strictEqual((await peticion('POST', '/cambiarContrasenya',
            { contrasenaActual: 'mal12345', contrasenaNueva: 'ozono2027' }, cuerpo.token)).codigo, 403);
        assert.strictEqual((await peticion('POST', '/cambiarContrasenya',
            { contrasenaActual: PELIN.contrasena, contrasenaNueva: 'corta' }, cuerpo.token)).codigo, 400);
        const r = await peticion('POST', '/cambiarContrasenya',
            { contrasenaActual: PELIN.contrasena, contrasenaNueva: 'ozono2027' }, cuerpo.token);
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual((await peticion('GET', '/usuarioActual', undefined, r.cuerpo.token)).codigo, 200);
        assert.strictEqual((await peticion('GET', '/usuarioActual', undefined, cuerpo.token)).codigo, 401);
    });

    it('POST /cambiarFoto: 204 y GET /usuarioActual la devuelve · 400 si no es imagen', async function () {
        const { cuerpo } = await peticion('POST', '/registrarUsuario', PELIN);
        const foto = '/9j/' + 'A'.repeat(40000);    // tamaño de una foto real de 256x256
        assert.strictEqual((await peticion('POST', '/cambiarFoto', { foto }, cuerpo.token)).codigo, 204);
        assert.strictEqual((await peticion('GET', '/usuarioActual', undefined, cuerpo.token)).cuerpo.foto, foto);
        assert.strictEqual((await peticion('POST', '/cambiarFoto', { foto: 'no es una foto' }, cuerpo.token)).codigo, 400);
        assert.strictEqual((await peticion('POST', '/cambiarFoto', {}, cuerpo.token)).codigo, 400);
    });

    // --- recuperación de contraseña -----------------------------------------

    it('POST /solicitarRecuperacion con un correo registrado: 200 y envía el enlace', async function () {
        await peticion('POST', '/registrarUsuario', PELIN);
        const r = await peticion('POST', '/solicitarRecuperacion', { correo: 'pelin@aeris.es' });
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(correos.length, 1);
        assert.match(correos[0].texto, /restablecer\.html\?token=[\w-]+\.[\w-]+/);
    });

    it('POST /solicitarRecuperacion con un correo no registrado: 404 y no envía nada', async function () {
        const r = await peticion('POST', '/solicitarRecuperacion', { correo: 'nadie@aeris.es' });
        assert.strictEqual(r.codigo, 404);
        assert.strictEqual(r.cuerpo.error, 'No hay ninguna cuenta con este correo');
        assert.strictEqual(correos.length, 0);
    });

    it('POST /solicitarRecuperacion con un correo mal formado: 400', async function () {
        assert.strictEqual((await peticion('POST', '/solicitarRecuperacion', { correo: 'pelin@' })).codigo, 400);
        assert.strictEqual(correos.length, 0);
    });

    it('POST /restablecerContrasenya: 204, la nueva contraseña funciona y el enlace no se puede repetir', async function () {
        await peticion('POST', '/registrarUsuario', PELIN);
        await peticion('POST', '/solicitarRecuperacion', { correo: 'pelin@aeris.es' });
        const token = correos[0].texto.match(/token=(\S+)/)[1];

        assert.strictEqual((await peticion('POST', '/restablecerContrasenya', { token, contrasena: 'nueva2026' })).codigo, 204);
        assert.strictEqual((await peticion('POST', '/iniciarSesion', { correo: 'pelin@aeris.es', contrasena: 'nueva2026' })).codigo, 200);
        assert.strictEqual((await peticion('POST', '/restablecerContrasenya', { token, contrasena: 'otra2026' })).codigo, 400);
    });

    it('GET /restablecer.html: el servidor sirve la página del enlace de recuperación', async function () {
        const r = await fetch(url + '/restablecer.html');
        assert.strictEqual(r.status, 200);
        assert.match(r.headers.get('content-type'), /text\/html/);
        assert.ok((await r.text()).includes('/restablecerContrasenya'));
    });

    // --- Autorizacion.extraerToken ------------------------------------------

    it('extraerToken() solo acepta "Bearer <token>"', function () {
        assert.strictEqual(extraerToken('Bearer abc'), 'abc');
        assert.strictEqual(extraerToken('bearer   abc '), 'abc');
        assert.strictEqual(extraerToken('abc'), null);
        assert.strictEqual(extraerToken(undefined), null);
    });
});
