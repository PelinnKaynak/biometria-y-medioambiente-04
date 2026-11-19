// ---------------------------------------------------------------------------
// Fichero:     test_mi_cuenta.js
// Descripción: Tests de los datos de la página Mi cuenta (Logica.js y
//              MiCuenta.js, T024) contra la BD de pruebas aeris_test. Las
//              fechas se calculan desde un «ahora» fijo.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../Logica');
const MiCuenta = require('../MiCuenta');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('./bdPruebas');

const AHORA = new Date('2026-11-18T12:00:00Z');
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const GANDIA = 'POINT(-0.181 38.967)';      // POINT(longitud latitud)

describe('MiCuenta (cálculos sin BD)', function () {

    it('limitesDeMes() da el día 1 de este mes y del anterior, también en enero', function () {
        const { inicioMes, inicioMesAnterior } = MiCuenta.limitesDeMes(AHORA);
        assert.strictEqual(inicioMes.toISOString(), '2026-11-01T00:00:00.000Z');
        assert.strictEqual(inicioMesAnterior.toISOString(), '2026-10-01T00:00:00.000Z');
        const enero = MiCuenta.limitesDeMes(new Date('2027-01-05T10:00:00Z'));
        assert.strictEqual(enero.inicioMesAnterior.toISOString(), '2026-12-01T00:00:00.000Z');
    });

    it('nivelDePuntos() da el nivel y el siguiente; en el último, el siguiente es él mismo', function () {
        assert.deepStrictEqual(MiCuenta.nivelDePuntos(0),
            { nivel: 'Principiante', siguienteNivel: 'Explorador', puntosSiguienteNivel: 1000 });
        assert.deepStrictEqual(MiCuenta.nivelDePuntos(2350),
            { nivel: 'Explorador', siguienteNivel: 'Guardián', puntosSiguienteNivel: 3000 });
        assert.deepStrictEqual(MiCuenta.nivelDePuntos(3000).nivel, 'Guardián');
        assert.deepStrictEqual(MiCuenta.nivelDePuntos(25000),
            { nivel: 'Experto', siguienteNivel: 'Experto', puntosSiguienteNivel: 10000 });
    });

    it('textoDelSitio() escribe las coordenadas con coma y tres decimales', function () {
        assert.strictEqual(MiCuenta.textoDelSitio(38.96712, -0.18105), '38,967, -0,181');
    });

    it('diasDelPeriodo() solo acepta semana, mes y 3meses', function () {
        assert.strictEqual(MiCuenta.diasDelPeriodo('semana'), 7);
        assert.strictEqual(MiCuenta.diasDelPeriodo('3meses'), 90);
        assert.strictEqual(MiCuenta.diasDelPeriodo('año'), null);
        assert.strictEqual(MiCuenta.diasDelPeriodo('toString'), null);
    });
});

