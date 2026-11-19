// ---------------------------------------------------------------------------
// Fichero:     Incidencias.js
// Descripción: Lógica de las incidencias (T041): el usuario las envía desde
//              Ayuda (app y web) y ve sus respuestas; los técnicos y los
//              administradores las listan con filtros, las responden y
//              cambian su estado. Al responder se guarda quién respondió y se
//              manda un correo al usuario.
//              Cada incidencia tiene además una conversación (T043): el usuario
//              y el equipo se escriben mensajes (tabla MensajesIncidencia).
//              Usa las tablas Incidencias y MensajesIncidencia de src/bd/usuarios.sql.
//              Diseño en doc/logica_design.md. Tareas T041 · H038, H039 y T043.
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
const LARGO_MAXIMO_ASUNTO = 120;

// Columnas que se devuelven (con el número de serie del sensor y quién respondió)
const SELECT_INCIDENCIA = `
    SELECT i.idIncidencia, i.idUsuario, i.idSensor, i.tipo, i.asunto, i.descripcion, i.estado,
           i.respuesta, i.idResponsable, i.fechaCreacion, i.fechaRespuesta, s.numeroSerie,
           r.nombre AS nombreResponsable, CASE
           WHEN r.idUsuario IS NULL THEN NULL
           WHEN r.esAdministrador = TRUE THEN 'administrador'
           WHEN r.esTecnico = TRUE THEN 'tecnico'
           WHEN r.esPortador = TRUE THEN 'portador' ELSE 'ciudadano' END AS rolResponsable
      FROM Incidencias i
      LEFT JOIN Sensores s ON s.idSensor = i.idSensor
      LEFT JOIN Usuarios r ON r.idUsuario = i.idResponsable`;

// Para los técnicos: además, quién la envió y el estado del sensor
const SELECT_INCIDENCIA_GESTION = `
    SELECT i.idIncidencia, i.idUsuario, i.idSensor, i.tipo, i.asunto, i.descripcion, i.estado,
           i.respuesta, i.idResponsable, i.fechaCreacion, i.fechaRespuesta,
           u.nombre, u.apellidos, u.email,
           s.numeroSerie, s.nombre AS nombreSensor, s.estado AS estadoSensor, s.bateria,
           s.ultimaConexion, s.necesitaCalibracion,
           r.nombre AS nombreResponsable, CASE
           WHEN r.idUsuario IS NULL THEN NULL
           WHEN r.esAdministrador = TRUE THEN 'administrador'
           WHEN r.esTecnico = TRUE THEN 'tecnico'
           WHEN r.esPortador = TRUE THEN 'portador' ELSE 'ciudadano' END AS rolResponsable
      FROM Incidencias i
      JOIN Usuarios u ON u.idUsuario = i.idUsuario
      LEFT JOIN Sensores s ON s.idSensor = i.idSensor
      LEFT JOIN Usuarios r ON r.idUsuario = i.idResponsable`;

// ---------------------------------------------------------------------------
// texto: Texto, largoMaximo: N (opcional) --> esTextoValido() --> V/F
// What it does: true if it is text that is not empty (without the spaces at
//               the ends) and not longer than largoMaximo (LARGO_MAXIMO_TEXTO
//               if not given).
// ---------------------------------------------------------------------------
function esTextoValido(texto, largoMaximo = LARGO_MAXIMO_TEXTO) {
    return typeof texto === 'string' && texto.trim().length > 0 && texto.trim().length <= largoMaximo;
}

// ---------------------------------------------------------------------------
// fila: FilaBD --> aIncidencia() --> Incidencia
// Incidencia = { idIncidencia, tipo, asunto, descripcion, estado, respuesta,
//                responsable: { nombre, rol } | null, fechaCreacion, fechaRespuesta,
//                sensor: { idSensor, numeroSerie } | null }
// responsable es quien respondió (para «Respuesta de Marc (técnico)»).
// ---------------------------------------------------------------------------
function aIncidencia(fila) {
    return {
        idIncidencia: fila.idIncidencia,
        tipo: fila.tipo,
        asunto: fila.asunto,
        descripcion: fila.descripcion,
        estado: fila.estado,
        respuesta: fila.respuesta,
        responsable: fila.idResponsable === null ? null
            : { nombre: fila.nombreResponsable, rol: fila.rolResponsable },
        fechaCreacion: fila.fechaCreacion,
        fechaRespuesta: fila.fechaRespuesta,
        sensor: fila.idSensor === null ? null : { idSensor: fila.idSensor, numeroSerie: fila.numeroSerie }
    };
}

