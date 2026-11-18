// ---------------------------------------------------------------------------
// Fichero:     MiCuenta.js
// Descripción: Cálculos de la página Mi cuenta que no necesitan la base de
//              datos: los periodos de fechas, el nivel según los puntos y
//              cómo se enseña el sitio de una medición. Los usa Logica.js
//              en resumenCuenta() y exposicion(). Tarea T024 · H035.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

// Nombres con los que puede estar el ozono en la tabla Contaminantes
const NOMBRES_OZONO = ['Ozono', 'O3'];

// µg/m³. Umbral de aviso por defecto, el mismo que enseña la web
// (UMBRAL_AVISO en mi_cuenta.js). Si el usuario tiene umbralAlerta, manda ese.
const UMBRAL_AVISO_POR_DEFECTO = 180;

const DIAS_POR_PERIODO = { semana: 7, mes: 30, '3meses': 90 };
const DIAS_EXPOSICION_MEDIA = 30;
const DIAS_HORAS_ALTAS = 7;
const NUMERO_ULTIMAS_MEDICIONES = 4;

// Niveles de la tarjeta de recompensas. PROVISIONAL: hasta que exista la
// tabla MovimientosPuntos, cada medición guardada cuenta como un punto.
const NIVELES = [
    { nombre: 'Principiante', desde: 0 },
    { nombre: 'Explorador', desde: 1000 },
    { nombre: 'Guardián', desde: 3000 },
    { nombre: 'Experto', desde: 10000 }
];

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// ahora: Fecha --> limitesDeMes() --> { inicioMes: Fecha, inicioMesAnterior: Fecha }
// What it does: the first instant (UTC) of this month and of the month before.
// ---------------------------------------------------------------------------
function limitesDeMes(ahora) {
    const anyo = ahora.getUTCFullYear();
    const mes = ahora.getUTCMonth();
    return {
        inicioMes: new Date(Date.UTC(anyo, mes, 1)),
        inicioMesAnterior: new Date(Date.UTC(anyo, mes - 1, 1))
    };
}

// ---------------------------------------------------------------------------
// ahora: Fecha, dias: N --> haceDias() --> Fecha
// ---------------------------------------------------------------------------
function haceDias(ahora, dias) {
    return new Date(ahora.getTime() - dias * MS_POR_DIA);
}

// ---------------------------------------------------------------------------
// puntos: N --> nivelDePuntos() --> { nivel: Texto, siguienteNivel: Texto, puntosSiguienteNivel: N }
// What it does: the level reached with those points and the next one. In
//               the last level the «next» one is itself, so the web says
//               that it has already been reached.
// ---------------------------------------------------------------------------
function nivelDePuntos(puntos) {
    let i = 0;
    while (i + 1 < NIVELES.length && puntos >= NIVELES[i + 1].desde) {
        i++;
    }
    const siguiente = NIVELES[Math.min(i + 1, NIVELES.length - 1)];
    return { nivel: NIVELES[i].nombre, siguienteNivel: siguiente.nombre, puntosSiguienteNivel: siguiente.desde };
}

// ---------------------------------------------------------------------------
// latitud: R, longitud: R --> textoDelSitio() --> Texto
// What it does: «38,967, -0,181». Measurements have no place name yet
//               (Mis lugares does not have a table), so the web shows the
//               coordinates.
// ---------------------------------------------------------------------------
function textoDelSitio(latitud, longitud) {
    const numero = (n) => Number(n).toFixed(3).replace('.', ',');
    return `${numero(latitud)}, ${numero(longitud)}`;
}

// ---------------------------------------------------------------------------
// periodo: Texto --> diasDelPeriodo() --> N | null
// ---------------------------------------------------------------------------
function diasDelPeriodo(periodo) {
    return Object.prototype.hasOwnProperty.call(DIAS_POR_PERIODO, periodo) ? DIAS_POR_PERIODO[periodo] : null;
}

module.exports = {
    NOMBRES_OZONO, UMBRAL_AVISO_POR_DEFECTO, DIAS_EXPOSICION_MEDIA, DIAS_HORAS_ALTAS,
    NUMERO_ULTIMAS_MEDICIONES, NIVELES,
    limitesDeMes, haceDias, nivelDePuntos, textoDelSitio, diasDelPeriodo
};