// ---------------------------------------------------------------------------
// Fichero:     test_api_lugares.js
// Descripción: Pruebas de la API de lugares (T046): autenticación,
//              validación, límite, CRUD y aislamiento entre usuarios.
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../../logica/Logica');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('../../logica/test/bdPruebas');
const { crearServidor } = require('../ServidorREST');

describe('API REST de Lugares (T046)', function () {
    let logica, servidor, url, laura, ana;

    async function pedir(metodo, ruta, token = laura.token, cuerpo) {
        const opciones = { method: metodo, headers: {} };
        if (token) opciones.headers.Authorization = `Bearer ${token}`;
        if (cuerpo !== undefined) {
            opciones.headers['Content-Type'] = 'application/json';
            opciones.body = JSON.stringify(cuerpo);
        }
        const respuesta = await fetch(url + ruta, opciones);
        const texto = await respuesta.text();
        return { codigo: respuesta.status, cuerpo: texto ? JSON.parse(texto) : null };
    }

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS, async () => {},
            'http://localhost:8080/restablecer.html', 'clave-de-pruebas');
        servidor = crearServidor(logica).listen(0);
        url = `http://127.0.0.1:${servidor.address().port}`;
    });

    beforeEach(async function () {
        await vaciarTablas(logica.conexion);
        laura = await logica.registrarUsuario('Laura', 'Martínez', 'laura@aeris.es', 'aire2026');
        ana = await logica.registrarUsuario('Ana', 'García', 'ana@aeris.es', 'aire2026');
    });

    after(async function () {
        servidor.close();
        await logica.cerrar();
    });

    function lugar(datos = {}) {
        return {
            nombre: 'Casa',
            tipo: 'casa',
            direccion: 'Gandia',
            latitud: 38.967,
            longitud: -0.181,
            ...datos
        };
    }

    it('requiere sesión y lista vacío sin necesitar sensor', async function () {
        assert.strictEqual((await pedir('GET', '/lugares', null)).codigo, 401);
        assert.strictEqual((await pedir('GET', '/lugares')).codigo, 200);
        assert.deepStrictEqual((await pedir('GET', '/lugares')).cuerpo, []);
    });

    it('crea lugares, valida nombre y coordenadas e impone el máximo de cinco', async function () {
        const creado = await pedir('POST', '/lugares', laura.token, lugar());
        assert.strictEqual(creado.codigo, 201);
        assert.strictEqual(creado.cuerpo.nombre, 'Casa');
        assert.strictEqual(creado.cuerpo.ozonoActual, null);

        const invalido = await pedir('POST', '/lugares', laura.token,
            lugar({ nombre: ' ', latitud: 91, longitud: null }));
        assert.strictEqual(invalido.codigo, 400);
        assert.deepStrictEqual(invalido.cuerpo.campos.sort(), ['latitud', 'longitud', 'nombre']);

        for (let i = 2; i <= 5; i++) {
            assert.strictEqual((await pedir('POST', '/lugares', laura.token,
                lugar({ nombre: `Lugar ${i}` }))).codigo, 201);
        }
        const exceso = await pedir('POST', '/lugares', laura.token, lugar({ nombre: 'Lugar 6' }));
        assert.strictEqual(exceso.codigo, 409);
        assert.strictEqual((await pedir('GET', '/lugares')).cuerpo.length, 5);
    });

    it('actualiza y borra por propietario, sin permitir acceder a lugares ajenos', async function () {
        const creado = await pedir('POST', '/lugares', laura.token, lugar());
        const id = creado.cuerpo.idLugar;

        assert.strictEqual((await pedir('PATCH', `/lugares/${id}`, laura.token,
            { avisosActivos: false })).codigo, 200);
        const cambiado = await pedir('PUT', `/lugares/${id}`, laura.token,
            lugar({ nombre: 'Trabajo', tipo: 'trabajo', avisosActivos: false }));
        assert.strictEqual(cambiado.codigo, 200);
        assert.strictEqual(cambiado.cuerpo.nombre, 'Trabajo');
        assert.strictEqual(cambiado.cuerpo.avisosActivos, false);

        assert.strictEqual((await pedir('GET', '/lugares', ana.token)).cuerpo.length, 0);
        assert.strictEqual((await pedir('PATCH', `/lugares/${id}`, ana.token,
            { avisosActivos: true })).codigo, 404);
        assert.strictEqual((await pedir('DELETE', `/lugares/${id}`, ana.token)).codigo, 404);
        assert.strictEqual((await pedir('DELETE', `/lugares/${id}`, laura.token)).codigo, 204);
        assert.deepStrictEqual((await pedir('GET', '/lugares')).cuerpo, []);
    });
});
