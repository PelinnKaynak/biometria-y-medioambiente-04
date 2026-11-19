'use strict';

const { UMBRAL_AVISO_POR_DEFECTO } = require('./MiCuenta');
const { interpolarOzono } = require('./Lugares');

const INTERVALO_ALERTA_PERSONAL_MS = 60 * 60 * 1000;

function debeAvisarPersonal({ usuario, medicion, ultimoEnvio, ahora }) {
    if (!usuario.alertas || medicion.contaminante !== 'O3') {
        return false;
    }

    const umbral = usuario.umbralAlerta === null
        ? UMBRAL_AVISO_POR_DEFECTO
        : Number(usuario.umbralAlerta);

    if (medicion.valor <= umbral) {
        return false;
    }

    return ultimoEnvio === null ||
        ahora.getTime() - ultimoEnvio.getTime() >= INTERVALO_ALERTA_PERSONAL_MS;
}

async function consultarAlertaPersonal(conexion, idUsuario, medicion, ahora) {
    const [[usuario]] = await conexion.execute(
        `SELECT u.alertas, u.umbralAlerta, e.ultimoEnvio
           FROM Usuarios u
           LEFT JOIN EstadoAlertaPersonal e ON e.idUsuario = u.idUsuario
          WHERE u.idUsuario = ?`,
        [idUsuario]
    );

    if (!usuario) {
        return false;
    }

    return debeAvisarPersonal({
        usuario,
        medicion,
        ultimoEnvio: usuario.ultimoEnvio,
        ahora
    });
}

async function reservarAlertaPersonal(pool, idUsuario, medicion, ahora = new Date()) {
    const conexion = await pool.getConnection();

    try {
        await conexion.beginTransaction();

        // Serializa las decisiones del mismo usuario, incluso en su primer aviso.
        await conexion.execute(
            'SELECT idUsuario FROM Usuarios WHERE idUsuario = ? FOR UPDATE',
            [idUsuario]
        );

        const corresponde = await consultarAlertaPersonal(conexion, idUsuario, medicion, ahora);

        if (corresponde) {
            await conexion.execute(
                `INSERT INTO EstadoAlertaPersonal (idUsuario, ultimoEnvio)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE ultimoEnvio = VALUES(ultimoEnvio)`,
                [idUsuario, ahora]
            );
        }

        await conexion.commit();
        return corresponde;
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

const INTERVALO_ALERTA_LUGAR_MS = 3 * 60 * 60 * 1000;

function nivelOzonoLugar(valor, { umbralMalo, umbralMuyMalo }) {
    if (valor === null) return null;
    if (valor >= umbralMuyMalo) return 'muy_malo';
    if (valor >= umbralMalo) return 'malo';
    return 'aceptable';
}

function debeAvisarLugar({ alertas, avisosActivos, nivelAnterior, nivelActual, ultimoEnvio, ahora }) {
    if (!alertas || !avisosActivos) return false;

    const pasaAMalo = nivelActual === 'malo' &&
        (nivelAnterior === null || nivelAnterior === 'aceptable');
    const pasaAMuyMalo = nivelActual === 'muy_malo' &&
        nivelAnterior !== 'muy_malo';

    if (!pasaAMalo && !pasaAMuyMalo) return false;

    return ultimoEnvio === null ||
        ahora.getTime() - ultimoEnvio.getTime() >= INTERVALO_ALERTA_LUGAR_MS;
}

async function reservarAlertaLugar(pool, idLugar, nivelActual, ahora = new Date()) {
    if (nivelActual === null) return false;

    const conexion = await pool.getConnection();

    try {
        await conexion.beginTransaction();

        const [[lugar]] = await conexion.execute(
            `SELECT l.avisosActivos, u.alertas,
            (u.premiumHasta > ?) AS premiumActivo
            FROM Lugares l
            JOIN Usuarios u ON u.idUsuario = l.idUsuario
            WHERE l.idLugar = ?
            FOR UPDATE`,
            [ahora, idLugar]
        );

        if (!lugar) {
            await conexion.rollback();
            return false;
        }

        const [[estado]] = await conexion.execute(
            `SELECT ultimoNivel, ultimoEnvio
               FROM EstadoAlertaLugar
              WHERE idLugar = ?`,
            [idLugar]
        );

        const ultimoEnvio = estado?.ultimoEnvio ?? null;
        const corresponde = debeAvisarLugar({
            alertas: lugar.alertas,
            avisosActivos: Boolean(lugar.avisosActivos) && Boolean(lugar.premiumActivo),
            nivelAnterior: estado?.ultimoNivel ?? null,
            nivelActual,
            ultimoEnvio,
            ahora
        });

        await conexion.execute(
            `INSERT INTO EstadoAlertaLugar (idLugar, ultimoNivel, ultimoEnvio)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 ultimoNivel = VALUES(ultimoNivel),
                 ultimoEnvio = VALUES(ultimoEnvio)`,
            [idLugar, nivelActual, corresponde ? ahora : ultimoEnvio]
        );

        await conexion.commit();
        return corresponde;
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

async function procesarAlertasDeLugares(logica, ahora = new Date()) {
    const pool = logica.conexion;
    const [[ozono]] = await pool.execute(
        `SELECT nombre, unidad, umbralMalo, umbralMuyMalo
           FROM Contaminantes WHERE nombre = ?`,
        ['O3']
    );
    if (!ozono || ozono.umbralMalo === null || ozono.umbralMuyMalo === null) return;

    const mediciones = await logica.lugares.medicionesRecientes(ahora);
    if (mediciones.length === 0) return;

    const [lugares] = await pool.execute(
        `SELECT idLugar, idUsuario, nombre, direccion,
                ST_Y(ubicacion) AS latitud, ST_X(ubicacion) AS longitud
           FROM Lugares
          ORDER BY idLugar`
    );

    for (const lugar of lugares) {
        try {
            const valor = interpolarOzono(lugar.latitud, lugar.longitud, mediciones);
            const nivel = nivelOzonoLugar(valor, ozono);

            if (await reservarAlertaLugar(pool, lugar.idLugar, nivel, ahora)) {
                await logica.notificarAlerta({
                    tipo: 'lugar',
                    idUsuario: lugar.idUsuario,
                    idLugar: lugar.idLugar,
                    contaminante: ozono.nombre,
                    valor,
                    unidad: ozono.unidad,
                    nivel,
                    zona: `${lugar.nombre} (${lugar.direccion})`
                });
            }
        } catch (error) {
            console.error(`Error al procesar la alerta del lugar ${lugar.idLugar}:`, error.message);
        }
    }
}
module.exports = { debeAvisarPersonal, consultarAlertaPersonal, reservarAlertaPersonal, nivelOzonoLugar, debeAvisarLugar, reservarAlertaLugar, procesarAlertasDeLugares };
