// ---------------------------------------------------------------------------
// Fichero:     test_lugares.js
// Descripción: Pruebas de la lógica de lugares (T046): aislamiento por
//              propietario, límite, validación, CRUD e interpolación del ozono.
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../Logica');
const { interpolarOzono } = require('../Lugares');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('./bdPruebas');

const AHORA = new Date('2026-11-19T12:00:00Z');

describe('Lugares (T046)', function () {
    let logica, ana, laura, idSensor, idOzono;

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS, async () => {},
            'http://localhost:8080/restablecer.html', 'clave-de-pruebas');
    });

    beforeEach(async function () {
        await vaciarTablas(logica.conexion);
        laura = await logica.registrarUsuario('Laura', 'Martínez', 'laura@aeris.es', 'aire2026');
        ana = await logica.registrarUsuario('Ana', 'García', 'ana@aeris.es', 'aire2026');
        const [ozono] = await logica.conexion.execute(
            "INSERT INTO Contaminantes (nombre, unidad) VALUES ('O3', 'µg/m³')");
        idOzono = ozono.insertId;
    });

    after(async function () {
        await logica.cerrar();
    });

    async function crearSensorYMedicion(latitud, longitud, valor, haceHoras = 1) {
        const [sensor] = await logica.conexion.execute(
            'INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario) VALUES (?, ?, ?, ?)',
            [`serie-${Date.now()}-${Math.random()}`, -44.75, 'laura@aeris.es', laura.idUsuario]);
        idSensor = sensor.insertId;
        await logica.conexion.execute(
            `INSERT INTO Mediciones (idSensor, idUsuario, idContaminante, valorMedicion, ubicacion, fechaHora)
             VALUES (?, ?, ?, ?, ST_GeomFromText(?), ?)`,
            [idSensor, laura.idUsuario, idOzono, valor,
                `POINT(${longitud} ${latitud})`, new Date(AHORA.getTime() - haceHoras * 3600000)]);
    }

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

    it('crea y lista lugares sin requerir un sensor y devuelve ozono nulo si no hay mediciones', async function () {
        const creado = await logica.lugares.crear(laura.idUsuario, lugar(), AHORA);
        assert.strictEqual(creado.nombre, 'Casa');
        assert.strictEqual(creado.tipo, 'casa');
        assert.strictEqual(creado.ozonoActual, null);
        assert.deepStrictEqual((await logica.lugares.listar(laura.idUsuario, AHORA)).map((l) => l.idLugar),
            [creado.idLugar]);
    });

    it('valida campos requeridos y rangos de ubicación, indicando cada campo', async function () {
        await assert.rejects(logica.lugares.crear(laura.idUsuario, lugar({ nombre: ' ' }), AHORA),
            (error) => error.codigo === 'DATOS_NO_VALIDOS' && error.campos.includes('nombre'));
        await assert.rejects(logica.lugares.crear(laura.idUsuario, lugar({ latitud: 91 }), AHORA),
            (error) => error.codigo === 'DATOS_NO_VALIDOS' && error.campos.includes('latitud'));
        await assert.rejects(logica.lugares.crear(laura.idUsuario, lugar({ longitud: -181 }), AHORA),
            (error) => error.codigo === 'DATOS_NO_VALIDOS' && error.campos.includes('longitud'));
        await assert.rejects(logica.lugares.crear(laura.idUsuario, lugar({ direccion: '' }), AHORA),
            (error) => error.codigo === 'DATOS_NO_VALIDOS' && error.campos.includes('direccion'));
    });

    it('limita a cinco lugares por usuario', async function () {
        for (let i = 1; i <= 5; i++) {
            await logica.lugares.crear(laura.idUsuario, lugar({ nombre: `Lugar ${i}` }), AHORA);
        }
        await assert.rejects(logica.lugares.crear(laura.idUsuario, lugar({ nombre: 'Lugar 6' }), AHORA),
            { codigo: 'LIMITE_LUGARES' });
        assert.strictEqual((await logica.lugares.listar(laura.idUsuario, AHORA)).length, 5);
    });

    it('mantiene el límite de cinco ante altas concurrentes', async function () {
        const resultados = await Promise.allSettled(Array.from({ length: 6 }, (_, i) =>
            logica.lugares.crear(laura.idUsuario, lugar({ nombre: `Concurrente ${i}` }), AHORA)));
        assert.strictEqual(resultados.filter((resultado) => resultado.status === 'fulfilled').length, 5);
        assert.deepStrictEqual(resultados.filter((resultado) => resultado.status === 'rejected')
            .map((resultado) => resultado.reason.codigo), ['LIMITE_LUGARES']);
        assert.strictEqual((await logica.lugares.listar(laura.idUsuario, AHORA)).length, 5);
    });

    it('actualiza y elimina solo los lugares del usuario propietario', async function () {
        const creado = await logica.lugares.crear(laura.idUsuario, lugar(), AHORA);
        const actualizado = await logica.lugares.actualizar(laura.idUsuario, creado.idLugar, {
            nombre: 'Trabajo',
            tipo: 'trabajo',
            avisosActivos: false
        }, AHORA);
        assert.strictEqual(actualizado.nombre, 'Trabajo');
        assert.strictEqual(actualizado.tipo, 'trabajo');
        assert.strictEqual(actualizado.avisosActivos, false);
        assert.deepStrictEqual(await logica.lugares.listar(ana.idUsuario, AHORA), []);
        await assert.rejects(logica.lugares.actualizar(ana.idUsuario, creado.idLugar, { nombre: 'Ajeno' }, AHORA),
            { codigo: 'LUGAR_NO_EXISTE' });
        await assert.rejects(logica.lugares.eliminar(ana.idUsuario, creado.idLugar),
            { codigo: 'LUGAR_NO_EXISTE' });
        assert.deepStrictEqual(await logica.lugares.eliminar(laura.idUsuario, creado.idLugar),
            { idLugar: creado.idLugar });
        assert.deepStrictEqual(await logica.lugares.listar(laura.idUsuario, AHORA), []);
    });

    it('interpela el valor dando más peso a la medición cercana y usa coincidencias exactas', function () {
        const mediciones = [
            { latitud: 38.967, longitud: -0.181, ozono: 80 },
            { latitud: 39.067, longitud: -0.181, ozono: 160 }
        ];
        const estimado = interpolarOzono(38.968, -0.181, mediciones);
        assert.ok(estimado > 80 && estimado < 100);
        assert.strictEqual(interpolarOzono(38.967, -0.181, mediciones), 80);
        assert.strictEqual(interpolarOzono(0, 0, []), null);
    });

    it('usa solo las mediciones de ozono de las últimas 24 horas', async function () {
        await crearSensorYMedicion(38.967, -0.181, 90, 2);
        await crearSensorYMedicion(39.1, -0.2, 200, 30);
        const creado = await logica.lugares.crear(laura.idUsuario, lugar(), AHORA);
        assert.strictEqual(creado.ozonoActual, 90);
    });
});
