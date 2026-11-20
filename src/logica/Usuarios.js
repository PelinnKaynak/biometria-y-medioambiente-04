// ---------------------------------------------------------------------------
// Fichero:     Usuarios.js
// Descripción: Gestión administrativa de cuentas (T027 · H018): búsqueda,
//              números de cada pestaña, creación de cuentas de técnico y
//              administrador, cambio de rol y baja lógica. Es lo que usa la
//              pantalla Usuarios del panel (web_admin/usuarios.html).
//              Una cuenta puede tener varios roles a la vez (esAdministrador,
//              esTecnico, esPortador); «rol» es solo el más alto.
// ---------------------------------------------------------------------------
'use strict';

const crypto = require('crypto');
const Seguridad = require('./Seguridad');
const Validador = require('./ValidadorUsuario');

const ROLES = ['todos', 'administrador', 'tecnico', 'portador', 'ciudadano'];
const ROLES_CREACION = ['administrador', 'tecnico'];
// Pestañas del panel. Van por los campos de roles, así que una persona
// técnica y portadora sale en Técnicos y en Portadores. Premium no es un
// rol: es quien tiene premiumHasta en el futuro.
const GRUPOS = {
    todos: 'TRUE',
    portadores: 'u.esPortador = TRUE',
    premium: 'u.premiumHasta > UTC_TIMESTAMP()',
    administradores: 'u.esAdministrador = TRUE',
    tecnicos: 'u.esTecnico = TRUE'
};
// pendiente: creada desde el panel, aún no ha elegido su contraseña.
// inactivo: dada de baja.
const ESTADOS = ['todos', 'activo', 'pendiente', 'inactivo'];
const POR_PAGINA_DEFECTO = 20;
const POR_PAGINA_MAXIMO = 100;
const BUSQUEDA_MAXIMA = 100;
const BAJAS_MAXIMAS = 100;

const SQL_ROL = `CASE
    WHEN u.esAdministrador = TRUE THEN 'administrador'
    WHEN u.esTecnico = TRUE THEN 'tecnico'
    WHEN u.esPortador = TRUE THEN 'portador'
    ELSE 'ciudadano'
END`;