// ---------------------------------------------------------------------------
// fila: FilaBD --> aIncidenciaGestion() --> IncidenciaGestion
// IncidenciaGestion = Incidencia + usuario: { idUsuario, nombre, apellidos, correo },
//                     en responsable también idUsuario, y en sensor también { nombre, estado, bateria, ultimaConexion, necesitaCalibracion }
// ---------------------------------------------------------------------------
function aIncidenciaGestion(fila) {
    const incidencia = aIncidencia(fila);
    incidencia.usuario = { idUsuario: fila.idUsuario, nombre: fila.nombre, apellidos: fila.apellidos, correo: fila.email };
    if (incidencia.responsable) {
        incidencia.responsable.idUsuario = fila.idResponsable;
    }
    if (incidencia.sensor) {
        Object.assign(incidencia.sensor, {
            nombre: fila.nombreSensor, estado: fila.estadoSensor, bateria: fila.bateria,
            ultimaConexion: fila.ultimaConexion, necesitaCalibracion: Boolean(fila.necesitaCalibracion)
        });
    }
    return incidencia;
}

// Los mensajes de la conversación (T043), con el nombre y el rol de quien los escribió
const SELECT_MENSAJE = `
    SELECT m.idMensaje, m.idIncidencia, m.idAutor, m.texto, m.fecha, i.idUsuario AS idDuenyo,
           a.nombre AS nombreAutor, CASE
           WHEN a.idUsuario IS NULL THEN NULL
           WHEN a.esAdministrador = TRUE THEN 'administrador'
           WHEN a.esTecnico = TRUE THEN 'tecnico'
           WHEN a.esPortador = TRUE THEN 'portador' ELSE 'ciudadano' END AS rolAutor
      FROM MensajesIncidencia m
      JOIN Incidencias i ON i.idIncidencia = m.idIncidencia
      LEFT JOIN Usuarios a ON a.idUsuario = m.idAutor`;

