// ---------------------------------------------------------------------------
// Fichero:     test_vinculacion.js
// Descripción: Tests de la vinculación del sensor confirmada por correo
//              (Logica.js, T005) contra la BD de pruebas aeris_test. Los
//              correos no se envían: se apuntan.
// Autores:     Equipo 04 – SenseTech
// Fecha:       14/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica, ocultarCorreo } = require('../Logica');
const Seguridad = require('../Seguridad');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('./bdPruebas');

const CLAVE = 'clave-de-pruebas';
const SERIE = '092021010920';
const COMPRADOR = 'pkaynak@upv.edu.es';

describe('Logica (vinculación del sensor por correo)', function () {

    let logica;
    let correos;
    let pelin, ana;     // sesiones de dos usuarios

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS,
            async (destinatario, asunto, texto, extra) => {
                if (!asunto.includes('bienvenida')) correos.push({ destinatario, asunto, texto, extra });
            },
            'http://localhost:8080/restablecer.html', CLAVE, 'http://localhost:8080/responderVinculacion');
    });

    beforeEach(async function () {
        correos = [];
        await vaciarTablas(logica.conexion);
        await logica.conexion.execute('INSERT INTO Sensores (numeroSerie, correoCompra) VALUES (?, ?)', [SERIE, COMPRADOR]);
        pelin = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        ana = await logica.registrarUsuario('Ana', 'García', 'ana@aeris.es', 'aire2026');
        correos = [];
    });

    after(async function () {
        await logica.cerrar();
    });

    function tokenDelUltimoCorreo() {
        return correos[correos.length - 1].texto.match(/token=([^&\s]+)/)[1];
    }

    async function filaSensor() {
        const [filas] = await logica.conexion.execute('SELECT * FROM Sensores WHERE numeroSerie = ?', [SERIE]);
        return filas[0];
    }

    it('ocultarCorreo() deja ver solo la primera letra y el dominio (como la app)', function () {
        assert.strictEqual(ocultarCorreo('pkaynak@upv.edu.es'), 'p•••••@upv.edu.es');
    });

    it('solicitarVinculacion() deja la solicitud pendiente y manda el correo a quien compró el sensor', async function () {
        const solicitud = await logica.solicitarVinculacion(pelin.idUsuario, SERIE, -41.5);
        assert.strictEqual(solicitud.estado, 'pendiente');
        assert.strictEqual(solicitud.numeroSerie, SERIE);
        assert.strictEqual(solicitud.correoComprador, ocultarCorreo(COMPRADOR));
        assert.ok(!Number.isNaN(Date.parse(solicitud.fecha)));

        assert.strictEqual(correos.length, 1);
        assert.strictEqual(correos[0].destinatario, COMPRADOR);
        assert.match(correos[0].asunto, /Pelin Kaynak quiere vincular tu sensor 092021010920/);
        assert.match(correos[0].texto, /responderVinculacion\?token=[\w-]+\.[\w-]+&respuesta=si/);
        assert.match(correos[0].extra.html, /Sí, vincular el sensor/);

        const fila = await filaSensor();
        assert.strictEqual(fila.idSolicitante, pelin.idUsuario);
        assert.strictEqual(fila.estadoSolicitud, 'pendiente');
        assert.strictEqual(fila.idUsuario, null);
        assert.strictEqual(fila.sensibilidad, -41.5);
    });

    it('solicitarVinculacion() con datos mal escritos, sensor desconocido o de otra cuenta da error', async function () {
        await assert.rejects(logica.solicitarVinculacion(pelin.idUsuario, '12345', 1), { codigo: 'DATOS_NO_VALIDOS' });
        await assert.rejects(logica.solicitarVinculacion(pelin.idUsuario, SERIE, 'mucho'), { codigo: 'DATOS_NO_VALIDOS' });
        await assert.rejects(logica.solicitarVinculacion(pelin.idUsuario, '999999999999', 1), { codigo: 'SENSOR_NO_REGISTRADO' });

        await logica.conexion.execute('UPDATE Sensores SET idUsuario = ? WHERE numeroSerie = ?', [ana.idUsuario, SERIE]);
        await assert.rejects(logica.solicitarVinculacion(pelin.idUsuario, SERIE, 1), { codigo: 'SENSOR_YA_VINCULADO' });
        assert.strictEqual(correos.length, 0);
    });

    it('responderVinculacion() con «sí» vincula el sensor y el estado pasa a confirmada', async function () {
        await logica.solicitarVinculacion(pelin.idUsuario, SERIE, 1);
        const r = await logica.responderVinculacion(tokenDelUltimoCorreo(), true);
        assert.deepStrictEqual(r, { estado: 'confirmada', numeroSerie: SERIE, nombreSolicitante: 'Pelin Kaynak' });

        const fila = await filaSensor();
        assert.strictEqual(fila.idUsuario, pelin.idUsuario);
        assert.strictEqual((await logica.estadoVinculacion(pelin.idUsuario)).estado, 'confirmada');

        // el mismo enlace ya no vale otra vez
        await assert.rejects(logica.responderVinculacion(tokenDelUltimoCorreo(), false), { codigo: 'TOKEN_NO_VALIDO' });
        // pedirlo otra vez cuando ya es suyo no manda otro correo
        assert.strictEqual((await logica.solicitarVinculacion(pelin.idUsuario, SERIE, 1)).estado, 'confirmada');
        assert.strictEqual(correos.length, 1);
    });

    it('responderVinculacion() con «no» lo rechaza y el sensor sigue sin dueño', async function () {
        await logica.solicitarVinculacion(pelin.idUsuario, SERIE, 1);
        const r = await logica.responderVinculacion(tokenDelUltimoCorreo(), false);
        assert.strictEqual(r.estado, 'rechazada');
        assert.strictEqual((await filaSensor()).idUsuario, null);
        assert.strictEqual((await logica.estadoVinculacion(pelin.idUsuario)).estado, 'rechazada');
    });

    it('estadoVinculacion() sin solicitudes da SIN_SOLICITUD; una pendiente de más de 48 h cuenta como rechazada', async function () {
        await assert.rejects(logica.estadoVinculacion(pelin.idUsuario), { codigo: 'SIN_SOLICITUD' });
        await logica.solicitarVinculacion(pelin.idUsuario, SERIE, 1);
        assert.strictEqual((await logica.estadoVinculacion(pelin.idUsuario)).estado, 'pendiente');
        await logica.conexion.execute(
            'UPDATE Sensores SET fechaSolicitud = ? WHERE numeroSerie = ?', [new Date(Date.now() - 49 * 3600 * 1000), SERIE]);
        assert.strictEqual((await logica.estadoVinculacion(pelin.idUsuario)).estado, 'rechazada');
    });

    it('reenviarCorreoVinculacion() manda un correo nuevo y el enlace anterior deja de valer', async function () {
        await assert.rejects(logica.reenviarCorreoVinculacion(pelin.idUsuario), { codigo: 'SIN_SOLICITUD' });
        await logica.solicitarVinculacion(pelin.idUsuario, SERIE, 1);
        const viejo = tokenDelUltimoCorreo();
        await new Promise((r) => setTimeout(r, 1100));     // la fecha se guarda en segundos
        await logica.reenviarCorreoVinculacion(pelin.idUsuario);
        assert.strictEqual(correos.length, 2);
        await assert.rejects(logica.responderVinculacion(viejo, true), { codigo: 'TOKEN_NO_VALIDO' });
        assert.strictEqual((await logica.responderVinculacion(tokenDelUltimoCorreo(), true)).estado, 'confirmada');
    });

    it('si otra persona pide el mismo sensor, el enlace del primero deja de valer', async function () {
        await logica.solicitarVinculacion(pelin.idUsuario, SERIE, 1);
        const dePelin = tokenDelUltimoCorreo();
        await logica.solicitarVinculacion(ana.idUsuario, SERIE, 1);
        await assert.rejects(logica.responderVinculacion(dePelin, true), { codigo: 'TOKEN_NO_VALIDO' });
        assert.strictEqual((await logica.responderVinculacion(tokenDelUltimoCorreo(), true)).nombreSolicitante, 'Ana García');
    });

    it('responderVinculacion() no acepta tokens de otro tipo, caducados o inventados', async function () {
        await logica.solicitarVinculacion(pelin.idUsuario, SERIE, 1);
        const datos = Seguridad.leerToken(tokenDelUltimoCorreo(), CLAVE);
        const caducado = Seguridad.firmarToken({ ...datos, exp: Math.floor(Date.now() / 1000) - 1 }, CLAVE);
        await assert.rejects(logica.responderVinculacion(caducado, true), { codigo: 'TOKEN_NO_VALIDO' });
        await assert.rejects(logica.responderVinculacion(pelin.token, true), { codigo: 'TOKEN_NO_VALIDO' });
        await assert.rejects(logica.responderVinculacion('abc.def', true), { codigo: 'TOKEN_NO_VALIDO' });
        assert.strictEqual((await filaSensor()).idUsuario, null);
    });
});
