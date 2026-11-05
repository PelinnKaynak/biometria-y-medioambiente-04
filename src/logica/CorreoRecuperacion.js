// ---------------------------------------------------------------------------
// Fichero:     CorreoRecuperacion.js
// Descripción: Correo para crear una contraseña nueva («Recuperar
//              contraseña»), con el mismo diseño que el de bienvenida: botón
//              con el enlace (el enlace escrito solo va en la versión de
//              texto), aviso de que caduca y logos de AERIS y SenseTech.
//              Diseño en doc/logica_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       05/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const { marcoCorreo, escaparHTML, LOGOS } = require('./PlantillaCorreo');

// ---------------------------------------------------------------------------
// nombre: Texto, enlace: Texto, minutos: N --> crearCorreoRecuperacion() --> Correo
// Correo = ( asunto: Texto, texto: Texto, html: Texto, adjuntos: Lista<Adjunto> )
// What it does: builds the password recovery email: plain text (with the
//               link) and HTML with a button that opens the link.
// ---------------------------------------------------------------------------
function crearCorreoRecuperacion(nombre, enlace, minutos) {
    const asunto = 'AERIS · Recuperar la contraseña';

    const texto =
        `Hola, ${nombre}:\n\n` +
        `Para crear una contraseña nueva abre este enlace (válido durante ${minutos} minutos):\n` +
        `${enlace}\n\n` +
        'El equipo de AERIS';

    const enlaceSeguro = escaparHTML(enlace);
    const html = marcoCorreo(asunto, `
        <tr><td style="padding:16px 32px 0 32px;font-family:Arial,sans-serif;">
          <h1 style="margin:0;font-size:24px;line-height:30px;color:#432E60;text-align:center;">Crea una contraseña nueva</h1>
          <p style="margin:12px 0 0 0;font-size:15px;line-height:22px;color:#432E60;text-align:center;">
            Hola, ${escaparHTML(nombre)}: hemos recibido una petición para cambiar la contraseña de tu cuenta de AERIS.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:26px 32px 0 32px;">
          <a href="${enlaceSeguro}" style="display:inline-block;padding:13px 28px;border-radius:12px;background:#7958A7;background:linear-gradient(90deg,#8A68BA,#7958A7);color:#FFFFFF;font:bold 15px/18px Arial,sans-serif;text-decoration:none;">Crear contraseña nueva</a>
        </td></tr>
        <tr><td style="padding:16px 32px 0 32px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;color:#8992B8;text-align:center;">
          El enlace caduca en <b style="color:#432E60;">${minutos} minutos</b> y solo se puede usar una vez.
        </td></tr>`);

    return { asunto, texto, html, adjuntos: LOGOS };
}

module.exports = { crearCorreoRecuperacion };
