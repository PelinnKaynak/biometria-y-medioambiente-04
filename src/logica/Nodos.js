// ---------------------------------------------------------------------------
// Fichero:     Nodos.js
// Descripción: Lógica de los nodos para el panel de administración (T021).
//              Un nodo es un sensor vinculado a un portador. De cada uno da
//              el número de serie, el portador, la fecha y el sitio de su
//              última medición, la batería y el estado (activo, inactivo o
//              por calibrar), con búsqueda, filtro por estado y páginas.
//              Usa las tablas Sensores, Usuarios y Mediciones de
//              src/bd/usuarios.sql. Diseño en doc/logica_design.md.
//              Tarea T021 · H011. Detección de nodos inactivos con el
//              umbral configurable y marca en Sensores.estado: T022 · H012.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

// Umbral de inactividad por defecto: el mismo que la web
// (UMBRAL_INACTIVO_HORAS en web_admin/js/nodos.js). Se cambia con
// UMBRAL_INACTIVO_HORAS en el .env del servidor (T022), de 1 a 168 horas.
const HORAS_INACTIVO = 24;
const HORAS_INACTIVO_MINIMO = 1;
const HORAS_INACTIVO_MAXIMO = 168;

// Valores de Sensores.estado (los mismos que usa Mediciones.js)
const ESTADO_BD_ACTIVO = 'activo';
const ESTADO_BD_INACTIVO = 'inactivo';
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
           s.estado,
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
// fila: FilaBD, ahora: Date, horasInactivo: N --> aNodo() --> Nodo
// Nodo = { id, portador, ultimaMedicion: Date | null, bateria: N | null,
//          latitud: R | null, longitud: R | null, necesitaCalibrar: V/F,
//          estado: ACTIVO | INACTIVO | CALIBRAR }
// Same keys as the nodes of LogicaAdminFake in the web.
// ---------------------------------------------------------------------------
function aNodo(fila, ahora, horasInactivo = HORAS_INACTIVO) {
    const ultima = fila.ultimaMedicion ? new Date(fila.ultimaMedicion) : null;
    const necesitaCalibrar = Boolean(fila.necesitaCalibracion);
    const inactivo = !ultima || ahora.getTime() - ultima.getTime() > horasInactivo * MS_POR_HORA;
    return {
        id: fila.numeroSerie,
        portador: fila.portador,
        ultimaMedicion: ultima,
        bateria: fila.bateria === null ? null : Number(fila.bateria),
        latitud: fila.latitud === null ? null : Number(fila.latitud),
        longitud: fila.longitud === null ? null : Number(fila.longitud),
        necesitaCalibrar,
        estado: inactivo ? INACTIVO : (necesitaCalibrar ? CALIBRAR : ACTIVO),
        estadoBD: fila.estado
    };
}

// ---------------------------------------------------------------------------
// valor: Texto | N | undefined --> leerUmbral() --> N | null
// What it does: the inactivity threshold in hours written in the .env, or
//               null if it is not a whole number between 1 and 168.
// ---------------------------------------------------------------------------
function leerUmbral(valor) {
    return leerEntero(valor, HORAS_INACTIVO, HORAS_INACTIVO_MINIMO, HORAS_INACTIVO_MAXIMO);
}

class Nodos {

    // -----------------------------------------------------------------------
    // logica: Logica --> constructor()
    // What it does: uses the database connection of Logica. The threshold
    //               starts at 24 hours.
    // -----------------------------------------------------------------------
    constructor(logica) {
        this.logica = logica;
        this.horasInactivo = HORAS_INACTIVO;
    }

    // -----------------------------------------------------------------------
    // horas: Texto | N | undefined --> cambiarUmbral() --> N
    // What it does: sets the inactivity threshold (the server calls it at the
    //               start with UMBRAL_INACTIVO_HORAS of the .env). Empty means
    //               24. Throws DATOS_NO_VALIDOS if it is not a whole number
    //               between 1 and 168. The states are calculated with it from
    //               the next request on.
    // -----------------------------------------------------------------------
    cambiarUmbral(horas) {
        const umbral = leerUmbral(horas);
        if (umbral === null) {
            const { ErrorLogica } = require('./Logica');
            throw new ErrorLogica('DATOS_NO_VALIDOS',
                `El umbral de inactividad tiene que ser un número entero de ${HORAS_INACTIVO_MINIMO} a ${HORAS_INACTIVO_MAXIMO} horas`,
                ['umbralHoras']);
        }
        this.horasInactivo = umbral;
        return umbral;
    }

