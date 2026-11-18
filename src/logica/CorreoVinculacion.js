// ---------------------------------------------------------------------------
// Fichero:     CorreoVinculacion.js
// Descripción: Correo que recibe quien compró un sensor cuando alguien lo
//              escanea y quiere vincularlo a su cuenta, con los datos de la
//              petición y los botones (sí / no conozco a esta persona).
//              Mismo marco que los correos de bienvenida y recuperación. Diseño de Figma
//              «Correo · confirmar la vinculación» (web).
//              Diseño en doc/logica_design.md. Tareas T005, T038.
// Autores:     Equipo 04 – SenseTech
// Fecha:       14/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const { marcoCorreo, escaparHTML, LOGOS } = require('./PlantillaCorreo');

// ---------------------------------------------------------------------------
// fecha: Date --> fechaLegible() --> Texto
// What it does: «14 nov 2026 · 18:40» in Spanish time (Europe/Madrid).
// ---------------------------------------------------------------------------
function fechaLegible(fecha) {
    const dia = new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', year: 'numeric'
    }).format(fecha).replace('.', '');
    const hora = new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(fecha);
    return `${dia} · ${hora}`;
}

// ---------------------------------------------------------------------------
// datos: { nombreSolicitante, correoSolicitante, numeroSerie, fecha: Date,
//          enlaceSi, enlaceNo, horas }
//     --> crearCorreoVinculacion() --> Correo
// Correo = ( asunto: Texto, texto: Texto, html: Texto, adjuntos: Lista<Adjunto> )
// What it does: builds the e-mail in plain text (with both links) and HTML
//               (two buttons). Every user value is escaped.
// ---------------------------------------------------------------------------
function crearCorreoVinculacion(datos) {
    const { nombreSolicitante, correoSolicitante, numeroSerie, fecha, enlaceSi, enlaceNo, horas } = datos;
    const asunto = `AERIS · ${nombreSolicitante} quiere vincular tu sensor ${numeroSerie}`;
    const cuando = fechaLegible(fecha);

    const texto =
        'Hola:\n\n' +
        `El sensor AERIS ${numeroSerie} se compró con este correo. ${nombreSolicitante} (${correoSolicitante}) ` +
        'lo ha escaneado y quiere vincularlo a su cuenta.\n\n' +
        `Si se lo has regalado tú o lo va a usar esa persona, confírmalo:\n${enlaceSi}\n\n` +
        `Si no conoces a esta persona:\n${enlaceNo}\n\n` +
        `El enlace caduca en ${horas} horas. Si no haces nada, el sensor no se vinculará.\n\n` +
        'El equipo de AERIS';

    const nombre = escaparHTML(nombreSolicitante);
    const horasSeguras = escaparHTML(horas);
    const fila = (etiqueta, valor) => `
              <tr>
                <td style="padding:7px 8px 7px 0;width:38%;vertical-align:top;font-size:14px;line-height:20px;color:#6A6585;">${escaparHTML(etiqueta)}</td>
                <td style="padding:7px 0;vertical-align:top;word-break:break-word;font-size:14px;line-height:20px;color:#432E60;">${escaparHTML(valor)}</td>
              </tr>`;
    const html = marcoCorreo(escaparHTML(asunto), `
        <tr><td style="padding:20px 24px 0 24px;font-family:Arial,sans-serif;">
          <div style="font-size:12px;line-height:18px;font-weight:bold;letter-spacing:1px;color:#7958A7;text-align:center;">SOLICITUD DE VINCULACIÓN</div>
          <h1 style="margin:8px 0 0;font-size:23px;line-height:29px;color:#432E60;text-align:center;">¿Vinculamos tu sensor?</h1>
          <p style="margin:14px 0 0;font-size:15px;line-height:23px;color:#5C5478;word-break:break-word;">
            Hola. <b style="color:#432E60;">${nombre}</b> (${escaparHTML(correoSolicitante)}) ha escaneado el sensor AERIS y quiere vincularlo a su cuenta.
          </p>
          <p style="margin:10px 0 0;font-size:15px;line-height:23px;color:#5C5478;">
            Si reconoces a esta persona y quieres autorizar la vinculación, confirma la solicitud. Sus mediciones aparecerán en su cuenta.
          </p>
        </td></tr>
        <tr><td style="padding:18px 24px 0;font-family:Arial,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6FA;border:1px solid #E3E5EF;border-radius:12px;">
            <tr><td style="padding:10px 14px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${fila('Sensor AERIS', numeroSerie)}
              ${fila('Solicitante', `${nombreSolicitante} · ${correoSolicitante}`)}
              ${fila('Fecha de solicitud', cuando)}
            </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:22px 24px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#7958A7;background:linear-gradient(90deg,#8A68BA,#7958A7);border-radius:12px;">
            <tr><td align="center" style="border-radius:12px;">
              <a href="${escaparHTML(enlaceSi)}" style="display:block;padding:14px 12px;border-radius:12px;color:#FFFFFF;font:bold 15px/20px Arial,sans-serif;text-decoration:none;text-align:center;">Sí, vincular el sensor</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:10px 24px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #7958A7;border-radius:12px;">
            <tr><td align="center" style="border-radius:12px;">
              <a href="${escaparHTML(enlaceNo)}" style="display:block;padding:13px 12px;border-radius:12px;color:#7958A7;font:bold 15px/20px Arial,sans-serif;text-decoration:none;text-align:center;">No conozco a esta persona</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 24px 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#6A6585;text-align:center;">
          El enlace caduca en <b style="color:#432E60;">${horasSeguras} horas</b>. Si no haces nada, el sensor no se vinculará. Si no esperabas este correo, puedes ignorarlo.
        </td></tr>`);

    return { asunto, texto, html, adjuntos: LOGOS };
}

module.exports = { crearCorreoVinculacion, fechaLegible };
