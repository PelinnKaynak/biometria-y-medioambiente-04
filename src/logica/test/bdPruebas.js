// ---------------------------------------------------------------------------
// Fichero:     bdPruebas.js
// Descripción: Ayuda de los tests: crea la base de datos de pruebas
//              (aeris_test) con el mismo script que la real (src/bd/usuarios.sql)
//              y la vacía entre tests. Nunca toca la base de datos aeris.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// ---------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const NOMBRE_BD_PRUEBAS = process.env.BD_PRUEBAS || 'aeris_test';

// Conexión a MySQL de XAMPP por defecto (root sin contraseña)
const CONFIG_BD_PRUEBAS = {
    host: process.env.BD_HOST || '127.0.0.1',
    port: Number(process.env.BD_PUERTO || 3306),
    user: process.env.BD_USUARIO || 'root',
    password: process.env.BD_CONTRASENYA || '',
    database: NOMBRE_BD_PRUEBAS
};

const RUTA_SCRIPT = path.join(__dirname, '..', '..', 'bd', 'usuarios.sql');

// ---------------------------------------------------------------------------
// --> crearBDPruebas() -->
// What it does: drops aeris_test, runs usuarios.sql on it (changing only the
//               database name) and fails if the script has any error.
// ---------------------------------------------------------------------------
async function crearBDPruebas() {
    const script = fs.readFileSync(RUTA_SCRIPT, 'utf8')
        .replace(/CREATE DATABASE IF NOT EXISTS aeris\b/, `CREATE DATABASE IF NOT EXISTS ${NOMBRE_BD_PRUEBAS}`)
        .replace(/USE aeris;/, `USE ${NOMBRE_BD_PRUEBAS};`);
    const { database, ...sinBD } = CONFIG_BD_PRUEBAS;
    const conexion = await mysql.createConnection({ ...sinBD, multipleStatements: true });
    try {
        await conexion.query(`DROP DATABASE IF EXISTS ${NOMBRE_BD_PRUEBAS}`);
        await conexion.query(script);
    } finally {
        await conexion.end();
    }
}

// ---------------------------------------------------------------------------
// conexion: Pool --> vaciarTablas() -->
// What it does: deletes all users (sessions and recoveries go with them).
// ---------------------------------------------------------------------------
async function vaciarTablas(conexion) {
    await conexion.query('DELETE FROM Usuarios');
}

module.exports = { CONFIG_BD_PRUEBAS, NOMBRE_BD_PRUEBAS, crearBDPruebas, vaciarTablas };
