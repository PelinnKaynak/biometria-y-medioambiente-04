// ---------------------------------------------------------------------------
// Fichero:     test_api_nodos.js
// Descripción: Tests de las rutas de nodos del panel (T021) con el servidor
//              en marcha en un puerto libre y la BD aeris_test.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../../logica/Logica');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('../../logica/test/bdPruebas');
const { crearServidor } = require('../ServidorREST');

describe('API REST de nodos del panel', function () {

    let logica, conexion, url, tokens;

    async function pedir(ruta, token) {
        const r = await fetch(url + ruta, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        return { codigo: r.status, cuerpo: await r.json() };
    }

    async function usuarioConRol(nombre, correo, roles) {
        const sesion = await logica.registrarUsuario(nombre, 'Prueba', correo, 'aire2026');
        await logica.conexion.execute(
            'UPDATE Usuarios SET esAdministrador = ?, esTecnico = ?, esPortador = ? WHERE idUsuario = ?',
            [roles.includes('administrador'), roles.includes('tecnico'), roles.includes('portador'), sesion.idUsuario]);
        return sesion;
    }

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS, async () => {}, 'http://localhost:8080/restablecer.html', 'clave-de-pruebas');
        conexion = crearServidor(logica).listen(0);
        url = `http://127.0.0.1:${conexion.address().port}`;
    });

    beforeEach(async function () {
        await vaciarTablas(logica.conexion);
        const [o] = await logica.conexion.execute("INSERT INTO Contaminantes (nombre, unidad) VALUES ('O3', 'µg/m³')");
        const admin = await usuarioConRol('Admin', 'admin@aeris.es', ['administrador', 'portador']);
        const tecnico = await usuarioConRol('Tecnico', 'tecnico@aeris.es', ['tecnico']);
        const portador = await usuarioConRol('Laura', 'laura@aeris.es', ['portador']);
        tokens = { admin: admin.token, tecnico: tecnico.token, portador: portador.token };

        const [s1] = await logica.conexion.execute(
            "INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario, bateria) VALUES ('092021010001', 1, 'x@aeris.es', ?, 70)",
            [portador.idUsuario]);
        await logica.conexion.execute(
            `INSERT INTO Mediciones (idSensor, idUsuario, idContaminante, valorMedicion, ubicacion, fechaHora)
             VALUES (?, ?, ?, 80, ST_GeomFromText('POINT(-0.181 38.967)'), ?)`,
            [s1.insertId, portador.idUsuario, o.insertId, new Date(Date.now() - 5 * 60000)]);
        await logica.conexion.execute(
            "INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario) VALUES ('092021010002', 1, 'x@aeris.es', ?)",
            [admin.idUsuario]);
    });

    after(async function () {
        conexion.close();
        await logica.cerrar();
    });

    it('sin sesión dan 401 y un portador sin otro rol 403', async function () {
        for (const ruta of ['/nodos/resumen', '/nodos', '/nodos/mapa']) {
            assert.strictEqual((await pedir(ruta)).codigo, 401, ruta);
            assert.strictEqual((await pedir(ruta, tokens.portador)).codigo, 403, ruta);
        }
    });

    it('el administrador y el técnico ven el resumen', async function () {
        for (const token of [tokens.admin, tokens.tecnico]) {
            const r = await pedir('/nodos/resumen', token);
            assert.strictEqual(r.codigo, 200);
            assert.deepStrictEqual(r.cuerpo, { total: 2, activos: 1, inactivos24h: 1, inactivos7d: 1, porCalibrar: 0 });
        }
    });

    it('GET /nodos: lista con todos los datos, filtros y páginas; 400 si el filtro no vale', async function () {
        const r = await pedir('/nodos?busqueda=&estado=todos&pagina=1&porPagina=20', tokens.admin);
        assert.strictEqual(r.codigo, 200);
        assert.strictEqual(r.cuerpo.total, 2);
        const n = r.cuerpo.nodos.find((x) => x.id === '092021010001');
        assert.strictEqual(n.portador, 'Laura Prueba');
        assert.strictEqual(n.bateria, 70);
        assert.strictEqual(n.latitud, 38.967);
        assert.strictEqual(n.longitud, -0.181);
        assert.strictEqual(n.estado, 'ACTIVO');
        assert.ok(!Number.isNaN(Date.parse(n.ultimaMedicion)));

        const activos = await pedir('/nodos?estado=activos', tokens.tecnico);
        assert.deepStrictEqual(activos.cuerpo.nodos.map((x) => x.id), ['092021010001']);
        const buscado = await pedir('/nodos?busqueda=admin', tokens.admin);
        assert.deepStrictEqual(buscado.cuerpo.nodos.map((x) => x.id), ['092021010002']);
        const pagina = await pedir('/nodos?pagina=2&porPagina=1', tokens.admin);
        assert.strictEqual(pagina.cuerpo.nodos.length, 1);
        assert.strictEqual(pagina.cuerpo.total, 2);

        const mal = await pedir('/nodos?estado=raro', tokens.admin);
        assert.strictEqual(mal.codigo, 400);
        assert.deepStrictEqual(mal.cuerpo.campos, ['estado']);
    });

    it('GET /nodos/mapa: sin paginar y solo los que tienen ubicación', async function () {
        const r = await pedir('/nodos/mapa?busqueda=&estado=todos&pagina=1&porPagina=0', tokens.admin);
        assert.strictEqual(r.codigo, 200);
        assert.deepStrictEqual(r.cuerpo.nodos.map((x) => x.id), ['092021010001']);
        assert.strictEqual(r.cuerpo.total, 1);
    });
});