// ---------------------------------------------------------------------------
// Fichero:     PaginaVinculacion.js
// Descripción: Páginas que ve quien compró el sensor al pulsar un botón del
//              correo de vinculación: primero la pregunta con un botón (así
//              los programas que abren los enlaces del correo para
//              revisarlos no vinculan nada por su cuenta) y después el
//              resultado: «Sensor vinculado», «Vinculación rechazada» o
//              «Enlace no válido». Diseño de Figma «Vinculación confirmada» (web).
//              Diseño en doc/servidor_rest_design.md. Tareas T005, T038.
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
// What it does: a responsive AERIS confirmation page with a status icon,
//               logo and clear action. Text is escaped; extra is internal HTML.
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
           background: #F5F6FA; font-family: Inter, Arial, sans-serif; color: #432E60; padding: 24px 16px; box-sizing: border-box; }
    .tarjeta { max-width: 480px; width: 100%; background: #FFFFFF; border: 1px solid #E3E5EF; border-radius: 18px;
               padding: 36px 32px 28px; text-align: center; box-sizing: border-box;
               box-shadow: 0 12px 36px rgba(67, 46, 96, 0.10); }
    .marca { margin: 0 auto 28px; }
    .marca img { display: block; width: 142px; max-width: 60%; height: auto; margin: 0 auto; }
    .icono { width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 18px; display: flex; align-items: center;
             justify-content: center; font-size: 27px; font-weight: 700; background: ${e.fondo}; color: ${e.color}; }
    h1 { margin: 0 0 14px; font-size: 25px; line-height: 32px; letter-spacing: -0.02em; }
    .mensajes p { margin: 0 0 10px; font-size: 15px; line-height: 23px; color: #5C5478; overflow-wrap: anywhere; }
    form { margin: 16px 0 0; }
    button { width: 100%; min-height: 48px; padding: 12px 16px; border: 0; border-radius: 12px;
             font: 600 15px/20px Inter, Arial, sans-serif; color: #FFFFFF;
             background: linear-gradient(90deg, #8A68BA, #7958A7); cursor: pointer; }
    button:hover { filter: brightness(1.05); }
    button:focus-visible { outline: 3px solid #5E3F8C; outline-offset: 3px; }
    button.secundario { color: #7958A7; background: #FFFFFF; border: 1px solid #7958A7; }
    .pie { margin-top: 28px; padding-top: 18px; border-top: 1px solid #E3E5EF;
           font-size: 12px; line-height: 18px; color: #6A6585; }
    @media (max-width: 480px) {
      body { align-items: flex-start; padding: 16px 12px; }
      .tarjeta { padding: 28px 20px 22px; border-radius: 16px; }
      .marca { margin-bottom: 24px; }
      h1 { font-size: 22px; line-height: 28px; }
      .pie { margin-top: 24px; }
    }
  </style>
</head>
<body>
  <main class="tarjeta">
    <div class="marca"><img src="/img/logo-aeris.svg" alt="AERIS"></div>
    <div class="icono" aria-hidden="true">${e.icono}</div>
    <h1>${escaparHTML(titulo)}</h1>
    <div class="mensajes">
      ${textos}
    </div>
      ${extra}
    <div class="pie">AERIS · SenseTech</div>
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
