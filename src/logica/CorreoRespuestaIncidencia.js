// ---------------------------------------------------------------------------
// Fichero:     CorreoRespuestaIncidencia.js
// Descripción: Correo que recibe el usuario cuando un técnico o un
//              administrador responde a su incidencia: su mensaje, la
//              respuesta y el estado. Mismo marco que el resto de correos.
//              Diseño en doc/logica_design.md. Tarea T041.
// Autores:     Equipo 04 – SenseTech
// Fecha:       17/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const { marcoCorreo, escaparHTML, LOGOS } = require('./PlantillaCorreo');

const NOMBRES_TIPO = { sensor: 'Sensor', datos: 'Datos', cuenta: 'Cuenta', otra: 'Otra' };
const NOMBRES_ESTADO = { 'abierta': 'Abierta', 'en curso': 'En curso', 'resuelta': 'Resuelta' };

// ---------------------------------------------------------------------------
// datos: { nombre, tipo, descripcion, respuesta, estado, fecha: Date, idIncidencia }
//     --> crearCorreoRespuestaIncidencia() --> Correo
// Correo = ( asunto: Texto, texto: Texto, html: Texto, adjuntos: Lista<Adjunto> )
// What it does: builds the e-mail with the answer to an incidence: plain
//               text and HTML.
// ---------------------------------------------------------------------------
function crearCorreoRespuestaIncidencia(datos) {
    const { nombre, tipo, descripcion, respuesta, estado, fecha, idIncidencia } = datos;
    const asunto = `AERIS · Respuesta a tu incidencia nº ${idIncidencia}`;
    const nombreTipo = NOMBRES_TIPO[tipo] || tipo;
    const nombreEstado = NOMBRES_ESTADO[estado] || estado;
    const dia = fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });

    const texto =
        `Hola, ${nombre}:\n\n` +
        `Hemos respondido a la incidencia que enviaste el ${dia} (${nombreTipo}).\n\n` +
        `Tu mensaje:\n${descripcion}\n\n` +
        `Respuesta:\n${respuesta}\n\n` +
        `Estado: ${nombreEstado}\n\n` +
        'Puedes verla también en Ayuda › Mis incidencias, en la app o en la web.\n\n' +
        'El equipo de AERIS';

    const html = marcoCorreo(asunto, `
        <tr><td style="padding:16px 32px 0 32px;font-family:Arial,sans-serif;">
          <h1 style="margin:0;font-size:24px;line-height:30px;color:#432E60;text-align:center;">Hemos respondido a tu incidencia</h1>
          <p style="margin:12px 0 0 0;font-size:15px;line-height:22px;color:#432E60;text-align:center;">
            Hola, ${escaparHTML(nombre)}: esta es la respuesta a la incidencia que enviaste el ${escaparHTML(dia)}.
          </p>
        </td></tr>
        <tr><td style="padding:22px 32px 0 32px;font-family:Arial,sans-serif;">
          <div style="font-size:12px;line-height:16px;color:#8992B8;text-transform:uppercase;letter-spacing:.5px;">Tu mensaje · ${escaparHTML(nombreTipo)}</div>
          <div style="margin-top:6px;padding:12px 14px;border:1px solid #E3E5EF;border-radius:12px;font-size:14px;line-height:20px;color:#432E60;white-space:pre-line;">${escaparHTML(descripcion)}</div>
        </td></tr>
        <tr><td style="padding:16px 32px 0 32px;font-family:Arial,sans-serif;">
          <div style="font-size:12px;line-height:16px;color:#8992B8;text-transform:uppercase;letter-spacing:.5px;">Respuesta</div>
          <div style="margin-top:6px;padding:12px 14px;border-radius:12px;background:#F1ECF8;font-size:14px;line-height:20px;color:#432E60;white-space:pre-line;">${escaparHTML(respuesta)}</div>
        </td></tr>
        <tr><td style="padding:16px 32px 0 32px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;color:#8992B8;text-align:center;">
          Estado: <b style="color:#432E60;">${escaparHTML(nombreEstado)}</b><br>
          También la puedes ver en <b style="color:#432E60;">Ayuda › Mis incidencias</b>, en la app o en la web.
        </td></tr>`);

    return { asunto, texto, html, adjuntos: LOGOS };
}

module.exports = { crearCorreoRespuestaIncidencia };
