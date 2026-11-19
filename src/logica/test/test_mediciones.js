// ---------------------------------------------------------------------------
// Fichero:     test_mediciones.js
// Descripción: Tests de las mediciones (Mediciones.js, T017) contra la BD de
//              pruebas aeris_test.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../Logica');
const { leerFecha } = require('../Mediciones');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('./bdPruebas');

const SERIE_PELIN = '092021011003';
const SERIE_ANA = '092021010920';

describe('Logica (mediciones)', function () {

    let logica, mediciones;
    let pelin, ana;
    let idSensorPelin;
    let avisoOriginal, avisos;

    // n: N --> haceMinutos() --> Texto (fecha ISO de hace n minutos, sin milisegundos)
    function haceMinutos(n) {
        return new Date(Math.floor((Date.now() - n * 60000) / 1000) * 1000).toISOString();
    }

    // cambios: Objeto --> medicion() --> Objeto (una medición válida de Pelin, con cambios)
    function medicion(cambios = {}) {
        return { numeroSerie: SERIE_PELIN, valor: 84.5, latitud: 38.9965, longitud: -0.1663,
            fecha: haceMinutos(1), ...cambios };
    }

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS, async () => { },
            'http://localhost:8080/restablecer.html', 'clave-de-pruebas');
        mediciones = logica.mediciones;
    });

    beforeEach(async function () {
        await vaciarTablas(logica.conexion);
        await logica.conexion.execute(
            "INSERT INTO Contaminantes (nombre, unidad, umbralModerado, umbralMalo, umbralMuyMalo) VALUES ('O3', 'µg/m³', 100, 180, 240)");
        pelin = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        ana = await logica.registrarUsuario('Ana', 'García', 'ana@aeris.es', 'aire2026');
        const [r] = await logica.conexion.execute(
            'INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario) VALUES (?, ?, ?, ?)',
            [SERIE_PELIN, -38.11, 'pkaynak@upv.edu.es', pelin.idUsuario]);
        idSensorPelin = r.insertId;
        await logica.conexion.execute(
            'INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario) VALUES (?, ?, ?, ?)',
            [SERIE_ANA, -44.75, 'pkaynak@upv.edu.es', ana.idUsuario]);
        avisos = [];
        avisoOriginal = console.warn;
        console.warn = (texto) => avisos.push(texto);
    });

    afterEach(function () {
        console.warn = avisoOriginal;
    });

    after(async function () {
        await logica.cerrar();
    });

    // --- guardar -----------------------------------------------------------------

    it('guardar() guarda la medición con su sensor, usuario, valor, posición y fecha', async function () {
        const fecha = haceMinutos(2);
        const { medicion: m, nueva } = await mediciones.guardar(pelin.idUsuario, medicion({ fecha }));
        assert.strictEqual(nueva, true);
        assert.strictEqual(m.contaminante, 'O3');
        assert.strictEqual(m.unidad, 'µg/m³');
        assert.strictEqual(m.valor, 84.5);
        assert.ok(Math.abs(m.latitud - 38.9965) < 1e-9 && Math.abs(m.longitud - -0.1663) < 1e-9);
        assert.strictEqual(m.fecha.toISOString(), fecha);

        const [filas] = await logica.conexion.query('SELECT idSensor, idUsuario FROM Mediciones');
        assert.deepStrictEqual(filas.map((f) => ({ ...f })), [{ idSensor: idSensorPelin, idUsuario: pelin.idUsuario }]);
    });

    it('guardar() dos veces la misma medición la guarda una sola vez (nueva = false)', async function () {
        const datos = medicion();
        const primera = await mediciones.guardar(pelin.idUsuario, datos);
        const segunda = await mediciones.guardar(pelin.idUsuario, { ...datos, fecha: new Date(datos.fecha).getTime() });
        assert.strictEqual(primera.nueva, true);
        assert.strictEqual(segunda.nueva, false);
        assert.strictEqual(segunda.medicion.idMedicion, primera.medicion.idMedicion);
        const [filas] = await logica.conexion.query('SELECT COUNT(*) AS n FROM Mediciones');
        assert.strictEqual(Number(filas[0].n), 1);
    });

    it('guardar() pone el sensor activo con su última conexión (la más reciente)', async function () {
        await mediciones.guardar(pelin.idUsuario, medicion({ fecha: haceMinutos(1) }));
        await mediciones.guardar(pelin.idUsuario, medicion({ fecha: haceMinutos(30) }));   // llega tarde (sin conexión)
        const [[s]] = await logica.conexion.execute('SELECT estado, ultimaConexion FROM Sensores WHERE idSensor = ?', [idSensorPelin]);
        assert.strictEqual(s.estado, 'activo');
        assert.strictEqual(s.ultimaConexion.toISOString(), haceMinutos(1));
    });

    it('guardar() rechaza datos que faltan o fuera de rango, dice qué campos y lo registra', async function () {
        await assert.rejects(mediciones.guardar(pelin.idUsuario, {}), (e) => e.codigo === 'DATOS_NO_VALIDOS'
            && ['numeroSerie', 'valor', 'latitud', 'longitud', 'fecha'].every((c) => e.campos.includes(c)));
        const malos = [
            [{ numeroSerie: '0920210110' }, 'numeroSerie'],
            [{ valor: -1 }, 'valor'],
            [{ valor: 2001 }, 'valor'],
            [{ valor: '84' }, 'valor'],
            [{ latitud: 91 }, 'latitud'],
            [{ longitud: -181 }, 'longitud'],
            [{ fecha: 'ayer' }, 'fecha'],
            [{ fecha: haceMinutos(-10) }, 'fecha'],                // 10 min en el futuro
            [{ fecha: haceMinutos(8 * 24 * 60) }, 'fecha'],        // hace 8 días
            [{ contaminante: 'XX' }, 'contaminante']
        ];
        for (const [cambio, campo] of malos) {
            await assert.rejects(mediciones.guardar(pelin.idUsuario, medicion(cambio)),
                (e) => e.codigo === 'DATOS_NO_VALIDOS' && e.campos.length === 1 && e.campos[0] === campo,
                JSON.stringify(cambio));
        }
        assert.strictEqual(avisos.length, malos.length + 1);
        assert.ok(avisos[0].includes(`usuario ${pelin.idUsuario}`));
        const [filas] = await logica.conexion.query('SELECT COUNT(*) AS n FROM Mediciones');
        assert.strictEqual(Number(filas[0].n), 0);
    });

    it('guardar() solo acepta el sensor vinculado al usuario', async function () {
        await assert.rejects(mediciones.guardar(pelin.idUsuario, medicion({ numeroSerie: SERIE_ANA })),
            (e) => e.codigo === 'SENSOR_NO_ES_TUYO');
        await assert.rejects(mediciones.guardar(pelin.idUsuario, medicion({ numeroSerie: '111111111111' })),
            (e) => e.codigo === 'SENSOR_NO_REGISTRADO');
        await logica.conexion.execute('UPDATE Sensores SET idUsuario = NULL WHERE idSensor = ?', [idSensorPelin]);
        await assert.rejects(mediciones.guardar(pelin.idUsuario, medicion()), (e) => e.codigo === 'SENSOR_NO_ES_TUYO');
    });

    // --- consultar ------------------------------------------------------------------

    it('ultimasDeUsuario() da las del usuario, la más nueva primero y como mucho «cantidad»', async function () {
        for (let i = 1; i <= 7; i++) {
            await mediciones.guardar(pelin.idUsuario, medicion({ valor: 80 + i, fecha: haceMinutos(i * 20) }));
        }
        await mediciones.guardar(ana.idUsuario, medicion({ numeroSerie: SERIE_ANA, valor: 150, fecha: haceMinutos(0) }));

        const cinco = await mediciones.ultimasDeUsuario(pelin.idUsuario);
        assert.deepStrictEqual(cinco.map((m) => m.valor), [81, 82, 83, 84, 85]);
        assert.deepStrictEqual((await mediciones.ultimasDeUsuario(pelin.idUsuario, 2)).map((m) => m.valor), [81, 82]);
        assert.strictEqual((await mediciones.ultimasDeUsuario(pelin.idUsuario, 500)).length, 7);
        assert.deepStrictEqual(await mediciones.ultimasDeUsuario(9999), []);
        await assert.rejects(mediciones.ultimasDeUsuario(pelin.idUsuario, 0), (e) => e.codigo === 'DATOS_NO_VALIDOS');
        await assert.rejects(mediciones.ultimasDeUsuario(pelin.idUsuario, 2.5), (e) => e.codigo === 'DATOS_NO_VALIDOS');
    });

    it('deUsuarioEnPeriodo() filtra por usuario y límites, y ordena cronológicamente', async function () {
        const desde = new Date(Date.now() - 60 * 60000);
        const hasta = new Date(Date.now() + 10 * 60000);
        await mediciones.guardar(pelin.idUsuario, medicion({ valor: 90, fecha: haceMinutos(1) }));
        await mediciones.guardar(pelin.idUsuario, medicion({ valor: 80, fecha: haceMinutos(2) }));
        await mediciones.guardar(pelin.idUsuario, medicion({ valor: 70, fecha: haceMinutos(61) }));
        await mediciones.guardar(ana.idUsuario, medicion({
            numeroSerie: SERIE_ANA, valor: 150, fecha: haceMinutos(1)
        }));

        const propias = await mediciones.deUsuarioEnPeriodo(pelin.idUsuario, desde, hasta);
        assert.deepStrictEqual(propias.map((m) => m.valor), [80, 90]);
        assert.ok(Math.abs(propias[0].latitud - 38.9965) < 1e-9);
        const ajenas = await mediciones.deUsuarioEnPeriodo(ana.idUsuario, desde, hasta);
        assert.deepStrictEqual(ajenas.map((m) => m.valor), [150]);
        await assert.rejects(mediciones.deUsuarioEnPeriodo(pelin.idUsuario, desde, new Date(NaN)),
            (e) => e.codigo === 'DATOS_NO_VALIDOS' && e.campos.includes('hasta'));
        await assert.rejects(mediciones.deUsuarioEnPeriodo(pelin.idUsuario, desde,
            new Date(desde.getTime() + 27 * 60 * 60000)), (e) => e.codigo === 'DATOS_NO_VALIDOS');
    });

    it('ultima() da la más nueva de todos los sensores; sin mediciones, SIN_MEDICIONES', async function () {
        await assert.rejects(mediciones.ultima(), (e) => e.codigo === 'SIN_MEDICIONES');
        await mediciones.guardar(pelin.idUsuario, medicion({ valor: 90, fecha: haceMinutos(10) }));
        await mediciones.guardar(ana.idUsuario, medicion({ numeroSerie: SERIE_ANA, valor: 120, fecha: haceMinutos(3) }));
        const u = await mediciones.ultima();
        assert.strictEqual(u.valor, 120);
        assert.strictEqual(u.idUsuario, undefined);     // no dice quién la tomó
    });

    it('obtenerUsuario() incluye el sensor vinculado (nombre y número de serie) o null', async function () {
        const conSensor = await logica.obtenerUsuario(pelin.idUsuario);
        assert.strictEqual(conSensor.sensor, 'Sensor AERIS');
        assert.strictEqual(conSensor.numeroSerie, SERIE_PELIN);
        const otro = await logica.registrarUsuario('Leo', 'Pons', 'leo@aeris.es', 'aire2026');
        const sinSensor = await logica.obtenerUsuario(otro.idUsuario);
        assert.strictEqual(sinSensor.sensor, null);
        assert.strictEqual(sinSensor.numeroSerie, null);
    });

    it('leerFecha() acepta ISO y milisegundos, quita los milisegundos y rechaza lo demás', function () {
        assert.strictEqual(leerFecha('2026-11-18T19:42:05.789Z').toISOString(), '2026-11-18T19:42:05.000Z');
        assert.strictEqual(leerFecha(Date.UTC(2026, 10, 18, 19, 42, 5)).toISOString(), '2026-11-18T19:42:05.000Z');
        assert.strictEqual(leerFecha('hola'), null);
        assert.strictEqual(leerFecha(''), null);
        assert.strictEqual(leerFecha(undefined), null);
        assert.strictEqual(leerFecha(true), null);
    });
});
