// ---------------------------------------------------------------------------
// Fichero:     test_api_incidencias.js
// Descripción: Tests de las rutas de incidencias (T041) con el servidor en
//              marcha en un puerto libre y la BD aeris_test. Los correos no
//              se envían: se apuntan.
// Autores:     Equipo 04 – SenseTech
// Fecha:       17/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../../logica/Logica');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('../../logica/test/bdPruebas');
const { crearServidor } = require('../ServidorREST');

describe('API REST de incidencias', function () {

    let logica, conexion, url, correos;
    let portador, tecnico, admin;     // tokens

    async function peticion(metodo, ruta, token, cuerpo) {
        const cabeceras = { 'Content-Type': 'application/json' };
        if (token) {
            cabeceras.Authorization = `Bearer ${token}`;
        }
        const r = await fetch(url + ruta, {
            method: metodo, headers: cabeceras, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
        });
        const texto = await r.text();
        return { codigo: r.status, cuerpo: texto ? JSON.parse(texto) : null };
    }

    async function usuarioConRol(nombre, correo, rol) {
        const sesion = await logica.registrarUsuario(nombre, 'Prueba', correo, 'aire2026');
        await logica.conexion.execute(
            `UPDATE Usuarios
            SET esAdministrador = ?, esTecnico = ?, esPortador = ?
            WHERE idUsuario = ?`,
            [
                rol === 'administrador',
                rol === 'tecnico',
                rol === 'portador' || rol === 'ciudadano',
                sesion.idUsuario
            ]
        );
        return sesion.token;
    }

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS,
            async (destinatario, asunto, texto) => {
                if (!asunto.includes('bienvenida')) correos.push({ destinatario, asunto, texto });
            },
            'http://localhost:8080/restablecer.html', 'clave-de-pruebas');
        conexion = crearServidor(logica).listen(0);
        url = `http://127.0.0.1:${conexion.address().port}`;
    });

    beforeEach(async function () {
        correos = [];
        await vaciarTablas(logica.conexion);
        const sesion = await logica.registrarUsuario('Pelin', 'Kaynak', 'pelin@aeris.es', 'aire2026');
        portador = sesion.token;
        await logica.conexion.execute(
            'INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario) VALUES (?, ?, ?, ?)',
            ['092021010920', -44.75, 'pkaynak@upv.edu.es', sesion.idUsuario]);
        tecnico = await usuarioConRol('Tomás', 'tecnico@aeris.es', 'tecnico');
        admin = await usuarioConRol('Alba', 'admin@aeris.es', 'administrador');
        correos = [];
    });

    after(async function () {
        conexion.close();
        await logica.cerrar();
    });

    it('sin sesión todas las rutas dan 401', async function () {
        assert.strictEqual((await peticion('POST', '/crearIncidencia', null, { tipo: 'otra', asunto: 'Asunto', descripcion: 'x' })).codigo, 401);
        assert.strictEqual((await peticion('GET', '/misIncidencias')).codigo, 401);
        assert.strictEqual((await peticion('GET', '/incidencias')).codigo, 401);
        assert.strictEqual((await peticion('GET', '/numeroIncidenciasAbiertas')).codigo, 401);
        assert.strictEqual((await peticion('GET', '/incidencia?id=1')).codigo, 401);
        assert.strictEqual((await peticion('POST', '/responderIncidencia', null, { idIncidencia: 1, estado: 'resuelta' })).codigo, 401);
    });

    it('POST /crearIncidencia: 201 con el sensor del usuario; 400 con los campos que fallan', async function () {
        const r = await peticion('POST', '/crearIncidencia', portador, { tipo: 'sensor', asunto: 'Bluetooth', descripcion: 'No conecta' });
        assert.strictEqual(r.codigo, 201);
        assert.strictEqual(r.cuerpo.asunto, 'Bluetooth');
        assert.strictEqual(r.cuerpo.estado, 'abierta');
        assert.strictEqual(r.cuerpo.sensor.numeroSerie, '092021010920');

        const mal = await peticion('POST', '/crearIncidencia', portador, { tipo: 'queja', descripcion: '' });
        assert.strictEqual(mal.codigo, 400);
        assert.deepStrictEqual(mal.cuerpo.campos.sort(), ['asunto', 'descripcion', 'tipo']);
    });

    it('GET /misIncidencias: el usuario ve las suyas con la respuesta', async function () {
        const { cuerpo: i } = await peticion('POST', '/crearIncidencia', portador, { tipo: 'cuenta', asunto: 'Asunto', descripcion: 'Foto' });
        await peticion('POST', '/crearIncidencia', tecnico, { tipo: 'otra', asunto: 'Asunto', descripcion: 'Del técnico' });
        await peticion('POST', '/responderIncidencia', tecnico, { idIncidencia: i.idIncidencia, respuesta: 'Ya está' });

        const r = await peticion('GET', '/misIncidencias', portador);
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(r.cuerpo.length, 1);
        assert.strictEqual(r.cuerpo[0].respuesta, 'Ya está');
        assert.strictEqual(r.cuerpo[0].estado, 'resuelta');
        assert.deepStrictEqual(r.cuerpo[0].responsable, { nombre: 'Tomás', rol: 'tecnico' });   // quien respondió
        assert.strictEqual(r.cuerpo[0].usuario, undefined);     // al usuario no le hace falta
    });

    it('un portador no puede usar las rutas de gestión (403)', async function () {
        assert.strictEqual((await peticion('GET', '/incidencias', portador)).codigo, 403);
        assert.strictEqual((await peticion('GET', '/numeroIncidenciasAbiertas', portador)).codigo, 403);
        assert.strictEqual((await peticion('GET', '/incidencia?id=1', portador)).codigo, 403);
        assert.strictEqual((await peticion('POST', '/responderIncidencia', portador, { idIncidencia: 1, estado: 'resuelta' })).codigo, 403);
    });

    it('GET /incidencias: técnicos y administradores listan con filtros; 400 con un filtro no válido', async function () {
        await peticion('POST', '/crearIncidencia', portador, { tipo: 'sensor', asunto: 'Asunto', descripcion: 'No conecta' });
        await peticion('POST', '/crearIncidencia', portador, { tipo: 'cuenta', asunto: 'Asunto', descripcion: 'Correo' });

        for (const token of [tecnico, admin]) {
            const r = await peticion('GET', '/incidencias', token);
            assert.strictEqual(r.codigo, 200);
            assert.strictEqual(r.cuerpo.length, 2);
            assert.strictEqual(r.cuerpo[0].usuario.correo, 'pelin@aeris.es');
        }
        const filtradas = await peticion('GET', `/incidencias?estado=${encodeURIComponent('abierta')}&tipo=sensor`, tecnico);
        assert.strictEqual(filtradas.cuerpo.length, 1);
        assert.strictEqual(filtradas.cuerpo[0].sensor.bateria, null);
        assert.strictEqual((await peticion('GET', '/incidencias?estado=en%20curso', tecnico)).cuerpo.length, 0);
        assert.strictEqual((await peticion('GET', '/incidencias?estado=cerrada', tecnico)).codigo, 400);
        assert.strictEqual((await peticion('GET', '/incidencias?tipo=a&tipo=b', tecnico)).codigo, 400);
    });

    it('GET /numeroIncidenciasAbiertas y GET /incidencia?id=', async function () {
        const { cuerpo: i } = await peticion('POST', '/crearIncidencia', portador, { tipo: 'otra', asunto: 'Asunto', descripcion: 'Hola' });
        assert.deepStrictEqual((await peticion('GET', '/numeroIncidenciasAbiertas', admin)).cuerpo, { abiertas: 1 });

        const r = await peticion('GET', `/incidencia?id=${i.idIncidencia}`, tecnico);
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(r.cuerpo.descripcion, 'Hola');
        assert.strictEqual(r.cuerpo.usuario.nombre, 'Pelin');
        assert.strictEqual((await peticion('GET', '/incidencia?id=999', tecnico)).codigo, 404);
        assert.strictEqual((await peticion('GET', '/incidencia?id=abc', tecnico)).codigo, 404);
    });

    it('POST /responderIncidencia: guarda, avisa por correo y cambia el estado; 400 y 404', async function () {
        const { cuerpo: i } = await peticion('POST', '/crearIncidencia', portador, { tipo: 'datos', asunto: 'Asunto', descripcion: 'Faltan datos' });

        const enCurso = await peticion('POST', '/responderIncidencia', admin, { idIncidencia: i.idIncidencia, estado: 'en curso' });
        assert.strictEqual(enCurso.codigo, 200);
        assert.strictEqual(enCurso.cuerpo.estado, 'en curso');
        assert.strictEqual(enCurso.cuerpo.responsable, null);     // solo cambia el estado
        assert.strictEqual(correos.length, 0);

        const r = await peticion('POST', '/responderIncidencia', tecnico, { idIncidencia: i.idIncidencia, respuesta: 'Arreglado' });
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(r.cuerpo.estado, 'resuelta');
        assert.strictEqual(r.cuerpo.responsable.nombre, 'Tomás');
        assert.strictEqual(correos.length, 1);
        assert.strictEqual(correos[0].destinatario, 'pelin@aeris.es');

        assert.strictEqual((await peticion('POST', '/responderIncidencia', tecnico, { idIncidencia: i.idIncidencia })).codigo, 400);
        assert.strictEqual((await peticion('POST', '/responderIncidencia', tecnico, { idIncidencia: 999, respuesta: 'x' })).codigo, 404);
        assert.deepStrictEqual((await peticion('GET', '/numeroIncidenciasAbiertas', tecnico)).cuerpo, { abiertas: 0 });
    });

    // --- conversación de cada incidencia (T043) ---------------------------------

    it('sin sesión las rutas de la conversación dan 401', async function () {
        assert.strictEqual((await peticion('GET', '/mensajesIncidencia?id=1')).codigo, 401);
        assert.strictEqual((await peticion('POST', '/enviarMensajeIncidencia', null, { idIncidencia: 1, texto: 'Hola' })).codigo, 401);
    });

    it('POST /enviarMensajeIncidencia y GET /mensajesIncidencia: el usuario y el equipo mantienen la conversación', async function () {
        const { cuerpo: i } = await peticion('POST', '/crearIncidencia', portador, { tipo: 'sensor', asunto: 'No conecta', descripcion: 'La luz parpadea' });
        assert.deepStrictEqual((await peticion('GET', `/mensajesIncidencia?id=${i.idIncidencia}`, portador)).cuerpo, []);

        // el usuario añade un mensaje
        const m1 = await peticion('POST', '/enviarMensajeIncidencia', portador, { idIncidencia: i.idIncidencia, texto: '  Sigue igual  ' });
        assert.strictEqual(m1.codigo, 201);
        assert.strictEqual(m1.cuerpo.texto, 'Sigue igual');
        assert.strictEqual(m1.cuerpo.delUsuario, true);
        assert.strictEqual(m1.cuerpo.autor.nombre, 'Pelin');
        assert.strictEqual(correos.length, 0);

        // el técnico responde por la ruta nueva: respuesta del equipo, estado y UN correo
        const m2 = await peticion('POST', '/enviarMensajeIncidencia', tecnico, { idIncidencia: i.idIncidencia, texto: 'Reinícialo' });
        assert.strictEqual(m2.codigo, 201);
        assert.strictEqual(m2.cuerpo.delUsuario, false);
        assert.strictEqual(m2.cuerpo.autor.rol, 'tecnico');
        assert.strictEqual(correos.length, 1);
        assert.strictEqual(correos[0].destinatario, 'pelin@aeris.es');
        const [laApp] = (await peticion('GET', '/misIncidencias', portador)).cuerpo;
        assert.strictEqual(laApp.estado, 'resuelta');
        assert.strictEqual(laApp.respuesta, 'Reinícialo');

        // el administrador responde por la ruta de siempre y también queda en la conversación (un correo más)
        await peticion('POST', '/responderIncidencia', admin, { idIncidencia: i.idIncidencia, respuesta: 'Te lo cambiamos', estado: 'en curso' });
        assert.strictEqual(correos.length, 2);

        // el usuario escribe otra vez: no manda correo y reabre si estaba «resuelta»
        await peticion('POST', '/responderIncidencia', tecnico, { idIncidencia: i.idIncidencia, estado: 'resuelta' });
        await peticion('POST', '/enviarMensajeIncidencia', portador, { idIncidencia: i.idIncidencia, texto: 'Gracias' });
        assert.strictEqual((await peticion('GET', '/misIncidencias', portador)).cuerpo[0].estado, 'abierta');
        assert.strictEqual(correos.length, 2);

        // el usuario y el equipo leen la misma conversación, por orden
        for (const token of [portador, tecnico, admin]) {
            const r = await peticion('GET', `/mensajesIncidencia?id=${i.idIncidencia}`, token);
            assert.strictEqual(r.codigo, 200);
            assert.deepStrictEqual(r.cuerpo.map((m) => m.texto), ['Sigue igual', 'Reinícialo', 'Te lo cambiamos', 'Gracias']);
            assert.deepStrictEqual(r.cuerpo.map((m) => m.delUsuario), [true, false, false, true]);
        }
    });

    it('un usuario que no envió la incidencia (y no es del equipo) recibe 404 al leer y al escribir', async function () {
        const { cuerpo: i } = await peticion('POST', '/crearIncidencia', portador, { tipo: 'otra', asunto: 'Asunto', descripcion: 'Privado' });
        const otro = await usuarioConRol('Carla', 'carla@aeris.es', 'portador');

        assert.strictEqual((await peticion('GET', `/mensajesIncidencia?id=${i.idIncidencia}`, otro)).codigo, 404);
        assert.strictEqual((await peticion('POST', '/enviarMensajeIncidencia', otro, { idIncidencia: i.idIncidencia, texto: 'Intruso' })).codigo, 404);
        assert.deepStrictEqual((await peticion('GET', `/mensajesIncidencia?id=${i.idIncidencia}`, portador)).cuerpo, []);
        assert.strictEqual(correos.length, 0);
    });

    it('conversación: 400 con un texto o un estado no válidos y 404 con una incidencia que no existe', async function () {
        const { cuerpo: i } = await peticion('POST', '/crearIncidencia', portador, { tipo: 'otra', asunto: 'Asunto', descripcion: 'Hola' });

        const vacio = await peticion('POST', '/enviarMensajeIncidencia', portador, { idIncidencia: i.idIncidencia, texto: '   ' });
        assert.strictEqual(vacio.codigo, 400);
        assert.ok(vacio.cuerpo.campos.includes('texto'));
        assert.strictEqual((await peticion('POST', '/enviarMensajeIncidencia', portador, { idIncidencia: i.idIncidencia, texto: 'x'.repeat(2001) })).codigo, 400);
        const estado = await peticion('POST', '/enviarMensajeIncidencia', tecnico, { idIncidencia: i.idIncidencia, texto: 'Hola', estado: 'cerrada' });
        assert.strictEqual(estado.codigo, 400);
        assert.ok(estado.cuerpo.campos.includes('estado'));

        assert.strictEqual((await peticion('POST', '/enviarMensajeIncidencia', portador, { idIncidencia: 999, texto: 'Hola' })).codigo, 404);
        assert.strictEqual((await peticion('POST', '/enviarMensajeIncidencia', portador, { texto: 'Hola' })).codigo, 404);
        assert.strictEqual((await peticion('GET', '/mensajesIncidencia?id=999', portador)).codigo, 404);
        assert.strictEqual((await peticion('GET', '/mensajesIncidencia?id=abc', tecnico)).codigo, 404);
        assert.strictEqual((await peticion('GET', '/mensajesIncidencia', tecnico)).codigo, 404);
        assert.deepStrictEqual((await peticion('GET', `/mensajesIncidencia?id=${i.idIncidencia}`, portador)).cuerpo, []);
    });
});
