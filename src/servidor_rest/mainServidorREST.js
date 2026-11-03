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
    const puerto = Number(entorno.PUERTO || 8080);

    const enviarCorreo = crearEnviadorCorreo({
        host: entorno.SMTP_HOST,
        puerto: entorno.SMTP_PUERTO,
        usuario: entorno.SMTP_USUARIO,
        contrasenya: entorno.SMTP_CONTRASENYA,
        remitente: entorno.SMTP_REMITENTE || 'AERIS <no-responder@aeris.es>'
    });

    // Clave secreta que firma los tokens de sesión y de recuperación.
    // En producción hay que poner una propia y larga en .env (CLAVE_TOKENS).
    let claveTokens = entorno.CLAVE_TOKENS;
    if (!claveTokens) {
        claveTokens = 'clave-de-desarrollo-aeris-cambiar-en-produccion';
        console.warn('Aviso: falta CLAVE_TOKENS en .env; se usa una clave de desarrollo.');
    }

    let logica;
    try {
        logica = await Logica.crear({
            host: entorno.BD_HOST || '127.0.0.1',
            port: Number(entorno.BD_PUERTO || 3306),
            user: entorno.BD_USUARIO || 'root',
            password: entorno.BD_CONTRASENYA || '',
            database: entorno.BD_NOMBRE || 'aeris'
        }, enviarCorreo, entorno.URL_RESTABLECER || `http://localhost:${puerto}/restablecer.html`, claveTokens);
    } catch (error) {
        console.error('No se puede conectar con MySQL. ¿Está MySQL en marcha en XAMPP y existe la BD aeris?');
        console.error(error.message);
        process.exit(1);
    }

    const servidor = crearServidor(logica);
    const conexion = servidor.listen(puerto, () => {
        console.log(`Servidor REST de AERIS escuchando en http://localhost:${puerto}`);
    });

    // Ctrl+C: cerrar el servidor y la conexión con la BD
    process.on('SIGINT', async () => {
        conexion.close();
        await logica.cerrar();
        console.log('\nServidor detenido');
        process.exit(0);
    });
}

main();
