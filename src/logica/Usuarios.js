// ---------------------------------------------------------------------------
// Fichero:     Usuarios.js
// Descripción: Gestión administrativa de cuentas (T027 · H018): búsqueda,
//              creación de cuentas de técnico y administrador, cambio de rol
//              y baja lógica.
// ---------------------------------------------------------------------------
'use strict';

const Seguridad = require('./Seguridad');
const Validador = require('./ValidadorUsuario');

const ROLES = ['todos', 'administrador', 'tecnico', 'portador', 'ciudadano'];
const ROLES_CREACION = ['administrador', 'tecnico'];
const ESTADOS = ['todos', 'activo', 'inactivo'];
const POR_PAGINA_DEFECTO = 20;
const POR_PAGINA_MAXIMO = 100;
const BUSQUEDA_MAXIMA = 100;

const SQL_ROL = `CASE
    WHEN esAdministrador = TRUE THEN 'administrador'
    WHEN esTecnico = TRUE THEN 'tecnico'
    WHEN esPortador = TRUE THEN 'portador'
    ELSE 'ciudadano'
END`;

function errorLogica(codigo, mensaje, campos = []) {
    const { ErrorLogica } = require('./Logica');
    return new ErrorLogica(codigo, mensaje, campos);
}

// valor: Texto | N | undefined --> leerEntero() --> N | null
// What it does: parses and bounds a query-string integer.
function leerEntero(valor, porDefecto, minimo, maximo) {
    if (valor === undefined || valor === null || valor === '') return porDefecto;
    const numero = Number(valor);
    return Number.isSafeInteger(numero) && numero >= minimo && numero <= maximo ? numero : null;
}

// fila: FilaBD --> aUsuario() --> UsuarioAdmin
// What it does: returns the public administrative fields, never credentials.
function aUsuario(fila) {
    return {
        idUsuario: fila.idUsuario,
        nombre: fila.nombre,
        apellidos: fila.apellidos,
        correo: fila.correo,
        rol: fila.rol,
        estado: fila.estado,
        fechaAlta: fila.fechaAlta
    };
}

class Usuarios {
    // logica: Logica --> constructor()
    // What it does: uses the database connection owned by Logica.
    constructor(logica) {
        this.logica = logica;
    }

