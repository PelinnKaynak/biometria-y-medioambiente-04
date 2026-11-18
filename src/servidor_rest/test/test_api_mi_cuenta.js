// ---------------------------------------------------------------------------
// Fichero:     test_api_mi_cuenta.js
// Descripción: Tests de las rutas de Mi cuenta (T024) con el servidor en
//              marcha en un puerto libre y la BD aeris_test.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../../logica/Logica');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('../../logica/test/bdPruebas');
const { crearServidor } = require('../ServidorREST');

describe('API REST de Mi cuenta', function () {

    let logica, conexion, url, sesion, idSensor, idOzono;

    async function pedir(ruta, conToken = true) {
        const r = await fetch(url + ruta, { headers: conToken ? { Authorization: `Bearer ${sesion.token}` } : {} });
        return { codigo: r.status, cuerpo: await r.json() };
    }

    async function medir(valor, haceHoras) {
        await logica.conexion.execute(
            `INSERT INTO Mediciones (idSensor, idUsuario, idContaminante, valorMedicion, ubicacion, fechaHora)
             VALUES (?, ?, ?, ?, ST_GeomFromText('POINT(-0.181 38.967)'), ?)`,
            [idSensor, sesion.idUsuario, idOzono, valor, new Date(Date.now() - haceHoras * 3600000)]);
    }

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS, async () => {}, 'http://localhost:8080/restablecer.html', 'clave-de-pruebas');
        conexion = crearServidor(logica).listen(0);
        url = `http://127.0.0.1:${conexion.address().port}`;
    });

    beforeEach(async function () {
        await vaciarTablas(logica.conexion);
        sesion = await logica.registrarUsuario('Laura', 'Martínez', 'laura@aeris.es', 'aire2026');
        const [o] = await logica.conexion.execute("INSERT INTO Contaminantes (nombre, unidad) VALUES ('Ozono', 'µg/m³')");
        idOzono = o.insertId;
    });

    async function vincularSensor() {
        const [s] = await logica.conexion.execute(
            'INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario) VALUES (?, ?, ?, ?)',
            ['092021010920', -44.75, 'laura@aeris.es', sesion.idUsuario]);
        idSensor = s.insertId;
    }

    after(async function () {
        conexion.close();
        await logica.cerrar();
    });

    it('sin sesión las dos rutas dan 401', async function () {
        assert.strictEqual((await pedir('/miCuenta', false)).codigo, 401);
        assert.strictEqual((await pedir('/miExposicion?periodo=mes', false)).codigo, 401);
    });

    it('GET /miCuenta: 404 sin sensor, 404 sin mediciones y 200 con el resumen', async function () {
        assert.strictEqual((await pedir('/miCuenta')).codigo, 404);
        await vincularSensor();
        const vacio = await pedir('/miCuenta');
        assert.strictEqual(vacio.codigo, 404);
        assert.strictEqual(vacio.cuerpo.error, 'Todavía no hay mediciones de tu sensor');

        await medir(90, 1);
        await medir(110, 2);
        const r = await pedir('/miCuenta');
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(r.cuerpo.nodo, '092021010920');
        assert.strictEqual(r.cuerpo.exposicionMedia, 100);
        assert.strictEqual(r.cuerpo.puntos, 2);
        assert.strictEqual(r.cuerpo.ultimasMediciones.length, 2);
        assert.strictEqual(r.cuerpo.ultimasMediciones[0].ozono, 90);
        assert.ok(!Number.isNaN(Date.parse(r.cuerpo.ultimasMediciones[0].fecha)));
    });

    it('GET /miExposicion: 200 con los puntos, 400 con un periodo raro y 404 sin sensor', async function () {
        assert.strictEqual((await pedir('/miExposicion?periodo=mes')).codigo, 404);
        await vincularSensor();
        await medir(90, 1);
        const r = await pedir('/miExposicion?periodo=semana');
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(r.cuerpo.length, 1);
        assert.strictEqual(r.cuerpo[0].ozono, 90);

        const mal = await pedir('/miExposicion?periodo=siempre');
        assert.strictEqual(mal.codigo, 400);
        assert.deepStrictEqual(mal.cuerpo.campos, ['periodo']);
        assert.strictEqual((await pedir('/miExposicion')).codigo, 400);
    });
});