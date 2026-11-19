'use strict';

const assert = require('node:assert/strict');
const {
    debeAvisarPersonal,
    reservarAlertaPersonal,
    nivelOzonoLugar,
    debeAvisarLugar,
    reservarAlertaLugar
} = require('../Alertas');
const { Logica } = require('../Logica');
const { CONFIG_BD_PRUEBAS, crearBDPruebas } = require('./bdPruebas');

describe('Alertas personales de ozono', function () {
    const ahora = new Date('2026-11-19T12:00:00Z');
    const unaHora = 60 * 60 * 1000;

    const datos = {
        usuario: { alertas: true, umbralAlerta: 150 },
        medicion: { contaminante: 'O3', valor: 160 },
        ultimoEnvio: null,
        ahora
    };

    it('avisa si el ozono supera el umbral personal y no hubo un aviso previo', function () {
        assert.strictEqual(debeAvisarPersonal(datos), true);
    });

    it('no avisa si las alertas están desactivadas', function () {
        assert.strictEqual(debeAvisarPersonal({
            ...datos,
            usuario: { ...datos.usuario, alertas: false }
        }), false);
    });

    it('no avisa si el valor es igual al umbral', function () {
        assert.strictEqual(debeAvisarPersonal({
            ...datos,
            medicion: { contaminante: 'O3', valor: 150 }
        }), false);
    });

    it('usa 180 como umbral cuando el usuario no ha elegido uno', function () {
        const usuario = { alertas: true, umbralAlerta: null };

        assert.strictEqual(debeAvisarPersonal({
            ...datos, usuario, medicion: { contaminante: 'O3', valor: 180 }
        }), false);
        assert.strictEqual(debeAvisarPersonal({
            ...datos, usuario, medicion: { contaminante: 'O3', valor: 181 }
        }), true);
    });

    it('no avisa por otro contaminante', function () {
        assert.strictEqual(debeAvisarPersonal({
            ...datos,
            medicion: { contaminante: 'NO2', valor: 200 }
        }), false);
    });

    it('bloquea la repetición antes de una hora y la permite al cumplirse', function () {
        assert.strictEqual(debeAvisarPersonal({
            ...datos,
            ultimoEnvio: new Date(ahora.getTime() - unaHora + 1)
        }), false);
        assert.strictEqual(debeAvisarPersonal({
            ...datos,
            ultimoEnvio: new Date(ahora.getTime() - unaHora)
        }), true);
    });
});

describe('Reserva de alertas en Mariadb', function () {
    let logica;

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(
            CONFIG_BD_PRUEBAS,
            async () => { },
            'http://localhost:8080/restablecer.html',
            'clave-de-pruebas'
        );
    });

    after(async function () {
        if (logica) {
            await logica.cerrar();
        }
    });

    it('reserva un solo aviso ante dos peticiones simultáneas del mismo usuario', async function () {
        const { idUsuario } = await logica.registrarUsuario(
            'Laura', 'Martínez', 'laura@aeris.es', 'aire2026'
        );
        const medicion = { contaminante: 'O3', valor: 200 };
        const ahora = new Date('2026-11-19T12:00:00Z');

        const resultados = await Promise.all([
            reservarAlertaPersonal(logica.conexion, idUsuario, medicion, ahora),
            reservarAlertaPersonal(logica.conexion, idUsuario, medicion, ahora)
        ]);

        assert.strictEqual(resultados.filter(Boolean).length, 1);
    });

    it('guarda el nivel del lugar y limita los avisos a uno cada tres horas', async function () {
        const { idUsuario } = await logica.registrarUsuario(
            'Ana', 'García', 'ana@aeris.es', 'aire2026'
        );
        await logica.conexion.execute(
            'UPDATE Usuarios SET premiumHasta = ? WHERE idUsuario = ?',
            [new Date('2099-01-01T00:00:00Z'), idUsuario]
        );
        const lugar = await logica.lugares.crear(idUsuario, {
            nombre: 'Casa',
            tipo: 'casa',
            direccion: 'Gandía',
            latitud: 38.967,
            longitud: -0.181,
            avisosActivos: true
        });

        const evaluar = (nivel, hora) => reservarAlertaLugar(
            logica.conexion,
            lugar.idLugar,
            nivel,
            new Date(`2026-11-19T${hora}Z`)
        );

        assert.strictEqual(await evaluar('aceptable', '12:00:00'), false);
        assert.strictEqual(await evaluar('malo', '12:01:00'), true);
        assert.strictEqual(await evaluar('malo', '12:02:00'), false);
        assert.strictEqual(await evaluar('muy_malo', '14:59:00'), false);

        const [[estado]] = await logica.conexion.execute(
            'SELECT ultimoNivel FROM EstadoAlertaLugar WHERE idLugar = ?',
            [lugar.idLugar]
        );
        assert.strictEqual(estado.ultimoNivel, 'muy_malo');

        assert.strictEqual(await evaluar('aceptable', '15:00:00'), false);
        assert.strictEqual(await evaluar('malo', '15:01:00'), true);
    });
});

describe('Alertas de ozono por lugar', function () {
    const ahora = new Date('2026-11-19T12:00:00Z');
    const tresHoras = 3 * 60 * 60 * 1000;
    const umbrales = { umbralMalo: 180, umbralMuyMalo: 240 };
    const datos = {
        alertas: true,
        avisosActivos: true,
        nivelAnterior: 'aceptable',
        nivelActual: 'malo',
        ultimoEnvio: null,
        ahora
    };

    it('clasifica el ozono en los límites de Malo y Muy malo', function () {
        assert.strictEqual(nivelOzonoLugar(null, umbrales), null);
        assert.strictEqual(nivelOzonoLugar(179, umbrales), 'aceptable');
        assert.strictEqual(nivelOzonoLugar(180, umbrales), 'malo');
        assert.strictEqual(nivelOzonoLugar(239, umbrales), 'malo');
        assert.strictEqual(nivelOzonoLugar(240, umbrales), 'muy_malo');
    });

    it('avisa en la primera lectura mala y cuando el nivel empeora', function () {
        assert.strictEqual(debeAvisarLugar({ ...datos, nivelAnterior: null }), true);
        assert.strictEqual(debeAvisarLugar(datos), true);
        assert.strictEqual(debeAvisarLugar({
            ...datos, nivelAnterior: 'malo', nivelActual: 'muy_malo'
        }), true);
    });

    it('no avisa si el nivel sigue igual, mejora o no hay lectura', function () {
        assert.strictEqual(debeAvisarLugar({ ...datos, nivelAnterior: 'malo' }), false);
        assert.strictEqual(debeAvisarLugar({ ...datos, nivelAnterior: 'muy_malo' }), false);
        assert.strictEqual(debeAvisarLugar({ ...datos, nivelActual: null }), false);
    });

    it('respeta el interruptor general y el del lugar', function () {
        assert.strictEqual(debeAvisarLugar({ ...datos, alertas: false }), false);
        assert.strictEqual(debeAvisarLugar({ ...datos, avisosActivos: false }), false);
    });

    it('bloquea un nuevo aviso antes de tres horas y lo permite justo al cumplirse', function () {
        assert.strictEqual(debeAvisarLugar({
            ...datos, ultimoEnvio: new Date(ahora.getTime() - tresHoras + 1)
        }), false);
        assert.strictEqual(debeAvisarLugar({
            ...datos, ultimoEnvio: new Date(ahora.getTime() - tresHoras)
        }), true);
    });
});