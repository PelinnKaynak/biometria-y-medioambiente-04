// ---------------------------------------------------------------------------
// Fichero:     test_api_vinculacion.js
// Descripción: Tests de las rutas de vinculación del sensor (T005) con el
//              servidor en marcha en un puerto libre y la BD aeris_test. Los
//              correos no se envían: se apuntan.
// Autores:     Equipo 04 – SenseTech
// Fecha:       14/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../../logica/Logica');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('../../logica/test/bdPruebas');
const { crearServidor } = require('../ServidorREST');

const SERIE = '092021010920';

describe('API REST de vinculación del sensor', function () {

    let logica, conexion, url, correos, token;

    async function peticion(metodo, ruta, cuerpo, conToken = true) {
        const cabeceras = { 'Content-Type': 'application/json' };
        if (conToken) {
            cabeceras.Authorization = `Bearer ${token}`;
        }
        const r = await fetch(url + ruta, {
            method: metodo, headers: cabeceras, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
        });
        const texto = await r.text();
        return { codigo: r.status, cuerpo: texto ? JSON.parse(texto) : null };
    }

    // lo que hace el navegador al pulsar el botón de la página de confirmación
    async function enviarFormulario(tokenCorreo, respuesta) {
        const r = await fetch(url + '/responderVinculacion', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: tokenCorreo, respuesta }).toString()
        });
        return { codigo: r.status, html: await r.text() };
    }

    function tokenDelCorreo() {
        return correos[correos.length - 1].texto.match(/token=([^&\s]+)/)[1];
    }

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS,
            async (destinatario, asunto, texto) => {
                if (!asunto.includes('bienvenida')) correos.push({ destinatario, asunto, texto });
            },
            'http://localhost:8080/restablecer.html', 'clave-de-pruebas', 'http://localhost:8080/responderVinculacion');
        conexion = crearServidor(logica).listen(0);
        url = `http://127.0.0.1:${conexion.address().port}`;
    });

    beforeEach(async function () {
        correos = [];
        await vaciarTablas(logica.conexion);
        await logica.conexion.execute('INSERT INTO Sensores (numeroSerie, correoCompra) VALUES (?, ?)',
            [SERIE, 'pkaynak@upv.edu.es']);
        token = (await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026')).token;
    });

    after(async function () {
        conexion.close();
        await logica.cerrar();
    });

    it('sin sesión las tres rutas de la app dan 401', async function () {
        assert.strictEqual((await peticion('POST', '/solicitarVinculacion', { numeroSerie: SERIE, sensibilidad: 1 }, false)).codigo, 401);
        assert.strictEqual((await peticion('GET', '/estadoVinculacion', undefined, false)).codigo, 401);
        assert.strictEqual((await peticion('POST', '/reenviarCorreoVinculacion', undefined, false)).codigo, 401);
    });

    it('POST /solicitarVinculacion: 201 pendiente y correo al comprador; 400, 404 y 409 en los errores', async function () {
        const r = await peticion('POST', '/solicitarVinculacion', { numeroSerie: SERIE, sensibilidad: -41.5 });
        assert.strictEqual(r.codigo, 201);
        assert.strictEqual(r.cuerpo.estado, 'pendiente');
        assert.strictEqual(r.cuerpo.correoComprador, 'p•••••@upv.edu.es');
        assert.strictEqual(correos.length, 1);
        assert.strictEqual(correos[0].destinatario, 'pkaynak@upv.edu.es');

        assert.strictEqual((await peticion('POST', '/solicitarVinculacion', { numeroSerie: 'abc', sensibilidad: 1 })).codigo, 400);
        assert.strictEqual((await peticion('POST', '/solicitarVinculacion', { numeroSerie: '111111111111', sensibilidad: 1 })).codigo, 404);

        const otra = await logica.registrarUsuario('Ana', 'García', 'ana@aeris.es', 'aire2026');
        await logica.conexion.execute('UPDATE Sensores SET idUsuario = ?', [otra.idUsuario]);
        assert.strictEqual((await peticion('POST', '/solicitarVinculacion', { numeroSerie: SERIE, sensibilidad: 1 })).codigo, 409);
    });

    it('GET /estadoVinculacion: 404 sin solicitud y 200 pendiente después', async function () {
        assert.strictEqual((await peticion('GET', '/estadoVinculacion')).codigo, 404);
        await peticion('POST', '/solicitarVinculacion', { numeroSerie: SERIE, sensibilidad: 1 });
        const r = await peticion('GET', '/estadoVinculacion');
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(r.cuerpo.estado, 'pendiente');
        assert.strictEqual(r.cuerpo.numeroSerie, SERIE);
    });

    it('POST /reenviarCorreoVinculacion: 404 sin pendiente y 200 con otro correo', async function () {
        assert.strictEqual((await peticion('POST', '/reenviarCorreoVinculacion')).codigo, 404);
        await peticion('POST', '/solicitarVinculacion', { numeroSerie: SERIE, sensibilidad: 1 });
        const r = await peticion('POST', '/reenviarCorreoVinculacion');
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(correos.length, 2);
    });

    it('GET /responderVinculacion solo enseña la pregunta: no vincula nada', async function () {
        await peticion('POST', '/solicitarVinculacion', { numeroSerie: SERIE, sensibilidad: 1 });
        const enlace = correos[0].texto.match(/http:\/\/localhost:8080(\/responderVinculacion\?\S+respuesta=si)/)[1];
        const r = await fetch(url + enlace);
        const html = await r.text();
        assert.strictEqual(r.status, 200);
        assert.match(html, /¿Vinculamos el sensor\?/);
        assert.match(html, /<form method="post" action="\/responderVinculacion">/);
        assert.strictEqual((await peticion('GET', '/estadoVinculacion')).cuerpo.estado, 'pendiente');

        assert.strictEqual((await fetch(url + '/responderVinculacion?respuesta=si')).status, 400);
    });

    it('POST /responderVinculacion con «si» vincula y la app ve confirmada; el enlace usado ya no vale', async function () {
        await peticion('POST', '/solicitarVinculacion', { numeroSerie: SERIE, sensibilidad: 1 });
        const r = await enviarFormulario(tokenDelCorreo(), 'si');
        assert.strictEqual(r.codigo, 200);
        assert.match(r.html, /Sensor vinculado/);
        assert.match(r.html, /Pelin Kaynak/);
        assert.strictEqual((await peticion('GET', '/estadoVinculacion')).cuerpo.estado, 'confirmada');

        const otraVez = await enviarFormulario(tokenDelCorreo(), 'si');
        assert.strictEqual(otraVez.codigo, 400);
        assert.match(otraVez.html, /Enlace no válido/);
    });

    it('POST /responderVinculacion con «no» rechaza; con token inventado da 400', async function () {
        await peticion('POST', '/solicitarVinculacion', { numeroSerie: SERIE, sensibilidad: 1 });
        const r = await enviarFormulario(tokenDelCorreo(), 'no');
        assert.strictEqual(r.codigo, 200);
        assert.match(r.html, /Vinculación rechazada/);
        assert.strictEqual((await peticion('GET', '/estadoVinculacion')).cuerpo.estado, 'rechazada');
        assert.strictEqual((await enviarFormulario('abc.def', 'si')).codigo, 400);
    });
});
