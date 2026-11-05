// ---------------------------------------------------------------------------
// Fichero:     PlantillaCorreo.js
// Descripción: Marco común de los correos de AERIS (bienvenida y recuperación
//              de contraseña): fondo, tarjeta blanca, logo de AERIS arriba y
//              pie con el logo de SenseTech. Los logos van incrustados (cid:).
//              Diseño en doc/logica_design.md.
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
const LOGOS = [LOGO_AERIS, LOGO_SENSETECH];

// ---------------------------------------------------------------------------
// asunto: Texto, filas: Texto --> marcoCorreo() --> Texto
// What it does: puts the rows (<tr>…</tr>) of one email inside the common
//               frame: AERIS logo on top and SenseTech footer.
// ---------------------------------------------------------------------------
function marcoCorreo(asunto, filas) {
    return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${asunto}</title></head>
<body style="margin:0;padding:0;background:#F5F6FA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6FA;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E3E5EF;border-radius:16px;">
        <tr><td align="center" style="padding:36px 32px 8px 32px;background:#C5D8D3;background:linear-gradient(180deg,#C5D8D3 0%,#FFFFFF 100%);border-radius:16px 16px 0 0;">
          <img src="cid:${LOGO_AERIS.cid}" width="93" height="100" alt="AERIS" style="display:block;border:0;">
        </td></tr>
${filas}
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
}

// ---------------------------------------------------------------------------
// texto: Texto --> escaparHTML() --> Texto
// What it does: changes & < > " ' so a name or a link can never add HTML to
//               the email.
// ---------------------------------------------------------------------------
function escaparHTML(texto) {
    return String(texto).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

module.exports = { marcoCorreo, escaparHTML, LOGOS };
