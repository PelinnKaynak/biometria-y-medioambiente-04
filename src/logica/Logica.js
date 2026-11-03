// ---------------------------------------------------------------------------
// Fichero:     Logica.js
// Descripción: Lógica de negocio de usuarios y autenticación: registro,
//              inicio y cierre de sesión, comprobación de la sesión y del rol,
//              y recuperación de la contraseña. Es la única parte que habla
//              con la base de datos (MySQL). El servidor REST solo la llama.
//              Diseño en doc/logica_design.md. Tarea T016 · H001, H002.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const mysql = require('mysql2/promise');
const Seguridad = require('./Seguridad');
const Validador = require('./ValidadorUsuario');

const ID_ROL_PORTADOR = 2;          // rol de quien se registra desde la app
const DURACION_SESION_DIAS = 30;
const DURACION_RECUPERACION_MINUTOS = 60;

// ---------------------------------------------------------------------------
// ErrorLogica: error con un código que el servidor REST traduce a HTTP.
//   codigo ∈ { DATOS_NO_VALIDOS, CORREO_YA_REGISTRADO,
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
    // conexion: Pool, enviarCorreo: Función, urlRestablecer: Texto --> constructor()
    // What it does: keeps the BD connection, the function that sends emails
    //               and the web page that opens the recovery link.
    //               Use Logica.crear() instead of new.
    // -----------------------------------------------------------------------
    constructor(conexion, enviarCorreo, urlRestablecer) {
        this.conexion = conexion;
        this.enviarCorreo = enviarCorreo;
        this.urlRestablecer = urlRestablecer;
    }

    // -----------------------------------------------------------------------
    // configBD: { host, port, user, password, database },
    // enviarCorreo: ( destinatario: Texto, asunto: Texto, texto: Texto ) --> Promesa,
    // urlRestablecer: Texto
    //     --> crear() --> Logica
    // What it does: opens the connection pool, checks that the BD answers and
    //               returns the Logica object.
    // -----------------------------------------------------------------------
    static async crear(configBD, enviarCorreo, urlRestablecer) {
        const conexion = mysql.createPool({ ...configBD, waitForConnections: true, connectionLimit: 10 });
        await conexion.query('SELECT 1');
        return new Logica(conexion, enviarCorreo, urlRestablecer);
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
                'INSERT INTO Usuarios (IdRol, Nombre, Apellidos, Email, HashContrasenya) VALUES (?, ?, ?, ?, ?)',
                [ID_ROL_PORTADOR, nombre.trim(), apellidos.trim(), Validador.normalizarCorreo(correo), hash]);
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
            'SELECT IdUsuario, HashContrasenya FROM Usuarios WHERE Email = ?',
            [Validador.normalizarCorreo(correo)]);

        const correcta = filas.length === 1
            && await Seguridad.comprobarContrasenya(contrasena, filas[0].HashContrasenya);
        if (!correcta) {
            throw new ErrorLogica('CREDENCIALES_INCORRECTAS', 'Correo o contraseña incorrectos');
        }
        return this.crearSesion(filas[0].IdUsuario);
    }

    // -----------------------------------------------------------------------
    // token: Texto --> comprobarSesion() --> UsuarioSesion | null
    // What it does: returns { idUsuario, rol } if the token is an open session
    //               that has not expired; null if not.
    // -----------------------------------------------------------------------
    async comprobarSesion(token) {
        if (Validador.estaVacio(token)) {
            return null;
        }
        const [filas] = await this.conexion.execute(
            `SELECT u.IdUsuario, r.Nombre AS Rol
               FROM Sesiones s
               JOIN Usuarios u ON u.IdUsuario = s.IdUsuario
               JOIN Roles r ON r.IdRol = u.IdRol
              WHERE s.HashToken = ? AND s.FechaCaducidad > UTC_TIMESTAMP()`,
            [Seguridad.hashToken(token)]);
        return filas.length === 1 ? { idUsuario: filas[0].IdUsuario, rol: filas[0].Rol } : null;
    }

    // -----------------------------------------------------------------------
    // token: Texto --> cerrarSesion() -->
    // What it does: deletes that session. Nothing happens if it does not exist.
    // -----------------------------------------------------------------------
    async cerrarSesion(token) {
        await this.conexion.execute('DELETE FROM Sesiones WHERE HashToken = ?', [Seguridad.hashToken(token)]);
    }

    // -----------------------------------------------------------------------
    // idUsuario: N --> obtenerUsuario() --> DatosUsuario | null
    // What it does: returns the user's data (never the password hash).
    // -----------------------------------------------------------------------
    async obtenerUsuario(idUsuario) {
        const [filas] = await this.conexion.execute(
            `SELECT u.IdUsuario, u.Nombre, u.Apellidos, u.Email, r.Nombre AS Rol, u.FechaRegistro
               FROM Usuarios u JOIN Roles r ON r.IdRol = u.IdRol
              WHERE u.IdUsuario = ?`,
            [idUsuario]);
        if (filas.length !== 1) {
            return null;
        }
        const f = filas[0];
        return {
            idUsuario: f.IdUsuario, nombre: f.Nombre, apellidos: f.Apellidos,
            correo: f.Email, rol: f.Rol, fechaRegistro: f.FechaRegistro
        };
    }

    // -----------------------------------------------------------------------
    // correo: Texto --> solicitarRecuperacion() --> V/F
    // What it does: if the email has an account, saves a recovery token
    //               (1 hour) and sends the link by email. Returns true if an
    //               email was sent. The REST server answers the same in both
    //               cases.
    // -----------------------------------------------------------------------
    async solicitarRecuperacion(correo) {
        if (!Validador.esCorreoValido(correo)) {
            return false;
        }
        const correoNormalizado = Validador.normalizarCorreo(correo);
        const [filas] = await this.conexion.execute(
            'SELECT IdUsuario, Nombre FROM Usuarios WHERE Email = ?', [correoNormalizado]);
        if (filas.length !== 1) {
            return false;
        }

        const token = Seguridad.generarToken();
        await this.conexion.execute(
            `INSERT INTO RecuperacionesContrasenya (HashToken, IdUsuario, FechaCaducidad)
             VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE)`,
            [Seguridad.hashToken(token), filas[0].IdUsuario, DURACION_RECUPERACION_MINUTOS]);

        const enlace = `${this.urlRestablecer}?token=${token}`;
        await this.enviarCorreo(
            correoNormalizado,
            'AERIS · Recuperar la contraseña',
            `Hola, ${filas[0].Nombre}:\n\n` +
            `Para crear una contraseña nueva abre este enlace (válido durante ${DURACION_RECUPERACION_MINUTOS} minutos):\n` +
            `${enlace}\n\n` +
            'Si no lo has pedido tú, ignora este correo.\n\nEl equipo de AERIS');
        return true;
    }

    // -----------------------------------------------------------------------
    // token: Texto, contrasenaNueva: Texto --> restablecerContrasenya() -->
    // What it does: changes the password if the token is valid, not used and
    //               not expired. The token can only be used once and all the
    //               open sessions of the user are closed.
    //               Throws DATOS_NO_VALIDOS or TOKEN_NO_VALIDO.
    // -----------------------------------------------------------------------
    async restablecerContrasenya(token, contrasenaNueva) {
        if (!Validador.esContrasenaSegura(contrasenaNueva)) {
            throw new ErrorLogica('DATOS_NO_VALIDOS', 'Contraseña no válida', ['contrasena']);
        }
        if (Validador.estaVacio(token)) {
            throw new ErrorLogica('TOKEN_NO_VALIDO', 'El enlace no es válido o ha caducado');
        }
        const hashDelToken = Seguridad.hashToken(token);
        const [filas] = await this.conexion.execute(
            `SELECT IdUsuario FROM RecuperacionesContrasenya
              WHERE HashToken = ? AND Usada = FALSE AND FechaCaducidad > UTC_TIMESTAMP()`,
            [hashDelToken]);
        if (filas.length !== 1) {
            throw new ErrorLogica('TOKEN_NO_VALIDO', 'El enlace no es válido o ha caducado');
        }

        const idUsuario = filas[0].IdUsuario;
        const hash = await Seguridad.calcularHash(contrasenaNueva);
        await this.conexion.execute('UPDATE Usuarios SET HashContrasenya = ? WHERE IdUsuario = ?', [hash, idUsuario]);
        await this.conexion.execute('UPDATE RecuperacionesContrasenya SET Usada = TRUE WHERE HashToken = ?', [hashDelToken]);
        await this.conexion.execute('DELETE FROM Sesiones WHERE IdUsuario = ?', [idUsuario]);
    }

    // -----------------------------------------------------------------------
    // idUsuario: N --> crearSesion() --> SesionIniciada
    // What it does: saves a new session (30 days) and returns
    //               { idUsuario, token, rol, nombre }.
    // -----------------------------------------------------------------------
    async crearSesion(idUsuario) {
        const token = Seguridad.generarToken();
        await this.conexion.execute(
            `INSERT INTO Sesiones (HashToken, IdUsuario, FechaCaducidad)
             VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ? DAY)`,
            [Seguridad.hashToken(token), idUsuario, DURACION_SESION_DIAS]);
        const usuario = await this.obtenerUsuario(idUsuario);
        return { idUsuario, token, rol: usuario.rol, nombre: usuario.nombre };
    }
}

module.exports = { Logica, ErrorLogica };
