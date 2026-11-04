// ---------------------------------------------------------------------------
// Fichero:     CorreoBienvenida.js
// Descripción: Correo de bienvenida que recibe el usuario al registrarse:
//              confirma que la cuenta se ha creado y presenta la app en general, con los
//              logos de SenseTech (empresa) y AERIS (producto) dentro del
//              propio correo. Diseño en doc/logica_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       05/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const path = require('path');

// Los logos van incrustados en el correo (cid:), así se ven aunque el servidor
// no esté en internet
const LOGO_AERIS = { filename: 'aeris.png', path: path.join(__dirname, 'img', 'logo_aeris.png'), cid: 'logo-aeris' };
const LOGO_SENSETECH = {
    filename: 'sensetech.png', path: path.join(__dirname, 'img', 'logo_sensetech.png'), cid: 'logo-sensetech'
};

// Qué es AERIS, en general (se repite en el texto y en el HTML)
const PRESENTACION = 'AERIS te ayuda a conocer la calidad del aire que respiras. Tu sensor mide '
    + 'la contaminación allí donde vas y, junto con las mediciones de toda la comunidad, crea el '
    + 'mapa del aire de tu ciudad. Así puedes decidir por dónde ir, cuándo salir y cómo cuidarte mejor.';

const PRIMER_PASO = 'Abre la app y vincula tu sensor: en menos de un minuto empezarás a medir.';
const DESPEDIDA = 'Gracias por sumarte. Cada medición cuenta: juntos hacemos visible el aire.';

// Algunas cosas que se pueden hacer (no es la lista completa)
const FUNCIONES = [
    'Mapa del aire en tiempo real',
    'Alertas al instante',
    'Tu historial de exposición',
    'Previsión de ozono',
    'Rutas más limpias',
    'Tus lugares, vigilados',
    'Puntos y recompensas por medir'
];

// ---------------------------------------------------------------------------
// nombre: Texto --> crearCorreoBienvenida() --> CorreoBienvenida
// CorreoBienvenida = ( asunto: Texto, texto: Texto, html: Texto, adjuntos: Lista<Adjunto> )
// What it does: builds the welcome email for the user (plain text for old
//               email apps, and HTML with the two logos).
// ---------------------------------------------------------------------------
function crearCorreoBienvenida(nombre) {
    const asunto = 'Te damos la bienvenida a AERIS';

    const texto =
        `Hola, ${nombre}:\n\n` +
        'Ya formas parte de AERIS. Tu cuenta se ha creado correctamente y ya puedes iniciar sesión en la app.\n\n' +
        PRESENTACION + '\n\n' +
        'Todo lo que te espera:\n' +
        FUNCIONES.map((funcion) => `- ${funcion}`).join('\n') + '\n' +
        '…y mucho más.\n\n' +
        'Tu primer paso: ' + PRIMER_PASO + '\n\n' +
        DESPEDIDA + '\n\n' +
        'El equipo de AERIS · SenseTech';

    const nombreSeguro = escaparHTML(nombre);
    const etiquetas = FUNCIONES.map((funcion) =>
        `<span style="display:inline-block;margin:0 6px 8px 0;padding:7px 12px;border-radius:14px;`
        + `background:#F1ECF8;color:#7958A7;font:bold 13px/16px Arial,sans-serif;">${funcion}</span>`).join('');

    const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${asunto}</title></head>
<body style="margin:0;padding:0;background:#F5F6FA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6FA;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E3E5EF;border-radius:16px;">
        <tr><td align="center" style="padding:36px 32px 8px 32px;background:#C5D8D3;background:linear-gradient(180deg,#C5D8D3 0%,#FFFFFF 100%);border-radius:16px 16px 0 0;">
          <img src="cid:${LOGO_AERIS.cid}" width="93" height="100" alt="AERIS" style="display:block;border:0;">
        </td></tr>
        <tr><td style="padding:16px 32px 0 32px;font-family:Arial,sans-serif;">
          <h1 style="margin:0;font-size:24px;line-height:30px;color:#432E60;text-align:center;">¡Hola, ${nombreSeguro}!<br>Ya formas parte de AERIS</h1>
          <p style="margin:12px 0 0 0;font-size:15px;line-height:22px;color:#8992B8;text-align:center;">
            Tu cuenta se ha creado correctamente y ya puedes iniciar sesión en la app.
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px 0 32px;font-family:Arial,sans-serif;font-size:15px;line-height:23px;color:#432E60;">
          ${PRESENTACION}
        </td></tr>
        <tr><td style="padding:24px 32px 4px 32px;">
          <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1px;color:#7958A7;padding-bottom:12px;">TODO LO QUE TE ESPERA</div>
          <div>${etiquetas}</div>
          <div style="font-family:Arial,sans-serif;font-size:14px;line-height:20px;color:#8992B8;padding-top:2px;">…y mucho más.</div>
        </td></tr>
        <tr><td style="padding:22px 32px 0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#7958A7;background:linear-gradient(90deg,#8A68BA,#7958A7);border-radius:12px;">
            <tr><td style="padding:16px 20px;font-family:Arial,sans-serif;color:#FFFFFF;">
              <div style="font-size:12px;font-weight:bold;letter-spacing:1px;opacity:0.85;">TU PRIMER PASO</div>
              <div style="font-size:15px;line-height:22px;font-weight:bold;padding-top:4px;">${PRIMER_PASO}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:22px 32px 0 32px;font-family:Arial,sans-serif;font-size:15px;line-height:22px;color:#432E60;text-align:center;">
          ${DESPEDIDA}<br><b>El equipo de AERIS</b>
        </td></tr>
        <tr><td style="height:28px;line-height:28px;">&nbsp;</td></tr>
        <tr><td align="center" style="padding:20px 32px 26px 32px;border-top:1px solid #E3E5EF;">
          <img src="cid:${LOGO_SENSETECH.cid}" width="57" height="60" alt="SenseTech" style="display:block;border:0;">
          <div style="font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#8992B8;padding-top:8px;">
            AERIS es un producto de SenseTech<br>Equipo 04 · EPSG – Universitat Politècnica de València
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    return { asunto, texto, html, adjuntos: [LOGO_AERIS, LOGO_SENSETECH] };
}

// ---------------------------------------------------------------------------
// texto: Texto --> escaparHTML() --> Texto
// What it does: changes & < > " ' so a name can never add HTML to the email.
// ---------------------------------------------------------------------------
function escaparHTML(texto) {
    return String(texto).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

module.exports = { crearCorreoBienvenida, escaparHTML };
