// ---------------------------------------------------------------------------
// Fichero:     PaginaVinculacion.js
// Descripción: Páginas que ve quien compró el sensor al pulsar un botón del
//              correo de vinculación: primero «¿Confirmas…?» con un botón (así
//              los programas que abren los enlaces de los correos para
//              revisarlos no vinculan nada por su cuenta) y después el
//              resultado: «Sensor vinculado», «Vinculación rechazada» o
//              «Enlace no válido». Diseño de Figma «Vinculación confirmada» (web).
//              Diseño en doc/servidor_rest_design.md. Tarea T005.
// Autores:     Equipo 04 – SenseTech
// Fecha:       14/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const { escaparHTML } = require('../logica/PlantillaCorreo');

// Colores de cada caso: fondo e icono del círculo
const ESTILOS = {
    ok: { fondo: '#E3F1EC', color: '#2B735B', icono: '✓' },
    no: { fondo: '#FBEAEA', color: '#C4473F', icono: '✕' },
    pregunta: { fondo: '#EFEAF6', color: '#7958A7', icono: '?' }
};

// ---------------------------------------------------------------------------
// tipo: Texto, titulo: Texto, parrafos: Lista<Texto>, extra: Texto (HTML ya seguro)
//     --> pagina() --> Texto
// What it does: a small page with the AERIS card (title, icon, texts). The
//               texts are escaped; extra is HTML made here (the form).
// ---------------------------------------------------------------------------
function pagina(tipo, titulo, parrafos, extra = '') {
    const e = ESTILOS[tipo];
    const textos = parrafos.map((p) => `<p>${escaparHTML(p)}</p>`).join('\n      ');
    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escaparHTML(titulo)} · AERIS</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
           background: #F5F6FA; font-family: Inter, Arial, sans-serif; color: #432E60; padding: 16px; box-sizing: border-box; }
    .tarjeta { max-width: 440px; width: 100%; background: #FFFFFF; border: 1px solid #E3E5EF; border-radius: 16px;
               padding: 32px 28px; text-align: center; box-sizing: border-box; }
    .icono { width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center;
             justify-content: center; font-size: 26px; font-weight: 700; background: ${e.fondo}; color: ${e.color}; }
    h1 { margin: 0 0 12px; font-size: 24px; line-height: 30px; }
    p { margin: 0 0 10px; font-size: 15px; line-height: 22px; color: #5C5478; }
    button { margin-top: 12px; width: 100%; height: 44px; border: 0; border-radius: 12px; font: 600 16px Inter, Arial, sans-serif;
             color: #FFFFFF; background: linear-gradient(90deg, #8A68BA, #7958A7); cursor: pointer; }
    button.secundario { background: #FFFFFF; color: #7958A7; border: 1px solid #7958A7; }
    .marca { margin-top: 20px; font-size: 13px; color: #8992B8; letter-spacing: 2px; }
  </style>
</head>
<body>
  <main class="tarjeta">
    <div class="icono">${e.icono}</div>
    <h1>${escaparHTML(titulo)}</h1>
      ${textos}
      ${extra}
    <div class="marca">AERIS</div>
  </main>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// token: Texto, acepta: V/F --> paginaConfirmar() --> Texto
// What it does: «¿Vinculamos el sensor?» or «¿Rechazamos…?» with a button
//               that sends the answer (POST /responderVinculacion).
// ---------------------------------------------------------------------------
function paginaConfirmar(token, acepta) {
    const formulario = `<form method="post" action="/responderVinculacion">
        <input type="hidden" name="token" value="${escaparHTML(token)}">
        <input type="hidden" name="respuesta" value="${acepta ? 'si' : 'no'}">
        <button type="submit"${acepta ? '' : ' class="secundario"'}>${acepta ? 'Sí, vincular el sensor' : 'No conozco a esta persona'}</button>
      </form>`;
    return acepta
        ? pagina('pregunta', '¿Vinculamos el sensor?',
            ['Pulsa el botón para vincular el sensor a la cuenta de quien lo ha escaneado.'], formulario)
        : pagina('pregunta', '¿Rechazamos la vinculación?',
            ['Si no conoces a esta persona, pulsa el botón y el sensor seguirá sin dueño.'], formulario);
}

// ---------------------------------------------------------------------------
// respuesta: { estado, numeroSerie, nombreSolicitante } --> paginaResultado() --> Texto
// What it does: «Sensor vinculado» or «Vinculación rechazada».
// ---------------------------------------------------------------------------
function paginaResultado(respuesta) {
    if (respuesta.estado === 'confirmada') {
        return pagina('ok', 'Sensor vinculado', [
            `Gracias por confirmarlo. El sensor ${respuesta.numeroSerie} ya está vinculado a la cuenta de `
            + `${respuesta.nombreSolicitante} y sus mediciones empezarán a aparecer en su app y en el mapa.`]);
    }
    return pagina('no', 'Vinculación rechazada', [
        `El sensor ${respuesta.numeroSerie} no se ha vinculado y sigue sin dueño.`]);
}

// --> paginaEnlaceNoValido() --> Texto
function paginaEnlaceNoValido() {
    return pagina('no', 'Enlace no válido', [
        'Este enlace ha caducado, ya se ha usado o se ha enviado un correo más nuevo.',
        'Si hace falta, quien escaneó el sensor puede pedir que se vuelva a enviar desde la app.']);
}

module.exports = { paginaConfirmar, paginaResultado, paginaEnlaceNoValido };
