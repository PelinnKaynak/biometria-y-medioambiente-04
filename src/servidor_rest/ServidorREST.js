// ---------------------------------------------------------------------------
// Fichero:     ServidorREST.js
// Descripción: Crea la aplicación Express con el cuerpo JSON, las reglas
//              REST y las respuestas 400 (JSON mal formado) y 404 (ruta que
//              no existe), y sirve las páginas de src/web_publica y del
//              panel de administración (src/web_admin).
//              No arranca el servidor: lo hace mainServidorREST.js
//              y, en los tests, el propio test.
//              Diseño en doc/servidor_rest_design.md. Tarea T016.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const path = require('path');
const express = require('express');
const { cargarReglasREST } = require('./ReglasREST');
const { cargarRutasPrevision } = require('./RutasPrevision');

const CARPETA_WEB_PUBLICA = path.join(__dirname, '..', 'web_publica');
const CARPETA_WEB_ADMIN = path.join(__dirname, '..', 'web_admin');

// ---------------------------------------------------------------------------
// previsionActiva: Text | undefined --> estaPrevisionActiva() --x
// B <--
// What it does: la previsión de ozono (T032) está activa salvo que PREVISION_ACTIVA
//               valga 0, false, no u off en el entorno (.env).
// ---------------------------------------------------------------------------
function estaPrevisionActiva(valor) {
    return !['0', 'false', 'no', 'off'].includes(String(valor ?? '').trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// logica: Logica, reglasExtra: ( servidor: Express ),
// opciones: { prevision: B, servicioPrevision: ServicioPrediccion } --> crearServidor() --> Express
// What it does: returns the Express app ready to listen. reglasExtra (optional)
//               lets other tasks or the tests add more routes. opciones (optional):
//               prevision = false desactiva la ruta de previsión (por defecto, la
//               indica PREVISION_ACTIVA); servicioPrevision permite a los tests
//               sustituir el servicio de predicción. Python no se lanza al crear
//               el servidor, sino en la primera petición de previsión.
// ---------------------------------------------------------------------------
function crearServidor(logica, reglasExtra, opciones = {}) {
    const servidor = express();
    servidor.use(express.json({ limit: '300kb' }));   // 300 KB: cabe la foto de perfil (T010)

    // Páginas web estáticas
    //   src/web_publica → http://localhost:8080/login.html
    //   src/web_admin   → http://localhost:8080/web_admin/panel_nodos.html
    // web_publica también se sirve en /web_publica/ porque las páginas del
    // panel enlazan a ../web_publica/login.html y ../web_publica/js/...
    servidor.use(express.static(CARPETA_WEB_PUBLICA));
    servidor.use('/web_publica', express.static(CARPETA_WEB_PUBLICA));
    servidor.use('/web_admin', express.static(CARPETA_WEB_ADMIN));

    cargarReglasREST(servidor, logica);
    // Previsión de ozono (T032): si algo falla al montarla, el resto de la API sigue funcionando
    try {
        const activa = opciones.prevision !== undefined
            ? opciones.prevision !== false
            : estaPrevisionActiva(process.env.PREVISION_ACTIVA);
        servidor.locals.servicioPrevision = cargarRutasPrevision(servidor, {
            activa,
            servicio: opciones.servicioPrevision
        });
    } catch (error) {
        console.error('No se pudo cargar la previsión de ozono; el resto de la API sigue activo:', error.message);
    }
    if (reglasExtra) {
        reglasExtra(servidor);
    }

    // Ruta que no existe
    servidor.use((peticion, respuesta) => {
        respuesta.status(404).json({ error: 'Ruta no encontrada' });
    });

    // JSON mal formado u otro error de Express
    servidor.use((error, peticion, respuesta, siguiente) => {
        if (error.type === 'entity.parse.failed') {
            return respuesta.status(400).json({ error: 'El cuerpo no es un JSON válido' });
        }
        console.error(error);
        respuesta.status(500).json({ error: 'Error del servidor' });
    });

    return servidor;
}

module.exports = { crearServidor, estaPrevisionActiva };
