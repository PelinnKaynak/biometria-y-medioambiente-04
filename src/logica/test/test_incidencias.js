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
        const i = await incidencias.crear(pelin.idUsuario, 'cuenta', '  Foto de perfil  ', '  No puedo cambiar la foto  ');
        assert.ok(Number.isInteger(i.idIncidencia));
        assert.strictEqual(i.tipo, 'cuenta');
        assert.strictEqual(i.asunto, 'Foto de perfil');
        assert.strictEqual(i.descripcion, 'No puedo cambiar la foto');
        assert.strictEqual(i.estado, 'abierta');
        assert.strictEqual(i.respuesta, null);
        assert.strictEqual(i.responsable, null);
        assert.strictEqual(i.fechaRespuesta, null);
        assert.strictEqual(i.sensor, null);
        assert.ok(i.fechaCreacion.getTime() >= antes && i.fechaCreacion.getTime() <= Date.now() + 2000);
    });

    it('crear() de tipo sensor o datos sin idSensor pone el sensor del usuario', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'sensor', 'Asunto', 'La luz no se enciende');
        assert.deepStrictEqual(i.sensor, { idSensor: idSensorPelin, numeroSerie: '092021010920' });
        const d = await incidencias.crear(pelin.idUsuario, 'datos', 'Asunto', 'Valores raros por la noche');
        assert.strictEqual(d.sensor.idSensor, idSensorPelin);
    });

    it('crear() de tipo sensor sin tener sensor la guarda sin sensor', async function () {
        const i = await incidencias.crear(ana.idUsuario, 'sensor', 'Asunto', 'No me llega el sensor');
        assert.strictEqual(i.sensor, null);
    });

    it('crear() con el idSensor de otro usuario da DATOS_NO_VALIDOS', async function () {
        await assert.rejects(incidencias.crear(ana.idUsuario, 'sensor', 'Asunto', 'Hola', idSensorPelin),
            (e) => e.codigo === 'DATOS_NO_VALIDOS' && e.campos.includes('idSensor'));
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Hola', idSensorPelin);
        assert.strictEqual(i.sensor.idSensor, idSensorPelin);
    });

    it('crear() rechaza tipo, asunto, descripción o idSensor no válidos y dice qué campos', async function () {
        await assert.rejects(incidencias.crear(pelin.idUsuario, 'queja', '  ', '   ', 'uno'),
            (e) => e.codigo === 'DATOS_NO_VALIDOS'
                && ['tipo', 'asunto', 'descripcion', 'idSensor'].every((c) => e.campos.includes(c)));
        await assert.rejects(incidencias.crear(pelin.idUsuario, 'otra', 'x'.repeat(121), 'Hola'),
            (e) => e.codigo === 'DATOS_NO_VALIDOS' && e.campos.includes('asunto'));
        await assert.rejects(incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'x'.repeat(2001)),
            (e) => e.codigo === 'DATOS_NO_VALIDOS' && e.campos.includes('descripcion'));
        const [filas] = await logica.conexion.query('SELECT COUNT(*) AS n FROM Incidencias');
        assert.strictEqual(Number(filas[0].n), 0);
    });

    // --- listar ----------------------------------------------------------------

    it('listarDeUsuario() solo da las suyas, la más nueva primero', async function () {
        const a = await incidencias.crear(pelin.idUsuario, 'cuenta', 'Asunto', 'Primera');
        await incidencias.crear(ana.idUsuario, 'otra', 'Asunto', 'De Ana');
        const b = await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Segunda');
        const lista = await incidencias.listarDeUsuario(pelin.idUsuario);
        assert.deepStrictEqual(lista.map((i) => i.idIncidencia), [b.idIncidencia, a.idIncidencia]);
        assert.deepStrictEqual(await incidencias.listarDeUsuario(9999), []);
    });

    it('listar() da todas con los datos del usuario y del sensor, y filtra por estado y tipo', async function () {
        const s = await incidencias.crear(pelin.idUsuario, 'sensor', 'Asunto', 'No conecta');
        const c = await incidencias.crear(ana.idUsuario, 'cuenta', 'Asunto', 'Olvidé el correo');
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
        await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Una');
        const b = await incidencias.crear(ana.idUsuario, 'otra', 'Asunto', 'Otra');
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
        const i = await incidencias.crear(pelin.idUsuario, 'sensor', 'Asunto', 'La batería dura poco');
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

    it('responder() guarda quién respondió y sale con su nombre y su rol', async function () {
        await logica.conexion.execute(
            `UPDATE Usuarios
            SET esAdministrador = FALSE, esTecnico = TRUE, esPortador = FALSE
            WHERE idUsuario = ?`,
            [ana.idUsuario]
        );
        const i = await incidencias.crear(pelin.idUsuario, 'sensor', 'No conecta', 'No lo encuentra por Bluetooth');
        const r = await incidencias.responder(i.idIncidencia, { respuesta: 'Reinícialo' }, ana.idUsuario);
        assert.deepStrictEqual(r.responsable, { nombre: 'Ana', rol: 'tecnico', idUsuario: ana.idUsuario });
        const [deLaApp] = await incidencias.listarDeUsuario(pelin.idUsuario);
        assert.deepStrictEqual(deLaApp.responsable, { nombre: 'Ana', rol: 'tecnico' });
        assert.ok(correos[0].texto.includes('Respuesta de Ana (técnico)'));
        assert.ok(correos[0].texto.includes('«No conecta»'));

        // si el técnico se borra, la respuesta se queda sin nombre
        await logica.conexion.execute('DELETE FROM Usuarios WHERE idUsuario = ?', [ana.idUsuario]);
        const [sinTecnico] = await incidencias.listarDeUsuario(pelin.idUsuario);
        assert.strictEqual(sinTecnico.respuesta, 'Reinícialo');
        assert.strictEqual(sinTecnico.responsable, null);
    });

    it('responder() con respuesta y estado deja el estado que se indica', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'datos', 'Asunto', 'Faltan datos de ayer');
        const r = await incidencias.responder(i.idIncidencia, { respuesta: 'Lo estamos mirando', estado: 'en curso' });
        assert.strictEqual(r.estado, 'en curso');
        assert.strictEqual(correos.length, 1);
    });

    it('responder() solo con estado lo cambia sin enviar correo', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Pregunta');
        const r = await incidencias.responder(i.idIncidencia, { estado: 'en curso' });
        assert.strictEqual(r.estado, 'en curso');
        assert.strictEqual(r.respuesta, null);
        assert.strictEqual(correos.length, 0);
    });

    it('responder() sin nada, con estado o respuesta no válidos, o de una que no existe da error', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Pregunta');
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
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Pregunta');
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
        const i = await incidencias.crear(pelin.idUsuario, 'sensor', 'Asunto', 'Algo');
        await logica.conexion.execute('DELETE FROM Sensores WHERE idSensor = ?', [idSensorPelin]);
        assert.strictEqual((await incidencias.obtener(i.idIncidencia)).sensor, null);
        await logica.conexion.execute('DELETE FROM Usuarios WHERE idUsuario = ?', [pelin.idUsuario]);
        assert.deepStrictEqual(await incidencias.listarDeUsuario(pelin.idUsuario), []);
    });

    it('el correo escapa el HTML de lo que escribe el usuario', function () {
        const correo = crearCorreoRespuestaIncidencia({
            nombre: '<b>Pelin</b>', tipo: 'otra', asunto: '<i>Hola</i>', descripcion: '<script>x</script>',
            respuesta: 'Vale & gracias', responsable: { nombre: '<u>Marc</u>', rol: 'tecnico' }, estado: 'resuelta', fecha: new Date('2026-11-17T10:00:00Z'), idIncidencia: 7
        });
        assert.ok(!correo.html.includes('<script>'));
        assert.ok(correo.html.includes('&lt;script&gt;'));
        assert.ok(correo.html.includes('Vale &amp; gracias'));
        assert.ok(!correo.html.includes('<i>') && !correo.html.includes('<u>'));
        assert.ok(correo.texto.includes('17 de noviembre de 2026'));
    });

    // --- conversación de cada incidencia (T043) ----------------------------------

    async function hacerDelEquipo(idUsuario, rol = 'tecnico') {
        await logica.conexion.execute(
            'UPDATE Usuarios SET esAdministrador = ?, esTecnico = ?, esPortador = FALSE WHERE idUsuario = ?',
            [rol === 'administrador', rol === 'tecnico', idUsuario]);
    }

    async function contarMensajes() {
        const [filas] = await logica.conexion.query('SELECT COUNT(*) AS n FROM MensajesIncidencia');
        return Number(filas[0].n);
    }

    it('enviarMensaje() del usuario guarda su mensaje con su autor y sale en la conversación', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'sensor', 'No conecta', 'No lo encuentra por Bluetooth');
        const antes = Date.now() - 2000;
        const m = await incidencias.enviarMensaje(i.idIncidencia, pelin.idUsuario, '  Sigue sin conectar  ');
        assert.ok(Number.isInteger(m.idMensaje));
        assert.strictEqual(m.idIncidencia, i.idIncidencia);
        assert.strictEqual(m.texto, 'Sigue sin conectar');
        assert.deepStrictEqual(m.autor, { idUsuario: pelin.idUsuario, nombre: 'Pelin', rol: 'ciudadano' });
        assert.strictEqual(m.delUsuario, true);
        assert.ok(m.fecha instanceof Date && m.fecha.getTime() >= antes && m.fecha.getTime() <= Date.now() + 2000);

        const hilo = await incidencias.listarMensajes(i.idIncidencia, pelin.idUsuario);
        assert.deepStrictEqual(hilo.map((x) => x.idMensaje), [m.idMensaje]);
        assert.strictEqual(correos.length, 0, 'el mensaje del usuario no manda ningún correo');
        assert.strictEqual(await estadoDe(i.idIncidencia), 'abierta');
    });

    async function estadoDe(idIncidencia) {
        return (await incidencias.obtener(idIncidencia)).estado;
    }

    it('la conversación va por orden y distingue lo del usuario de lo del equipo', async function () {
        await hacerDelEquipo(ana.idUsuario);
        const i = await incidencias.crear(pelin.idUsuario, 'datos', 'Faltan datos', 'No salen los de ayer');
        await incidencias.responder(i.idIncidencia, { respuesta: 'Los estamos mirando', estado: 'en curso' }, ana.idUsuario);
        await incidencias.enviarMensaje(i.idIncidencia, pelin.idUsuario, 'Gracias, espero');
        await incidencias.enviarMensaje(i.idIncidencia, ana.idUsuario, 'Ya están', 'resuelta');
        await incidencias.enviarMensaje(i.idIncidencia, pelin.idUsuario, 'Perfecto');

        // el técnico y el usuario ven lo mismo, por orden (aunque pasen en el mismo segundo)
        for (const quien of [pelin.idUsuario, ana.idUsuario]) {
            const hilo = await incidencias.listarMensajes(i.idIncidencia, quien);
            assert.deepStrictEqual(hilo.map((m) => m.texto),
                ['Los estamos mirando', 'Gracias, espero', 'Ya están', 'Perfecto']);
            assert.deepStrictEqual(hilo.map((m) => m.delUsuario), [false, true, false, true]);
            assert.deepStrictEqual(hilo[0].autor, { idUsuario: ana.idUsuario, nombre: 'Ana', rol: 'tecnico' });
            assert.deepStrictEqual(hilo[1].autor, { idUsuario: pelin.idUsuario, nombre: 'Pelin', rol: 'ciudadano' });
        }
    });

    it('responder() también añade su respuesta a la conversación; solo con estado no añade nada', async function () {
        await hacerDelEquipo(ana.idUsuario);
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Pregunta');
        await incidencias.responder(i.idIncidencia, { estado: 'en curso' }, ana.idUsuario);
        assert.deepStrictEqual(await incidencias.listarMensajes(i.idIncidencia, pelin.idUsuario), []);

        await incidencias.responder(i.idIncidencia, { respuesta: '  Hecho  ' }, ana.idUsuario);
        const hilo = await incidencias.listarMensajes(i.idIncidencia, pelin.idUsuario);
        assert.strictEqual(hilo.length, 1);
        assert.strictEqual(hilo[0].texto, 'Hecho');
        assert.strictEqual(hilo[0].delUsuario, false);
        assert.deepStrictEqual(hilo[0].autor, { idUsuario: ana.idUsuario, nombre: 'Ana', rol: 'tecnico' });
        // y lo de siempre sigue igual: la última respuesta queda en la incidencia
        const [deLaApp] = await incidencias.listarDeUsuario(pelin.idUsuario);
        assert.strictEqual(deLaApp.respuesta, 'Hecho');
    });

    it('si el usuario escribe en una incidencia «resuelta» se reabre como «abierta»; «en curso» y «abierta» no cambian', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Pregunta');
        await incidencias.responder(i.idIncidencia, { respuesta: 'Hecho' });
        assert.strictEqual(await estadoDe(i.idIncidencia), 'resuelta');
        const antesAbiertas = await incidencias.contarAbiertas();

        await incidencias.enviarMensaje(i.idIncidencia, pelin.idUsuario, 'Sigue fallando');
        assert.strictEqual(await estadoDe(i.idIncidencia), 'abierta');
        assert.strictEqual(await incidencias.contarAbiertas(), antesAbiertas + 1);

        await incidencias.responder(i.idIncidencia, { estado: 'en curso' });
        await incidencias.enviarMensaje(i.idIncidencia, pelin.idUsuario, 'Otro detalle');
        assert.strictEqual(await estadoDe(i.idIncidencia), 'en curso');

        const otra = await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Otra');
        await incidencias.enviarMensaje(otra.idIncidencia, pelin.idUsuario, 'Más info', 'resuelta');
        assert.strictEqual(await estadoDe(otra.idIncidencia), 'abierta', 'el usuario no puede cambiar el estado');
    });

    it('un técnico o un administrador responden con enviarMensaje(): respuesta, estado y UN correo', async function () {
        await hacerDelEquipo(ana.idUsuario, 'tecnico');
        const i = await incidencias.crear(pelin.idUsuario, 'sensor', 'No conecta', 'La luz parpadea');
        const m = await incidencias.enviarMensaje(i.idIncidencia, ana.idUsuario, 'Reinícialo con el botón');
        assert.strictEqual(m.delUsuario, false);
        assert.deepStrictEqual(m.autor, { idUsuario: ana.idUsuario, nombre: 'Ana', rol: 'tecnico' });

        const despues = await incidencias.obtener(i.idIncidencia);
        assert.strictEqual(despues.respuesta, 'Reinícialo con el botón');
        assert.strictEqual(despues.estado, 'resuelta');
        assert.deepStrictEqual(despues.responsable, { nombre: 'Ana', rol: 'tecnico', idUsuario: ana.idUsuario });
        assert.ok(despues.fechaRespuesta instanceof Date);
        assert.strictEqual(correos.length, 1);
        assert.strictEqual(correos[0].destinatario, 'pelin@aeris.es');
        assert.ok(correos[0].texto.includes('Reinícialo con el botón'));

        // con estado indicado, se respeta; y un administrador también puede
        const carla = await logica.registrarUsuario('Carla', 'Ruiz', 'carla@aeris.es', 'aire2026');
        await hacerDelEquipo(carla.idUsuario, 'administrador');
        await incidencias.enviarMensaje(i.idIncidencia, carla.idUsuario, 'Pásate por el taller', 'en curso');
        assert.strictEqual(await estadoDe(i.idIncidencia), 'en curso');
        assert.strictEqual(correos.length, 2);
        const hilo = await incidencias.listarMensajes(i.idIncidencia, pelin.idUsuario);
        assert.strictEqual(hilo[1].autor.rol, 'administrador');
    });

    it('cada respuesta del equipo manda un solo correo, venga de responder() o de enviarMensaje(); el usuario ninguno', async function () {
        await hacerDelEquipo(ana.idUsuario);
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Pregunta');
        await incidencias.responder(i.idIncidencia, { respuesta: 'Primera' }, ana.idUsuario);
        assert.strictEqual(correos.length, 1);
        await incidencias.enviarMensaje(i.idIncidencia, ana.idUsuario, 'Segunda');
        assert.strictEqual(correos.length, 2);
        await incidencias.enviarMensaje(i.idIncidencia, pelin.idUsuario, 'Tercera');
        await incidencias.responder(i.idIncidencia, { estado: 'en curso' }, ana.idUsuario);
        assert.strictEqual(correos.length, 2, 'ni el mensaje del usuario ni un cambio de estado mandan correo');
    });

    it('si quien escribe es del equipo pero la incidencia es suya, cuenta como mensaje del usuario', async function () {
        await hacerDelEquipo(ana.idUsuario);
        const i = await incidencias.crear(ana.idUsuario, 'otra', 'Asunto', 'Mi propia incidencia');
        await incidencias.responder(i.idIncidencia, { respuesta: 'Hecho' });
        const m = await incidencias.enviarMensaje(i.idIncidencia, ana.idUsuario, 'Pero sigue igual');
        assert.strictEqual(m.delUsuario, true);
        assert.strictEqual(await estadoDe(i.idIncidencia), 'abierta');
        assert.strictEqual(correos.length, 1, 'solo el de responder(): su propio mensaje no manda correo');
    });

    it('quien no envió la incidencia ni es del equipo no puede leerla ni escribir en ella', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Privado');
        await incidencias.enviarMensaje(i.idIncidencia, pelin.idUsuario, 'Un detalle');
        const carla = await logica.registrarUsuario('Carla', 'Ruiz', 'carla@aeris.es', 'aire2026');
        const noExiste = (e) => e.codigo === 'INCIDENCIA_NO_EXISTE';

        await assert.rejects(incidencias.listarMensajes(i.idIncidencia, carla.idUsuario), noExiste);
        await assert.rejects(incidencias.enviarMensaje(i.idIncidencia, carla.idUsuario, 'Intruso'), noExiste);
        assert.strictEqual(await contarMensajes(), 1);
        assert.strictEqual(correos.length, 0);
    });

    it('enviarMensaje() y listarMensajes() de una que no existe o con un id raro dan INCIDENCIA_NO_EXISTE', async function () {
        const noExiste = (e) => e.codigo === 'INCIDENCIA_NO_EXISTE';
        await assert.rejects(incidencias.listarMensajes(12345, pelin.idUsuario), noExiste);
        await assert.rejects(incidencias.listarMensajes(NaN, pelin.idUsuario), noExiste);
        await assert.rejects(incidencias.enviarMensaje(12345, pelin.idUsuario, 'Hola'), noExiste);
        await assert.rejects(incidencias.enviarMensaje('7', pelin.idUsuario, 'Hola'), noExiste);
        await assert.rejects(incidencias.enviarMensaje(undefined, pelin.idUsuario, 'Hola'), noExiste);
    });

    it('enviarMensaje() rechaza un texto vacío o de más de 2000 caracteres y un estado que no existe', async function () {
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Pregunta');
        for (const mal of ['', '   ', undefined, null, 5, 'x'.repeat(2001)]) {
            await assert.rejects(incidencias.enviarMensaje(i.idIncidencia, pelin.idUsuario, mal),
                (e) => e.codigo === 'DATOS_NO_VALIDOS' && e.campos.includes('texto'), `texto ${String(mal).slice(0, 10)}`);
        }
        await assert.rejects(incidencias.enviarMensaje(i.idIncidencia, pelin.idUsuario, 'Hola', 'cerrada'),
            (e) => e.codigo === 'DATOS_NO_VALIDOS' && e.campos.includes('estado'));
        assert.strictEqual(await contarMensajes(), 0);

        const justo = await incidencias.enviarMensaje(i.idIncidencia, pelin.idUsuario, 'x'.repeat(2000));
        assert.strictEqual(justo.texto.length, 2000);
        // un estado null (JSON) es como no enviarlo
        await incidencias.enviarMensaje(i.idIncidencia, pelin.idUsuario, 'Con estado null', null);
        assert.strictEqual(await contarMensajes(), 2);
    });

    it('si el correo falla, el mensaje del equipo se guarda igual', async function () {
        await hacerDelEquipo(ana.idUsuario);
        const otra = new Logica(logica.conexion, async () => { throw new Error('Gmail caído'); },
            'http://localhost:8080/restablecer.html', 'clave-de-pruebas');
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Pregunta');
        const errorOriginal = console.error;
        console.error = () => { };
        try {
            const m = await otra.incidencias.enviarMensaje(i.idIncidencia, ana.idUsuario, 'Respuesta');
            assert.strictEqual(m.texto, 'Respuesta');
        } finally {
            console.error = errorOriginal;
        }
        assert.strictEqual(await contarMensajes(), 1);
    });

    it('borrar la incidencia borra sus mensajes; borrar al autor deja su mensaje sin nombre', async function () {
        await hacerDelEquipo(ana.idUsuario);
        const i = await incidencias.crear(pelin.idUsuario, 'otra', 'Asunto', 'Pregunta');
        await incidencias.enviarMensaje(i.idIncidencia, ana.idUsuario, 'Respuesta del equipo');
        await incidencias.enviarMensaje(i.idIncidencia, pelin.idUsuario, 'Gracias');

        await logica.conexion.execute('DELETE FROM Usuarios WHERE idUsuario = ?', [ana.idUsuario]);
        const hilo = await incidencias.listarMensajes(i.idIncidencia, pelin.idUsuario);
        assert.deepStrictEqual(hilo.map((m) => m.texto), ['Respuesta del equipo', 'Gracias']);
        assert.strictEqual(hilo[0].autor, null);
        assert.strictEqual(hilo[0].delUsuario, false);
        assert.strictEqual(hilo[1].delUsuario, true);

        await logica.conexion.execute('DELETE FROM Incidencias WHERE idIncidencia = ?', [i.idIncidencia]);
        assert.strictEqual(await contarMensajes(), 0);
    });
});
