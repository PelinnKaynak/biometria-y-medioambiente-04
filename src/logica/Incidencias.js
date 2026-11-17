// ---------------------------------------------------------------------------
// Fichero:     Incidencias.js
// Descripción: Lógica de las incidencias (T041): el usuario las envía desde
//              Ayuda (app y web) y ve sus respuestas; los técnicos y los
//              administradores las listan con filtros, las responden y
//              cambian su estado. Al responder se manda un correo al usuario.
//              Usa la tabla Incidencias de src/bd/usuarios.sql.
//              Diseño en doc/logica_design.md. Tarea T041 · H038, H039.
// Autores:     Equipo 04 – SenseTech
// Fecha:       17/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const { crearCorreoRespuestaIncidencia } = require('./CorreoRespuestaIncidencia');

// Valores del diagrama de la BD (Figma)
const TIPOS = ['sensor', 'datos', 'cuenta', 'otra'];
const ESTADOS = ['abierta', 'en curso', 'resuelta'];
const ESTADO_INICIAL = 'abierta';
const TIPOS_CON_SENSOR = ['sensor', 'datos'];   // si no se indica, se pone el sensor del usuario
const LARGO_MAXIMO_TEXTO = 2000;                 // descripción y respuesta

// Columnas que se devuelven (con el número de serie del sensor)
const SELECT_INCIDENCIA = `
    SELECT i.idIncidencia, i.idUsuario, i.idSensor, i.tipo, i.descripcion, i.estado,
           i.respuesta, i.fechaCreacion, i.fechaRespuesta, s.numeroSerie
      FROM Incidencias i LEFT JOIN Sensores s ON s.idSensor = i.idSensor`;

// Para los técnicos: además, quién la envió y el estado del sensor
const SELECT_INCIDENCIA_GESTION = `
    SELECT i.idIncidencia, i.idUsuario, i.idSensor, i.tipo, i.descripcion, i.estado,
           i.respuesta, i.fechaCreacion, i.fechaRespuesta,
           u.nombre, u.apellidos, u.email,
           s.numeroSerie, s.nombre AS nombreSensor, s.estado AS estadoSensor, s.bateria,
           s.ultimaConexion, s.necesitaCalibracion
      FROM Incidencias i
      JOIN Usuarios u ON u.idUsuario = i.idUsuario
      LEFT JOIN Sensores s ON s.idSensor = i.idSensor`;

// ---------------------------------------------------------------------------
// texto: Texto --> esTextoValido() --> V/F
// What it does: true if it is text that is not empty (without the spaces at
//               the ends) and not longer than LARGO_MAXIMO_TEXTO.
// ---------------------------------------------------------------------------
function esTextoValido(texto) {
    return typeof texto === 'string' && texto.trim().length > 0 && texto.trim().length <= LARGO_MAXIMO_TEXTO;
}

// ---------------------------------------------------------------------------
// fila: FilaBD --> aIncidencia() --> Incidencia
// Incidencia = { idIncidencia, tipo, descripcion, estado, respuesta,
//                fechaCreacion, fechaRespuesta, sensor: { idSensor, numeroSerie } | null }
// ---------------------------------------------------------------------------
function aIncidencia(fila) {
    return {
        idIncidencia: fila.idIncidencia,
        tipo: fila.tipo,
        descripcion: fila.descripcion,
        estado: fila.estado,
        respuesta: fila.respuesta,
        fechaCreacion: fila.fechaCreacion,
        fechaRespuesta: fila.fechaRespuesta,
        sensor: fila.idSensor === null ? null : { idSensor: fila.idSensor, numeroSerie: fila.numeroSerie }
    };
}

// ---------------------------------------------------------------------------
// fila: FilaBD --> aIncidenciaGestion() --> IncidenciaGestion
// IncidenciaGestion = Incidencia + usuario: { idUsuario, nombre, apellidos, correo }
//                     y en sensor también { nombre, estado, bateria, ultimaConexion, necesitaCalibracion }
// ---------------------------------------------------------------------------
function aIncidenciaGestion(fila) {
    const incidencia = aIncidencia(fila);
    incidencia.usuario = { idUsuario: fila.idUsuario, nombre: fila.nombre, apellidos: fila.apellidos, correo: fila.email };
    if (incidencia.sensor) {
        Object.assign(incidencia.sensor, {
            nombre: fila.nombreSensor, estado: fila.estadoSensor, bateria: fila.bateria,
            ultimaConexion: fila.ultimaConexion, necesitaCalibracion: Boolean(fila.necesitaCalibracion)
        });
    }
    return incidencia;
}

