// ---------------------------------------------------------------------------
// Fichero:     Logica.js
// Descripción: Lógica de negocio de usuarios y autenticación: registro,
//              inicio de sesión, comprobación de la sesión y del rol, y
//              recuperación de la contraseña, y el aviso de alertas del
//              perfil, la edición de los datos y la foto (T010), y la
//              vinculación de sensores confirmada por correo (T005). Es la
//              única parte que habla con la base de datos (MySQL, tablas
//              Usuarios y Sensores). Las sesiones y los enlaces de
//              recuperación y de vinculación son tokens firmados: no usan tablas.
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
const { crearCorreoRecuperacion } = require('./CorreoRecuperacion');
const { crearCorreoVinculacion } = require('./CorreoVinculacion');

const ROL_PORTADOR = 'portador';        // rol de quien se registra desde la app
const DURACION_SESION_SEGUNDOS = 30 * 24 * 60 * 60;      // 30 días
const DURACION_RECUPERACION_SEGUNDOS = 30 * 60;          // 30 minutos (criterio de T003)
const TIPO_SESION = 'sesion';
const TIPO_RECUPERACION = 'recuperacion';
const TIPO_VINCULACION = 'vinculacion';
const DURACION_VINCULACION_SEGUNDOS = 48 * 60 * 60;     // 48 horas (diseño de Figma)
const ESTADO_PENDIENTE = 'pendiente';
const ESTADO_CONFIRMADA = 'confirmada';
const ESTADO_RECHAZADA = 'rechazada';

// ---------------------------------------------------------------------------
// ErrorLogica: error con un código que el servidor REST traduce a HTTP.
//   codigo ∈ { DATOS_NO_VALIDOS, CORREO_YA_REGISTRADO, CORREO_NO_REGISTRADO,
//              CREDENCIALES_INCORRECTAS, TOKEN_NO_VALIDO,
//              SENSOR_NO_REGISTRADO, SENSOR_YA_VINCULADO, SIN_SOLICITUD }
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
const MENSAJE_CONTRASENA_IGUAL = 'La contraseña nueva tiene que ser distinta de la actual';

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
// correo: Texto --> ocultarCorreo() --> Texto
// What it does: keeps the first letter and the domain:
//               «pkaynak@upv.edu.es» -> «p•••••@upv.edu.es». The app only
//               sees this, never the buyer's full e-mail.
// ---------------------------------------------------------------------------
function ocultarCorreo(correo) {
    const arroba = String(correo || '').indexOf('@');
    return arroba > 0 ? correo[0] + '•••••' + correo.substring(arroba) : '•••••';
}

// ---------------------------------------------------------------------------
// Logica class: business logic of users and authentication.
// ---------------------------------------------------------------------------
class Logica {

    // -----------------------------------------------------------------------
    // conexion: Pool, enviarCorreo: Función, urlRestablecer: Texto, claveTokens: Texto,
    // urlVinculacion: Texto
    //     --> constructor()
    // What it does: keeps the BD connection, the function that sends emails,
    //               the web page that opens the recovery link, the secret
    //               key that signs the tokens and the address of the links
    //               of the linking e-mail (by default, /responderVinculacion
    //               on the same server as urlRestablecer). Use Logica.crear()
    //               instead of new.
    // -----------------------------------------------------------------------
    constructor(conexion, enviarCorreo, urlRestablecer, claveTokens, urlVinculacion) {
        this.conexion = conexion;
        this.enviarCorreo = enviarCorreo;
        this.urlRestablecer = urlRestablecer;
        this.claveTokens = claveTokens;
        this.urlVinculacion = urlVinculacion || `${new URL(urlRestablecer).origin}/responderVinculacion`;
    }

