// ---------------------------------------------------------------------------
// Fichero:     Mediciones.js
// Descripción: Lógica de las mediciones (T017). La app recibe por Bluetooth
//              las tramas del nodo (UUID "AERI" + número de serie, ver
//              doc/arduino_design.md), les añade la hora y la ubicación y
//              las guarda aquí. Solo se aceptan las del sensor vinculado al
//              usuario, con todos los datos y dentro de rango, y cada una se
//              guarda una sola vez aunque la app la reenvíe. También da las
//              últimas mediciones del usuario (pantalla de inicio) y la
//              última medición de todas (consulta pública, H006).
//              Usa las tablas Mediciones, Sensores y Contaminantes de
//              src/bd/usuarios.sql. Diseño en doc/logica_design.md.
//              Tarea T017 · H004, H006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const { reservarAlertaPersonal, procesarAlertasDeLugares } = require('./Alertas');

const CONTAMINANTE_POR_DEFECTO = 'O3';     // el que miden los nodos AERIS
const VALOR_MAXIMO = 2000;                 // µg/m³: por encima es un error del sensor
const MARGEN_FUTURO_MS = 5 * 60 * 1000;    // relojes un poco adelantados
const ANTIGUEDAD_MAXIMA_MS = 7 * 24 * 60 * 60 * 1000;   // lo que la app guarda sin conexión
const CANTIDAD_POR_DEFECTO = 5;
const CANTIDAD_MAXIMA = 100;
const DURACION_MAXIMA_CONSULTA_MS = 26 * 60 * 60 * 1000;
const ESTADO_ACTIVO = 'activo';

// ---------------------------------------------------------------------------
// valor --> esNumero() --> V/F
// What it does: true if it is a real number (not NaN, not Infinity, not text).
// ---------------------------------------------------------------------------
function esNumero(valor) {
    return typeof valor === 'number' && Number.isFinite(valor);
}

// ---------------------------------------------------------------------------
// fecha: Texto | N --> leerFecha() --> Date | null
// What it does: an ISO date («2026-11-18T19:42:05Z») or milliseconds since
//               1970, without milliseconds (DATETIME/TIMESTAMP keep seconds).
//               null if it is not a date.
// ---------------------------------------------------------------------------
function leerFecha(fecha) {
    if (!(typeof fecha === 'string' && fecha.trim() !== '') && !esNumero(fecha)) {
        return null;
    }
    const ms = new Date(fecha).getTime();
    return Number.isNaN(ms) ? null : new Date(Math.floor(ms / 1000) * 1000);
}

// ---------------------------------------------------------------------------
// fila: FilaBD --> aMedicion() --> Medicion
// Medicion = { idMedicion, contaminante, valor, unidad, fecha: Date, latitud, longitud }
// ---------------------------------------------------------------------------
function aMedicion(fila) {
    return {
        idMedicion: fila.idMedicion,
        contaminante: fila.contaminante,
        valor: fila.valorMedicion,
        unidad: fila.unidad,
        fecha: fila.fechaHora,
        latitud: fila.latitud,
        longitud: fila.longitud
    };
}

// Columnas de una medición, con el contaminante y la ubicación separada
const SELECT_MEDICION = `
    SELECT m.idMedicion, m.valorMedicion, m.fechaHora, c.nombre AS contaminante, c.unidad,
           ST_Y(m.ubicacion) AS latitud, ST_X(m.ubicacion) AS longitud
      FROM Mediciones m JOIN Contaminantes c ON c.idContaminante = m.idContaminante`;

// ---------------------------------------------------------------------------
// Mediciones class: saves and reads the measurements of the sensor nodes.
// ---------------------------------------------------------------------------
class Mediciones {

    // -----------------------------------------------------------------------
    // logica: Logica --> constructor()
    // What it does: uses the BD connection of logica.
    // -----------------------------------------------------------------------
    constructor(logica) {
        this.logica = logica;
    }

    get conexion() {
        return this.logica.conexion;
    }

