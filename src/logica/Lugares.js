// ---------------------------------------------------------------------------
// Fichero:     Lugares.js
// Descripción: Persistencia y consulta de los lugares habituales (T046).
//              Aísla cada operación por usuario y calcula el ozono actual
//              mediante interpolación inversa a la distancia con mediciones
//              recientes.
//              Usa las tablas Lugares, Mediciones y Contaminantes.
// ---------------------------------------------------------------------------
'use strict';

const TIPOS_LUGAR = ['casa', 'trabajo', 'colegio', 'otro'];
const MAX_LUGARES = 5;
const MAX_NOMBRE = 80;
const MAX_DIRECCION = 255;
const EDAD_MAXIMA_MEDICION_MS = 24 * 60 * 60 * 1000;
const RADIO_TIERRA_KM = 6371.0088;

function esNumero(valor) {
    return typeof valor === 'number' && Number.isFinite(valor);
}

function distanciaKm(lat1, lon1, lat2, lon2) {
    const radianes = grados => grados * Math.PI / 180;
    const dLat = radianes(lat2 - lat1);
    const dLon = radianes(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(radianes(lat1)) * Math.cos(radianes(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(Math.min(1, a)));
}

function interpolarOzono(latitud, longitud, mediciones) {
    if (mediciones.length === 0) {
        return null;
    }

    const puntos = mediciones.map((medicion) => ({
        ozono: Number(medicion.ozono),
        distancia: distanciaKm(latitud, longitud, Number(medicion.latitud), Number(medicion.longitud))
    }));
    const coincidentes = puntos.filter((punto) => punto.distancia < 0.001);
    if (coincidentes.length > 0) {
        const media = coincidentes.reduce((suma, punto) => suma + punto.ozono, 0) / coincidentes.length;
        return Number(media.toFixed(2));
    }

    let sumaPonderada = 0;
    let sumaPesos = 0;
    for (const punto of puntos) {
        const peso = 1 / (punto.distancia * punto.distancia);
        sumaPonderada += punto.ozono * peso;
        sumaPesos += peso;
    }
    return Number((sumaPonderada / sumaPesos).toFixed(2));
}

function aLugar(fila, ozonoActual) {
    const idLugar = Number(fila.idLugar);
    const direccion = fila.direccion;
    return {
        id: idLugar,
        idLugar,
        idUsuario: Number(fila.idUsuario),
        nombre: fila.nombre,
        tipo: fila.tipo,
        direccion,
        zona: direccion,
        latitud: Number(fila.latitud),
        longitud: Number(fila.longitud),
        avisosActivos: Boolean(fila.avisosActivos),
        ozonoActual,
        ozono: ozonoActual
    };
}

class Lugares {
    constructor(logica) {
        this.logica = logica;
    }

    get conexion() {
        return this.logica.conexion;
    }

    error(codigo, mensaje, campos = []) {
        const { ErrorLogica } = require('./Logica');
        return new ErrorLogica(codigo, mensaje, campos);
    }

    validarId(idLugar) {
        const id = Number(idLugar);
        if (!Number.isInteger(id) || id < 1) {
            throw this.error('DATOS_NO_VALIDOS', 'El identificador del lugar no es válido', ['idLugar']);
        }
        return id;
    }

    validar(datos) {
        const campos = [];
        if (typeof datos.nombre !== 'string' || datos.nombre.trim().length === 0
            || datos.nombre.trim().length > MAX_NOMBRE) {
            campos.push('nombre');
        }
        if (typeof datos.tipo !== 'string' || !TIPOS_LUGAR.includes(datos.tipo.trim().toLowerCase())) {
            campos.push('tipo');
        }
        if (typeof datos.direccion !== 'string' || datos.direccion.trim().length === 0
            || datos.direccion.trim().length > MAX_DIRECCION) {
            campos.push('direccion');
        }
        if (!esNumero(datos.latitud) || datos.latitud < -90 || datos.latitud > 90) {
            campos.push('latitud');
        }
        if (!esNumero(datos.longitud) || datos.longitud < -180 || datos.longitud > 180) {
            campos.push('longitud');
        }
        if (datos.avisosActivos !== undefined && typeof datos.avisosActivos !== 'boolean') {
            campos.push('avisosActivos');
        }
        if (campos.length > 0) {
            throw this.error('DATOS_NO_VALIDOS', 'Datos del lugar no válidos', campos);
        }
        return {
            nombre: datos.nombre.trim(),
            tipo: datos.tipo.trim().toLowerCase(),
            direccion: datos.direccion.trim(),
            latitud: datos.latitud,
            longitud: datos.longitud,
            avisosActivos: datos.avisosActivos === undefined ? true : datos.avisosActivos
        };
    }

    async listar(idUsuario, ahora = new Date()) {
        const [filas] = await this.conexion.execute(
            `SELECT idLugar, idUsuario, nombre, tipo, direccion, avisosActivos,
                    ST_Y(ubicacion) AS latitud, ST_X(ubicacion) AS longitud
               FROM Lugares
              WHERE idUsuario = ?
              ORDER BY idLugar`,
            [idUsuario]);
        if (filas.length === 0) {
            return [];
        }
        const mediciones = await this.medicionesRecientes(ahora);
        return filas.map((fila) => aLugar(fila,
            interpolarOzono(Number(fila.latitud), Number(fila.longitud), mediciones)));
    }

    async paraCuenta(idUsuario, ahora = new Date()) {
        const lugares = await this.listar(idUsuario, ahora);
        return lugares.map((lugar) => ({
            idLugar: lugar.idLugar,
            nombre: lugar.nombre,
            tipo: lugar.tipo,
            zona: lugar.zona,
            ozono: lugar.ozono
        }));
    }

    async crear(idUsuario, datos, ahora = new Date()) {
        const lugar = this.validar(datos || {});
        const conexion = await this.conexion.getConnection();
        let transaccionIniciada = false;
        try {
            await conexion.beginTransaction();
            transaccionIniciada = true;
            const [usuarios] = await conexion.execute(
                'SELECT idUsuario FROM Usuarios WHERE idUsuario = ? FOR UPDATE',
                [idUsuario]);
            if (usuarios.length === 0) {
                throw this.error('DATOS_NO_VALIDOS', 'El usuario no existe', ['idUsuario']);
            }
            const [[cuenta]] = await conexion.execute(
                'SELECT COUNT(*) AS total FROM Lugares WHERE idUsuario = ?',
                [idUsuario]);
            if (Number(cuenta.total) >= MAX_LUGARES) {
                throw this.error('LIMITE_LUGARES', `No se pueden guardar más de ${MAX_LUGARES} lugares`);
            }

            const punto = `POINT(${lugar.longitud} ${lugar.latitud})`;
            const [resultado] = await conexion.execute(
                `INSERT INTO Lugares (idUsuario, nombre, tipo, direccion, ubicacion, avisosActivos)
                 VALUES (?, ?, ?, ?, ST_GeomFromText(?), ?)`,
                [idUsuario, lugar.nombre, lugar.tipo, lugar.direccion, punto, lugar.avisosActivos]);
            await conexion.commit();
            transaccionIniciada = false;
            return this.obtener(idUsuario, resultado.insertId, ahora);
        } catch (error) {
            if (transaccionIniciada) await conexion.rollback();
            throw error;
        } finally {
            conexion.release();
        }
    }

    async actualizar(idUsuario, idLugar, cambios, ahora = new Date()) {
        const id = this.validarId(idLugar);
        if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) {
            throw this.error('DATOS_NO_VALIDOS', 'Datos del lugar no válidos', ['lugar']);
        }
        const permitidos = ['nombre', 'tipo', 'direccion', 'latitud', 'longitud', 'avisosActivos'];
        const desconocidos = Object.keys(cambios).filter((campo) => !permitidos.includes(campo));
        if (desconocidos.length > 0 || Object.keys(cambios).length === 0) {
            throw this.error('DATOS_NO_VALIDOS', 'Datos del lugar no válidos',
                desconocidos.length > 0 ? desconocidos : ['lugar']);
        }

        const [filas] = await this.conexion.execute(
            `SELECT idLugar, nombre, tipo, direccion, avisosActivos,
                    ST_Y(ubicacion) AS latitud, ST_X(ubicacion) AS longitud
               FROM Lugares WHERE idLugar = ? AND idUsuario = ?`,
            [id, idUsuario]);
        if (filas.length === 0) {
            throw this.error('LUGAR_NO_EXISTE', 'El lugar no existe');
        }
        const actual = filas[0];
        const lugar = this.validar({
            nombre: cambios.nombre === undefined ? actual.nombre : cambios.nombre,
            tipo: cambios.tipo === undefined ? actual.tipo : cambios.tipo,
            direccion: cambios.direccion === undefined ? actual.direccion : cambios.direccion,
            latitud: cambios.latitud === undefined ? Number(actual.latitud) : cambios.latitud,
            longitud: cambios.longitud === undefined ? Number(actual.longitud) : cambios.longitud,
            avisosActivos: cambios.avisosActivos === undefined
                ? Boolean(actual.avisosActivos) : cambios.avisosActivos
        });
        const punto = `POINT(${lugar.longitud} ${lugar.latitud})`;
        const [resultado] = await this.conexion.execute(
            `UPDATE Lugares
                SET nombre = ?, tipo = ?, direccion = ?, ubicacion = ST_GeomFromText(?), avisosActivos = ?
              WHERE idLugar = ? AND idUsuario = ?`,
            [lugar.nombre, lugar.tipo, lugar.direccion, punto, lugar.avisosActivos, id, idUsuario]);
        if (resultado.affectedRows === 0) {
            throw this.error('LUGAR_NO_EXISTE', 'El lugar no existe');
        }
        return this.obtener(idUsuario, id, ahora);
    }

    async eliminar(idUsuario, idLugar) {
        const id = this.validarId(idLugar);
        const [resultado] = await this.conexion.execute(
            'DELETE FROM Lugares WHERE idLugar = ? AND idUsuario = ?',
            [id, idUsuario]);
        if (resultado.affectedRows === 0) {
            throw this.error('LUGAR_NO_EXISTE', 'El lugar no existe');
        }
        return { idLugar: id };
    }

    async obtener(idUsuario, idLugar, ahora = new Date()) {
        const lugares = await this.listar(idUsuario, ahora);
        const lugar = lugares.find((actual) => actual.idLugar === Number(idLugar));
        if (!lugar) {
            throw this.error('LUGAR_NO_EXISTE', 'El lugar no existe');
        }
        return lugar;
    }

    async medicionesRecientes(ahora = new Date()) {
        const desde = new Date(ahora.getTime() - EDAD_MAXIMA_MEDICION_MS);
        const [filas] = await this.conexion.execute(
            `SELECT m.idSensor, m.valorMedicion AS ozono,
                    ST_Y(m.ubicacion) AS latitud, ST_X(m.ubicacion) AS longitud,
                    m.fechaHora, m.idMedicion
               FROM Mediciones m
               JOIN Contaminantes c ON c.idContaminante = m.idContaminante
              WHERE UPPER(c.nombre) IN ('O3', 'OZONO')
                AND m.fechaHora >= ? AND m.fechaHora <= ?
                AND NOT EXISTS (
                    SELECT 1 FROM Mediciones m2
                     WHERE m2.idSensor = m.idSensor
                       AND m2.idContaminante = m.idContaminante
                       AND m2.fechaHora >= ? AND m2.fechaHora <= ?
                       AND (m2.fechaHora > m.fechaHora
                            OR (m2.fechaHora = m.fechaHora AND m2.idMedicion > m.idMedicion))
                )
              ORDER BY m.fechaHora DESC, m.idMedicion DESC`,
            [desde, ahora, desde, ahora]);

        const porSensor = new Map();
        for (const fila of filas) {
            if (!porSensor.has(Number(fila.idSensor))) {
                porSensor.set(Number(fila.idSensor), {
                    ozono: Number(fila.ozono),
                    latitud: Number(fila.latitud),
                    longitud: Number(fila.longitud)
                });
            }
        }
        return [...porSensor.values()];
    }
}

module.exports = { Lugares, TIPOS_LUGAR, MAX_LUGARES, interpolarOzono, distanciaKm };
