// ---------------------------------------------------------------------------
// Fichero:     Nodos.js
// Descripción: Lógica de los nodos para el panel de administración (T021).
//              Un nodo es un sensor vinculado a un portador. De cada uno da
//              el número de serie, el portador, la fecha y el sitio de su
//              última medición, la batería y el estado (activo, inactivo o
//              por calibrar), con búsqueda, filtro por estado y páginas.
//              Usa las tablas Sensores, Usuarios y Mediciones de
//              src/bd/usuarios.sql. Diseño en doc/logica_design.md.
//              Tarea T021 · H011.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

// Mismo umbral que la web (UMBRAL_INACTIVO_HORAS en web_admin/js/nodos.js)
const HORAS_INACTIVO = 24;
const DIAS_INACTIVO_LARGO = 7;
const POR_PAGINA_POR_DEFECTO = 20;
const POR_PAGINA_MAXIMO = 100;
const ESTADOS_FILTRO = ['todos', 'activos', 'inactivos', 'calibrar'];

const MS_POR_HORA = 60 * 60 * 1000;

// Estado de cada nodo, con los mismos nombres que EstadoNodo de la web
const ACTIVO = 'ACTIVO';
const INACTIVO = 'INACTIVO';
const CALIBRAR = 'CALIBRAR';

// Un nodo por sensor vinculado, con su última medición (la más nueva) y el
// sitio donde se tomó. Si nunca ha medido, se usa ultimaConexion.
const SQL_NODOS = `
    SELECT s.numeroSerie,
           s.bateria,
           s.necesitaCalibracion,
           CONCAT(u.nombre, ' ', u.apellidos) AS portador,
           COALESCE(ult.fechaHora, s.ultimaConexion) AS ultimaMedicion,
           ST_Y(ult.ubicacion) AS latitud,
           ST_X(ult.ubicacion) AS longitud
      FROM Sensores s
      JOIN Usuarios u ON u.idUsuario = s.idUsuario
      LEFT JOIN Mediciones ult ON ult.idMedicion = (
            SELECT m.idMedicion FROM Mediciones m
             WHERE m.idSensor = s.idSensor
             ORDER BY m.fechaHora DESC, m.idMedicion DESC
             LIMIT 1)`;

// ---------------------------------------------------------------------------
// valor, porDefecto: N, minimo: N, maximo: N --> leerEntero() --> N | null
// What it does: the whole number in valor (it can come as text from the
//               query string), porDefecto if it is empty, null if it is not
//               a whole number between minimo and maximo.
// ---------------------------------------------------------------------------
function leerEntero(valor, porDefecto, minimo, maximo) {
    if (valor === undefined || valor === null || valor === '') {
        return porDefecto;
    }
    const n = Number(valor);
    return Number.isInteger(n) && n >= minimo && n <= maximo ? n : null;
}

// ---------------------------------------------------------------------------
// fila: FilaBD, ahora: Date --> aNodo() --> Nodo
// Nodo = { id, portador, ultimaMedicion: Date | null, bateria: N | null,
//          latitud: R | null, longitud: R | null, necesitaCalibrar: V/F,
//          estado: ACTIVO | INACTIVO | CALIBRAR }
// Same keys as the nodes of LogicaAdminFake in the web.
// ---------------------------------------------------------------------------
function aNodo(fila, ahora) {
    const ultima = fila.ultimaMedicion ? new Date(fila.ultimaMedicion) : null;
    const necesitaCalibrar = Boolean(fila.necesitaCalibracion);
    const inactivo = !ultima || ahora.getTime() - ultima.getTime() > HORAS_INACTIVO * MS_POR_HORA;
    return {
        id: fila.numeroSerie,
        portador: fila.portador,
        ultimaMedicion: ultima,
        bateria: fila.bateria === null ? null : Number(fila.bateria),
        latitud: fila.latitud === null ? null : Number(fila.latitud),
        longitud: fila.longitud === null ? null : Number(fila.longitud),
        necesitaCalibrar,
        estado: inactivo ? INACTIVO : (necesitaCalibrar ? CALIBRAR : ACTIVO)
    };
}

class Nodos {

    // -----------------------------------------------------------------------
    // logica: Logica --> constructor()
    // What it does: uses the database connection and ErrorLogica of Logica.
    // -----------------------------------------------------------------------
    constructor(logica) {
        this.logica = logica;
    }

