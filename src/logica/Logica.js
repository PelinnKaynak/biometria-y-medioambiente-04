// ---------------------------------------------------------------------------
// Fichero:     Logica.js
// Descripción: Lógica de negocio de usuarios y autenticación: registro,
//              inicio de sesión, comprobación de la sesión y del rol, y
//              recuperación de la contraseña, y el aviso de alertas del
//              perfil, la edición de los datos y la foto (T010). Es la única parte que habla con
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
const { crearCorreoBienvenida } = require('./CorreoBienvenida');

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

const TAMANYO_MAXIMO_FOTO = 200000;     // caracteres en base64 (unos 150 KB)

// ---------------------------------------------------------------------------
// foto: Texto --> esFotoValida() --> V/F
// What it does: true if it is base64 text of a JPEG ("/9j/") or a PNG
//               ("iVBOR") that is not too big.
// ---------------------------------------------------------------------------
function esFotoValida(foto) {
    return typeof foto === 'string'
        && foto.length > 0 && foto.length <= TAMANYO_MAXIMO_FOTO
        && /^[A-Za-z0-9+/]+={0,2}$/.test(foto)
        && (foto.startsWith('/9j/') || foto.startsWith('iVBOR'));
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
    // enviarCorreo: ( destinatario: Texto, asunto: Texto, texto: Texto, extra ) --> Promesa,
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
    //               (rol portador), opens a session for him and sends him the
    //               welcome email in the background (if it fails, the sign-up
    //               still works). Throws DATOS_NO_VALIDOS or CORREO_YA_REGISTRADO.
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

        const sesion = await this.crearSesion(idUsuario);
        this.enviarBienvenida(Validador.normalizarCorreo(correo), nombre.trim());   // sin esperar
        return sesion;
    }

    // -----------------------------------------------------------------------
    // correo: Texto, nombre: Texto --> enviarBienvenida() --> Promesa
    // What it does: sends the welcome email (logos of SenseTech and AERIS and
    //               what the app can do). An error is only written in the
    //               server console: it never stops the sign-up.
    // -----------------------------------------------------------------------
    enviarBienvenida(correo, nombre) {
        const mensaje = crearCorreoBienvenida(nombre);
        return Promise.resolve()
            .then(() => this.enviarCorreo(correo, mensaje.asunto, mensaje.texto,
                { html: mensaje.html, adjuntos: mensaje.adjuntos }))
            .catch((error) => console.error(`No se ha podido enviar la bienvenida a ${correo}:`, error.message));
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
            `SELECT idUsuario, nombre, apellidos, email, role, fechaAlta, alertas, premiumHasta, foto
               FROM Usuarios WHERE idUsuario = ?`,
            [idUsuario]);
        if (filas.length !== 1) {
            return null;
        }
        const f = filas[0];
        return {
            idUsuario: f.idUsuario, nombre: f.nombre, apellidos: f.apellidos,
            correo: f.email, rol: f.role, fechaAlta: f.fechaAlta,
            alertas: Boolean(f.alertas), premiumHasta: f.premiumHasta, foto: f.foto
        };
    }

    // -----------------------------------------------------------------------
    // idUsuario: N, nombre: Texto, apellidos: Texto, correo: Texto
    //     --> actualizarDatos() --> DatosBasicos
    // What it does: changes the name, surname and email of the user (same
    //               rules as the sign-up) and returns { nombre, apellidos,
    //               correo }. Throws DATOS_NO_VALIDOS (with the wrong fields)
    //               or CORREO_YA_REGISTRADO if another account has that email.
    // -----------------------------------------------------------------------
    async actualizarDatos(idUsuario, nombre, apellidos, correo) {
        const erroneos = [];
        if (!Validador.esNombreValido(nombre, 50)) erroneos.push('nombre');
        if (!Validador.esNombreValido(apellidos, 100)) erroneos.push('apellidos');
        if (!Validador.esCorreoValido(correo)) erroneos.push('correo');
        if (erroneos.length > 0) {
            throw new ErrorLogica('DATOS_NO_VALIDOS', 'Datos no válidos', erroneos);
        }
        const datos = {
            nombre: nombre.trim(), apellidos: apellidos.trim(), correo: Validador.normalizarCorreo(correo)
        };
        try {
            await this.conexion.execute(
                'UPDATE Usuarios SET nombre = ?, apellidos = ?, email = ? WHERE idUsuario = ?',
                [datos.nombre, datos.apellidos, datos.correo, idUsuario]);
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new ErrorLogica('CORREO_YA_REGISTRADO', 'El correo ya tiene una cuenta');
            }
            throw error;
        }
        return datos;
    }

    // -----------------------------------------------------------------------
    // idUsuario: N, contrasenaActual: Texto, contrasenaNueva: Texto
    //     --> cambiarContrasenya() --> SesionIniciada
    // What it does: changes the password if the current one is right. The old
    //               session tokens stop working (other phones are logged out),
    //               so it returns a new session for this phone.
    //               Throws DATOS_NO_VALIDOS (weak new password) or
    //               CONTRASENA_INCORRECTA (the current one is wrong).
    // -----------------------------------------------------------------------
    async cambiarContrasenya(idUsuario, contrasenaActual, contrasenaNueva) {
        if (!Validador.esContrasenaSegura(contrasenaNueva)) {
            throw new ErrorLogica('DATOS_NO_VALIDOS', 'Contraseña no válida', ['contrasenaNueva']);
        }
        const [filas] = await this.conexion.execute(
            'SELECT passwordHash FROM Usuarios WHERE idUsuario = ?', [idUsuario]);
        const correcta = filas.length === 1 && typeof contrasenaActual === 'string'
            && await Seguridad.comprobarContrasenya(contrasenaActual, filas[0].passwordHash);
        if (!correcta) {
            throw new ErrorLogica('CONTRASENA_INCORRECTA', 'La contraseña actual no es correcta');
        }
        const hash = await Seguridad.calcularHash(contrasenaNueva);
        await this.conexion.execute('UPDATE Usuarios SET passwordHash = ? WHERE idUsuario = ?', [hash, idUsuario]);
        return this.crearSesion(idUsuario);
    }

    // -----------------------------------------------------------------------
    // idUsuario: N, foto: Texto | null --> cambiarFoto() -->
    // What it does: saves the profile photo (a JPEG or PNG in base64, at most
    //               TAMANYO_MAXIMO_FOTO characters), or deletes it with null.
    //               Throws DATOS_NO_VALIDOS if it is not a valid image.
    // -----------------------------------------------------------------------
    async cambiarFoto(idUsuario, foto) {
        if (foto !== null && !esFotoValida(foto)) {
            throw new ErrorLogica('DATOS_NO_VALIDOS', 'La foto no es válida', ['foto']);
        }
        await this.conexion.execute('UPDATE Usuarios SET foto = ? WHERE idUsuario = ?', [foto, idUsuario]);
    }

    // -----------------------------------------------------------------------
    // idUsuario: N, alertas: V/F --> cambiarAlertas() -->
    // What it does: saves if the user wants to receive notifications
    //               (column alertas). Throws DATOS_NO_VALIDOS if alertas is
    //               not true or false. Used by the Perfil screen (T010).
    // -----------------------------------------------------------------------
    async cambiarAlertas(idUsuario, alertas) {
        if (typeof alertas !== 'boolean') {
            throw new ErrorLogica('DATOS_NO_VALIDOS', 'alertas tiene que ser true o false', ['alertas']);
        }
        await this.conexion.execute('UPDATE Usuarios SET alertas = ? WHERE idUsuario = ?',
            [alertas, idUsuario]);
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
