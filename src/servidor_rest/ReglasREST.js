// ---------------------------------------------------------------------------
// Fichero:     ReglasREST.js
// Descripción: Rutas REST de usuarios y autenticación. Cada ruta lee la
//              petición, llama a la lógica y traduce el resultado a HTTP.
//              Contrato completo en doc/servidor_rest_design.md. Tareas T016,
//              T010, T005 (vinculación del sensor confirmada por correo),
//              T041 (incidencias), T017 (mediciones), T007 (Mis datos),
//              T024 (datos de la
//              página Mi cuenta), T021 (nodos del panel) y T046 (lugares).
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const express = require('express');
const { requiereSesion } = require('./Autorizacion');
const { paginaConfirmar, paginaResultado, paginaEnlaceNoValido } = require('./PaginaVinculacion');

// Roles que reciben y responden las incidencias (T041)
const ROLES_GESTION_INCIDENCIAS = ['administrador', 'tecnico'];

// Roles que entran al panel de administración y ven los nodos (T021)
const ROLES_PANEL = ['administrador', 'tecnico'];

// Código de ErrorLogica --> código HTTP
const CODIGOS_HTTP = {
    DATOS_NO_VALIDOS: 400,
    TOKEN_NO_VALIDO: 400,
    CREDENCIALES_INCORRECTAS: 401,
    CONTRASENA_INCORRECTA: 403,
    CORREO_NO_REGISTRADO: 404,
    SENSOR_NO_REGISTRADO: 404,
    SIN_SOLICITUD: 404,
    INCIDENCIA_NO_EXISTE: 404,
    SIN_MEDICIONES: 404,
    LUGAR_NO_EXISTE: 404,
    SENSOR_NO_ES_TUYO: 403,
    SIN_SENSOR: 404,
    LIMITE_LUGARES: 409,
    CORREO_YA_REGISTRADO: 409,
    SENSOR_YA_VINCULADO: 409
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
    //   200 { idUsuario, nombre, apellidos, correo, rol, fechaAlta, alertas, premiumHasta, foto,
    //         sensor, numeroSerie } · 401        (sensor y numeroSerie: null si no tiene sensor, T017)
    servidor.get('/usuarioActual', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        respuesta.status(200).json(await logica.obtenerUsuario(peticion.usuario.idUsuario));
    }));

    // GET /miSensor (Authorization: Bearer <token>)
    //   200 { nombre, numeroSerie, bateria, ultimaConexion } · 404 sin sensor · 401
    servidor.get('/miSensor', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        const sensor = await logica.obtenerMiSensor(peticion.usuario.idUsuario);
        respuesta.status(200).json({
            ...sensor,
            ultimaConexion: sensor.ultimaConexion ? new Date(sensor.ultimaConexion).toISOString() : null
        });
    }));

    // DELETE /miSensor (Authorization: Bearer <token>)
    //   204 desvinculado · 404 sin sensor · 401
    servidor.delete('/miSensor', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        await logica.desvincularMiSensor(peticion.usuario.idUsuario);
        respuesta.status(204).end();
    }));

    // POST /cambiarAlertas  { alertas: true | false }  (Authorization: Bearer <token>)
    //   204 guardado · 400 alertas no es true ni false · 401 sin sesión      (T010)
    servidor.post('/cambiarAlertas', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        await logica.cambiarAlertas(peticion.usuario.idUsuario, peticion.body.alertas);
        respuesta.status(204).end();
    }));

    servidor.get('/avisos', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        const cursor = peticion.query.desdeId;
        const desdeId = cursor === undefined ? 0
            : typeof cursor === 'string' && /^\d+$/.test(cursor) ? Number(cursor)
                : NaN;

        const avisos = await logica.listarAvisos(peticion.usuario.idUsuario, desdeId);
        respuesta.status(200).json(avisos);
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

    // ---- Vinculación del sensor confirmada por correo (T005) ----

    // POST /solicitarVinculacion  { numeroSerie, sensibilidad }  🔒
    //   201 { numeroSerie, correoComprador (oculto), estado: "pendiente", fecha } (correo enviado a quien lo compró)
    //   200 { …, estado: "confirmada" } si ya era suyo · 400 · 404 sensor no registrado · 409 de otra cuenta · 401
    servidor.post('/solicitarVinculacion', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        const { numeroSerie, sensibilidad } = peticion.body;
        const solicitud = await logica.solicitarVinculacion(peticion.usuario.idUsuario, numeroSerie, sensibilidad);
        respuesta.status(solicitud.estado === 'pendiente' ? 201 : 200).json(solicitud);
    }));

    // GET /estadoVinculacion  🔒
    //   200 { numeroSerie, correoComprador, estado: pendiente | confirmada | rechazada, fecha } · 404 sin solicitud · 401
    servidor.get('/estadoVinculacion', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        respuesta.status(200).json(await logica.estadoVinculacion(peticion.usuario.idUsuario));
    }));

    // POST /reenviarCorreoVinculacion  🔒
    //   200 { mensaje } · 404 no hay ninguna pendiente · 401
    servidor.post('/reenviarCorreoVinculacion', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        await logica.reenviarCorreoVinculacion(peticion.usuario.idUsuario);
        respuesta.status(200).json({ mensaje: 'Correo reenviado' });
    }));

    // ---- Nodos del panel de administración (T021) ----

    // GET /nodos/resumen  🔒 administrador o técnico
    //   200 { total, activos, inactivos24h, inactivos7d, porCalibrar, umbralHoras } · 401 · 403
    //   inactivos24h: los que pasan del umbral (UMBRAL_INACTIVO_HORAS, 24 h por defecto, T022)
    servidor.get('/nodos/resumen', requiereSesion(logica, ROLES_PANEL), envolver(async (peticion, respuesta) => {
        respuesta.status(200).json(await logica.nodos.resumen());
    }));

    // GET /nodos?busqueda=&estado=todos|activos|inactivos|calibrar&pagina=1&porPagina=20  🔒 administrador o técnico
    //   200 { nodos: [ Nodo ], total } (total sin paginar; porPagina máx. 100) · 400 filtro no válido · 401 · 403
    servidor.get('/nodos', requiereSesion(logica, ROLES_PANEL), envolver(async (peticion, respuesta) => {
        respuesta.status(200).json(await logica.nodos.buscar(peticion.query));
    }));

    // GET /nodos/mapa?busqueda=&estado=  🔒 administrador o técnico
    //   200 { nodos: [ Nodo ], total }: todos los que cumplen el filtro y tienen ubicación, sin paginar · 400 · 401 · 403
    servidor.get('/nodos/mapa', requiereSesion(logica, ROLES_PANEL), envolver(async (peticion, respuesta) => {
        const { nodos } = await logica.nodos.buscar({ ...peticion.query, pagina: 1, porPagina: 0 });
        const conSitio = nodos.filter((n) => n.latitud !== null && n.longitud !== null);
        respuesta.status(200).json({ nodos: conSitio, total: conSitio.length });
    }));

    // POST /nodos/:numeroSerie/desvincular  🔒 solo administrador
    //   200 { numeroSerie } · 404 el sensor no existe o no está vinculado · 401 · 403
    //   Quita el sensor a su usuario; el sensor y sus mediciones se conservan.
    servidor.post('/nodos/:numeroSerie/desvincular', requiereSesion(logica, ['administrador']), envolver(async (peticion, respuesta) => {
        const { numeroSerie } = await logica.desvincularSensor(peticion.params.numeroSerie);
        respuesta.status(200).json({ numeroSerie });
    }));

    // GET /miCuenta  🔒                                                   (T024)
    //   200 Resumen (ver Logica.resumenCuenta) · 404 sin sensor vinculado o sin mediciones · 401
    servidor.get('/miCuenta', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        respuesta.status(200).json(await logica.resumenCuenta(peticion.usuario.idUsuario));
    }));

    // GET /lugares  (Authorization: Bearer <token>)
    //   200 [ Lugar ] del usuario autenticado · 401
    servidor.get('/lugares', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        respuesta.status(200).json(await logica.lugares.listar(peticion.usuario.idUsuario));
    }));

    // POST /lugares  { nombre, tipo, direccion, latitud, longitud, avisosActivos? }
    //   201 Lugar · 400 { error, campos } · 401 · 409 límite de cinco
    servidor.post('/lugares', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        const lugar = await logica.lugares.crear(peticion.usuario.idUsuario, peticion.body);
        respuesta.status(201).json(lugar);
    }));

    // PUT /lugares/:idLugar y PATCH /lugares/:idLugar
    //   200 Lugar actualizado · 400 { error, campos } · 401 · 404 si no es del usuario
    servidor.put('/lugares/:idLugar', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        const lugar = await logica.lugares.actualizar(
            peticion.usuario.idUsuario, peticion.params.idLugar, peticion.body);
        respuesta.status(200).json(lugar);
    }));
    servidor.patch('/lugares/:idLugar', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        const lugar = await logica.lugares.actualizar(
            peticion.usuario.idUsuario, peticion.params.idLugar, peticion.body);
        respuesta.status(200).json(lugar);
    }));

    // DELETE /lugares/:idLugar
    //   204 eliminado · 401 · 404 si no existe o no es del usuario
    servidor.delete('/lugares/:idLugar', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        await logica.lugares.eliminar(peticion.usuario.idUsuario, peticion.params.idLugar);
        respuesta.status(204).end();
    }));

    // GET /miExposicion?periodo=semana|mes|3meses  🔒                     (T024)
    //   200 [ { fecha, ozono } ] media de cada día · 400 periodo no válido · 404 sin sensor · 401
    servidor.get('/miExposicion', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        respuesta.status(200).json(await logica.exposicion(peticion.usuario.idUsuario, peticion.query.periodo));
    }));

    // GET /responderVinculacion?token=…&respuesta=si|no      (enlaces del correo; abre el navegador)
    //   200 HTML «¿Confirmas…?» con un botón que hace el POST · 400 HTML si falta algo
    servidor.get('/responderVinculacion', (peticion, respuesta) => {
        const { token, respuesta: valor } = peticion.query;
        if (typeof token !== 'string' || !token || (valor !== 'si' && valor !== 'no')) {
            return respuesta.status(400).type('html').send(paginaEnlaceNoValido());
        }
        respuesta.status(200).type('html').send(paginaConfirmar(token, valor === 'si'));
    });

    // POST /responderVinculacion  (formulario: token, respuesta = si | no)
    //   200 HTML «Sensor vinculado» o «Vinculación rechazada» · 400 HTML «Enlace no válido»
    servidor.post('/responderVinculacion', express.urlencoded({ extended: false }), async (peticion, respuesta) => {
        const { token, respuesta: valor } = peticion.body;
        try {
            if (valor !== 'si' && valor !== 'no') {
                throw Object.assign(new Error('respuesta'), { codigo: 'TOKEN_NO_VALIDO' });
            }
            const resultado = await logica.responderVinculacion(token, valor === 'si');
            respuesta.status(200).type('html').send(paginaResultado(resultado));
        } catch (error) {
            if (error.codigo !== 'TOKEN_NO_VALIDO') {
                console.error(error);
            }
            respuesta.status(error.codigo === 'TOKEN_NO_VALIDO' ? 400 : 500).type('html').send(paginaEnlaceNoValido());
        }
    });

    // ---- Incidencias (T041) · la usan la app y la web ----

    // POST /crearIncidencia  { tipo, asunto, descripcion, idSensor (opcional) }  🔒
    //   tipo: sensor | datos | cuenta | otra. Sin idSensor, las de tipo sensor o datos llevan el sensor del usuario
    //   201 Incidencia · 400 { error, campos } · 401
    servidor.post('/crearIncidencia', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        const { tipo, asunto, descripcion, idSensor } = peticion.body;
        respuesta.status(201).json(
            await logica.incidencias.crear(peticion.usuario.idUsuario, tipo, asunto, descripcion, idSensor));
    }));

    // GET /misIncidencias  🔒
    //   200 [ Incidencia ] (las del usuario, con la respuesta; la más nueva primero) · 401
    servidor.get('/misIncidencias', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        respuesta.status(200).json(await logica.incidencias.listarDeUsuario(peticion.usuario.idUsuario));
    }));

    // GET /incidencias?estado=abierta|en curso|resuelta&tipo=sensor|datos|cuenta|otra  🔒 técnico o administrador
    //   200 [ IncidenciaGestion ] · 400 filtro no válido · 401 · 403
    servidor.get('/incidencias', requiereSesion(logica, ROLES_GESTION_INCIDENCIAS),
        envolver(async (peticion, respuesta) => {
            const { estado, tipo } = peticion.query;
            respuesta.status(200).json(await logica.incidencias.listar({
                estado: textoDeConsulta(estado), tipo: textoDeConsulta(tipo)
            }));
        }));

    // GET /numeroIncidenciasAbiertas  🔒 técnico o administrador
    //   200 { abiertas: N } (el número del menú del panel) · 401 · 403
    servidor.get('/numeroIncidenciasAbiertas', requiereSesion(logica, ROLES_GESTION_INCIDENCIAS),
        envolver(async (peticion, respuesta) => {
            respuesta.status(200).json({ abiertas: await logica.incidencias.contarAbiertas() });
        }));

    // GET /incidencia?id=N  🔒 técnico o administrador
    //   200 IncidenciaGestion (con los datos del usuario y del sensor) · 404 · 401 · 403
    servidor.get('/incidencia', requiereSesion(logica, ROLES_GESTION_INCIDENCIAS),
        envolver(async (peticion, respuesta) => {
            respuesta.status(200).json(await logica.incidencias.obtener(Number(peticion.query.id)));
        }));

    // POST /responderIncidencia  { idIncidencia, respuesta (opcional), estado (opcional) }  🔒 técnico o administrador
    //   Con respuesta: se guarda con la fecha y con quién responde (el usuario de la sesión), se manda por correo al usuario y, si no se indica
    //   estado, pasa a «resuelta». Sin respuesta: solo cambia el estado.
    //   200 IncidenciaGestion · 400 { error, campos } · 404 · 401 · 403
    servidor.post('/responderIncidencia', requiereSesion(logica, ROLES_GESTION_INCIDENCIAS),
        envolver(async (peticion, respuesta) => {
            const { idIncidencia, respuesta: texto, estado } = peticion.body;
            respuesta.status(200).json(await logica.incidencias.responder(idIncidencia, { respuesta: texto, estado },
                peticion.usuario.idUsuario));
        }));

    // ---- Mediciones (T017) · la app las recibe del nodo por Bluetooth ----

    // POST /guardarMedicion  { numeroSerie, contaminante?, valor, latitud, longitud, fecha }  🔒
    //   numeroSerie: el del UUID de la trama ("AERI" + 12 cifras); contaminante: "O3" si no se dice;
    //   valor en µg/m³ (0..2000); fecha ISO o milisegundos (como mucho 7 días atrás).
    //   201 { medicion, nueva: true } · 200 { medicion, nueva: false } (ya estaba guardada: no reenviar)
    //   400 { error, campos } · 401 · 403 el sensor no es suyo · 404 sensor no registrado
    servidor.post('/guardarMedicion', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        const resultado = await logica.mediciones.guardar(peticion.usuario.idUsuario, peticion.body);
        respuesta.status(resultado.nueva ? 201 : 200).json(resultado);
    }));

    // GET /ultimasMediciones?cantidad=5  🔒
    //   200 [ Medicion ] del usuario, la más nueva primero (cantidad: 5 si no se dice, como mucho 100)
    //   400 cantidad no válida · 401
    servidor.get('/ultimasMediciones', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        const cantidad = textoDeConsulta(peticion.query.cantidad);
        respuesta.status(200).json(await logica.mediciones.ultimasDeUsuario(peticion.usuario.idUsuario,
            cantidad === undefined ? undefined : Number(cantidad)));
    }));

    // GET /misDatos?desde=<epoch-ms>&hasta=<epoch-ms>  🔒
    //   200 [ Medicion ] del usuario en el periodo (máximo 26 h) · 400 fechas no válidas · 404 sin sensor · 401
    servidor.get('/misDatos', requiereSesion(logica), envolver(async (peticion, respuesta) => {
        await logica.sensorDelUsuario(peticion.usuario.idUsuario);
        const desdeTexto = textoDeConsulta(peticion.query.desde);
        const hastaTexto = textoDeConsulta(peticion.query.hasta);
        const desdeMs = desdeTexto && /^\d+$/.test(desdeTexto) ? Number(desdeTexto) : NaN;
        const hastaMs = hastaTexto && /^\d+$/.test(hastaTexto) ? Number(hastaTexto) : NaN;
        respuesta.status(200).json(await logica.mediciones.deUsuarioEnPeriodo(
            peticion.usuario.idUsuario, new Date(desdeMs), new Date(hastaMs)));
    }));

    // GET /ultimaMedicion  (pública, sin sesión: H006)
    //   200 Medicion (la más nueva de todos los sensores, sin datos de quién la tomó) · 404 aún no hay
    servidor.get('/ultimaMedicion', envolver(async (peticion, respuesta) => {
        respuesta.status(200).json(await logica.mediciones.ultima());
    }));
}

// valor: Texto | Lista | undefined --> textoDeConsulta() --> Texto | undefined
// (un parámetro vacío o repetido en la URL cuenta como no enviado / no válido)
function textoDeConsulta(valor) {
    if (valor === undefined || valor === '') return undefined;
    return typeof valor === 'string' ? valor : '';
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