    // -----------------------------------------------------------------------
    // ahora: Fecha (opcional) --> marcarInactivos() --> { inactivos: N, activos: N }
    // What it does: writes in Sensores.estado the state of each node with the
    //               current threshold: 'inactivo' for those that have been
    //               more than horasInactivo without data and 'activo' for the
    //               rest. Only touches the rows that change and returns how
    //               many changed to each state. The server calls it every hour
    //               and every time the nodes are listed.
    // -----------------------------------------------------------------------
    async marcarInactivos(ahora = new Date()) {
        return this.guardarEstados(await this.leerNodos(ahora));
    }

    // -----------------------------------------------------------------------
    // ahora: Fecha (opcional) --> resumen() --> ResumenNodos
    // ResumenNodos = { total, activos, inactivos24h, inactivos7d, porCalibrar, umbralHoras }
    // What it does: the numbers at the top of the Nodos page. activos +
    //               inactivos24h = total; inactivos24h are those over the
    //               threshold (24 h by default) and inactivos7d the inactive
    //               ones that have not sent anything for more than a week.
    // -----------------------------------------------------------------------
    async resumen(ahora = new Date()) {
        const nodos = await this.todos(ahora);
        const hace7Dias = ahora.getTime() - DIAS_INACTIVO_LARGO * 24 * MS_POR_HORA;
        const resumen = {
            total: nodos.length, activos: 0, inactivos24h: 0, inactivos7d: 0, porCalibrar: 0,
            umbralHoras: this.horasInactivo
        };
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
    //               first), with its state saved in Sensores.estado.
    // -----------------------------------------------------------------------
    async todos(ahora) {
        const nodos = await this.leerNodos(ahora);
        await this.guardarEstados(nodos);
        return nodos.map(({ estadoBD, ...nodo }) => nodo);
    }

    // -----------------------------------------------------------------------
    // ahora: Fecha --> leerNodos() --> [ Nodo con estadoBD ]
    // -----------------------------------------------------------------------
    async leerNodos(ahora) {
        const [filas] = await this.logica.conexion.query(
            `${SQL_NODOS} ORDER BY ultimaMedicion IS NOT NULL, ultimaMedicion ASC, s.numeroSerie`);
        return filas.map((fila) => aNodo(fila, ahora, this.horasInactivo));
    }

    // -----------------------------------------------------------------------
    // nodos: [ Nodo con estadoBD ] --> guardarEstados() --> { inactivos: N, activos: N }
    // What it does: updates Sensores.estado only where it is different.
    // -----------------------------------------------------------------------
    async guardarEstados(nodos) {
        const cambios = { inactivos: [], activos: [] };
        for (const nodo of nodos) {
            const debe = nodo.estado === INACTIVO ? ESTADO_BD_INACTIVO : ESTADO_BD_ACTIVO;
            if (nodo.estadoBD !== debe) {
                (debe === ESTADO_BD_INACTIVO ? cambios.inactivos : cambios.activos).push(nodo.id);
            }
        }
        for (const [estado, ids] of [[ESTADO_BD_INACTIVO, cambios.inactivos], [ESTADO_BD_ACTIVO, cambios.activos]]) {
            if (ids.length > 0) {
                await this.logica.conexion.query('UPDATE Sensores SET estado = ? WHERE numeroSerie IN (?)', [estado, ids]);
            }
        }
        return { inactivos: cambios.inactivos.length, activos: cambios.activos.length };
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
    Nodos, HORAS_INACTIVO, HORAS_INACTIVO_MINIMO, HORAS_INACTIVO_MAXIMO, POR_PAGINA_POR_DEFECTO, POR_PAGINA_MAXIMO,
    ACTIVO, INACTIVO, CALIBRAR
};