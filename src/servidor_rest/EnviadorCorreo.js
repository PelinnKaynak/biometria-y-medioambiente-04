// ---------------------------------------------------------------------------
// Fichero:     EnviadorCorreo.js
// Descripción: Crea la función que envía correos (recuperación de contraseña).
//              Con SMTP configurado usa nodemailer; sin SMTP muestra el correo
//              en la consola del servidor, para poder probar en local.
//              Al arrancar comprueba la conexión con el servidor de correo y
//              apunta en el log cada correo enviado o el motivo si falla,
//              para saber qué pasa en el servidor de la UPV.
//              Diseño en doc/servidor_rest_design.md. Tarea T016.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const nodemailer = require('nodemailer');

// ---------------------------------------------------------------------------
// config: { host, puerto, usuario, contrasenya, remitente }
//     --> crearEnviadorCorreo()
//     --> ( destinatario: Texto, asunto: Texto, texto: Texto, extra: { html, adjuntos } ) --> Promesa
// What it does: returns the function that Logica uses to send emails.
//               extra is optional: an HTML version and attached files (for
//               example the logos of the welcome email, with cid).
// ---------------------------------------------------------------------------
function crearEnviadorCorreo(config) {

    if (!config.host) {
        console.warn('Correo sin configurar: falta SMTP_HOST');
        if (process.env.NODE_ENV === 'production') {
            return async () => {
                throw new Error(
                    'SMTP no configurado en producción'
                );
            };
        }

        // En desarrollo se mantiene el comportamiento original.
        return async (destinatario, asunto, texto, extra = {}) => {
            console.log(
                `\n[correo NO enviado: falta SMTP_HOST]\n` +
                `Para: ${destinatario}\n` +
                `Asunto: ${asunto}\n${texto}\n`
            );
        };
    }

    const puerto = Number(config.puerto) || 587;
    const transporte = nodemailer.createTransport({
        host: config.host,
        port: puerto,
        secure: puerto === 465,
        auth: config.usuario ? { user: config.usuario, pass: config.contrasenya } : undefined,
        connectionTimeout: 15000
    });
    // Comprobación al arrancar (no para el servidor si falla: solo lo apunta)
    const donde = `${config.host}:${puerto}${config.usuario ? ` como ${config.usuario}` : ''}`;
    transporte.verify()
        .then(() => console.log(`Correo listo (${donde})`))
        .catch((error) => console.error(`El correo NO funciona (${donde}): ${error.message}`));

    return async (destinatario, asunto, texto, extra = {}) => {
        await transporte.sendMail({
            from: config.remitente, to: destinatario, subject: asunto, text: texto,
            html: extra.html, attachments: extra.adjuntos
        });
        console.log(`Correo enviado a ${destinatario}: ${asunto}`);
    };
}

module.exports = { crearEnviadorCorreo };
