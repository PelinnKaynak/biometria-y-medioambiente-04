// ---------------------------------------------------------------------------
// Fichero:     CorreoVinculacion.js
// Descripción: Correo que recibe quien compró un sensor cuando alguien lo
//              escanea y quiere vincularlo a su cuenta: «¿Vinculamos tu sensor
//              a la cuenta de Laura?», con los datos de la petición y dos
//              botones (sí / no conozco a esta persona). Mismo marco que los
//              correos de bienvenida y de recuperación. Diseño de Figma
//              «Correo · confirmar la vinculación» (web).
//              Diseño en doc/logica_design.md. Tarea T005.
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
    const fila = (etiqueta, valor) => `
              <tr>
                <td style="padding:4px 0;width:130px;font-size:14px;line-height:20px;color:#8992B8;">${etiqueta}</td>
                <td style="padding:4px 0;font-size:14px;line-height:20px;color:#432E60;">${valor}</td>
              </tr>`;
    const html = marcoCorreo(asunto, `
        <tr><td style="padding:16px 32px 0 32px;font-family:Arial,sans-serif;">
          <h1 style="margin:0;font-size:24px;line-height:30px;color:#432E60;text-align:center;">¿Vinculamos tu sensor a la cuenta de ${nombre}?</h1>
          <p style="margin:14px 0 0 0;font-size:15px;line-height:22px;color:#432E60;">
            Hola. El sensor AERIS ${escaparHTML(numeroSerie)} se compró con este correo. ${nombre}
            (${escaparHTML(correoSolicitante)}) lo ha escaneado y quiere vincularlo a su cuenta.
          </p>
          <p style="margin:12px 0 0 0;font-size:15px;line-height:22px;color:#432E60;">
            Si se lo has regalado tú o lo va a usar esa persona, confírmalo. Desde ese momento sus mediciones aparecerán en su cuenta.
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px 0 32px;font-family:Arial,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6FA;border-radius:12px;">
            <tr><td style="padding:12px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${fila('Sensor', escaparHTML(numeroSerie))}${fila('Quiere vincularlo', `${nombre} · ${escaparHTML(correoSolicitante)}`)}${fila('Solicitado', escaparHTML(cuando))}
            </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:24px 32px 0 32px;">
          <a href="${escaparHTML(enlaceSi)}" style="display:block;padding:13px 20px;border-radius:12px;background:#7958A7;background:linear-gradient(90deg,#8A68BA,#7958A7);color:#FFFFFF;font:bold 15px/18px Arial,sans-serif;text-decoration:none;text-align:center;">Sí, vincular el sensor</a>
        </td></tr>
        <tr><td align="center" style="padding:12px 32px 0 32px;">
          <a href="${escaparHTML(enlaceNo)}" style="display:block;padding:12px 20px;border-radius:12px;border:1px solid #7958A7;background:#FFFFFF;color:#7958A7;font:bold 15px/18px Arial,sans-serif;text-decoration:none;text-align:center;">No conozco a esta persona</a>
        </td></tr>
        <tr><td style="padding:16px 32px 0 32px;font-family:Arial,sans-serif;font-size:13px;line-height:19px;color:#8992B8;text-align:center;">
          El enlace caduca en <b style="color:#432E60;">${horas} horas</b>. Si no haces nada, el sensor no se vinculará. Si no esperabas este correo, puedes ignorarlo.
        </td></tr>`);

    return { asunto, texto, html, adjuntos: LOGOS };
}

module.exports = { crearCorreoVinculacion, fechaLegible };
