// ---------------------------------------------------------------------------
// Fichero:     Logica.js
// Descripción: Lógica de negocio de usuarios y autenticación: registro,
//              inicio de sesión, comprobación de la sesión y del rol, y
//              recuperación de la contraseña. Es la única parte que habla con
//              la base de datos (MySQL, tabla Usuarios). Las sesiones y los
//              enlaces de recuperación son tokens firmados: no usan tablas.
//              Diseño en doc/logica_design.md. Tarea T016 · H001, H002.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const mysql = require('mysql2/promise');
const Seguridad = require('./Seguridad');
const Validador = require('./ValidadorUsuario');

const ROL_PORTADOR = 'portador';        // rol de quien se registra desde la app
const DURACION_SESION_SEGUNDOS = 30 * 24 * 60 * 60;      // 30 días
const DURACION_RECUPERACION_SEGUNDOS = 30 * 60;          // 30 minutos (criterio de T003)
const TIPO_SESION = 'sesion';
const TIPO_RECUPERACION = 'recuperacion';

// ---------------------------------------------------------------------------
// ErrorLogica: error con un código que el servidor REST traduce a HTTP.
//   codigo ∈ { DATOS_NO_VALIDOS, CORREO_YA_REGISTRADO, CORREO_NO_REGISTRADO,
//              CREDENCIALES_INCORRECTAS, TOKEN_NO_VALIDO }
// ---------------------------------------------------------------------------
class ErrorLogica extends Error {
    constructor(codigo, mensaje, campos = []) {
        super(mensaje);
        this.name = 'ErrorLogica';
        this.codigo = codigo;
        this.campos = campos;
    }
}

// ---------------------------------------------------------------------------
// Logica class: business logic of users and authentication.
// ---------------------------------------------------------------------------
class Logica {

    // -----------------------------------------------------------------------
    // conexion: Pool, enviarCorreo: Función, urlRestablecer: Texto, claveTokens: Texto
    //     --> constructor()
    // What it does: keeps the BD connection, the function that sends emails,
    //               the web page that opens the recovery link and the secret
    //               key that signs the tokens. Use Logica.crear() instead of new.
    // -----------------------------------------------------------------------
    constructor(conexion, enviarCorreo, urlRestablecer, claveTokens) {
        this.conexion = conexion;
        this.enviarCorreo = enviarCorreo;
        this.urlRestablecer = urlRestablecer;
        this.claveTokens = claveTokens;
    }

    // -----------------------------------------------------------------------
    // configBD: { host, port, user, password, database },
    // enviarCorreo: ( destinatario: Texto, asunto: Texto, texto: Texto ) --> Promesa,
    // urlRestablecer: Texto, claveTokens: Texto
    //     --> crear() --> Logica
    // What it does: opens the connection pool, checks that the BD answers and
    //               returns the Logica object.
    // -----------------------------------------------------------------------
    static async crear(configBD, enviarCorreo, urlRestablecer, claveTokens) {
        if (Validador.estaVacio(claveTokens)) {
            throw new Error('Falta la clave para firmar los tokens');
        }
        // timezone 'Z': las fechas de la BD están en UTC
        const conexion = mysql.createPool({ ...configBD, timezone: 'Z', waitForConnections: true, connectionLimit: 10 });
        await conexion.query('SELECT 1');
        return new Logica(conexion, enviarCorreo, urlRestablecer, claveTokens);
    }

    // -----------------------------------------------------------------------
    // --> cerrar() -->
    // What it does: closes the connection pool.
    // -----------------------------------------------------------------------
    async cerrar() {
        await this.conexion.end();
    }

