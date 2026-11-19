// ---------------------------------------------------------------------------
// Fichero:     test_api_mi_sensor.js
// Descripción: Tests de GET y DELETE /miSensor (T011) con la BD de pruebas.
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../../logica/Logica');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('../../logica/test/bdPruebas');
const { crearServidor } = require('../ServidorREST');

describe('API REST de Mi sensor', function () {

    let logica, servidor, url, sesion, idSensor;

    async function pedir(ruta, metodo = 'GET', conToken = true) {
        const headers = conToken ? { Authorization: `Bearer ${sesion.token}` } : {};
        const respuesta = await fetch(url + ruta, { method: metodo, headers });
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
        sesion = await logica.registrarUsuario('Laura', 'Martínez', 'laura@aeris.es', 'aire2026');
        const [sensor] = await logica.conexion.execute(
            'INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario, bateria) VALUES (?, ?, ?, ?, ?)',
            ['092021010920', -44.75, 'laura@aeris.es', sesion.idUsuario, null]);
        idSensor = sensor.insertId;
    });

    after(async function () {
        servidor.close();
        await logica.cerrar();
    });

    it('requiere sesión y devuelve 404 si no hay sensor', async function () {
        assert.strictEqual((await pedir('/miSensor', 'GET', false)).codigo, 401);
        assert.strictEqual((await pedir('/miSensor', 'DELETE', false)).codigo, 401);
        await logica.conexion.execute('UPDATE Sensores SET idUsuario = NULL WHERE idSensor = ?', [idSensor]);
        assert.strictEqual((await pedir('/miSensor')).codigo, 404);
        assert.strictEqual((await pedir('/miSensor', 'DELETE')).codigo, 404);
    });

    it('GET devuelve el sensor sin exigir que tenga batería o sincronización', async function () {
        const sinDatos = await pedir('/miSensor');
        assert.strictEqual(sinDatos.codigo, 200);
        assert.strictEqual(sinDatos.cuerpo.numeroSerie, '092021010920');
        assert.strictEqual(sinDatos.cuerpo.bateria, null);
        assert.strictEqual(sinDatos.cuerpo.ultimaConexion, null);

        await logica.conexion.execute(
            'UPDATE Sensores SET bateria = ?, ultimaConexion = ? WHERE idSensor = ?',
            [61, new Date('2026-11-18T12:00:00Z'), idSensor]);
        const actualizado = await pedir('/miSensor');
        assert.strictEqual(actualizado.cuerpo.bateria, 61);
        assert.ok(!Number.isNaN(Date.parse(actualizado.cuerpo.ultimaConexion)));
    });

    it('DELETE desvincula el sensor del usuario', async function () {
        const respuesta = await pedir('/miSensor', 'DELETE');
        assert.strictEqual(respuesta.codigo, 204);
        const [[sensor]] = await logica.conexion.execute(
            'SELECT idUsuario FROM Sensores WHERE idSensor = ?', [idSensor]);
        assert.strictEqual(sensor.idUsuario, null);
        assert.strictEqual((await pedir('/miSensor')).codigo, 404);
    });
});
