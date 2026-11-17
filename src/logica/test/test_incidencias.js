// ---------------------------------------------------------------------------
// Fichero:     test_incidencias.js
// Descripción: Tests de las incidencias (Incidencias.js, T041) contra la BD
//              de pruebas aeris_test. Los correos no se envían: se apuntan.
// Autores:     Equipo 04 – SenseTech
// Fecha:       17/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../Logica');
const { crearCorreoRespuestaIncidencia } = require('../CorreoRespuestaIncidencia');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('./bdPruebas');

describe('Logica (incidencias)', function () {

    let logica, incidencias;
    let correos;
    let pelin, ana;       // sesiones de dos usuarios
    let idSensorPelin;

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS,
            async (destinatario, asunto, texto, extra) => {
                if (!asunto.includes('bienvenida')) correos.push({ destinatario, asunto, texto, extra });
            },
            'http://localhost:8080/restablecer.html', 'clave-de-pruebas');
        incidencias = logica.incidencias;
    });

    beforeEach(async function () {
        await vaciarTablas(logica.conexion);
        pelin = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        ana = await logica.registrarUsuario('Ana', 'García', 'ana@aeris.es', 'aire2026');
        const [r] = await logica.conexion.execute(
            'INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario) VALUES (?, ?, ?, ?)',
            ['092021010920', -44.75, 'pkaynak@upv.edu.es', pelin.idUsuario]);
        idSensorPelin = r.insertId;
        correos = [];
    });

    after(async function () {
        await logica.cerrar();
    });

    // --- crear -----------------------------------------------------------------

    it('crear() guarda la incidencia «abierta», sin respuesta y con la fecha', async function () {
        const antes = Date.now() - 2000;
        const i = await incidencias.crear(pelin.idUsuario, 'cuenta', '  No puedo cambiar la foto  ');
        assert.ok(Number.isInteger(i.idIncidencia));
        assert.strictEqual(i.tipo, 'cuenta');
        assert.strictEqual(i.descripcion, 'No puedo cambiar la foto');
        assert.strictEqual(i.estado, 'abierta');
        assert.strictEqual(i.respuesta, null);
        assert.strictEqual(i.fechaRespuesta, null);
        assert.strictEqual(i.sensor, null);
        assert.ok(i.fechaCreacion.getTime() >= antes && i.fechaCreacion.getTime() <= Date.now() + 2000);
    });

    it('crear() de tipo sensor o datos sin idSensor pone el sensor del usuario', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'sensor', 'La luz no se enciende');
        assert.deepStrictEqual(i.sensor, { idSensor: idSensorPelin, numeroSerie: '092021010920' });
        const d = await incidencias.crear(pelin.idUsuario, 'datos', 'Valores raros por la noche');
        assert.strictEqual(d.sensor.idSensor, idSensorPelin);
    });

    it('crear() de tipo sensor sin tener sensor la guarda sin sensor', async function () {
        const i = await incidencias.crear(ana.idUsuario, 'sensor', 'No me llega el sensor');
        assert.strictEqual(i.sensor, null);
    });

    it('crear() con el idSensor de otro usuario da DATOS_NO_VALIDOS', async function () {
        await assert.rejects(incidencias.crear(ana.idUsuario, 'sensor', 'Hola', idSensorPelin),
            (e) => e.codigo === 'DATOS_NO_VALIDOS' && e.campos.includes('idSensor'));
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Hola', idSensorPelin);
        assert.strictEqual(i.sensor.idSensor, idSensorPelin);
    });

    it('crear() rechaza tipo, descripción o idSensor no válidos y dice qué campos', async function () {
        await assert.rejects(incidencias.crear(pelin.idUsuario, 'queja', '   ', 'uno'),
            (e) => e.codigo === 'DATOS_NO_VALIDOS'
                && ['tipo', 'descripcion', 'idSensor'].every((c) => e.campos.includes(c)));
        await assert.rejects(incidencias.crear(pelin.idUsuario, 'otra', 'x'.repeat(2001)),
            (e) => e.codigo === 'DATOS_NO_VALIDOS' && e.campos.includes('descripcion'));
        const [filas] = await logica.conexion.query('SELECT COUNT(*) AS n FROM Incidencias');
        assert.strictEqual(Number(filas[0].n), 0);
    });

    // --- listar ----------------------------------------------------------------

    it('listarDeUsuario() solo da las suyas, la más nueva primero', async function () {
        const a = await incidencias.crear(pelin.idUsuario, 'cuenta', 'Primera');
        await incidencias.crear(ana.idUsuario, 'otra', 'De Ana');
        const b = await incidencias.crear(pelin.idUsuario, 'otra', 'Segunda');
        const lista = await incidencias.listarDeUsuario(pelin.idUsuario);
        assert.deepStrictEqual(lista.map((i) => i.idIncidencia), [b.idIncidencia, a.idIncidencia]);
        assert.deepStrictEqual(await incidencias.listarDeUsuario(9999), []);
    });

    it('listar() da todas con los datos del usuario y del sensor, y filtra por estado y tipo', async function () {
        const s = await incidencias.crear(pelin.idUsuario, 'sensor', 'No conecta');
        const c = await incidencias.crear(ana.idUsuario, 'cuenta', 'Olvidé el correo');
        await incidencias.responder(c.idIncidencia, { estado: 'en curso' });

        const todas = await incidencias.listar();
        assert.strictEqual(todas.length, 2);
        const deSensor = todas.find((i) => i.idIncidencia === s.idIncidencia);
        assert.deepStrictEqual(deSensor.usuario,
            { idUsuario: pelin.idUsuario, nombre: 'Pelin', apellidos: 'Kaynak', correo: 'pelin@aeris.es' });
        assert.strictEqual(deSensor.sensor.numeroSerie, '092021010920');
        assert.strictEqual(deSensor.sensor.estado, 'inactivo');
        assert.strictEqual(deSensor.sensor.necesitaCalibracion, false);

        assert.deepStrictEqual((await incidencias.listar({ estado: 'abierta' })).map((i) => i.idIncidencia), [s.idIncidencia]);
        assert.deepStrictEqual((await incidencias.listar({ tipo: 'cuenta' })).map((i) => i.idIncidencia), [c.idIncidencia]);
        assert.deepStrictEqual(await incidencias.listar({ estado: 'en curso', tipo: 'sensor' }), []);
        await assert.rejects(incidencias.listar({ estado: 'cerrada' }), (e) => e.codigo === 'DATOS_NO_VALIDOS');
    });

    it('contarAbiertas() cuenta solo las abiertas', async function () {
        assert.strictEqual(await incidencias.contarAbiertas(), 0);
        await incidencias.crear(pelin.idUsuario, 'otra', 'Una');
        const b = await incidencias.crear(ana.idUsuario, 'otra', 'Otra');
        assert.strictEqual(await incidencias.contarAbiertas(), 2);
        await incidencias.responder(b.idIncidencia, { respuesta: 'Hecho' });
        assert.strictEqual(await incidencias.contarAbiertas(), 1);
    });

    it('obtener() de una que no existe da INCIDENCIA_NO_EXISTE', async function () {
        await assert.rejects(incidencias.obtener(12345), (e) => e.codigo === 'INCIDENCIA_NO_EXISTE');
        await assert.rejects(incidencias.obtener(NaN), (e) => e.codigo === 'INCIDENCIA_NO_EXISTE');
    });

    // --- responder ---------------------------------------------------------------

    it('responder() con respuesta la guarda, la pone «resuelta» y manda el correo al usuario', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'sensor', 'La batería dura poco');
        const r = await incidencias.responder(i.idIncidencia, { respuesta: '  Hay que recalibrarlo  ' });
        assert.strictEqual(r.respuesta, 'Hay que recalibrarlo');
        assert.strictEqual(r.estado, 'resuelta');
        assert.ok(r.fechaRespuesta instanceof Date);

        assert.strictEqual(correos.length, 1);
        assert.strictEqual(correos[0].destinatario, 'pelin@aeris.es');
        assert.ok(correos[0].asunto.includes(`nº ${i.idIncidencia}`));
        assert.ok(correos[0].texto.includes('La batería dura poco'));
        assert.ok(correos[0].texto.includes('Hay que recalibrarlo'));
        assert.ok(correos[0].extra.html.includes('Hemos respondido a tu incidencia'));

        const [deLaApp] = await incidencias.listarDeUsuario(pelin.idUsuario);
        assert.strictEqual(deLaApp.respuesta, 'Hay que recalibrarlo');
    });

    it('responder() con respuesta y estado deja el estado que se indica', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'datos', 'Faltan datos de ayer');
        const r = await incidencias.responder(i.idIncidencia, { respuesta: 'Lo estamos mirando', estado: 'en curso' });
        assert.strictEqual(r.estado, 'en curso');
        assert.strictEqual(correos.length, 1);
    });

    it('responder() solo con estado lo cambia sin enviar correo', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Pregunta');
        const r = await incidencias.responder(i.idIncidencia, { estado: 'en curso' });
        assert.strictEqual(r.estado, 'en curso');
        assert.strictEqual(r.respuesta, null);
        assert.strictEqual(correos.length, 0);
    });

    it('responder() sin nada, con estado o respuesta no válidos, o de una que no existe da error', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Pregunta');
        await assert.rejects(incidencias.responder(i.idIncidencia, {}), (e) => e.codigo === 'DATOS_NO_VALIDOS');
        await assert.rejects(incidencias.responder(i.idIncidencia, { estado: 'cerrada' }),
            (e) => e.codigo === 'DATOS_NO_VALIDOS' && e.campos.includes('estado'));
        await assert.rejects(incidencias.responder(i.idIncidencia, { respuesta: '  ' }),
            (e) => e.codigo === 'DATOS_NO_VALIDOS' && e.campos.includes('respuesta'));
        await assert.rejects(incidencias.responder(999, { respuesta: 'Hola' }),
            (e) => e.codigo === 'INCIDENCIA_NO_EXISTE');
        assert.strictEqual(correos.length, 0);
    });

    it('si el correo de la respuesta falla, la respuesta se guarda igual', async function () {
        const otra = new Logica(logica.conexion, async () => { throw new Error('Gmail caído'); },
            'http://localhost:8080/restablecer.html', 'clave-de-pruebas');
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Pregunta');
        const errorOriginal = console.error;
        console.error = () => { };
        try {
            const r = await otra.incidencias.responder(i.idIncidencia, { respuesta: 'Respuesta' });
            assert.strictEqual(r.estado, 'resuelta');
        } finally {
            console.error = errorOriginal;
        }
    });

    it('borrar el sensor deja la incidencia sin sensor; borrar el usuario borra sus incidencias', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'sensor', 'Algo');
        await logica.conexion.execute('DELETE FROM Sensores WHERE idSensor = ?', [idSensorPelin]);
        assert.strictEqual((await incidencias.obtener(i.idIncidencia)).sensor, null);
        await logica.conexion.execute('DELETE FROM Usuarios WHERE idUsuario = ?', [pelin.idUsuario]);
        assert.deepStrictEqual(await incidencias.listarDeUsuario(pelin.idUsuario), []);
    });

    it('el correo escapa el HTML de lo que escribe el usuario', function () {
        const correo = crearCorreoRespuestaIncidencia({
            nombre: '<b>Pelin</b>', tipo: 'otra', descripcion: '<script>x</script>', respuesta: 'Vale & gracias',
            estado: 'resuelta', fecha: new Date('2026-11-17T10:00:00Z'), idIncidencia: 7
        });
        assert.ok(!correo.html.includes('<script>'));
        assert.ok(correo.html.includes('&lt;script&gt;'));
        assert.ok(correo.html.includes('Vale &amp; gracias'));
        assert.ok(correo.texto.includes('17 de noviembre de 2026'));
    });
});