    // -----------------------------------------------------------------------
    // nombre: Texto, apellidos: Texto, correo: Texto, contrasena: Texto
    //     --> registrarUsuario() --> SesionIniciada
    // What it does: checks the data, saves the user with the password hash
    //               (rol portador) and opens a session for him.
    //               Throws DATOS_NO_VALIDOS or CORREO_YA_REGISTRADO.
    // -----------------------------------------------------------------------
    async registrarUsuario(nombre, apellidos, correo, contrasena) {
        const erroneos = Validador.validarRegistro(nombre, apellidos, correo, contrasena);
        if (erroneos.length > 0) {
            throw new ErrorLogica('DATOS_NO_VALIDOS', 'Datos de registro no válidos', erroneos);
        }

        const hash = await Seguridad.calcularHash(contrasena);
        let idUsuario;
        try {
            const [resultado] = await this.conexion.execute(
                'INSERT INTO Usuarios (role, nombre, apellidos, email, passwordHash) VALUES (?, ?, ?, ?, ?)',
                [ROL_PORTADOR, nombre.trim(), apellidos.trim(), Validador.normalizarCorreo(correo), hash]);
            idUsuario = resultado.insertId;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new ErrorLogica('CORREO_YA_REGISTRADO', 'El correo ya tiene una cuenta');
            }
            throw error;
        }

