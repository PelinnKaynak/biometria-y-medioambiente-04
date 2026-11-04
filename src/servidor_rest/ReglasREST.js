// ---------------------------------------------------------------------------
// Fichero:     ReglasREST.js
// Descripción: Rutas REST de usuarios y autenticación. Cada ruta lee la
//              petición, llama a la lógica y traduce el resultado a HTTP.
//              Contrato completo en doc/servidor_rest_design.md. Tareas T016 y T010.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const { requiereSesion } = require('./Autorizacion');

// Código de ErrorLogica --> código HTTP
const CODIGOS_HTTP = {
    DATOS_NO_VALIDOS: 400,
    TOKEN_NO_VALIDO: 400,
    CREDENCIALES_INCORRECTAS: 401,
    CONTRASENA_INCORRECTA: 403,
    CORREO_NO_REGISTRADO: 404,
    CORREO_YA_REGISTRADO: 409
};

// ---------------------------------------------------------------------------
// servidor: Express, logica: Logica --> cargarReglasREST() -->
// What it does: adds the user and authentication routes to the server.
// ---------------------------------------------------------------------------
function cargarReglasREST(servidor, logica) {

    // POST /registrarUsuario  { nombre, apellidos, correo, contrasena }
    //   201 { idUsuario, token, rol, nombre } · 400 { error, campos } · 409 { error }
    servidor.post('/registrarUsuario', envolver(async (peticion, respuesta) => {
        const { nombre, apellidos, correo, contrasena } = peticion.body;
        const sesion = await logica.registrarUsuario(nombre, apellidos, correo, contrasena);
        respuesta.status(201).json(sesion);
    }));

    // POST /iniciarSesion  { correo, contrasena }
    //   200 { idUsuario, token, rol, nombre } · 401 { error }
    servidor.post('/iniciarSesion', envolver(async (peticion, respuesta) => {
        const { correo, contrasena } = peticion.body;
        respuesta.status(200).json(await logica.iniciarSesion(correo, contrasena));
    }));

    // GET /usuarioActual  (Authorization: Bearer <token>)
    //   200 { idUsuario, nombre, apellidos, correo, rol, fechaAlta, alertas, premiumHasta, foto } · 401
    servidor.get('/usuarioActual', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        respuesta.status(200).json(await logica.obtenerUsuario(peticion.usuario.idUsuario));
    }));

    // POST /cambiarAlertas  { alertas: true | false }  (Authorization: Bearer <token>)
    //   204 guardado · 400 alertas no es true ni false · 401 sin sesión      (T010)
    servidor.post('/cambiarAlertas', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        await logica.cambiarAlertas(peticion.usuario.idUsuario, peticion.body.alertas);
        respuesta.status(204).end();
    }));

    // POST /actualizarDatos  { nombre, apellidos, correo }  🔒            (T010)
    //   200 { nombre, apellidos, correo } · 400 { error, campos } · 409 correo de otra cuenta · 401
    servidor.post('/actualizarDatos', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        const { nombre, apellidos, correo } = peticion.body;
        respuesta.status(200).json(
            await logica.actualizarDatos(peticion.usuario.idUsuario, nombre, apellidos, correo));
    }));

    // POST /cambiarContrasenya  { contrasenaActual, contrasenaNueva }  🔒  (T010)
    //   200 { idUsuario, token, rol, nombre } (sesión nueva) · 400 contraseña débil
    //   · 403 la contraseña actual no es correcta · 401
    servidor.post('/cambiarContrasenya', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        const { contrasenaActual, contrasenaNueva } = peticion.body;
        respuesta.status(200).json(
            await logica.cambiarContrasenya(peticion.usuario.idUsuario, contrasenaActual, contrasenaNueva));
    }));

    // POST /cambiarFoto  { foto: base64 | null }  🔒                        (T010)
    //   204 guardada (null = quitar la foto) · 400 no es una imagen válida · 401
    servidor.post('/cambiarFoto', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        const foto = peticion.body.foto === undefined ? '' : peticion.body.foto;
        await logica.cambiarFoto(peticion.usuario.idUsuario, foto);
        respuesta.status(204).end();
    }));

    // POST /solicitarRecuperacion  { correo }
    //   200 enlace enviado · 400 correo no válido · 404 el correo no tiene cuenta (no se envía nada)
    servidor.post('/solicitarRecuperacion', envolver(async (peticion, respuesta) => {
        await logica.solicitarRecuperacion(peticion.body.correo);
        respuesta.status(200).json({ mensaje: 'Te hemos enviado un enlace' });
    }));

    // POST /restablecerContrasenya  { token, contrasena }
    //   204 · 400 { error }
    servidor.post('/restablecerContrasenya', envolver(async (peticion, respuesta) => {
        const { token, contrasena } = peticion.body;
        await logica.restablecerContrasenya(token, contrasena);
        respuesta.status(204).end();
    }));
}

// ---------------------------------------------------------------------------
// error: Error, respuesta: Response --> responderError() -->
// What it does: answers with the HTTP code of the ErrorLogica, or 500
//               (without details) for any other error.
// ---------------------------------------------------------------------------
function responderError(error, respuesta) {
    const codigoHTTP = CODIGOS_HTTP[error.codigo];
    if (codigoHTTP) {
        const cuerpo = { error: error.message };
        if (error.campos && error.campos.length > 0) {
            cuerpo.campos = error.campos;
        }
        return respuesta.status(codigoHTTP).json(cuerpo);
    }
    console.error(error);
    respuesta.status(500).json({ error: 'Error del servidor' });
}

// ---------------------------------------------------------------------------
// funcion: ( peticion, respuesta ) --> Promesa --> envolver() --> Middleware
// What it does: runs an async route and sends any error to responderError().
// ---------------------------------------------------------------------------
function envolver(funcion) {
    return (peticion, respuesta) => {
        funcion(peticion, respuesta).catch((error) => responderError(error, respuesta));
    };
}

module.exports = { cargarReglasREST, responderError, CODIGOS_HTTP };