// Campos de un UsuarioAdmin; nodo es el número de serie de su sensor vinculado
const SQL_CAMPOS = `u.idUsuario, u.nombre, u.apellidos, u.email AS correo, ${SQL_ROL} AS rol,
       u.esAdministrador, u.esTecnico, u.esPortador, u.estado, u.fechaAlta,
       COALESCE(u.premiumHasta > UTC_TIMESTAMP(), FALSE) AS premium,
       (SELECT s.numeroSerie FROM Sensores s WHERE s.idUsuario = u.idUsuario
         ORDER BY s.idSensor LIMIT 1) AS nodo`;

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
// UsuarioAdmin = { idUsuario, nombre, apellidos, correo, rol, esAdministrador,
//                  esTecnico, esPortador, premium, nodo, estado, fechaAlta }
// What it does: returns the public administrative fields, never credentials.
function aUsuario(fila) {
    return {
        idUsuario: fila.idUsuario,
        nombre: fila.nombre,
        apellidos: fila.apellidos,
        correo: fila.correo,
        rol: fila.rol,
        esAdministrador: Boolean(fila.esAdministrador),
        esTecnico: Boolean(fila.esTecnico),
        esPortador: Boolean(fila.esPortador),
        premium: Boolean(fila.premium),
        nodo: fila.nodo || null,
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

    // filtro: { busqueda, rol, grupo, estado, pagina, porPagina }
    //     --> buscar() --> { usuarios: [ UsuarioAdmin ], total }
    // What it does: searches and filters users and returns one page. rol
    //               filters by the highest role; grupo by the tabs of the
    //               panel (todos, portadores, premium, administradores,
    //               tecnicos), which use the three role fields.
    async buscar(filtro = {}) {
        const busquedaOriginal = filtro.busqueda === undefined || filtro.busqueda === '' ? '' : filtro.busqueda;
        const rol = filtro.rol === undefined || filtro.rol === '' ? 'todos' : filtro.rol;
        const grupo = filtro.grupo === undefined || filtro.grupo === '' ? 'todos' : filtro.grupo;
        const estado = filtro.estado === undefined || filtro.estado === '' ? 'todos' : filtro.estado;
        const pagina = leerEntero(filtro.pagina, 1, 1, Number.MAX_SAFE_INTEGER);
        const porPagina = leerEntero(filtro.porPagina, POR_PAGINA_DEFECTO, 1, POR_PAGINA_MAXIMO);
        const campos = [];

        if (typeof busquedaOriginal !== 'string' || busquedaOriginal.trim().length > BUSQUEDA_MAXIMA) {
            campos.push('busqueda');
        }
        if (typeof rol !== 'string' || !ROLES.includes(rol)) campos.push('rol');
        if (typeof grupo !== 'string' || !Object.prototype.hasOwnProperty.call(GRUPOS, grupo)) campos.push('grupo');
        if (typeof estado !== 'string' || !ESTADOS.includes(estado)) campos.push('estado');
        if (pagina === null) campos.push('pagina');
        if (porPagina === null) campos.push('porPagina');
        if (campos.length > 0) {
            throw errorLogica('DATOS_NO_VALIDOS', 'Filtro de usuarios no válido', campos);
        }

        const condiciones = [GRUPOS[grupo]];
        const parametros = [];
        const busqueda = busquedaOriginal.trim();
        if (busqueda) {
            condiciones.push("LOWER(CONCAT_WS(' ', u.nombre, u.apellidos, u.email)) LIKE LOWER(?)");
            parametros.push(`%${busqueda}%`);
        }
        if (rol !== 'todos') {
            condiciones.push(`${SQL_ROL} = ?`);
            parametros.push(rol);
        }
        if (estado !== 'todos') {
            condiciones.push('u.estado = ?');
            parametros.push(estado);
        }

        const where = `WHERE ${condiciones.join(' AND ')}`;
        const [filasTotal] = await this.logica.conexion.execute(
            `SELECT COUNT(*) AS total FROM Usuarios u ${where}`, parametros);
        const total = Number(filasTotal[0].total);
        // LIMIT y OFFSET ya están validados como enteros
        const [filas] = await this.logica.conexion.query(
            `SELECT ${SQL_CAMPOS}
               FROM Usuarios u ${where}
              ORDER BY u.fechaAlta DESC, u.idUsuario DESC
              LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`,
            parametros);

        return { usuarios: filas.map(aUsuario), total };
    }

    // --> conteo() --> { todos, portadores, premium, administradores, tecnicos }
    // What it does: the number of each tab of the panel, counting every
    //               account whatever its state.
    async conteo() {
        const [[fila]] = await this.logica.conexion.query(
            `SELECT COUNT(*) AS todos,
                    COALESCE(SUM(esPortador = TRUE), 0) AS portadores,
                    COALESCE(SUM(premiumHasta > UTC_TIMESTAMP()), 0) AS premium,
                    COALESCE(SUM(esAdministrador = TRUE), 0) AS administradores,
                    COALESCE(SUM(esTecnico = TRUE), 0) AS tecnicos
               FROM Usuarios`);
        return {
            todos: Number(fila.todos),
            portadores: Number(fila.portadores),
            premium: Number(fila.premium),
            administradores: Number(fila.administradores),
            tecnicos: Number(fila.tecnicos)
        };
    }

    // datos: { nombre, apellidos, correo, contrasena?, rol }
    //     --> crear() --> UsuarioAdmin
    // What it does: creates an administrator or technician account. Without
    //               contrasena (the panel does not ask for one) the account
    //               is «pendiente» with a random password nobody knows, and
    //               the person gets the email to choose theirs (the same as
    //               «recuperar contraseña»). When they choose it, the account
    //               becomes «activo». If the email fails, the account is
    //               still created: they can use «¿Has olvidado tu contraseña?».
    async crear(datos = {}) {
        const { nombre, apellidos, correo, rol } = datos || {};
        const conContrasena = datos && datos.contrasena !== undefined && datos.contrasena !== null
            && datos.contrasena !== '';
        const contrasena = conContrasena ? datos.contrasena : contrasenaAleatoria();
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
        const correoNormalizado = Validador.normalizarCorreo(correo);

        let idUsuario;
        try {
            const [resultado] = await this.logica.conexion.execute(
                `INSERT INTO Usuarios
                    (nombre, apellidos, email, passwordHash, esAdministrador, esTecnico, esPortador, estado)
                 VALUES (?, ?, ?, ?, ?, ?, FALSE, ?)`,
                [nombre.trim(), apellidos.trim(), correoNormalizado, hash,
                    permisos[0], permisos[1], conContrasena ? 'activo' : 'pendiente']);
            idUsuario = resultado.insertId;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw errorLogica('CORREO_YA_REGISTRADO', 'El correo ya tiene una cuenta');
            }
            throw error;
        }

        if (!conContrasena) {
            try {
                await this.logica.solicitarRecuperacion(correoNormalizado);
            } catch (error) {
                console.error(`[usuarios] no se pudo enviar el correo para elegir contraseña: ${error.message}`);
            }
        }
        return this.obtener(idUsuario);
    }

    // idUsuario: N, rol: Texto, idAdministrador: N --> cambiarRol() --> UsuarioAdmin
    // What it does: assigns the administrator, technician, carrier or citizen
    //               role and prevents an administrator demoting themself.
    //               Someone with a linked sensor keeps being a carrier
    //               (esPortador) whatever role they get, so they do not lose
    //               their sensor in the web and the app.
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

        const [[sensores]] = await this.logica.conexion.execute(
            'SELECT COUNT(*) AS cuantos FROM Sensores WHERE idUsuario = ?', [id]);
        const tieneSensor = Number(sensores.cuantos) > 0;
        const permisos = {
            administrador: [true, false],
            tecnico: [false, true],
            portador: [false, false],
            ciudadano: [false, false]
        }[rol];
        const esPortador = rol === 'portador' || tieneSensor;
        await this.logica.conexion.execute(
            `UPDATE Usuarios
                SET esAdministrador = ?, esTecnico = ?, esPortador = ?
              WHERE idUsuario = ?`,
            [...permisos, esPortador, id]);
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

    // ids: [ N ], idAdministrador: N --> darDeBajaVarios() --> { bajas: N }
    // What it does: the «Dar de baja» button of the panel, with several
    //               users at once. All or none: if an id is not valid, does
    //               not exist or is the administrator themself, nobody is
    //               deactivated.
    async darDeBajaVarios(ids, idAdministrador) {
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > BAJAS_MAXIMAS) {
            throw errorLogica('DATOS_NO_VALIDOS', 'Lista de usuarios no válida', ['ids']);
        }
        const validos = [...new Set(ids.map((id) => this.validarId(id)))];
        if (validos.includes(null)) {
            throw errorLogica('DATOS_NO_VALIDOS', 'Identificador de usuario no válido', ['ids']);
        }
        if (validos.includes(Number(idAdministrador))) {
            throw errorLogica('NO_PUEDE_DARSE_DE_BAJA', 'No puedes darte de baja a ti mismo');
        }
        const marcas = validos.map(() => '?').join(', ');
        const [[existentes]] = await this.logica.conexion.execute(
            `SELECT COUNT(*) AS cuantos FROM Usuarios WHERE idUsuario IN (${marcas})`, validos);
        if (Number(existentes.cuantos) !== validos.length) {
            throw errorLogica('USUARIO_NO_EXISTE', 'Algún usuario no existe');
        }
        await this.logica.conexion.execute(
            `UPDATE Usuarios SET estado = 'inactivo' WHERE idUsuario IN (${marcas})`, validos);
        return { bajas: validos.length };
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
            `SELECT ${SQL_CAMPOS} FROM Usuarios u WHERE u.idUsuario = ?`, [idUsuario]);
        return filas.length === 1 ? aUsuario(filas[0]) : null;
    }
}

// --> contrasenaAleatoria() --> Texto
// What it does: a long random password that nobody knows (letters, numbers
//               and a symbol, so it passes the same rules as the others).
function contrasenaAleatoria() {
    return `${crypto.randomBytes(18).toString('base64url')}aA1!`;
}

module.exports = { Usuarios, ROLES, GRUPOS, ESTADOS, POR_PAGINA_DEFECTO, POR_PAGINA_MAXIMO };
