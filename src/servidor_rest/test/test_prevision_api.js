
'use strict';

const assert = require('assert');

const URL = 'http://localhost:8081/api/prevision/ozono';

describe('API de predicción de ozono', function () {
    this.timeout(10000);

    it('devuelve 48 predicciones simuladas para Gandia', async function () {
        const respuesta = await fetch(`${URL}?zona=Gandia`);
        const datos = await respuesta.json();

        assert.strictEqual(respuesta.status, 200);
        assert.strictEqual(datos.zona, 'Gandia');
        assert.strictEqual(datos.simulados, true);
        assert.strictEqual(datos.numero_predicciones, 48);
        assert.strictEqual(datos.predicciones.length, 48);
        assert.ok(datos.hora_pico);
        assert.ok(datos.nivel_pico);
    });

    it('rechaza zonas sin modelo disponible', async function () {
        const respuesta = await fetch(`${URL}?zona=Valencia`);
        const datos = await respuesta.json();

        assert.strictEqual(respuesta.status, 400);
        assert.strictEqual(datos.zona_solicitada, 'Valencia');
        assert.strictEqual(datos.zona_disponible, 'Gandia');
    });
});