// ---------------------------------------------------------------------------
// Incidencias class: users send them; technicians and administrators answer them.
// ---------------------------------------------------------------------------
class Incidencias {

    // -----------------------------------------------------------------------
    // logica: Logica --> constructor()
    // What it does: uses the BD connection and the e-mail function of logica.
    // -----------------------------------------------------------------------
    constructor(logica) {
        this.logica = logica;
    }

    get conexion() {
        return this.logica.conexion;
    }

    // -----------------------------------------------------------------------
    // idUsuario: N, tipo: Texto, descripcion: Texto, idSensor: N (opcional)
    //     --> crear() --> Incidencia
    // What it does: saves a new incidence «abierta». idSensor has to be a
    //               sensor of the user; if it is not given and the tipo is
    //               «sensor» or «datos», the user's sensor is used (NULL if
    //               he has none). Throws DATOS_NO_VALIDOS with the wrong fields.
    // -----------------------------------------------------------------------
    async crear(idUsuario, tipo, descripcion, idSensor) {
        const erroneos = [];
        if (!TIPOS.includes(tipo)) erroneos.push('tipo');
        if (!esTextoValido(descripcion)) erroneos.push('descripcion');
        const conSensor = idSensor !== undefined && idSensor !== null;
        if (conSensor && !Number.isInteger(idSensor)) erroneos.push('idSensor');
        if (erroneos.length > 0) {
            throw this.error('DATOS_NO_VALIDOS', 'Datos de la incidencia no válidos', erroneos);
        }

        let sensor = null;
        if (conSensor) {
            const [filas] = await this.conexion.execute(
                'SELECT idSensor FROM Sensores WHERE idSensor = ? AND idUsuario = ?', [idSensor, idUsuario]);
            if (filas.length !== 1) {
                throw this.error('DATOS_NO_VALIDOS', 'Ese sensor no es tuyo', ['idSensor']);
            }
            sensor = idSensor;
        } else if (TIPOS_CON_SENSOR.includes(tipo)) {
            const [filas] = await this.conexion.execute(
                'SELECT idSensor FROM Sensores WHERE idUsuario = ? ORDER BY idSensor LIMIT 1', [idUsuario]);
            sensor = filas.length === 1 ? filas[0].idSensor : null;
        }

        const [resultado] = await this.conexion.execute(
            'INSERT INTO Incidencias (idUsuario, idSensor, tipo, descripcion, estado) VALUES (?, ?, ?, ?, ?)',
            [idUsuario, sensor, tipo, descripcion.trim(), ESTADO_INICIAL]);
        const [filas] = await this.conexion.execute(`${SELECT_INCIDENCIA} WHERE i.idIncidencia = ?`,
            [resultado.insertId]);
        return aIncidencia(filas[0]);
    }

    // -----------------------------------------------------------------------
    // idUsuario: N --> listarDeUsuario() --> Lista<Incidencia>
    // What it does: the user's incidences with their answers, newest first.
    // -----------------------------------------------------------------------
    async listarDeUsuario(idUsuario) {
        const [filas] = await this.conexion.execute(
            `${SELECT_INCIDENCIA} WHERE i.idUsuario = ? ORDER BY i.fechaCreacion DESC, i.idIncidencia DESC`,
            [idUsuario]);
        return filas.map(aIncidencia);
    }

    // -----------------------------------------------------------------------
    // filtros: { estado: Texto (opcional), tipo: Texto (opcional) }
    //     --> listar() --> Lista<IncidenciaGestion>
    // What it does: all the incidences (for technicians and administrators),
    //               newest first, only those of that estado and/or tipo if
    //               given. Throws DATOS_NO_VALIDOS if a filter is not valid.
    // -----------------------------------------------------------------------
    async listar(filtros = {}) {
        const { estado, tipo } = filtros;
        const erroneos = [];
        if (estado !== undefined && !ESTADOS.includes(estado)) erroneos.push('estado');
        if (tipo !== undefined && !TIPOS.includes(tipo)) erroneos.push('tipo');
        if (erroneos.length > 0) {
            throw this.error('DATOS_NO_VALIDOS', 'Filtro no válido', erroneos);
        }
        const condiciones = [];
        const valores = [];
        if (estado !== undefined) { condiciones.push('i.estado = ?'); valores.push(estado); }
        if (tipo !== undefined) { condiciones.push('i.tipo = ?'); valores.push(tipo); }
        const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
        const [filas] = await this.conexion.execute(
            `${SELECT_INCIDENCIA_GESTION} ${donde} ORDER BY i.fechaCreacion DESC, i.idIncidencia DESC`, valores);
        return filas.map(aIncidenciaGestion);
    }