    // -----------------------------------------------------------------------
    // ahora: Fecha (opcional) --> resumen() --> ResumenNodos
    // ResumenNodos = { total, activos, inactivos24h, inactivos7d, porCalibrar }
    // What it does: the numbers at the top of the Nodos page. activos +
    //               inactivos24h = total; inactivos7d are the inactive ones
    //               that have not sent anything for more than a week.
    // -----------------------------------------------------------------------
    async resumen(ahora = new Date()) {
        const nodos = await this.todos(ahora);
        const hace7Dias = ahora.getTime() - DIAS_INACTIVO_LARGO * 24 * MS_POR_HORA;
        const resumen = { total: nodos.length, activos: 0, inactivos24h: 0, inactivos7d: 0, porCalibrar: 0 };
        for (const nodo of nodos) {
            if (nodo.estado === INACTIVO) {
                resumen.inactivos24h++;
                if (!nodo.ultimaMedicion || nodo.ultimaMedicion.getTime() < hace7Dias) {
                    resumen.inactivos7d++;
                }
            } else {
                resumen.activos++;
            }
            if (nodo.necesitaCalibrar) {
                resumen.porCalibrar++;
            }
        }
        return resumen;
    }

    // -----------------------------------------------------------------------
    // filtro: { busqueda, estado, pagina, porPagina }, ahora: Fecha (opcional)
    //     --> buscar() --> { nodos: [ Nodo ], total: N }
    // What it does: the nodes whose serial number or carrier contains busqueda
    //               (without caring about capitals or accents) and that are in
    //               that estado (todos, activos = not inactive, inactivos,
    //               calibrar), ordered from the one that has been longest
    //               without data. total is the number of nodes that match,
    //               without pages. pagina starts at 1 and porPagina is 20 by
    //               default and 100 at most; porPagina 0 gives them all (the
    //               map). Throws DATOS_NO_VALIDOS if a filter is not valid.
    // -----------------------------------------------------------------------
    async buscar(filtro = {}, ahora = new Date()) {
        const estado = filtro.estado === undefined || filtro.estado === '' ? 'todos' : filtro.estado;
        const pagina = leerEntero(filtro.pagina, 1, 1, Number.MAX_SAFE_INTEGER);
        const porPagina = leerEntero(filtro.porPagina, POR_PAGINA_POR_DEFECTO, 0, POR_PAGINA_MAXIMO);

        const campos = [];
        if (!ESTADOS_FILTRO.includes(estado)) campos.push('estado');
        if (pagina === null) campos.push('pagina');
        if (porPagina === null) campos.push('porPagina');
        if (campos.length > 0) {
            const { ErrorLogica } = require('./Logica');
            throw new ErrorLogica('DATOS_NO_VALIDOS', 'Filtro de nodos no válido', campos);
        }

        const busqueda = String(filtro.busqueda || '').trim().toLowerCase();
        const encontrados = (await this.todos(ahora))
            .filter((n) => !busqueda ||
                n.id.toLowerCase().includes(busqueda) ||
                quitarAcentos(n.portador).includes(quitarAcentos(busqueda)))
            .filter((n) => {
                if (estado === 'activos') return n.estado !== INACTIVO;
                if (estado === 'inactivos') return n.estado === INACTIVO;
                if (estado === 'calibrar') return n.necesitaCalibrar;
                return true;
            });

        if (porPagina === 0) {
            return { nodos: encontrados, total: encontrados.length };
        }
        const inicio = (pagina - 1) * porPagina;
        return { nodos: encontrados.slice(inicio, inicio + porPagina), total: encontrados.length };
    }

    // -----------------------------------------------------------------------
    // ahora: Fecha --> todos() --> [ Nodo ]
    // What it does: every linked sensor, ordered from the one that has been
    //               longest without data (those that never sent anything
    //               first).
    // -----------------------------------------------------------------------
    async todos(ahora) {
        const [filas] = await this.logica.conexion.query(
            `${SQL_NODOS} ORDER BY ultimaMedicion IS NOT NULL, ultimaMedicion ASC, s.numeroSerie`);
        return filas.map((fila) => aNodo(fila, ahora));
    }
}

// ---------------------------------------------------------------------------
// texto: Texto --> quitarAcentos() --> Texto
// What it does: lower case and without accents, to search «Martinez» and find
//               «Martínez».
// ---------------------------------------------------------------------------
function quitarAcentos(texto) {
    return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

module.exports = {
    Nodos, HORAS_INACTIVO, POR_PAGINA_POR_DEFECTO, POR_PAGINA_MAXIMO,
    ACTIVO, INACTIVO, CALIBRAR
};