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
        logica = await Logica.crear(CONFIG_BD_PRUEBAS, async () => { },
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

    it('desvincularMiSensor elimina la asociación y deja de ser portador si era el único sensor', async function () {
        await logica.conexion.execute(
            'UPDATE Usuarios SET esPortador = TRUE WHERE idUsuario = ?',
            [usuario.idUsuario]);

        const resultado = await logica.desvincularMiSensor(usuario.idUsuario);
        assert.strictEqual(resultado.numeroSerie, '092021010920');

        const [[sensor]] = await logica.conexion.execute(
            'SELECT idUsuario, idSolicitante, estadoSolicitud, luzActiva FROM Sensores WHERE idSensor = ?',
            [idSensor]
        );
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

    it('sigue siendo portador si conserva otro sensor', async function () {
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

    // ---- El administrador desvincula un sensor desde el panel de Nodos ----

    it('desvincularSensor() quita el sensor a su usuario y conserva sus mediciones', async function () {
        await logica.conexion.execute('UPDATE Usuarios SET esPortador = TRUE WHERE idUsuario = ?', [usuario.idUsuario]);
        const [[o]] = await logica.conexion.query("SELECT idContaminante FROM Contaminantes WHERE nombre = 'O3'");
        const idO3 = o ? o.idContaminante
            : (await logica.conexion.execute("INSERT INTO Contaminantes (nombre, unidad) VALUES ('O3', 'µg/m³')"))[0].insertId;
        await logica.conexion.execute(
            `INSERT INTO Mediciones (idSensor, idUsuario, idContaminante, valorMedicion, ubicacion, fechaHora)
             VALUES (?, ?, ?, 80, POINT(-0.181, 38.967), NOW())`, [idSensor, usuario.idUsuario, idO3]);

        const r = await logica.desvincularSensor('092021010920');
        assert.deepStrictEqual(r, { numeroSerie: '092021010920', idUsuario: usuario.idUsuario });
        const [[sensor]] = await logica.conexion.execute(
            'SELECT idUsuario, idSolicitante, estadoSolicitud FROM Sensores WHERE idSensor = ?', [idSensor]);
        assert.deepStrictEqual({ ...sensor }, { idUsuario: null, idSolicitante: null, estadoSolicitud: null });
        const [[mediciones]] = await logica.conexion.execute(
            'SELECT COUNT(*) AS n FROM Mediciones WHERE idSensor = ?', [idSensor]);
        assert.strictEqual(Number(mediciones.n), 1);
        const [[u]] = await logica.conexion.execute('SELECT esPortador FROM Usuarios WHERE idUsuario = ?', [usuario.idUsuario]);
        assert.strictEqual(Boolean(u.esPortador), false);
        await assert.rejects(logica.obtenerMiSensor(usuario.idUsuario), { codigo: 'SIN_SENSOR' });
    });

    it('desvincularSensor() con un sensor sin dueño o que no existe da SIN_SENSOR', async function () {
        await logica.desvincularSensor('092021010920');
        await assert.rejects(logica.desvincularSensor('092021010920'), { codigo: 'SIN_SENSOR' });
        await assert.rejects(logica.desvincularSensor('000000000000'), { codigo: 'SIN_SENSOR' });
        await assert.rejects(logica.desvincularSensor(undefined), { codigo: 'SIN_SENSOR' });
    });

    it('desvincularSensor() deja al usuario como portador si tiene otro sensor', async function () {
        await anadirSensor('092021010921', usuario.idUsuario);
        await logica.conexion.execute('UPDATE Usuarios SET esPortador = TRUE WHERE idUsuario = ?', [usuario.idUsuario]);
        await logica.desvincularSensor('092021010920');
        const [[u]] = await logica.conexion.execute('SELECT esPortador FROM Usuarios WHERE idUsuario = ?', [usuario.idUsuario]);
        assert.strictEqual(Boolean(u.esPortador), true);
        assert.strictEqual((await logica.obtenerMiSensor(usuario.idUsuario)).numeroSerie, '092021010921');
    });
});