describe('Logica (datos de Mi cuenta)', function () {

    let logica, laura, ana, idSensor, idOzono, idNO2;

    async function medir(usuario, valor, haceMs, contaminante = idOzono, punto = GANDIA) {
        await logica.conexion.execute(
            `INSERT INTO Mediciones (idSensor, idUsuario, idContaminante, valorMedicion, ubicacion, fechaHora)
             VALUES (?, ?, ?, ?, ST_GeomFromText(?), ?)`,
            [idSensor, usuario.idUsuario, contaminante, valor, punto, new Date(AHORA.getTime() - haceMs)]);
    }

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS, async () => {}, 'http://localhost:8080/restablecer.html', 'clave-de-pruebas');
    });

    beforeEach(async function () {
        await vaciarTablas(logica.conexion);
        laura = await logica.registrarUsuario('Laura', 'Martínez', 'laura@aeris.es', 'aire2026');
        ana = await logica.registrarUsuario('Ana', 'García', 'ana@aeris.es', 'aire2026');
        const [s] = await logica.conexion.execute(
            'INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario) VALUES (?, ?, ?, ?)',
            ['092021010920', -44.75, 'laura@aeris.es', laura.idUsuario]);
        idSensor = s.insertId;
        const [o] = await logica.conexion.execute(
            "INSERT INTO Contaminantes (nombre, unidad, umbralModerado, umbralMalo, umbralMuyMalo) VALUES ('Ozono', 'µg/m³', 100, 180, 240)");
        idOzono = o.insertId;
        const [n] = await logica.conexion.execute("INSERT INTO Contaminantes (nombre, unidad) VALUES ('NO2', 'µg/m³')");
        idNO2 = n.insertId;
    });

    after(async function () {
        await logica.cerrar();
    });

    it('el script de la BD da de alta el ozono', async function () {
        await crearBDPruebas();
        const [filas] = await logica.conexion.execute("SELECT unidad, umbralMalo FROM Contaminantes WHERE nombre = 'O3'");
        assert.deepStrictEqual(filas.map((f) => [f.unidad, f.umbralMalo]), [['µg/m³', 180]]);
    });

    it('resumenCuenta() sin sensor vinculado da SIN_SENSOR y sin mediciones SIN_MEDICIONES', async function () {
        await assert.rejects(logica.resumenCuenta(ana.idUsuario, AHORA), { codigo: 'SIN_SENSOR' });
        await assert.rejects(logica.resumenCuenta(laura.idUsuario, AHORA), { codigo: 'SIN_MEDICIONES' });
    });

    it('resumenCuenta() cuenta las mediciones de este mes y del anterior, y los puntos', async function () {
        await medir(laura, 80, 1 * HORA);
        await medir(laura, 90, 5 * DIA);
        await medir(laura, 95, 17 * DIA + HORA);     // 1 de noviembre a las 11:00
        await medir(laura, 70, 20 * DIA);            // octubre
        await medir(laura, 60, 60 * DIA);            // septiembre: solo cuenta en el total

        const r = await logica.resumenCuenta(laura.idUsuario, AHORA);
        assert.strictEqual(r.nodo, '092021010920');
        assert.strictEqual(r.medicionesMes, 3);
        assert.strictEqual(r.medicionesMesAnterior, 1);
        assert.strictEqual(r.puntos, 5);
        assert.strictEqual(r.nivel, 'Principiante');
        assert.strictEqual(r.siguienteNivel, 'Explorador');
        assert.deepStrictEqual(r.lugares, []);
    });

    it('resumenCuenta() calcula la exposición media de 30 días y solo con el ozono', async function () {
        await medir(laura, 80, 1 * DIA);
        await medir(laura, 120, 10 * DIA);
        await medir(laura, 500, 2 * DIA, idNO2);     // no es ozono
        await medir(laura, 400, 40 * DIA);           // fuera de los 30 días

        const r = await logica.resumenCuenta(laura.idUsuario, AHORA);
        assert.strictEqual(r.exposicionMedia, 100);
    });

    it('resumenCuenta() cuenta las horas de la última semana por encima del umbral (180 o el del usuario)', async function () {
        await medir(laura, 200, 1 * HORA);
        await medir(laura, 210, 50 * 60000);              // las 11:10, misma hora: cuenta una vez
        await medir(laura, 190, 3 * DIA);
        await medir(laura, 150, 2 * DIA);                 // por debajo de 180
        await medir(laura, 250, 9 * DIA);                 // hace más de una semana

        let r = await logica.resumenCuenta(laura.idUsuario, AHORA);
        assert.strictEqual(r.horasOzonoAlto, 2);
        assert.strictEqual(r.umbralAviso, 180);

        await logica.conexion.execute('UPDATE Usuarios SET umbralAlerta = 120 WHERE idUsuario = ?', [laura.idUsuario]);
        r = await logica.resumenCuenta(laura.idUsuario, AHORA);
        assert.strictEqual(r.horasOzonoAlto, 3);
        assert.strictEqual(r.umbralAviso, 120);
    });

    it('resumenCuenta() da las 4 últimas mediciones de ozono con las coordenadas como sitio', async function () {
        for (let i = 1; i <= 6; i++) {
            await medir(laura, 60 + i, i * HORA);
        }
        await medir(laura, 999, 30 * 60000, idNO2);

        const r = await logica.resumenCuenta(laura.idUsuario, AHORA);
        assert.deepStrictEqual(r.ultimasMediciones.map((m) => m.ozono), [61, 62, 63, 64]);
        assert.strictEqual(r.ultimasMediciones[0].lugar, '38,967, -0,181');
        assert.strictEqual(r.ultimasMediciones[0].latitud, 38.967);
        assert.strictEqual(r.ultimasMediciones[0].longitud, -0.181);
        assert.strictEqual(new Date(r.ultimasMediciones[0].fecha).getTime(), AHORA.getTime() - HORA);
    });

    it('resumenCuenta() usa la última conexión del sensor o, si no hay, la última medición', async function () {
        await medir(laura, 80, 2 * HORA);
        let r = await logica.resumenCuenta(laura.idUsuario, AHORA);
        assert.strictEqual(new Date(r.ultimaSincronizacion).getTime(), AHORA.getTime() - 2 * HORA);

        const conexion = new Date(AHORA.getTime() - 5 * 60000);
        await logica.conexion.execute('UPDATE Sensores SET ultimaConexion = ? WHERE idSensor = ?', [conexion, idSensor]);
        r = await logica.resumenCuenta(laura.idUsuario, AHORA);
        assert.strictEqual(new Date(r.ultimaSincronizacion).getTime(), conexion.getTime());
    });

    it('resumenCuenta() solo ve las mediciones del usuario', async function () {
        await medir(laura, 80, HORA);
        await medir(ana, 300, 2 * HORA);      // mismo sensor: otra hora (uk_mediciones_unica)
        const r = await logica.resumenCuenta(laura.idUsuario, AHORA);
        assert.strictEqual(r.puntos, 1);
        assert.strictEqual(r.exposicionMedia, 80);
    });

    it('exposicion() da la media de cada día del periodo, sin los días vacíos', async function () {
        await medir(laura, 80, 1 * HORA);
        await medir(laura, 100, 2 * HORA);
        await medir(laura, 150, 3 * DIA);
        await medir(laura, 70, 20 * DIA);
        await medir(laura, 500, 2 * HORA, idNO2);

        const semana = await logica.exposicion(laura.idUsuario, 'semana', AHORA);
        assert.deepStrictEqual(semana.map((p) => [p.fecha.toISOString(), p.ozono]), [
            ['2026-11-15T12:00:00.000Z', 150],
            ['2026-11-18T12:00:00.000Z', 90]
        ]);
        assert.strictEqual((await logica.exposicion(laura.idUsuario, 'mes', AHORA)).length, 3);
    });

    it('exposicion() con un periodo raro da DATOS_NO_VALIDOS y sin sensor SIN_SENSOR', async function () {
        await assert.rejects(logica.exposicion(laura.idUsuario, 'año', AHORA), { codigo: 'DATOS_NO_VALIDOS' });
        await assert.rejects(logica.exposicion(ana.idUsuario, 'mes', AHORA), { codigo: 'SIN_SENSOR' });
    });
});