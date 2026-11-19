// ---------------------------------------------------------------------------
// Fichero:     test_nodos.js
// Descripción: Tests de los nodos del panel de administración (Nodos.js,
//              T021) y de la detección de nodos inactivos (T022) contra la
//              BD de pruebas aeris_test. Las fechas se
//              calculan desde un «ahora» fijo.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const { Logica } = require('../Logica');
const { CONFIG_BD_PRUEBAS, crearBDPruebas, vaciarTablas } = require('./bdPruebas');

const AHORA = new Date('2026-11-19T12:00:00Z');
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

describe('Logica (nodos del panel)', function () {

    let logica, idO3, laura, pau, marta;

    // Crea un sensor vinculado a usuario, con batería y calibración
    async function sensor(numeroSerie, usuario, bateria = 80, calibrar = false) {
        const [r] = await logica.conexion.execute(
            `INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario, bateria, necesitaCalibracion)
             VALUES (?, -44.75, 'compra@aeris.es', ?, ?, ?)`,
            [numeroSerie, usuario ? usuario.idUsuario : null, bateria, calibrar]);
        return r.insertId;
    }

    async function medir(idSensor, usuario, haceMs, punto = 'POINT(-0.181 38.967)') {
        await logica.conexion.execute(
            `INSERT INTO Mediciones (idSensor, idUsuario, idContaminante, valorMedicion, ubicacion, fechaHora)
             VALUES (?, ?, ?, 80, ST_GeomFromText(?), ?)`,
            [idSensor, usuario.idUsuario, idO3, punto, new Date(AHORA.getTime() - haceMs)]);
    }

    before(async function () {
        await crearBDPruebas();
        logica = await Logica.crear(CONFIG_BD_PRUEBAS, async () => {}, 'http://localhost:8080/restablecer.html', 'clave-de-pruebas');
    });

    beforeEach(async function () {
        await vaciarTablas(logica.conexion);
        const [o] = await logica.conexion.execute("INSERT INTO Contaminantes (nombre, unidad) VALUES ('O3', 'µg/m³')");
        idO3 = o.insertId;
        laura = await logica.registrarUsuario('Laura', 'Martínez', 'laura@aeris.es', 'aire2026');
        pau = await logica.registrarUsuario('Pau', 'Ferrer', 'pau@aeris.es', 'aire2026');
        marta = await logica.registrarUsuario('Marta', 'Soler', 'marta@aeris.es', 'aire2026');

        const s1 = await sensor('092021010001', laura, 90);
        await medir(s1, laura, 3 * DIA);
        await medir(s1, laura, 10 * 60000, 'POINT(-0.376 39.470)');      // la última: hace 10 min, en Valencia
        const s2 = await sensor('092021010002', pau, 15);
        await medir(s2, pau, 2 * DIA);                                   // inactivo desde hace 2 días
        const s3 = await sensor('092021010003', marta, 60, true);
        await medir(s3, marta, HORA);                                    // activo, pero por calibrar
        await sensor('092021010004', laura, null);                       // nunca ha medido
        await sensor('092021010005', null);                              // sin vincular: no es un nodo
    });

    after(async function () {
        await logica.cerrar();
    });

    it('buscar() da cada nodo con su portador, última medición, batería, ubicación y estado', async function () {
        const { nodos, total } = await logica.nodos.buscar({}, AHORA);
        assert.strictEqual(total, 4);
        const n1 = nodos.find((n) => n.id === '092021010001');
        assert.deepStrictEqual(n1, {
            id: '092021010001',
            portador: 'Laura Martínez',
            ultimaMedicion: new Date(AHORA.getTime() - 10 * 60000),
            bateria: 90,
            latitud: 39.47,
            longitud: -0.376,
            necesitaCalibrar: false,
            estado: 'ACTIVO'
        });
        const nunca = nodos.find((n) => n.id === '092021010004');
        assert.strictEqual(nunca.ultimaMedicion, null);
        assert.strictEqual(nunca.latitud, null);
        assert.strictEqual(nunca.bateria, null);
        assert.strictEqual(nunca.estado, 'INACTIVO');
        assert.strictEqual(nodos.find((n) => n.id === '092021010003').estado, 'CALIBRAR');
    });

    it('buscar() ordena del que lleva más tiempo sin datos al más reciente', async function () {
        const { nodos } = await logica.nodos.buscar({}, AHORA);
        assert.deepStrictEqual(nodos.map((n) => n.id),
            ['092021010004', '092021010002', '092021010003', '092021010001']);
    });

    it('buscar() encuentra por número de serie o por portador, sin mirar mayúsculas ni acentos', async function () {
        assert.deepStrictEqual((await logica.nodos.buscar({ busqueda: '0003' }, AHORA)).nodos.map((n) => n.id), ['092021010003']);
        const martinez = await logica.nodos.buscar({ busqueda: 'MARTINEZ' }, AHORA);
        assert.deepStrictEqual(martinez.nodos.map((n) => n.id), ['092021010004', '092021010001']);
        assert.strictEqual((await logica.nodos.buscar({ busqueda: 'nadie' }, AHORA)).total, 0);
    });

    it('buscar() filtra por estado: activos, inactivos y por calibrar', async function () {
        const ids = async (estado) => (await logica.nodos.buscar({ estado }, AHORA)).nodos.map((n) => n.id).sort();
        assert.deepStrictEqual(await ids('activos'), ['092021010001', '092021010003']);
        assert.deepStrictEqual(await ids('inactivos'), ['092021010002', '092021010004']);
        assert.deepStrictEqual(await ids('calibrar'), ['092021010003']);
        assert.strictEqual((await ids('todos')).length, 4);
    });

    it('buscar() devuelve por páginas y total sin paginar; porPagina 0 los da todos', async function () {
        const p1 = await logica.nodos.buscar({ pagina: 1, porPagina: 3 }, AHORA);
        const p2 = await logica.nodos.buscar({ pagina: '2', porPagina: '3' }, AHORA);
        assert.strictEqual(p1.nodos.length, 3);
        assert.strictEqual(p2.nodos.length, 1);
        assert.strictEqual(p1.total, 4);
        assert.strictEqual(p2.total, 4);
        assert.strictEqual((await logica.nodos.buscar({ porPagina: 0 }, AHORA)).nodos.length, 4);
    });

    it('buscar() con más de mil nodos solo devuelve la página pedida (20 por defecto)', async function () {
        this.timeout(60000);
        const filas = [];
        for (let i = 0; i < 1100; i++) {
            filas.push([`9${String(i).padStart(11, '0')}`, -44.75, 'compra@aeris.es', pau.idUsuario, 50]);
        }
        await logica.conexion.query(
            'INSERT INTO Sensores (numeroSerie, sensibilidad, correoCompra, idUsuario, bateria) VALUES ?', [filas]);
        const r = await logica.nodos.buscar({}, AHORA);
        assert.strictEqual(r.total, 1104);
        assert.strictEqual(r.nodos.length, 20);
        assert.strictEqual((await logica.nodos.buscar({ pagina: 56 }, AHORA)).nodos.length, 4);
    });

    it('buscar() con filtros raros da DATOS_NO_VALIDOS con los campos', async function () {
        await assert.rejects(logica.nodos.buscar({ estado: 'rotos' }, AHORA),
            { codigo: 'DATOS_NO_VALIDOS', campos: ['estado'] });
        await assert.rejects(logica.nodos.buscar({ pagina: 0, porPagina: 500 }, AHORA),
            { codigo: 'DATOS_NO_VALIDOS', campos: ['pagina', 'porPagina'] });
        await assert.rejects(logica.nodos.buscar({ pagina: 'dos' }, AHORA), { codigo: 'DATOS_NO_VALIDOS' });
    });

    it('resumen() cuenta activos, inactivos de 24 h y de 7 días, y por calibrar', async function () {
        assert.deepStrictEqual(await logica.nodos.resumen(AHORA),
            { total: 4, activos: 2, inactivos24h: 2, inactivos7d: 1, porCalibrar: 1, umbralHoras: 24 });
    });

    // ---- T022: detección de nodos inactivos ----

    async function estadosBD() {
        const [filas] = await logica.conexion.query(
            'SELECT numeroSerie, estado FROM Sensores WHERE idUsuario IS NOT NULL ORDER BY numeroSerie');
        return Object.fromEntries(filas.map((f) => [f.numeroSerie, f.estado]));
    }

    afterEach(function () {
        logica.nodos.cambiarUmbral(24);
    });

    it('marcarInactivos() guarda en Sensores.estado los que llevan más de 24 h sin datos', async function () {
        await logica.conexion.query("UPDATE Sensores SET estado = 'activo'");
        const r = await logica.nodos.marcarInactivos(AHORA);
        assert.deepStrictEqual(await estadosBD(), {
            '092021010001': 'activo', '092021010002': 'inactivo', '092021010003': 'activo', '092021010004': 'inactivo'
        });
        assert.deepStrictEqual(r, { inactivos: 2, activos: 0 });
        assert.deepStrictEqual(await logica.nodos.marcarInactivos(AHORA), { inactivos: 0, activos: 0 });
    });

    it('al listar los nodos también se guarda su estado en la BD', async function () {
        await logica.nodos.buscar({}, AHORA);
        assert.strictEqual((await estadosBD())['092021010002'], 'inactivo');
        const { nodos } = await logica.nodos.buscar({}, AHORA);
        assert.ok(nodos.every((n) => !('estadoBD' in n)));
    });

    it('con otro umbral los estados se recalculan con el valor nuevo', async function () {
        assert.strictEqual(logica.nodos.cambiarUmbral('72'), 72);    // como llega del .env
        assert.strictEqual((await logica.nodos.buscar({ busqueda: '0002' }, AHORA)).nodos[0].estado, 'ACTIVO');
        assert.deepStrictEqual(await logica.nodos.resumen(AHORA),
            { total: 4, activos: 3, inactivos24h: 1, inactivos7d: 1, porCalibrar: 1, umbralHoras: 72 });
        assert.strictEqual((await estadosBD())['092021010002'], 'activo');

        logica.nodos.cambiarUmbral(1);        // la de hace justo 1 h aún cuenta; hace falta pasar del umbral
        assert.deepStrictEqual((await logica.nodos.buscar({ estado: 'activos' }, AHORA)).nodos.map((n) => n.id),
            ['092021010003', '092021010001']);
        assert.strictEqual((await logica.nodos.buscar({ estado: 'activos' },
            new Date(AHORA.getTime() + 60000))).total, 1);   // un minuto después, la de hace 1 h ya es inactiva
        logica.nodos.cambiarUmbral(undefined);                         // sin nada en el .env: 24
        assert.strictEqual(logica.nodos.horasInactivo, 24);
    });

    it('cambiarUmbral() solo acepta enteros de 1 a 168 horas', function () {
        for (const malo of [0, 169, '12.5', 'mucho', -3]) {
            assert.throws(() => logica.nodos.cambiarUmbral(malo), { codigo: 'DATOS_NO_VALIDOS', campos: ['umbralHoras'] }, String(malo));
        }
        assert.strictEqual(logica.nodos.horasInactivo, 24);
        assert.strictEqual(logica.nodos.cambiarUmbral(168), 168);
    });

    it('un nodo inactivo que vuelve a medir pasa a activo', async function () {
        await logica.nodos.marcarInactivos(AHORA);
        const [[s2]] = await logica.conexion.query("SELECT idSensor FROM Sensores WHERE numeroSerie = '092021010002'");
        await medir(s2.idSensor, pau, 5 * 60000);
        assert.strictEqual((await logica.nodos.buscar({ busqueda: '0002' }, AHORA)).nodos[0].estado, 'ACTIVO');
        await logica.nodos.marcarInactivos(AHORA);
        assert.strictEqual((await estadosBD())['092021010002'], 'activo');
    });
});