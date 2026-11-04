// ---------------------------------------------------------------------------
// Fichero:     EnviadorCorreo.js
// Descripción: Crea la función que envía correos (recuperación de contraseña).
//              Con SMTP configurado usa nodemailer; sin SMTP muestra el correo
//              en la consola del servidor, para poder probar en local.
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
//     --> ( destinatario: Texto, asunto: Texto, texto: Texto ) --> Promesa
// What it does: returns the function that Logica uses to send emails.
// ---------------------------------------------------------------------------
function crearEnviadorCorreo(config) {
    if (!config.host) {
        return async (destinatario, asunto, texto) => {
            console.log(`\n[correo NO enviado: falta SMTP_HOST en .env]\nPara: ${destinatario}\nAsunto: ${asunto}\n${texto}\n`);
        };
    }
    const transporte = nodemailer.createTransport({
        host: config.host,
        port: Number(config.puerto) || 587,
        secure: Number(config.puerto) === 465,
        auth: config.usuario ? { user: config.usuario, pass: config.contrasenya } : undefined
    });
    return async (destinatario, asunto, texto) => {
        await transporte.sendMail({ from: config.remitente, to: destinatario, subject: asunto, text: texto });
    };
}

module.exports = { crearEnviadorCorreo };
