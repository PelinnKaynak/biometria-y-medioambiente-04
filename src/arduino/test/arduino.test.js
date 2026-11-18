// ---------------------------------------------------------------------------
// Fichero:     arduino.test.js
// Descripción: Lanza desde mocha los tests C++ del nodo (pruebasNodoAERIS.cpp):
//              los compila con g++ junto a los dobles de prueba de stubs/ y
//              los ejecuta. Si el ordenador no tiene g++, el test se omite.
//              Igual que en el Sprint 0. Diseño en doc/arduino_design.md. T004.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CARPETA_TEST = __dirname;
const EJECUTABLE = path.join(os.tmpdir(),
    `pruebasNodoAERIS-${process.pid}${process.platform === 'win32' ? '.exe' : ''}`);

// ---------------------------------------------------------------------------
// --> hayCompilador() --> V/F
// What it does: true if g++ can be run on this computer.
// ---------------------------------------------------------------------------
function hayCompilador() {
    return spawnSync('g++', ['--version']).status === 0;
}

describe('arduino: programa del nodo AERIS (C++ con dobles de prueba)', function () {

    it('compila el código del nodo y pasa todas las comprobaciones', function () {
        if (!hayCompilador()) this.skip();

        const compilacion = spawnSync('g++', ['-std=c++17', '-I', path.join(CARPETA_TEST, 'stubs'),
            '-o', EJECUTABLE, path.join(CARPETA_TEST, 'pruebasNodoAERIS.cpp')], { encoding: 'utf8' });
        assert.strictEqual(compilacion.status, 0, compilacion.stderr);

        const ejecucion = spawnSync(EJECUTABLE, { encoding: 'utf8' });
        assert.strictEqual(ejecucion.status, 0, ejecucion.stdout);
        assert.match(ejecucion.stdout, /, 0 fallidas/);
    });
});