    // filtro: { busqueda, rol, estado, pagina, porPagina }
    //     --> buscar() --> { usuarios: [ UsuarioAdmin ], total }
    // What it does: searches and filters users and returns one page.
    async buscar(filtro = {}) {
        const busquedaOriginal = filtro.busqueda === undefined || filtro.busqueda === '' ? '' : filtro.busqueda;
        const rol = filtro.rol === undefined || filtro.rol === '' ? 'todos' : filtro.rol;
        const estado = filtro.estado === undefined || filtro.estado === '' ? 'todos' : filtro.estado;
        const pagina = leerEntero(filtro.pagina, 1, 1, Number.MAX_SAFE_INTEGER);
        const porPagina = leerEntero(filtro.porPagina, POR_PAGINA_DEFECTO, 1, POR_PAGINA_MAXIMO);
        const campos = [];

        if (typeof busquedaOriginal !== 'string' || busquedaOriginal.trim().length > BUSQUEDA_MAXIMA) {
            campos.push('busqueda');
        }
        if (typeof rol !== 'string' || !ROLES.includes(rol)) campos.push('rol');
        if (typeof estado !== 'string' || !ESTADOS.includes(estado)) campos.push('estado');
        if (pagina === null) campos.push('pagina');
        if (porPagina === null) campos.push('porPagina');
        if (campos.length > 0) {
            throw errorLogica('DATOS_NO_VALIDOS', 'Filtro de usuarios no válido', campos);
        }

        const condiciones = [];
        const parametros = [];
        const busqueda = busquedaOriginal.trim();
        if (busqueda) {
            condiciones.push("LOWER(CONCAT_WS(' ', nombre, apellidos, email)) LIKE LOWER(?)");
            parametros.push(`%${busqueda}%`);
        }
        if (rol !== 'todos') {
            condiciones.push(`${SQL_ROL} = ?`);
            parametros.push(rol);
        }
        if (estado !== 'todos') {
            condiciones.push('estado = ?');
            parametros.push(estado);
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
        const [filasTotal] = await this.logica.conexion.execute(
            `SELECT COUNT(*) AS total FROM Usuarios ${where}`, parametros);
        const total = Number(filasTotal[0].total);
        const [filas] = await this.logica.conexion.execute(
            `SELECT idUsuario, nombre, apellidos, email AS correo, ${SQL_ROL} AS rol, estado, fechaAlta
               FROM Usuarios ${where}
              ORDER BY fechaAlta DESC, idUsuario DESC
              LIMIT ? OFFSET ?`,
            [...parametros, porPagina, (pagina - 1) * porPagina]);

        return { usuarios: filas.map(aUsuario), total };
    }

    // datos: { nombre, apellidos, correo, contrasena, rol }
    //     --> crear() --> UsuarioAdmin
    // What it does: creates an administrator or technician account.
    async crear(datos = {}) {
        const { nombre, apellidos, correo, contrasena, rol } = datos || {};
        const campos = Validador.validarRegistro(nombre, apellidos, correo, contrasena);
        if (typeof rol !== 'string' || !ROLES_CREACION.includes(rol)) campos.push('rol');
        if (campos.length > 0) {
            throw errorLogica('DATOS_NO_VALIDOS', 'Datos de usuario no válidos', campos);
        }

        const hash = await Seguridad.calcularHash(contrasena);
        const permisos = {
            administrador: [true, false],
            tecnico: [false, true]
        }[rol];

        try {
            const [resultado] = await this.logica.conexion.execute(
                `INSERT INTO Usuarios
                    (nombre, apellidos, email, passwordHash, esAdministrador, esTecnico, esPortador)
                 VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
                [nombre.trim(), apellidos.trim(), Validador.normalizarCorreo(correo), hash,
                    permisos[0], permisos[1]]);
            return this.obtener(resultado.insertId);
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw errorLogica('CORREO_YA_REGISTRADO', 'El correo ya tiene una cuenta');
            }
            throw error;
        }
    }

    // idUsuario: N, rol: Texto, idAdministrador: N --> cambiarRol() --> UsuarioAdmin
    // What it does: assigns one role and prevents an administrator demoting themself.
    async cambiarRol(idUsuario, rol, idAdministrador) {
        const id = this.validarId(idUsuario);
        if (id === null || typeof rol !== 'string' || !ROLES.slice(1).includes(rol)) {
            throw errorLogica('DATOS_NO_VALIDOS', 'Datos de rol no válidos',
                [...(id === null ? ['idUsuario'] : []),
                    ...(typeof rol !== 'string' || !ROLES.slice(1).includes(rol) ? ['rol'] : [])]);
        }
        if (id === Number(idAdministrador) && rol !== 'administrador') {
            throw errorLogica('NO_PUEDE_QUITAR_ADMIN_PROPIO',
                'No puedes quitarte tu propio rol de administrador');
        }
        if (!(await this.obtener(id))) {
            throw errorLogica('USUARIO_NO_EXISTE', 'El usuario no existe');
        }

        const permisos = {
            administrador: [true, false, false],
            tecnico: [false, true, false],
            portador: [false, false, true],
            ciudadano: [false, false, false]
        }[rol];
        await this.logica.conexion.execute(
            `UPDATE Usuarios
                SET esAdministrador = ?, esTecnico = ?, esPortador = ?
              WHERE idUsuario = ?`,
            [...permisos, id]);
        return this.obtener(id);
    }

    // idUsuario: N --> darDeBaja() --> UsuarioAdmin
    // What it does: marks a user inactive without deleting account data.
    async darDeBaja(idUsuario) {
        const id = this.validarId(idUsuario);
        if (id === null) {
            throw errorLogica('DATOS_NO_VALIDOS', 'Identificador de usuario no válido', ['idUsuario']);
        }
        if (!(await this.obtener(id))) {
            throw errorLogica('USUARIO_NO_EXISTE', 'El usuario no existe');
        }
        await this.logica.conexion.execute(
            "UPDATE Usuarios SET estado = 'inactivo' WHERE idUsuario = ?", [id]);
        return this.obtener(id);
    }

    // idUsuario: Texto | N --> validarId() --> N | null
    // What it does: accepts only positive safe integer identifiers.
    validarId(idUsuario) {
        const id = Number(idUsuario);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    }

    // idUsuario: N --> obtener() --> UsuarioAdmin | null
    // What it does: loads a user's public administrative fields.
    async obtener(idUsuario) {
        const [filas] = await this.logica.conexion.execute(
            `SELECT idUsuario, nombre, apellidos, email AS correo, ${SQL_ROL} AS rol, estado, fechaAlta
               FROM Usuarios WHERE idUsuario = ?`, [idUsuario]);
        return filas.length === 1 ? aUsuario(filas[0]) : null;
    }
}

module.exports = { Usuarios, ROLES, ESTADOS, POR_PAGINA_DEFECTO, POR_PAGINA_MAXIMO };