    // -----------------------------------------------------------------------
    // idUsuario: N, datos: { numeroSerie, contaminante?, valor, latitud, longitud, fecha }
    //     --> guardar() --> { medicion: Medicion, nueva: V/F }
    // What it does: saves one measurement of the user's sensor (the serial
    //               number comes in the iBeacon packet). contaminante is
    //               «O3» if not given. If the same sensor already has a
    //               measurement of that pollutant at that same second, it is
    //               the app sending it again: nothing is saved and nueva is
    //               false (so the app knows it can forget it). The sensor
    //               becomes «activo» with its last connection.
    //               Throws DATOS_NO_VALIDOS (with the wrong fields; they are
    //               written in the console), SENSOR_NO_REGISTRADO or
    //               SENSOR_NO_ES_TUYO.
    // -----------------------------------------------------------------------
    async guardar(idUsuario, datos = {}) {
        const { numeroSerie, valor, latitud, longitud } = datos;
        const contaminante = datos.contaminante === undefined ? CONTAMINANTE_POR_DEFECTO : datos.contaminante;
        const fecha = leerFecha(datos.fecha);
        const ahora = Date.now();

        const erroneos = [];
        if (typeof numeroSerie !== 'string' || !/^\d{12}$/.test(numeroSerie)) erroneos.push('numeroSerie');
        if (typeof contaminante !== 'string' || contaminante.trim() === '') erroneos.push('contaminante');
        if (!esNumero(valor) || valor < 0 || valor > VALOR_MAXIMO) erroneos.push('valor');
        if (!esNumero(latitud) || latitud < -90 || latitud > 90) erroneos.push('latitud');
        if (!esNumero(longitud) || longitud < -180 || longitud > 180) erroneos.push('longitud');
        if (!fecha || fecha.getTime() > ahora + MARGEN_FUTURO_MS || fecha.getTime() < ahora - ANTIGUEDAD_MAXIMA_MS) {
            erroneos.push('fecha');
        }
        let idContaminante = null;
        if (!erroneos.includes('contaminante')) {
            const [filas] = await this.conexion.execute(
                'SELECT idContaminante FROM Contaminantes WHERE nombre = ?', [contaminante]);
            if (filas.length === 1) {
                idContaminante = filas[0].idContaminante;
            } else {
                erroneos.push('contaminante');
            }
        }
        if (erroneos.length > 0) {
            console.warn(`Medición rechazada (usuario ${idUsuario}): ${erroneos.join(', ')}`);
            throw this.error('DATOS_NO_VALIDOS', 'Medición con datos que faltan o fuera de rango', erroneos);
        }

        const [sensores] = await this.conexion.execute(
            'SELECT idSensor, idUsuario FROM Sensores WHERE numeroSerie = ?', [numeroSerie]);
        if (sensores.length !== 1) {
            throw this.error('SENSOR_NO_REGISTRADO', 'Este sensor no está registrado');
        }
        const sensor = sensores[0];
        if (sensor.idUsuario !== idUsuario) {
            throw this.error('SENSOR_NO_ES_TUYO', 'Este sensor no está vinculado a tu cuenta');
        }

        const [resultado] = await this.conexion.execute(
            `INSERT IGNORE INTO Mediciones (idSensor, idUsuario, idContaminante, valorMedicion, ubicacion, fechaHora)
             VALUES (?, ?, ?, ?, POINT(?, ?), ?)`,
            [sensor.idSensor, idUsuario, idContaminante, valor, longitud, latitud, fecha]);
        await this.conexion.execute(
            `UPDATE Sensores SET estado = ?,
                    ultimaConexion = IF(ultimaConexion IS NULL OR ultimaConexion < ?, ?, ultimaConexion)
              WHERE idSensor = ?`,
            [ESTADO_ACTIVO, fecha, fecha, sensor.idSensor]);
        const [filas] = await this.conexion.execute(
            `${SELECT_MEDICION} WHERE m.idSensor = ? AND m.idContaminante = ? AND m.fechaHora = ?`,
            [sensor.idSensor, idContaminante, fecha]);
        const medicion = aMedicion(filas[0]);
        const nueva = resultado.affectedRows === 1;

        if (nueva && medicion.contaminante === 'O3') {
            const ahora = new Date();

            try {
                const { latitud, longitud } = medicion;
                const aviso = {
                    tipo: 'personal',
                    idUsuario,
                    contaminante: medicion.contaminante,
                    valor: medicion.valor,
                    unidad: medicion.unidad,
                    zona: { latitud, longitud }
                };

                const reservado = await reservarAlertaPersonal(this.conexion, idUsuario, medicion, ahora, {
                    ...aviso,
                    zona: `${latitud.toFixed(5)}, ${longitud.toFixed(5)}`,
                    latitud,
                    longitud
                });

                if (reservado) await this.logica.notificarAlerta?.(aviso);
            } catch (error) {
                console.error(`Error al procesar la alerta personal del usuario ${idUsuario}:`, error.message);
            }

            try {
                await procesarAlertasDeLugares(this.logica, ahora);
            } catch (error) {
                console.error('Error al evaluar las alertas de lugares:', error.message);
            }
        }

        return { medicion, nueva };
    }

