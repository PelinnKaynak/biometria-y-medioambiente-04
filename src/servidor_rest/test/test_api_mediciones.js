// ---------------------------------------------------------------------------
// Fichero:     test_api_mediciones.js
// Descripción: Tests de las rutas de mediciones (T017) con el servidor en
//              marcha en un puerto libre y la BD aeris_test.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../../logica/Logica');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('../../logica/test/bdPruebas');
const { crearServidor } = require('../ServidorREST');

describe('API REST de mediciones', function () {

    let logica, conexion, url, avisoOriginal;
    let pelin, ana, idAna;     // tokens y usuario

    async function peticion(metodo, ruta, token, cuerpo) {
        const cabeceras = { 'Content-Type': 'application/json' };
        if (token) {
            cabeceras.Authorization = `Bearer ${token}`;
        }
        const r = await fetch(url + ruta, {
            method: metodo, headers: cabeceras, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
        });
        const texto = await r.text();
        return { codigo: r.status, cuerpo: texto ? JSON.parse(texto) : null };
    }

    // n: N --> haceMinutos() --> Texto
    function haceMinutos(n) {
        return new Date(Math.floor((Date.now() - n * 60000) / 1000) * 1000).toISOString();
    }

    function medicion(cambios = {}) {
        return { numeroSerie: '092021011003', valor: 84, latitud: 38.9965, longitud: -0.1663,
            fecha: haceMinutos(1), ...cambios };
    }

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS, async () => { },
            'http://localhost:8080/restablecer.html', 'clave-de-pruebas');
        conexion = crearServidor(logica).listen(0);
        url = `http://127.0.0.1:${conexion.address().port}`;
    });

    beforeEach(async function () {
        await vaciarTablas(logica.conexion);
        await logica.conexion.execute(
            "INSERT INTO Contaminantes (nombre, unidad, umbralModerado, umbralMalo, umbralMuyMalo) VALUES ('O3', 'µg/m³', 100, 180, 240)");
        const sesionPelin = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        const sesionAna = await logica.registrarUsuario('Ana', 'García', 'ana@aeris.es', 'aire2026');
        pelin = sesionPelin.token;
        ana = sesionAna.token;
        idAna = sesionAna.idUsuario;
        await logica.conexion.execute(
            'INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario) VALUES (?, ?, ?, ?)',
            ['092021011003', -38.11, 'pkaynak@upv.edu.es', sesionPelin.idUsuario]);
        avisoOriginal = console.warn;
        console.warn = () => { };
    });

    afterEach(function () {
        console.warn = avisoOriginal;
    });

    after(async function () {
        conexion.close();
        await logica.cerrar();
    });

    it('sin sesión, guardar y ver las mías dan 401; la última medición es pública', async function () {
        assert.strictEqual((await peticion('POST', '/guardarMedicion', null, medicion())).codigo, 401);
        assert.strictEqual((await peticion('GET', '/ultimasMediciones')).codigo, 401);
        assert.strictEqual((await peticion('GET', '/misDatos')).codigo, 401);
        assert.strictEqual((await peticion('GET', '/ultimaMedicion')).codigo, 404);     // aún no hay
    });

    it('POST /guardarMedicion: 201 la primera vez y 200 (nueva: false) si se reenvía', async function () {
        const datos = medicion();
        const r = await peticion('POST', '/guardarMedicion', pelin, datos);
        assert.strictEqual(r.codigo, 201);
        assert.strictEqual(r.cuerpo.nueva, true);
        assert.strictEqual(r.cuerpo.medicion.valor, 84);
        assert.strictEqual(r.cuerpo.medicion.fecha, datos.fecha);

        const otraVez = await peticion('POST', '/guardarMedicion', pelin, datos);
        assert.strictEqual(otraVez.codigo, 200);
        assert.strictEqual(otraVez.cuerpo.nueva, false);
        assert.strictEqual(otraVez.cuerpo.medicion.idMedicion, r.cuerpo.medicion.idMedicion);
    });

    it('POST /guardarMedicion: 400 con los campos que fallan, 403 sensor de otro y 404 no registrado', async function () {
        const mal = await peticion('POST', '/guardarMedicion', pelin, medicion({ valor: 5000, latitud: null }));
        assert.strictEqual(mal.codigo, 400);
        assert.deepStrictEqual(mal.cuerpo.campos.sort(), ['latitud', 'valor']);
        assert.strictEqual((await peticion('POST', '/guardarMedicion', ana, medicion())).codigo, 403);
        assert.strictEqual((await peticion('POST', '/guardarMedicion', pelin, medicion({ numeroSerie: '111111111111' }))).codigo, 404);
    });

    it('GET /ultimasMediciones: las del usuario en el formato de la app; 400 con cantidad no válida', async function () {
        for (let i = 1; i <= 6; i++) {
            await peticion('POST', '/guardarMedicion', pelin, medicion({ valor: 80 + i, fecha: haceMinutos(i * 20) }));
        }
        const r = await peticion('GET', '/ultimasMediciones', pelin);
        assert.strictEqual(r.codigo, 200);
        assert.deepStrictEqual(r.cuerpo.map((m) => m.valor), [81, 82, 83, 84, 85]);
        assert.ok(!Number.isNaN(Date.parse(r.cuerpo[0].fecha)));          // lo que lee Medicion.java
        assert.strictEqual((await peticion('GET', '/ultimasMediciones?cantidad=2', pelin)).cuerpo.length, 2);
        assert.deepStrictEqual((await peticion('GET', '/ultimasMediciones', ana)).cuerpo, []);
        assert.strictEqual((await peticion('GET', '/ultimasMediciones?cantidad=abc', pelin)).codigo, 400);
        assert.strictEqual((await peticion('GET', '/ultimasMediciones?cantidad=0', pelin)).codigo, 400);
    });

    it('GET /misDatos: devuelve todas las mediciones del periodo solo del usuario autenticado', async function () {
        await logica.conexion.execute(
            'INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario) VALUES (?, ?, ?, ?)',
            ['092021010920', -44.75, 'ana@aeris.es', idAna]);
        await peticion('POST', '/guardarMedicion', pelin, medicion({ valor: 90, fecha: haceMinutos(1) }));
        await peticion('POST', '/guardarMedicion', pelin, medicion({ valor: 80, fecha: haceMinutos(2) }));
        await peticion('POST', '/guardarMedicion', ana,
            medicion({ numeroSerie: '092021010920', valor: 150, fecha: haceMinutos(1) }));

        const desde = Date.now() - 60 * 60000;
        const hasta = Date.now() + 5 * 60000;
        const ruta = `/misDatos?desde=${desde}&hasta=${hasta}`;
        const datosPelin = await peticion('GET', ruta, pelin);
        const datosAna = await peticion('GET', ruta, ana);
        assert.strictEqual(datosPelin.codigo, 200);
        assert.deepStrictEqual(datosPelin.cuerpo.map((m) => m.valor), [80, 90]);
        assert.strictEqual(datosPelin.cuerpo[0].latitud, 38.9965);
        assert.deepStrictEqual(datosAna.cuerpo.map((m) => m.valor), [150]);

        const invalido = await peticion('GET', '/misDatos?desde=no&hasta=1', pelin);
        assert.strictEqual(invalido.codigo, 400);
        assert.deepStrictEqual(invalido.cuerpo.campos, ['desde', 'hasta']);
    });

    it('GET /misDatos: 404 cuando el usuario no tiene sensor vinculado', async function () {
        const desde = Date.now() - 60 * 60000;
        const hasta = Date.now() + 5 * 60000;
        assert.strictEqual((await peticion('GET', `/misDatos?desde=${desde}&hasta=${hasta}`, ana)).codigo, 404);
    });

    it('GET /ultimaMedicion: la más nueva, con valor, unidad, fecha y ubicación', async function () {
        await peticion('POST', '/guardarMedicion', pelin, medicion({ valor: 97, fecha: haceMinutos(5) }));
        const r = await peticion('GET', '/ultimaMedicion');
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(r.cuerpo.valor, 97);
        assert.strictEqual(r.cuerpo.unidad, 'µg/m³');
        assert.ok(Math.abs(r.cuerpo.latitud - 38.9965) < 1e-9);
    });

    it('GET /usuarioActual: incluye el sensor y su número de serie (la app filtra las tramas con él)', async function () {
        const r = await peticion('GET', '/usuarioActual', pelin);
        assert.strictEqual(r.cuerpo.sensor, 'Sensor AERIS');
        assert.strictEqual(r.cuerpo.numeroSerie, '092021011003');
        assert.strictEqual((await peticion('GET', '/usuarioActual', ana)).cuerpo.numeroSerie, null);
    });
});
