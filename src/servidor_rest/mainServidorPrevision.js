
'use strict';

const express = require('express');
const { cargarRutasPrevision } = require('./RutasPrevision');

const servidor = express();

servidor.use(express.json());
cargarRutasPrevision(servidor);

servidor.get('/', (peticion, respuesta) => {
    respuesta.json({
        servicio: 'AERIS - Predicción de ozono',
        estado: 'activo',
        endpoint: '/api/prevision/ozono?zona=Gandia'
    });
});

servidor.use((peticion, respuesta) => {
    respuesta.status(404).json({
        error: 'Ruta no encontrada'
    });
});

const PUERTO = process.env.PUERTO_PREVISION || 8081;

servidor.listen(PUERTO, () => {
    console.log(`Servidor de previsión activo en http://localhost:${PUERTO}`);
});