    // -----------------------------------------------------------------------
    // idIncidencia: N --> obtener() --> IncidenciaGestion
    // What it does: one incidence with the user's and the sensor's data.
    //               Throws INCIDENCIA_NO_EXISTE.
    // -----------------------------------------------------------------------
    async obtener(idIncidencia) {
        const [filas] = Number.isInteger(idIncidencia)
            ? await this.conexion.execute(`${SELECT_INCIDENCIA_GESTION} WHERE i.idIncidencia = ?`, [idIncidencia])
            : [[]];
        if (filas.length !== 1) {
            throw this.error('INCIDENCIA_NO_EXISTE', 'Esa incidencia no existe');
        }
        return aIncidenciaGestion(filas[0]);
    }

    // -----------------------------------------------------------------------
    // --> contarAbiertas() --> N
    // What it does: how many incidences are «abierta» (number in the panel menu).
    // -----------------------------------------------------------------------
    async contarAbiertas() {
        const [filas] = await this.conexion.execute(
            'SELECT COUNT(*) AS abiertas FROM Incidencias WHERE estado = ?', [ESTADO_INICIAL]);
        return Number(filas[0].abiertas);
    }

    // -----------------------------------------------------------------------
    // idIncidencia: N, cambios: { respuesta: Texto (opcional), estado: Texto (opcional) }
    //     --> responder() --> IncidenciaGestion
    // What it does: saves the answer (with its date) and/or the new estado.
    //               If there is an answer and no estado, it becomes «resuelta».
    //               When there is an answer, the user gets an e-mail with it
    //               (a failure is only written in the console). Throws
    //               DATOS_NO_VALIDOS or INCIDENCIA_NO_EXISTE.
    // -----------------------------------------------------------------------
    async responder(idIncidencia, cambios = {}) {
        const { respuesta, estado } = cambios;
        const conRespuesta = respuesta !== undefined && respuesta !== null;
        const erroneos = [];
        if (conRespuesta && !esTextoValido(respuesta)) erroneos.push('respuesta');
        if (estado !== undefined && !ESTADOS.includes(estado)) erroneos.push('estado');
        if (!conRespuesta && estado === undefined) erroneos.push('respuesta', 'estado');
        if (erroneos.length > 0) {
            throw this.error('DATOS_NO_VALIDOS', 'Hay que enviar una respuesta o un estado válidos', erroneos);
        }
        const antes = await this.obtener(idIncidencia);

        if (conRespuesta) {
            await this.conexion.execute(
                'UPDATE Incidencias SET respuesta = ?, fechaRespuesta = ?, estado = ? WHERE idIncidencia = ?',
                [respuesta.trim(), this.logica.ahoraEnSegundos(), estado || 'resuelta', idIncidencia]);
        } else {
            await this.conexion.execute('UPDATE Incidencias SET estado = ? WHERE idIncidencia = ?',
                [estado, idIncidencia]);
        }
        const despues = await this.obtener(idIncidencia);
        if (conRespuesta) {
            await this.enviarRespuesta(despues, antes.usuario);
        }
        return despues;
    }

    // -----------------------------------------------------------------------
    // incidencia: IncidenciaGestion, usuario: { nombre, correo } --> enviarRespuesta() -->
    // What it does: e-mails the answer to the user who sent the incidence.
    //               A failure is only written in the console.
    // -----------------------------------------------------------------------
    async enviarRespuesta(incidencia, usuario) {
        const mensaje = crearCorreoRespuestaIncidencia({
            nombre: usuario.nombre, tipo: incidencia.tipo, descripcion: incidencia.descripcion,
            respuesta: incidencia.respuesta, estado: incidencia.estado,
            fecha: incidencia.fechaCreacion, idIncidencia: incidencia.idIncidencia
        });
        try {
            await this.logica.enviarCorreo(usuario.correo, mensaje.asunto, mensaje.texto,
                { html: mensaje.html, adjuntos: mensaje.adjuntos });
        } catch (error) {
            console.error(`No se ha podido enviar la respuesta de la incidencia a ${usuario.correo}:`, error.message);
        }
    }

    // codigo: Texto, mensaje: Texto, campos: Lista<Texto> --> error() --> ErrorLogica
    error(codigo, mensaje, campos) {
        const { ErrorLogica } = require('./Logica');
        return new ErrorLogica(codigo, mensaje, campos);
    }
}

module.exports = { Incidencias, TIPOS_INCIDENCIA: TIPOS, ESTADOS_INCIDENCIA: ESTADOS };
