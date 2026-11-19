// ---------------------------------------------------------------------------
// Fichero:     test_mi_sensor.js
// Descripción: Tests de los datos y la desvinculación del sensor de un
//              usuario (T011) contra la BD de pruebas.
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../Logica');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('./bdPruebas');

describe('Logica (Mi sensor)', function () {

    let logica, usuario, idSensor;

    async function anadirSensor(numeroSerie, idUsuario) {
        const [resultado] = await logica.conexion.execute(
            'INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario) VALUES (?, ?, ?, ?)',
            [numeroSerie, -44.75, 'laura@aeris.es', idUsuario]);
        return resultado.insertId;
    }

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS, async () => {},
            'http://localhost:8080/restablecer.html', 'clave-de-pruebas');
    });

    beforeEach(async function () {
        await vaciarTablas(logica.conexion);
        usuario = await logica.registrarUsuario('Laura', 'Martínez', 'laura@aeris.es', 'aire2026');
        idSensor = await anadirSensor('092021010920', usuario.idUsuario);
    });

    after(async function () {
        await logica.cerrar();
    });

    it('obtenerMiSensor devuelve serie, batería nullable y última conexión', async function () {
        const sinBateria = await logica.obtenerMiSensor(usuario.idUsuario);
        assert.strictEqual(sinBateria.numeroSerie, '092021010920');
        assert.strictEqual(sinBateria.bateria, null);
        assert.strictEqual(sinBateria.ultimaConexion, null);

        const ultimaConexion = new Date('2026-11-18T12:00:00Z');
        await logica.conexion.execute(
            'UPDATE Sensores SET bateria = ?, ultimaConexion = ? WHERE idSensor = ?',
            [73, ultimaConexion, idSensor]);
        const actualizado = await logica.obtenerMiSensor(usuario.idUsuario);
        assert.strictEqual(actualizado.bateria, 73);
        assert.strictEqual(actualizado.ultimaConexion.toISOString(), ultimaConexion.toISOString());
    });

    it('desvincularMiSensor elimina la asociación y revierte el rol si era el único sensor', async function () {
        await logica.conexion.execute(
            'UPDATE Usuarios SET esPortador = TRUE WHERE idUsuario = ?',
            [usuario.idUsuario]);

        const resultado = await logica.desvincularMiSensor(usuario.idUsuario);
        assert.strictEqual(resultado.numeroSerie, '092021010920');
        const [[sensor]] = await logica.conexion.execute(
            'SELECT idUsuario, idSolicitante, estadoSolicitud, luzActiva FROM Sensores WHERE idSensor = ?',
            [idSensor]);
        assert.strictEqual(sensor.idUsuario, null);
        assert.strictEqual(sensor.idSolicitante, null);
        assert.strictEqual(sensor.estadoSolicitud, null);
        assert.strictEqual(Boolean(sensor.luzActiva), false);
        const [[actualizado]] = await logica.conexion.execute(
            'SELECT esPortador FROM Usuarios WHERE idUsuario = ?', [usuario.idUsuario]);
        assert.strictEqual(Boolean(actualizado.esPortador), false);
        assert.strictEqual((await logica.comprobarSesion(usuario.token)).rol, 'ciudadano');
        await assert.rejects(logica.obtenerMiSensor(usuario.idUsuario), { codigo: 'SIN_SENSOR' });
        await assert.rejects(logica.desvincularMiSensor(usuario.idUsuario), { codigo: 'SIN_SENSOR' });
    });

    it('mantiene el rol portador si el usuario conserva otro sensor', async function () {
        await anadirSensor('092021010921', usuario.idUsuario);
        await logica.conexion.execute(
            'UPDATE Usuarios SET esPortador = TRUE WHERE idUsuario = ?',
            [usuario.idUsuario]);

        await logica.desvincularMiSensor(usuario.idUsuario);
        const [[actualizado]] = await logica.conexion.execute(
            'SELECT esPortador FROM Usuarios WHERE idUsuario = ?', [usuario.idUsuario]);
        assert.strictEqual(Boolean(actualizado.esPortador), true);
        assert.strictEqual((await logica.comprobarSesion(usuario.token)).rol, 'portador');
    });
});