        return this.crearSesion(idUsuario);
    }

    // -----------------------------------------------------------------------
    // correo: Texto, contrasena: Texto --> iniciarSesion() --> SesionIniciada
    // What it does: opens a session if the email and the password are right.
    //               Throws CREDENCIALES_INCORRECTAS (same error if the email
    //               does not exist, so nobody can find out which emails exist).
    // -----------------------------------------------------------------------
    async iniciarSesion(correo, contrasena) {
        if (Validador.estaVacio(correo) || typeof contrasena !== 'string' || contrasena.length === 0) {
            throw new ErrorLogica('CREDENCIALES_INCORRECTAS', 'Correo o contraseña incorrectos');
        }
        const [filas] = await this.conexion.execute(
            'SELECT idUsuario, passwordHash FROM Usuarios WHERE email = ?',
            [Validador.normalizarCorreo(correo)]);

        const correcta = filas.length === 1
            && await Seguridad.comprobarContrasenya(contrasena, filas[0].passwordHash);
        if (!correcta) {
            throw new ErrorLogica('CREDENCIALES_INCORRECTAS', 'Correo o contraseña incorrectos');
        }
        return this.crearSesion(filas[0].idUsuario);
    }

    // -----------------------------------------------------------------------
    // token: Texto --> comprobarSesion() --> UsuarioSesion | null
    // What it does: returns { idUsuario, rol } if the token is a session token
    //               signed by this server, not expired, and the password has
    //               not changed since; null if not. The rol is read from the
    //               BD, so a rol change counts at once.
    // -----------------------------------------------------------------------
    async comprobarSesion(token) {
        const usuario = await this.leerTokenDeUsuario(token, TIPO_SESION);
        return usuario ? { idUsuario: usuario.idUsuario, rol: usuario.role } : null;
    }

    // -----------------------------------------------------------------------
    // idUsuario: N --> obtenerUsuario() --> DatosUsuario | null
    // What it does: returns the user's data (never the password hash).
    // -----------------------------------------------------------------------
    async obtenerUsuario(idUsuario) {
        const [filas] = await this.conexion.execute(
            `SELECT idUsuario, nombre, apellidos, email, role, fechaAlta, premiumHasta
               FROM Usuarios WHERE idUsuario = ?`,
            [idUsuario]);
        if (filas.length !== 1) {
            return null;
        }
        const f = filas[0];
        return {
            idUsuario: f.idUsuario, nombre: f.nombre, apellidos: f.apellidos,
            correo: f.email, rol: f.role, fechaAlta: f.fechaAlta, premiumHasta: f.premiumHasta
        };
    }

    // -----------------------------------------------------------------------
    // correo: Texto --> solicitarRecuperacion() -->
    // What it does: if the email has an account, makes a signed recovery token
    //               (30 minutes) and sends the link by email.
    //               Throws DATOS_NO_VALIDOS if the email is not valid and
    //               CORREO_NO_REGISTRADO if it has no account (no email is sent).
    // -----------------------------------------------------------------------
    async solicitarRecuperacion(correo) {
        if (!Validador.esCorreoValido(correo)) {
            throw new ErrorLogica('DATOS_NO_VALIDOS', 'El correo no tiene un formato válido', ['correo']);
        }
        const correoNormalizado = Validador.normalizarCorreo(correo);
        const [filas] = await this.conexion.execute(
            'SELECT idUsuario, nombre, passwordHash FROM Usuarios WHERE email = ?', [correoNormalizado]);
        if (filas.length !== 1) {
            throw new ErrorLogica('CORREO_NO_REGISTRADO', 'No hay ninguna cuenta con este correo');
        }

        const token = this.crearToken(filas[0], TIPO_RECUPERACION, DURACION_RECUPERACION_SEGUNDOS);
        const enlace = `${this.urlRestablecer}?token=${token}`;
        await this.enviarCorreo(
            correoNormalizado,
            'AERIS · Recuperar la contraseña',
            `Hola, ${filas[0].nombre}:\n\n` +
            `Para crear una contraseña nueva abre este enlace (válido durante ${DURACION_RECUPERACION_SEGUNDOS / 60} minutos):\n` +
            `${enlace}\n\n` +
            'Si no lo has pedido tú, ignora este correo.\n\nEl equipo de AERIS');
    }

    // -----------------------------------------------------------------------
    // token: Texto, contrasenaNueva: Texto --> restablecerContrasenya() -->
    // What it does: changes the password if the link token is valid and not
    //               expired. As the password changes, the same link cannot be
    //               used again and all the open sessions stop working.
    //               Throws DATOS_NO_VALIDOS or TOKEN_NO_VALIDO.
    // -----------------------------------------------------------------------
    async restablecerContrasenya(token, contrasenaNueva) {
        if (!Validador.esContrasenaSegura(contrasenaNueva)) {
            throw new ErrorLogica('DATOS_NO_VALIDOS', 'Contraseña no válida', ['contrasena']);
        }
        const usuario = await this.leerTokenDeUsuario(token, TIPO_RECUPERACION);
        if (!usuario) {
            throw new ErrorLogica('TOKEN_NO_VALIDO', 'El enlace no es válido o ha caducado');
        }
        const hash = await Seguridad.calcularHash(contrasenaNueva);
        await this.conexion.execute('UPDATE Usuarios SET passwordHash = ? WHERE idUsuario = ?',
            [hash, usuario.idUsuario]);
    }

    // -----------------------------------------------------------------------
    // idUsuario: N --> crearSesion() --> SesionIniciada
    // What it does: makes a signed session token (30 days) and returns
    //               { idUsuario, token, rol, nombre }.
    // -----------------------------------------------------------------------
    async crearSesion(idUsuario) {
        const [filas] = await this.conexion.execute(
            'SELECT idUsuario, nombre, role, passwordHash FROM Usuarios WHERE idUsuario = ?', [idUsuario]);
        const usuario = filas[0];
        const token = this.crearToken(usuario, TIPO_SESION, DURACION_SESION_SEGUNDOS);
        return { idUsuario, token, rol: usuario.role, nombre: usuario.nombre };
    }

    // -----------------------------------------------------------------------
    // usuario: { idUsuario, passwordHash }, tipo: Texto, segundos: N
    //     --> crearToken() --> Texto
    // What it does: signs { u: idUsuario, t: tipo, exp, h: huella de la contraseña }.
    // -----------------------------------------------------------------------
    crearToken(usuario, tipo, segundos) {
        return Seguridad.firmarToken({
            u: usuario.idUsuario,
            t: tipo,
            exp: Math.floor(Date.now() / 1000) + segundos,
            h: Seguridad.huellaContrasenya(usuario.passwordHash)
        }, this.claveTokens);
    }

    // -----------------------------------------------------------------------
    // token: Texto, tipo: Texto --> leerTokenDeUsuario() --> FilaUsuario | null
    // What it does: checks the signature, expiry and type of the token, reads
    //               the user and checks that the password has not changed
    //               since the token was made. Returns the user's row or null.
    // -----------------------------------------------------------------------
    async leerTokenDeUsuario(token, tipo) {
        const datos = Seguridad.leerToken(token, this.claveTokens);
        if (!datos || datos.t !== tipo || !Number.isInteger(datos.u)) {
            return null;
        }
        const [filas] = await this.conexion.execute(
            'SELECT idUsuario, role, passwordHash FROM Usuarios WHERE idUsuario = ?', [datos.u]);
        if (filas.length !== 1 || Seguridad.huellaContrasenya(filas[0].passwordHash) !== datos.h) {
            return null;
        }
        return filas[0];
    }
}

module.exports = { Logica, ErrorLogica };