    // -----------------------------------------------------------------------
    // configBD: { host, port, user, password, database },
    // enviarCorreo: ( destinatario: Texto, asunto: Texto, texto: Texto, extra ) --> Promesa,
    // urlRestablecer: Texto, claveTokens: Texto, urlVinculacion: Texto (opcional)
    //     --> crear() --> Logica
    // What it does: opens the connection pool, checks that the BD answers and
    //               returns the Logica object.
    // -----------------------------------------------------------------------
    static async crear(configBD, enviarCorreo, urlRestablecer, claveTokens, urlVinculacion) {
        if (Validador.estaVacio(claveTokens)) {
            throw new Error('Falta la clave para firmar los tokens');
        }
        // timezone 'Z': las fechas de la BD están en UTC
        const conexion = mysql.createPool({ ...configBD, timezone: 'Z', waitForConnections: true, connectionLimit: 10 });
        await conexion.query('SELECT 1');
        return new Logica(conexion, enviarCorreo, urlRestablecer, claveTokens, urlVinculacion);
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
        if (contrasenaNueva === contrasenaActual) {
            throw new ErrorLogica('DATOS_NO_VALIDOS', MENSAJE_CONTRASENA_IGUAL, ['contrasenaNueva']);
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
        const mensaje = crearCorreoRecuperacion(filas[0].nombre, enlace, DURACION_RECUPERACION_SEGUNDOS / 60);
        await this.enviarCorreo(correoNormalizado, mensaje.asunto, mensaje.texto,
            { html: mensaje.html, adjuntos: mensaje.adjuntos });
    }

    // -----------------------------------------------------------------------
    // token: Texto, contrasenaNueva: Texto --> restablecerContrasenya() -->
    // What it does: changes the password if the link token is valid and not
    //               expired and the new one is not the same as the current one. As the password changes, the same link cannot be
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
        if (await Seguridad.comprobarContrasenya(contrasenaNueva, usuario.passwordHash)) {
            throw new ErrorLogica('DATOS_NO_VALIDOS', MENSAJE_CONTRASENA_IGUAL, ['contrasena']);
        }
        const hash = await Seguridad.calcularHash(contrasenaNueva);
        await this.conexion.execute('UPDATE Usuarios SET passwordHash = ? WHERE idUsuario = ?',
            [hash, usuario.idUsuario]);
    }

    // =======================================================================
    // Vinculación de sensores confirmada por correo (T005)
    // =======================================================================

    // -----------------------------------------------------------------------
    // idUsuario: N, numeroSerie: Texto, sensibilidad: R | null
    //     --> solicitarVinculacion() --> Solicitud
    // Solicitud = { numeroSerie, correoComprador (oculto), estado, fecha }
    // What it does: the user has scanned the label of a sensor. Saves the
    //               request in the sensor (pending, with the date) and sends
    //               the e-mail to whoever bought it (correoCompra), with a
    //               link to confirm and another to reject (48 h). If the
    //               sensor is already his, answers «confirmada» without
    //               sending anything. If the e-mail fails it is only written
    //               in the console: the request stays and can be re-sent.
    //               Throws DATOS_NO_VALIDOS (serial is not 12 digits or the
    //               sensitivity is not a number), SENSOR_NO_REGISTRADO or
    //               SENSOR_YA_VINCULADO (it belongs to another account).
    // -----------------------------------------------------------------------
    async solicitarVinculacion(idUsuario, numeroSerie, sensibilidad) {
        const serie = String(numeroSerie || '').trim();
        if (!/^\d{12}$/.test(serie)) {
            throw new ErrorLogica('DATOS_NO_VALIDOS', 'El número de serie no es válido', ['numeroSerie']);
        }
        if (sensibilidad !== undefined && sensibilidad !== null
            && (typeof sensibilidad !== 'number' || !Number.isFinite(sensibilidad))) {
            throw new ErrorLogica('DATOS_NO_VALIDOS', 'La sensibilidad no es válida', ['sensibilidad']);
        }
        const [filas] = await this.conexion.execute(
            'SELECT idSensor, numeroSerie, correoCompra, idUsuario FROM Sensores WHERE numeroSerie = ?', [serie]);
        if (filas.length !== 1) {
            throw new ErrorLogica('SENSOR_NO_REGISTRADO', 'Este sensor no está registrado');
        }
        const sensor = filas[0];
        if (sensor.idUsuario === idUsuario) {
            return { numeroSerie: serie, correoComprador: ocultarCorreo(sensor.correoCompra),
                estado: ESTADO_CONFIRMADA, fecha: new Date() };
        }
        if (sensor.idUsuario !== null) {
            throw new ErrorLogica('SENSOR_YA_VINCULADO', 'Este sensor ya está vinculado a otra cuenta');
        }
        const fecha = this.ahoraEnSegundos();
        await this.conexion.execute(
            `UPDATE Sensores SET sensibilidad = COALESCE(?, sensibilidad), idSolicitante = ?,
                    estadoSolicitud = ?, fechaSolicitud = ? WHERE idSensor = ?`,
            [typeof sensibilidad === 'number' ? sensibilidad : null, idUsuario, ESTADO_PENDIENTE, fecha, sensor.idSensor]);
        await this.enviarCorreoVinculacion(sensor, idUsuario, fecha);
        return { numeroSerie: serie, correoComprador: ocultarCorreo(sensor.correoCompra),
            estado: ESTADO_PENDIENTE, fecha };
    }

