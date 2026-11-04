// ---------------------------------------------------------------------------
// Fichero:     ServidorREST.js
// Descripción: Crea la aplicación Express con el cuerpo JSON, las reglas
//              REST y las respuestas 400 (JSON mal formado) y 404 (ruta que
//              no existe), y sirve las páginas de src/web_publica (por ahora
//              restablecer.html, la del enlace de recuperar contraseña).
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

const CARPETA_WEB_PUBLICA = path.join(__dirname, '..', 'web_publica');

// ---------------------------------------------------------------------------
// logica: Logica, reglasExtra: ( servidor: Express ) --> crearServidor() --> Express
// What it does: returns the Express app ready to listen. reglasExtra (optional)
//               lets other tasks or the tests add more routes.
// ---------------------------------------------------------------------------
function crearServidor(logica, reglasExtra) {
    const servidor = express();
    servidor.use(express.json({ limit: '300kb' }));   // 300 KB: cabe la foto de perfil (T010)

    // Páginas web estáticas (src/web_publica): http://localhost:8080/restablecer.html
    servidor.use(express.static(CARPETA_WEB_PUBLICA));

    cargarReglasREST(servidor, logica);
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

module.exports = { crearServidor };