    // -----------------------------------------------------------------------
    // idUsuario: N, cantidad: N (opcional), contaminante: Texto (opcional)
    //     --> ultimasDeUsuario() --> Lista<Medicion>
    // What it does: the last 'cantidad' (5 if not given, at most 100)
    //               measurements of the user, newest first. Throws
    //               DATOS_NO_VALIDOS if cantidad is not a whole number from 1.
    // -----------------------------------------------------------------------
    async ultimasDeUsuario(idUsuario, cantidad = CANTIDAD_POR_DEFECTO, contaminante = CONTAMINANTE_POR_DEFECTO) {
        if (!Number.isInteger(cantidad) || cantidad < 1) {
            throw this.error('DATOS_NO_VALIDOS', 'cantidad tiene que ser un número entero desde 1', ['cantidad']);
        }
        const limite = Math.min(cantidad, CANTIDAD_MAXIMA);    // entero ya comprobado
        const [filas] = await this.conexion.execute(
            `${SELECT_MEDICION} WHERE m.idUsuario = ? AND c.nombre = ?
              ORDER BY m.fechaHora DESC, m.idMedicion DESC LIMIT ${limite}`,
            [idUsuario, contaminante]);
        return filas.map(aMedicion);
    }

    // -----------------------------------------------------------------------
    // idUsuario: N, desde: Fecha, hasta: Fecha --> deUsuarioEnPeriodo() --> Lista<Medicion>
    // What it does: returns all ozone readings of this user in the half-open
    //               time range [desde, hasta). The bounded interval is used
    //               by the daily app summary and allows 23/25-hour local days.
    // -----------------------------------------------------------------------
    async deUsuarioEnPeriodo(idUsuario, desde, hasta) {
        const inicioMs = desde instanceof Date ? desde.getTime() : NaN;
        const finMs = hasta instanceof Date ? hasta.getTime() : NaN;
        if (!Number.isFinite(inicioMs) || !Number.isFinite(finMs)
            || inicioMs >= finMs || finMs - inicioMs > DURACION_MAXIMA_CONSULTA_MS) {
            throw this.error('DATOS_NO_VALIDOS', 'desde y hasta deben formar un periodo de hasta 26 horas',
                ['desde', 'hasta']);
        }

        const nombresOzono = this.logica.condicionOzono().valores;
        const [filas] = await this.conexion.execute(
            `${SELECT_MEDICION} WHERE m.idUsuario = ? AND c.nombre IN (?, ?)
              AND m.fechaHora >= ? AND m.fechaHora < ?
              ORDER BY m.fechaHora ASC, m.idMedicion ASC`,
            [idUsuario, ...nombresOzono, desde, hasta]);
        return filas.map(aMedicion);
    }

    // -----------------------------------------------------------------------
    // contaminante: Texto (opcional) --> ultima() --> Medicion
    // What it does: the newest measurement of all the sensors (public: it
    //               has no data of who measured it). Throws SIN_MEDICIONES
    //               if there are none yet.
    // -----------------------------------------------------------------------
    async ultima(contaminante = CONTAMINANTE_POR_DEFECTO) {
        const [filas] = await this.conexion.execute(
            `${SELECT_MEDICION} WHERE c.nombre = ? ORDER BY m.fechaHora DESC, m.idMedicion DESC LIMIT 1`,
            [contaminante]);
        if (filas.length === 0) {
            throw this.error('SIN_MEDICIONES', 'Todavía no hay mediciones');
        }
        return aMedicion(filas[0]);
    }

    // codigo: Texto, mensaje: Texto, campos: Lista<Texto> --> error() --> ErrorLogica
    error(codigo, mensaje, campos) {
        const { ErrorLogica } = require('./Logica');
        return new ErrorLogica(codigo, mensaje, campos);
    }
}

module.exports = { Mediciones, leerFecha, VALOR_MAXIMO, CANTIDAD_MAXIMA };