    // -----------------------------------------------------------------------
    // idUsuario: N --> estadoVinculacion() --> Solicitud
    // What it does: the user's last request. A pending one older than 48 h
    //               counts as «rechazada» (the link has expired). Throws
    //               SIN_SOLICITUD if he has not asked for any.
    // -----------------------------------------------------------------------
    async estadoVinculacion(idUsuario) {
        const sensor = await this.ultimaSolicitud(idUsuario);
        if (!sensor) {
            throw new ErrorLogica('SIN_SOLICITUD', 'No has pedido vincular ningún sensor');
        }
        let estado = sensor.estadoSolicitud;
        if (estado === ESTADO_PENDIENTE && this.haCaducado(sensor.fechaSolicitud)) {
            estado = ESTADO_RECHAZADA;
        }
        return { numeroSerie: sensor.numeroSerie, correoComprador: ocultarCorreo(sensor.correoCompra),
            estado, fecha: sensor.fechaSolicitud };
    }

    // -----------------------------------------------------------------------
    // idUsuario: N --> reenviarCorreoVinculacion() -->
    // What it does: sends the e-mail of the pending request again with a new
    //               date: the 48 h start again and the old links stop
    //               working. Throws SIN_SOLICITUD if there is no pending one.
    // -----------------------------------------------------------------------
    async reenviarCorreoVinculacion(idUsuario) {
        const sensor = await this.ultimaSolicitud(idUsuario);
        if (!sensor || sensor.estadoSolicitud !== ESTADO_PENDIENTE) {
            throw new ErrorLogica('SIN_SOLICITUD', 'No hay ninguna vinculación pendiente');
        }
        const fecha = this.ahoraEnSegundos();
        await this.conexion.execute('UPDATE Sensores SET fechaSolicitud = ? WHERE idSensor = ?',
            [fecha, sensor.idSensor]);
        await this.enviarCorreoVinculacion(sensor, idUsuario, fecha);
    }

    // -----------------------------------------------------------------------
    // token: Texto, acepta: V/F --> responderVinculacion() --> Respuesta
    // Respuesta = { estado, numeroSerie, nombreSolicitante }
    // What it does: the buyer has pressed a button of the e-mail. If the
    //               link is valid (signed, not expired, and it is the last
    //               e-mail of a request that is still pending), links the
    //               sensor to the user who asked (acepta) or rejects it.
    //               Throws TOKEN_NO_VALIDO otherwise.
    // -----------------------------------------------------------------------
    async responderVinculacion(token, acepta) {
        const datos = Seguridad.leerToken(token, this.claveTokens);
        if (!datos || datos.t !== TIPO_VINCULACION || !Number.isInteger(datos.s) || !Number.isInteger(datos.u)) {
            throw new ErrorLogica('TOKEN_NO_VALIDO', 'El enlace no es válido o ha caducado');
        }
        const [filas] = await this.conexion.execute(
            `SELECT s.idSensor, s.numeroSerie, s.idUsuario, s.idSolicitante, s.estadoSolicitud, s.fechaSolicitud,
                    u.nombre, u.apellidos
               FROM Sensores s JOIN Usuarios u ON u.idUsuario = s.idSolicitante
              WHERE s.idSensor = ?`, [datos.s]);
        const sensor = filas[0];
        if (!sensor || sensor.idSolicitante !== datos.u || sensor.estadoSolicitud !== ESTADO_PENDIENTE
            || Math.floor(sensor.fechaSolicitud.getTime() / 1000) !== datos.f || sensor.idUsuario !== null) {
            throw new ErrorLogica('TOKEN_NO_VALIDO', 'El enlace no es válido o ya se ha usado');
        }
        if (acepta) {
            await this.conexion.execute(
                'UPDATE Sensores SET idUsuario = ?, estadoSolicitud = ? WHERE idSensor = ?',
                [datos.u, ESTADO_CONFIRMADA, sensor.idSensor]);
        } else {
            await this.conexion.execute('UPDATE Sensores SET estadoSolicitud = ? WHERE idSensor = ?',
                [ESTADO_RECHAZADA, sensor.idSensor]);
        }
        return { estado: acepta ? ESTADO_CONFIRMADA : ESTADO_RECHAZADA,
            numeroSerie: sensor.numeroSerie, nombreSolicitante: `${sensor.nombre} ${sensor.apellidos}` };
    }