// ---------------------------------------------------------------------------
// fila: FilaBD --> aMensaje() --> Mensaje
// Mensaje = { idMensaje, idIncidencia, texto, fecha,
//             autor: { idUsuario, nombre, rol } | null, delUsuario: V/F }
// autor es null si su cuenta se borró. delUsuario es V si lo escribió quien envió
// la incidencia (en la app: «Tú»); F si lo escribió el equipo.
// ---------------------------------------------------------------------------
function aMensaje(fila) {
    return {
        idMensaje: fila.idMensaje,
        idIncidencia: fila.idIncidencia,
        texto: fila.texto,
        fecha: fila.fecha,
        autor: fila.idAutor === null ? null
            : { idUsuario: fila.idAutor, nombre: fila.nombreAutor, rol: fila.rolAutor },
        delUsuario: fila.idAutor !== null && fila.idAutor === fila.idDuenyo
    };
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
    // idUsuario: N, tipo: Texto, asunto: Texto, descripcion: Texto, idSensor: N (opcional)
    //     --> crear() --> Incidencia
    // What it does: saves a new incidence «abierta». idSensor has to be a
    //               sensor of the user; if it is not given and the tipo is
    //               «sensor» or «datos», the user's sensor is used (NULL if
    //               he has none). Throws DATOS_NO_VALIDOS with the wrong fields.
    // -----------------------------------------------------------------------
    async crear(idUsuario, tipo, asunto, descripcion, idSensor) {
        const erroneos = [];
        if (!TIPOS.includes(tipo)) erroneos.push('tipo');
        if (!esTextoValido(asunto, LARGO_MAXIMO_ASUNTO)) erroneos.push('asunto');
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
            'INSERT INTO Incidencias (idUsuario, idSensor, tipo, asunto, descripcion, estado) VALUES (?, ?, ?, ?, ?, ?)',
            [idUsuario, sensor, tipo, asunto.trim(), descripcion.trim(), ESTADO_INICIAL]);
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
    // idIncidencia: N, cambios: { respuesta: Texto (opcional), estado: Texto (opcional) },
    // idResponsable: N --> responder() --> IncidenciaGestion
    // What it does: saves the answer (with its date and who answered, the
    //               technician or administrator idResponsable) and/or the new estado.
    //               If there is an answer and no estado, it becomes «resuelta».
    //               The answer is also added to the conversation of the incidence
    //               (T043). When there is an answer, the user gets ONE e-mail with
    //               it (a failure is only written in the console). Throws
    //               DATOS_NO_VALIDOS or INCIDENCIA_NO_EXISTE.
    // -----------------------------------------------------------------------
    async responder(idIncidencia, cambios = {}, idResponsable = null) {
        return (await this.responderConMensaje(idIncidencia, cambios, idResponsable)).incidencia;
    }

    // -----------------------------------------------------------------------
    // idIncidencia: N, cambios: { respuesta?, estado? }, idResponsable: N
    //     --> responderConMensaje() --> { incidencia: IncidenciaGestion, idMensaje: N | null }
    // What it does: the same as responder(), and also says the id of the message
    //               that the answer added to the conversation (null if there was
    //               only a change of estado). It is the ONLY way the answer of
    //               the team is saved and e-mailed, so it is never e-mailed twice.
    // -----------------------------------------------------------------------
    async responderConMensaje(idIncidencia, cambios = {}, idResponsable = null) {
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

        let idMensaje = null;
        if (conRespuesta) {
            idMensaje = await this.guardarRespuesta(idIncidencia, respuesta.trim(), estado || 'resuelta', idResponsable);
        } else {
            await this.conexion.execute('UPDATE Incidencias SET estado = ? WHERE idIncidencia = ?',
                [estado, idIncidencia]);
        }
        const despues = await this.obtener(idIncidencia);
        if (conRespuesta) {
            await this.enviarRespuesta(despues, antes.usuario);
        }
        return { incidencia: despues, idMensaje };
    }

    // -----------------------------------------------------------------------
    // idIncidencia: N, texto: Texto, estado: Texto, idResponsable: N | null
    //     --> guardarRespuesta() --> N                                   (privado)
    // What it does: in ONE transaction, saves the last answer of the team in the
    //               incidence (respuesta, idResponsable, fechaRespuesta and estado:
    //               what the web keeps showing) and adds it as a message of the
    //               conversation. Returns the id of the message.
    // -----------------------------------------------------------------------
    async guardarRespuesta(idIncidencia, texto, estado, idResponsable) {
        const fecha = this.logica.ahoraEnSegundos();
        const conexion = await this.conexion.getConnection();
        let transaccionIniciada = false;
        try {
            await conexion.beginTransaction();
            transaccionIniciada = true;
            await conexion.execute(
                'UPDATE Incidencias SET respuesta = ?, idResponsable = ?, fechaRespuesta = ?, estado = ? WHERE idIncidencia = ?',
                [texto, idResponsable, fecha, estado, idIncidencia]);
            const [resultado] = await conexion.execute(
                'INSERT INTO MensajesIncidencia (idIncidencia, idAutor, texto, fecha) VALUES (?, ?, ?, ?)',
                [idIncidencia, idResponsable, texto, fecha]);
            await conexion.commit();
            transaccionIniciada = false;
            return resultado.insertId;
        } catch (error) {
            if (transaccionIniciada) await conexion.rollback();
            throw error;
        } finally {
            conexion.release();
        }
    }

    // -----------------------------------------------------------------------
    // idIncidencia: N, idUsuario: N --> listarMensajes() --> Lista<Mensaje>
    // What it does: the conversation of an incidence, oldest first (the
    //               description of the incidence is the first message and is not
    //               repeated). Only the user who sent it, technicians and
    //               administrators can read it: for anybody else (or if it does not
    //               exist) it throws INCIDENCIA_NO_EXISTE, so nobody can find out
    //               which incidences exist.
    // -----------------------------------------------------------------------
    async listarMensajes(idIncidencia, idUsuario) {
        await this.comprobarAcceso(idIncidencia, idUsuario);
        const [filas] = await this.conexion.execute(
            `${SELECT_MENSAJE} WHERE m.idIncidencia = ? ORDER BY m.fecha, m.idMensaje`, [idIncidencia]);
        return filas.map(aMensaje);
    }

    // -----------------------------------------------------------------------
    // idIncidencia: N, idAutor: N, texto: Texto, estado: Texto (opcional)
    //     --> enviarMensaje() --> Mensaje
    // What it does: adds a message to the conversation.
    //               - The user who sent the incidence: it is saved as his message and,
    //                 if the incidence was «resuelta», it is reopened as «abierta».
    //                 «estado» is ignored (only the team changes it).
    //               - A technician or administrator (who did not send it): it is the
    //                 answer of the team, exactly as responder() with a respuesta
    //                 (it also updates the last answer, the estado «resuelta» unless
    //                 another is given, and e-mails the user once).
    //               Throws DATOS_NO_VALIDOS (texto, estado) or INCIDENCIA_NO_EXISTE.
    // -----------------------------------------------------------------------
    async enviarMensaje(idIncidencia, idAutor, texto, estado) {
        const nuevoEstado = estado === null ? undefined : estado;
        const erroneos = [];
        if (!esTextoValido(texto)) erroneos.push('texto');
        if (nuevoEstado !== undefined && !ESTADOS.includes(nuevoEstado)) erroneos.push('estado');
        if (erroneos.length > 0) {
            throw this.error('DATOS_NO_VALIDOS', 'El mensaje no es válido', erroneos);
        }
        const acceso = await this.comprobarAcceso(idIncidencia, idAutor);

        let idMensaje;
        if (acceso.esDuenyo) {
            idMensaje = await this.guardarMensajeDelUsuario(idIncidencia, idAutor, texto.trim());
        } else {
            idMensaje = (await this.responderConMensaje(idIncidencia, { respuesta: texto, estado: nuevoEstado },
                idAutor)).idMensaje;
        }
        const [filas] = await this.conexion.execute(`${SELECT_MENSAJE} WHERE m.idMensaje = ?`, [idMensaje]);
        return aMensaje(filas[0]);
    }

    // -----------------------------------------------------------------------
    // idIncidencia: N, idAutor: N, texto: Texto --> guardarMensajeDelUsuario() --> N   (privado)
    // What it does: in ONE transaction, adds the message of the user and reopens
    //               the incidence if it was «resuelta». Returns the id of the message.
    // -----------------------------------------------------------------------
    async guardarMensajeDelUsuario(idIncidencia, idAutor, texto) {
        const fecha = this.logica.ahoraEnSegundos();
        const conexion = await this.conexion.getConnection();
        let transaccionIniciada = false;
        try {
            await conexion.beginTransaction();
            transaccionIniciada = true;
            const [resultado] = await conexion.execute(
                'INSERT INTO MensajesIncidencia (idIncidencia, idAutor, texto, fecha) VALUES (?, ?, ?, ?)',
                [idIncidencia, idAutor, texto, fecha]);
            await conexion.execute(
                'UPDATE Incidencias SET estado = ? WHERE idIncidencia = ? AND estado = ?',
                [ESTADO_INICIAL, idIncidencia, 'resuelta']);
            await conexion.commit();
            transaccionIniciada = false;
            return resultado.insertId;
        } catch (error) {
            if (transaccionIniciada) await conexion.rollback();
            throw error;
        } finally {
            conexion.release();
        }
    }

    // -----------------------------------------------------------------------
    // idIncidencia: N, idUsuario: N --> comprobarAcceso() --> { esDuenyo: V/F, esGestor: V/F }   (privado)
    // What it does: says if the user sent the incidence and/or is a technician or an
    //               administrator (read in the BD, not trusted from the caller). If
    //               the incidence does not exist, or the user is neither its owner
    //               nor of the team, it throws INCIDENCIA_NO_EXISTE.
    // -----------------------------------------------------------------------
    async comprobarAcceso(idIncidencia, idUsuario) {
        const [filas] = Number.isInteger(idIncidencia)
            ? await this.conexion.execute(
                `SELECT i.idUsuario AS idDuenyo, u.esAdministrador, u.esTecnico
                   FROM Incidencias i JOIN Usuarios u ON u.idUsuario = ?
                  WHERE i.idIncidencia = ?`, [idUsuario, idIncidencia])
            : [[]];
        if (filas.length !== 1) {
            throw this.error('INCIDENCIA_NO_EXISTE', 'Esa incidencia no existe');
        }
        const esDuenyo = filas[0].idDuenyo === idUsuario;
        const esGestor = Boolean(filas[0].esAdministrador) || Boolean(filas[0].esTecnico);
        if (!esDuenyo && !esGestor) {
            throw this.error('INCIDENCIA_NO_EXISTE', 'Esa incidencia no existe');
        }
        return { esDuenyo, esGestor };
    }

    // -----------------------------------------------------------------------
    // incidencia: IncidenciaGestion, usuario: { nombre, correo } --> enviarRespuesta() -->
    // What it does: e-mails the answer to the user who sent the incidence.
    //               A failure is only written in the console.
    // -----------------------------------------------------------------------
    async enviarRespuesta(incidencia, usuario) {
        const mensaje = crearCorreoRespuestaIncidencia({
            nombre: usuario.nombre, tipo: incidencia.tipo, asunto: incidencia.asunto,
            descripcion: incidencia.descripcion, respuesta: incidencia.respuesta,
            responsable: incidencia.responsable, estado: incidencia.estado,
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
