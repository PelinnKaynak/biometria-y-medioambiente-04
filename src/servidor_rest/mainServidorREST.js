// ---------------------------------------------------------------------------
// Fichero:     mainServidorREST.js
// Descripción: Programa principal del servidor REST. Lee la configuración de
//              .env, conecta la lógica con MySQL y escucha en el puerto 8080.
//              Uso:  npm start   (desde src/servidor_rest)
//              Diseño en doc/servidor_rest_design.md. Tarea T016.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

require('dotenv').config();

const { Logica } = require('../logica/Logica');
const { crearServidor } = require('./ServidorREST');
const { crearEnviadorCorreo } = require('./EnviadorCorreo');

// ---------------------------------------------------------------------------
// --> main() -->
// What it does: starts the REST server. Stops with a clear message if MySQL
//               is not running.
// ---------------------------------------------------------------------------
async function main() {
    const entorno = process.env;
    const puerto = Number(entorno.PORT || entorno.PUERTO || 8080);

    const enviarCorreo = crearEnviadorCorreo({
        host: entorno.SMTP_HOST,
        puerto: entorno.SMTP_PUERTO,
        usuario: entorno.SMTP_USUARIO,
        contrasenya: entorno.SMTP_CONTRASENYA,
        // Gmail solo deja enviar desde la propia cuenta: por defecto, el remitente es SMTP_USUARIO
        remitente: entorno.SMTP_REMITENTE
            || (entorno.SMTP_USUARIO ? `AERIS <${entorno.SMTP_USUARIO}>` : 'AERIS <no-responder@aeris.es>')
    });
    // Clave secreta que firma los tokens de sesión y de recuperación.
    // En producción hay que poner una propia y larga en .env (CLAVE_TOKENS).

    const claveTokens = entorno.CLAVE_TOKENS;

    if (!claveTokens || claveTokens.length < 32) {
        throw new Error(
            'CLAVE_TOKENS debe estar configurada y tener al menos 32 caracteres'
        );
    }


    let logica;
    try {
        logica = await Logica.crear({
                host: entorno.BD_HOST || '127.0.0.1',
                port: Number(entorno.BD_PUERTO || 3306),
                user: entorno.BD_USUARIO || 'root',
                password: entorno.BD_CONTRASENYA || '',
                database: entorno.BD_NOMBRE || 'aeris'
            }, enviarCorreo, entorno.URL_RESTABLECER || `http://localhost:${puerto}/restablecer.html`, claveTokens,
            // Enlaces del correo de vinculación (T005). Sin URL_VINCULACION se usa el mismo
            // servidor que URL_RESTABLECER (en la UPV: https://pfermar1.upv.edu.es/responderVinculacion)
            entorno.URL_VINCULACION);
    } catch (error) {
        console.error('No se puede conectar con MySQL. ¿Está MySQL en marcha en XAMPP y existe la BD aeris?');
        console.error(error.message);
        process.exit(1);
    }

    // Umbral de inactividad de los nodos (T022): UMBRAL_INACTIVO_HORAS en el
    // .env, de 1 a 168 horas; 24 si no está. Si no vale, se avisa y se usa 24.
    try {
        logica.nodos.cambiarUmbral(entorno.UMBRAL_INACTIVO_HORAS);
    } catch (error) {
        console.warn(`UMBRAL_INACTIVO_HORAS no vale (${entorno.UMBRAL_INACTIVO_HORAS}): ${error.message}. Se usan 24 horas.`);
    }
    console.log(`Un nodo pasa a inactivo tras ${logica.nodos.horasInactivo} h sin datos`);

    // Cada hora se marcan en Sensores.estado los nodos que han pasado a
    // inactivos, aunque nadie abra el panel (T022)
    const marcarInactivos = () => logica.nodos.marcarInactivos()
        .then((r) => { if (r.inactivos > 0) console.log(`${r.inactivos} nodo(s) han pasado a inactivos`); })
        .catch((error) => console.error('No se han podido marcar los nodos inactivos:', error.message));
    marcarInactivos();
    const temporizador = setInterval(marcarInactivos, 60 * 60 * 1000);

    const servidor = crearServidor(logica);
    const conexion = servidor.listen(puerto, '0.0.0.0', () => {
        console.log(`Servidor REST de AERIS escuchando en http://localhost:${puerto}`);
    });

    // Ctrl+C: cerrar el servidor y la conexión con la BD
    process.on('SIGINT', async () => {
        clearInterval(temporizador);
        conexion.close();
        await logica.cerrar();
        console.log('\nServidor detenido');
        process.exit(0);
    });
}

main();