    // -----------------------------------------------------------------------
    // sensor: { idSensor, numeroSerie, correoCompra }, idUsuario: N, fecha: Date
    //     --> enviarCorreoVinculacion() -->
    // What it does: signs the link token { s: idSensor, u: idUsuario,
    //               f: fecha in seconds } (48 h) and sends the e-mail to
    //               correoCompra. A failure is only written in the console.
    // -----------------------------------------------------------------------
    async enviarCorreoVinculacion(sensor, idUsuario, fecha) {
        const [filas] = await this.conexion.execute(
            'SELECT nombre, apellidos, email FROM Usuarios WHERE idUsuario = ?', [idUsuario]);
        const usuario = filas[0];
        const token = Seguridad.firmarToken({
            s: sensor.idSensor, u: idUsuario, t: TIPO_VINCULACION,
            f: Math.floor(fecha.getTime() / 1000),
            exp: Math.floor(fecha.getTime() / 1000) + DURACION_VINCULACION_SEGUNDOS
        }, this.claveTokens);
        const mensaje = crearCorreoVinculacion({
            nombreSolicitante: `${usuario.nombre} ${usuario.apellidos}`, correoSolicitante: usuario.email,
            numeroSerie: sensor.numeroSerie, fecha,
            enlaceSi: `${this.urlVinculacion}?token=${token}&respuesta=si`,
            enlaceNo: `${this.urlVinculacion}?token=${token}&respuesta=no`,
            horas: DURACION_VINCULACION_SEGUNDOS / 3600
        });
        try {
            await this.enviarCorreo(sensor.correoCompra, mensaje.asunto, mensaje.texto,
                { html: mensaje.html, adjuntos: mensaje.adjuntos });
        } catch (error) {
            console.error(`No se ha podido enviar el correo de vinculación a ${sensor.correoCompra}:`, error.message);
        }
    }

    // idUsuario: N --> ultimaSolicitud() --> FilaSensor | null   (la más reciente)
    async ultimaSolicitud(idUsuario) {
        const [filas] = await this.conexion.execute(
            `SELECT idSensor, numeroSerie, correoCompra, estadoSolicitud, fechaSolicitud FROM Sensores
              WHERE idSolicitante = ? AND fechaSolicitud IS NOT NULL
              ORDER BY fechaSolicitud DESC, idSensor DESC LIMIT 1`, [idUsuario]);
        return filas[0] || null;
    }

    // fecha: Date --> haCaducado() --> V/F   (más de 48 h)
    haCaducado(fecha) {
        return Date.now() - fecha.getTime() > DURACION_VINCULACION_SEGUNDOS * 1000;
    }

    // --> ahoraEnSegundos() --> Date   (sin milisegundos: es lo que guarda DATETIME)
    ahoraEnSegundos() {
        return new Date(Math.floor(Date.now() / 1000) * 1000);
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

module.exports = { Logica, ErrorLogica, ocultarCorreo };
