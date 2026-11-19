// ---------------------------------------------------------------------------
// Fichero:     RutasPrevision.js
// Descripción: Ruta GET /api/prevision/ozono?zona=Gandia del servidor REST. La
//              previsión la calcula ServicioPrediccion (worker Python con
//              arranque perezoso, caché de 5 minutos y recuperación de caídas);
//              esta ruta solo valida la zona y traduce el resultado a HTTP.
//              Un fallo de la previsión nunca afecta a las demás rutas.
//              Diseño en doc/servidor_rest_design.md. Tarea T032.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const {
    ServicioPrediccion,
    ErrorPrevision,
    MOTIVO_NO_DISPONIBLE,
    MOTIVO_TIEMPO_AGOTADO,
    MOTIVO_DESACTIVADA
} = require('./ServicioPrediccion');

const ZONA_DISPONIBLE = 'Gandia';

// ---------------------------------------------------------------------------
// servidor: Express, opciones: { activa: B, servicio: ServicioPrediccion,
//           servicioOpciones: Object } --> cargarRutasPrevision() --> ServicioPrediccion
// What it does: añade GET /api/prevision/ozono. Con activa = false la ruta
//               responde 503 «desactivada» y Python no se lanza nunca. El
//               worker no se lanza aquí, sino en la primera petición.
//               Devuelve el servicio (los tests y el cierre pueden usarlo).
// ---------------------------------------------------------------------------
function cargarRutasPrevision(servidor, opciones = {}) {
    const activa = opciones.activa !== false;
    const servicio = opciones.servicio || new ServicioPrediccion(opciones.servicioOpciones);

    servidor.get('/api/prevision/ozono', async (peticion, respuesta) => {
        try {
            const zona = String(peticion.query.zona || ZONA_DISPONIBLE).trim();

            if (zona.toLowerCase() !== ZONA_DISPONIBLE.toLowerCase()) {
                return respuesta.status(400).json({
                    error: 'El modelo disponible solo permite predicciones para Gandia.',
                    zona_solicitada: zona,
                    zona_disponible: ZONA_DISPONIBLE
                });
            }

            if (!activa) {
                return respuesta.status(503).json({
                    error: 'La previsión no está activada en el servidor.',
                    motivo: MOTIVO_DESACTIVADA
                });
            }

            const inicio = Date.now();
            const resultado = await servicio.predecir();
            return respuesta.json({
                ...resultado,
                tiempo_respuesta_ms: Date.now() - inicio
            });
        } catch (error) {
            return responderError(respuesta, error);
        }
    });

    return servicio;
}

// ---------------------------------------------------------------------------
// respuesta: Response, error: Error --> responderError() -->
// What it does: 504 si se agotó el tiempo; 503 en cualquier otro fallo. El
//               cliente solo recibe un texto genérico y el «motivo»; el
//               detalle (trazas de Python, rutas…) se queda en el log.
// ---------------------------------------------------------------------------
function responderError(respuesta, error) {
    if (!(error instanceof ErrorPrevision)) {
        console.error('[previsión] error inesperado:', error);
    }
    const agotado = error instanceof ErrorPrevision && error.motivo === MOTIVO_TIEMPO_AGOTADO;
    if (respuesta.headersSent) {
        return undefined;
    }
    return respuesta.status(agotado ? 504 : 503).json(agotado
        ? { error: 'Tiempo de espera agotado.', motivo: MOTIVO_TIEMPO_AGOTADO }
        : { error: 'Servicio de predicción no disponible.', motivo: MOTIVO_NO_DISPONIBLE });
}

module.exports = { cargarRutasPrevision };
