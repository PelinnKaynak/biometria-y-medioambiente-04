// ---------------------------------------------------------------------------
// Fichero:     test_servicio_prediccion.js
// Descripción: Tests del servicio de predicción de ozono (T032): arranque
//              perezoso, caché de 5 minutos, peticiones simultáneas, errores de
//              spawn/stdin/stdout/stderr/exit, caída y recuperación del worker,
//              y que ningún fallo afecte a las demás rutas ni filtre mensajes
//              internos. No necesitan MySQL ni Python: usan procesos falsos y,
//              en algunos casos, un worker real hecho con el propio Node.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const express = require('express');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { spawn } = require('child_process');
const { ServicioPrediccion, ErrorPrevision, MOTIVO_NO_DISPONIBLE, MOTIVO_TIEMPO_AGOTADO } = require('../ServicioPrediccion');
const { cargarRutasPrevision } = require('../RutasPrevision');
const { crearServidor, estaPrevisionActiva } = require('../ServidorREST');

const CINCO_MINUTOS = 5 * 60 * 1000;
const RESULTADO = { zona: 'Gandia', simulados: true, numero_predicciones: 48, predicciones: [], valor_pico: 61.5 };

// ---- ayudas ----------------------------------------------------------------

// Proceso falso con tuberías reales. alPedir(proceso, peticion) decide qué hace el «worker».
function crearProcesoFalso(alPedir) {
    const p = new EventEmitter();
    p.stdin = new PassThrough();
    p.stdout = new PassThrough();
    p.stderr = new PassThrough();
    p.peticiones = 0;
    p.killed = false;
    p.kill = () => {
        if (p.killed) return;
        p.killed = true;
        setImmediate(() => { p.emit('exit', null, 'SIGTERM'); p.emit('close', null, 'SIGTERM'); });
    };
    p.responder = (objeto) => p.stdout.write(JSON.stringify(objeto) + '\n');
    p.caer = (codigo = 1) => { p.killed = true; p.emit('exit', codigo, null); p.emit('close', codigo, null); };
    p.stdin.on('data', (datos) => {
        String(datos).split('\n').filter(Boolean).forEach((linea) => {
            p.peticiones++;
            alPedir(p, JSON.parse(linea));
        });
    });
    return p;
}

function crearLog() {
    return { lineas: [], error(...a) { this.lineas.push(a.join(' ')); }, warn(...a) { this.lineas.push(a.join(' ')); } };
}

// Reloj controlable y servicio con procesos falsos: fabrica(n) devuelve el proceso número n (0, 1, …)
function crearBanco(fabrica, extra = {}) {
    const banco = { t: 1000000, procesos: [], log: crearLog() };
    banco.servicio = new ServicioPrediccion({
        lanzar: () => {
            const p = fabrica(banco.procesos.length);
            banco.procesos.push(p);
            return p;
        },
        ahora: () => banco.t,
        log: banco.log,
        graciaSalidaMs: 5,
        tiempoEsperaMs: 2000,
        tiempoArranqueMs: 0,
        esperaReinicioMs: 1000,
        ...extra
    });
    return banco;
}

const respondeBien = (marca) => (p) => p.responder({ ...RESULTADO, marca });
const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function rechazo(promesa) {
    try {
        await promesa;
    } catch (error) {
        return error;
    }
    return assert.fail('Debía rechazar la promesa');
}

// Servidor Express con la ruta de previsión, una ruta ajena y puerto libre
async function iniciarApp(opcionesRutas) {
    const app = express();
    app.get('/otra', (q, r) => r.json({ ok: true }));
    const servicio = cargarRutasPrevision(app, opcionesRutas);
    const conexion = await new Promise((resolve) => { const c = app.listen(0, () => resolve(c)); });
    const url = `http://127.0.0.1:${conexion.address().port}`;
    return { app, servicio, url, cerrar: () => { servicio.detener(); conexion.close(); } };
}

async function pedir(url, ruta) {
    const r = await fetch(url + ruta);
    const texto = await r.text();
    let cuerpo = null;
    try { cuerpo = JSON.parse(texto); } catch (error) { /* no es JSON */ }
    return { codigo: r.status, texto, cuerpo };
}

// ---- tests -----------------------------------------------------------------

describe('ServicioPrediccion (previsión de ozono, T032)', function () {
    this.timeout(10000);

    let abiertos;
    beforeEach(() => { abiertos = []; });
    afterEach(() => { abiertos.forEach((cerrar) => cerrar()); });

    function usar(banco) {
        abiertos.push(() => banco.servicio.detener());
        return banco;
    }

    // ----- arranque perezoso -----

    it('no lanza el worker al crear el servicio ni al montar las rutas', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso(respondeBien(1))));
        const app = await iniciarApp({ servicio: banco.servicio });
        abiertos.push(app.cerrar);

        assert.strictEqual(banco.procesos.length, 0);
        await pedir(app.url, '/otra');
        assert.strictEqual(banco.procesos.length, 0, 'una ruta ajena no debe lanzar Python');
    });

    it('lanza el worker en la primera petición y lo reutiliza', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso(respondeBien(1)), { ttlCacheMs: 0 }));
        await banco.servicio.predecir();
        await banco.servicio.predecir();
        assert.strictEqual(banco.procesos.length, 1);
        assert.strictEqual(banco.procesos[0].peticiones, 2);
    });

    it('se puede desactivar: responde 503 «desactivada» y no lanza Python nunca', async function () {
        let lanzado = 0;
        const app = await iniciarApp({
            activa: false,
            servicioOpciones: { lanzar: () => { lanzado++; throw new Error('no debería lanzarse'); } }
        });
        abiertos.push(app.cerrar);

        const r = await pedir(app.url, '/api/prevision/ozono?zona=Gandia');
        assert.strictEqual(r.codigo, 503);
        assert.strictEqual(r.cuerpo.motivo, 'desactivada');
        assert.strictEqual((await pedir(app.url, '/api/prevision/ozono?zona=Valencia')).codigo, 400);
        assert.strictEqual((await pedir(app.url, '/otra')).codigo, 200);
        assert.strictEqual(lanzado, 0);
    });

    it('crearServidor({ prevision: false }) desactiva la ruta sin afectar al 404 ni a otras rutas', async function () {
        const servidor = crearServidor({}, (s) => s.get('/otra', (q, r) => r.json({ ok: true })), { prevision: false });
        const conexion = await new Promise((resolve) => { const c = servidor.listen(0, () => resolve(c)); });
        abiertos.push(() => conexion.close());
        const url = `http://127.0.0.1:${conexion.address().port}`;

        assert.strictEqual((await pedir(url, '/api/prevision/ozono')).codigo, 503);
        assert.strictEqual((await pedir(url, '/otra')).codigo, 200);
        assert.strictEqual((await pedir(url, '/noExiste')).codigo, 404);
    });

    it('PREVISION_ACTIVA: solo 0, false, no u off la desactivan', function () {
        for (const valor of ['0', 'false', 'FALSE', 'no', 'off', ' off ']) {
            assert.strictEqual(estaPrevisionActiva(valor), false, valor);
        }
        for (const valor of [undefined, '', '1', 'true', 'si']) {
            assert.strictEqual(estaPrevisionActiva(valor), true, String(valor));
        }
    });

    // ----- caché -----

    it('la caché de 5 minutos evita recalcular y caduca después', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso((p) => p.responder({ ...RESULTADO, marca: p.peticiones }))));

        const primero = await banco.servicio.predecir();
        banco.t += CINCO_MINUTOS - 1000;                    // 4 min 59 s
        const segundo = await banco.servicio.predecir();
        assert.strictEqual(banco.procesos[0].peticiones, 1, 'a los 4:59 sale de la caché');
        assert.strictEqual(segundo.marca, primero.marca);

        banco.t += 2000;                                    // 5 min 01 s
        const tercero = await banco.servicio.predecir();
        assert.strictEqual(banco.procesos[0].peticiones, 2, 'a los 5:01 se recalcula');
        assert.strictEqual(tercero.marca, 2);
        assert.strictEqual(banco.procesos.length, 1, 'se reutiliza el mismo worker');
    });

    it('un error no se guarda en la caché', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso((p) => (
            p.peticiones === 1 ? p.responder({ error: 'fallo puntual' }) : p.responder(RESULTADO)))));

        await rechazo(banco.servicio.predecir());
        const ok = await banco.servicio.predecir();
        assert.strictEqual(ok.zona, 'Gandia');
        assert.strictEqual(banco.procesos[0].peticiones, 2);
    });

    // ----- peticiones simultáneas -----

    it('las peticiones simultáneas comparten un único cálculo', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso((p) => setTimeout(() => p.responder({ ...RESULTADO, marca: 'x' }), 40))));

        const resultados = await Promise.all([1, 2, 3, 4, 5].map(() => banco.servicio.predecir()));
        assert.strictEqual(banco.procesos.length, 1);
        assert.strictEqual(banco.procesos[0].peticiones, 1, 'cinco peticiones, un solo cálculo');
        assert.ok(resultados.every((r) => r.marca === 'x'));
    });

    it('por HTTP: 6 peticiones a la vez dan 200 y un solo cálculo (sin 503 «ocupado»)', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso((p) => setTimeout(() => p.responder(RESULTADO), 40))));
        const app = await iniciarApp({ servicio: banco.servicio });
        abiertos.push(app.cerrar);

        const respuestas = await Promise.all(
            [1, 2, 3, 4, 5, 6].map(() => pedir(app.url, '/api/prevision/ozono?zona=Gandia')));
        assert.deepStrictEqual(respuestas.map((r) => r.codigo), [200, 200, 200, 200, 200, 200]);
        assert.strictEqual(banco.procesos[0].peticiones, 1);
        assert.strictEqual(typeof respuestas[0].cuerpo.tiempo_respuesta_ms, 'number');
        assert.strictEqual(respuestas[0].cuerpo.simulados, true);
    });

    it('si el cálculo compartido falla, todas las peticiones reciben el fallo', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso((p) => setTimeout(() => p.caer(1), 20))));
        const errores = await Promise.all([1, 2, 3].map(() => rechazo(banco.servicio.predecir())));
        assert.ok(errores.every((e) => e instanceof ErrorPrevision && e.motivo === MOTIVO_NO_DISPONIBLE));
        assert.strictEqual(banco.procesos.length, 1);
    });

    // ----- errores de spawn, stdin, stdout, stderr y exit -----

    it('error de spawn: 503 genérico, sin detalles, y el resto de la API sigue', async function () {
        const banco = usar(crearBanco(() => {
            const p = crearProcesoFalso(() => {});
            setImmediate(() => {
                p.emit('error', new Error('spawn C:\\no_existe\\python.exe ENOENT'));
                p.stdin.emit('error', new Error('write EPIPE'));
            });
            return p;
        }));
        const app = await iniciarApp({ servicio: banco.servicio });
        abiertos.push(app.cerrar);

        const r = await pedir(app.url, '/api/prevision/ozono?zona=Gandia');
        assert.strictEqual(r.codigo, 503);
        assert.strictEqual(r.cuerpo.motivo, MOTIVO_NO_DISPONIBLE);
        assert.ok(!/ENOENT|python|EPIPE|C:\\/i.test(r.texto), `filtra detalles: ${r.texto}`);
        assert.ok(banco.log.lineas.some((l) => l.includes('ENOENT')), 'el detalle queda en el log');
        assert.strictEqual((await pedir(app.url, '/otra')).codigo, 200);
    });

    it('spawn real de un ejecutable que no existe: 503 y el servidor no se cae', async function () {
        const log = crearLog();
        const app = await iniciarApp({
            servicioOpciones: {
                lanzar: () => spawn('C:\\ruta\\que\\no\\existe\\python.exe', ['x.py']),
                log
            }
        });
        abiertos.push(app.cerrar);

        const r = await pedir(app.url, '/api/prevision/ozono?zona=Gandia');
        assert.strictEqual(r.codigo, 503);
        assert.strictEqual((await pedir(app.url, '/otra')).codigo, 200);
    });

    it('lanzar() que lanza una excepción: 503 y la ruta ajena sigue', async function () {
        const app = await iniciarApp({ servicioOpciones: { lanzar: () => { throw new Error('boom interno'); }, log: crearLog() } });
        abiertos.push(app.cerrar);

        const r = await pedir(app.url, '/api/prevision/ozono?zona=Gandia');
        assert.strictEqual(r.codigo, 503);
        assert.ok(!r.texto.includes('boom'));
        assert.strictEqual((await pedir(app.url, '/otra')).codigo, 200);
    });

    it('error de escritura en stdin (EPIPE): se controla y no tumba el proceso', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso((p) => p.stdin.emit('error', new Error('write EPIPE')))));
        const error = await rechazo(banco.servicio.predecir());
        assert.strictEqual(error.motivo, MOTIVO_NO_DISPONIBLE);
        assert.ok(banco.log.lineas.some((l) => l.includes('EPIPE')));
    });

    it('error en stdout y en stderr: se controlan', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso((p) => p.stdout.emit('error', new Error('lectura rota')))));
        assert.strictEqual((await rechazo(banco.servicio.predecir())).motivo, MOTIVO_NO_DISPONIBLE);

        const banco2 = usar(crearBanco(() => crearProcesoFalso((p) => p.stderr.emit('error', new Error('stderr roto')))));
        assert.strictEqual((await rechazo(banco2.servicio.predecir())).motivo, MOTIVO_NO_DISPONIBLE);
    });

    it('lo que Python escribe en stderr o en stdout sin ser JSON va al log, no al cliente', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso((p) => {
            p.stderr.write('Traceback: aviso de pandas\n');
            p.stdout.write('basura que no es json\n');
            setTimeout(() => p.responder(RESULTADO), 20);
        })));
        const app = await iniciarApp({ servicio: banco.servicio });
        abiertos.push(app.cerrar);

        const r = await pedir(app.url, '/api/prevision/ozono?zona=Gandia');
        assert.strictEqual(r.codigo, 200);
        assert.ok(!r.texto.includes('Traceback'));
        assert.ok(banco.log.lineas.some((l) => l.includes('aviso de pandas')));
        assert.ok(banco.log.lineas.some((l) => l.includes('basura')));
    });

    it('un error devuelto por Python no se envía al cliente (trazas y rutas solo en el log)', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso((p) => p.responder({
            error: 'Traceback (most recent call last): File "C:\\secreto\\worker.py", line 9'
        }))));
        const app = await iniciarApp({ servicio: banco.servicio });
        abiertos.push(app.cerrar);

        const r = await pedir(app.url, '/api/prevision/ozono?zona=Gandia');
        assert.strictEqual(r.codigo, 503);
        assert.ok(!/Traceback|secreto|worker\.py/.test(r.texto), `filtra: ${r.texto}`);
        assert.ok(banco.log.lineas.some((l) => l.includes('secreto')), 'el detalle queda en el log');
    });

    it('si el worker responde y muere enseguida, la respuesta no se pierde', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso((p) => {
            p.responder(RESULTADO);
            p.emit('exit', 0, null);        // 'exit' puede llegar antes que la última línea
            setTimeout(() => p.emit('close', 0, null), 30);
        }), { graciaSalidaMs: 50 }));
        const r = await banco.servicio.predecir();
        assert.strictEqual(r.zona, 'Gandia');
    });

    // ----- caída y recuperación del worker -----

    it('si el worker cae durante una petición, falla enseguida; no se relanza durante la espera y se recupera después', async function () {
        const banco = usar(crearBanco((n) => crearProcesoFalso((p) => {
            if (n === 0) {
                p.stderr.write('Traceback: el modelo explotó\n');
                p.caer(1);
            } else {
                p.responder({ ...RESULTADO, marca: 'recuperado' });
            }
        })));

        const inicio = Date.now();
        const error = await rechazo(banco.servicio.predecir());
        assert.strictEqual(error.motivo, MOTIVO_NO_DISPONIBLE);
        assert.ok(Date.now() - inicio < 1500, 'no espera al tiempo de espera');
        assert.strictEqual(banco.procesos.length, 1);

        // Dentro de la espera de reinicio: respuesta inmediata, sin relanzar
        const durante = await rechazo(banco.servicio.predecir());
        assert.strictEqual(durante.motivo, MOTIVO_NO_DISPONIBLE);
        assert.strictEqual(banco.procesos.length, 1, 'no se relanza todavía');

        // Pasada la espera: vuelve a lanzar el worker y funciona
        banco.t += 1500;
        const ok = await banco.servicio.predecir();
        assert.strictEqual(ok.marca, 'recuperado');
        assert.strictEqual(banco.procesos.length, 2, 'se lanzó un worker nuevo');
    });

    it('si el worker muere solo (sin petición en curso), la siguiente petición lo relanza', async function () {
        const banco = usar(crearBanco((n) => crearProcesoFalso(respondeBien(`worker${n}`)), { ttlCacheMs: 0 }));
        assert.strictEqual((await banco.servicio.predecir()).marca, 'worker0');

        banco.procesos[0].caer(137);
        await pausa(30);
        banco.t += 1500;
        assert.strictEqual((await banco.servicio.predecir()).marca, 'worker1');
        assert.strictEqual(banco.procesos.length, 2);
    });

    it('tiempo agotado: 504, el worker se descarta y su respuesta tardía no se entrega a otra petición', async function () {
        const banco = usar(crearBanco((n) => crearProcesoFalso((p) => {
            if (n === 0) return;                                  // el primero no responde nunca
            p.responder({ ...RESULTADO, marca: 'segundo' });
        }), { tiempoEsperaMs: 40, ttlCacheMs: 0 }));
        const app = await iniciarApp({ servicio: banco.servicio });
        abiertos.push(app.cerrar);

        const r = await pedir(app.url, '/api/prevision/ozono?zona=Gandia');
        assert.strictEqual(r.codigo, 504);
        assert.strictEqual(r.cuerpo.motivo, MOTIVO_TIEMPO_AGOTADO);
        assert.ok(banco.procesos[0].killed, 'el worker colgado se mata');

        banco.procesos[0].responder({ ...RESULTADO, marca: 'tardía' });    // respuesta tardía del worker descartado
        banco.t += 1500;
        const siguiente = await pedir(app.url, '/api/prevision/ozono?zona=Gandia');
        assert.strictEqual(siguiente.codigo, 200);
        assert.strictEqual(siguiente.cuerpo.marca, 'segundo');
    });

    it('la primera petición tiene margen extra para cargar el modelo', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso((p) => setTimeout(() => p.responder(RESULTADO), 120)),
            { tiempoEsperaMs: 40, tiempoArranqueMs: 1000 }));
        assert.strictEqual((await banco.servicio.predecir()).zona, 'Gandia');
    });

    it('detener() para el worker y rechaza la petición en curso', async function () {
        const banco = usar(crearBanco(() => crearProcesoFalso(() => {})));
        const promesa = banco.servicio.predecir();
        await pausa(20);
        banco.servicio.detener();
        assert.strictEqual((await rechazo(promesa)).motivo, MOTIVO_NO_DISPONIBLE);
        assert.ok(banco.procesos[0].killed);
    });

    // ----- con un proceso real (Node actuando de worker) -----

    describe('con un proceso real', function () {
        const WORKER_OK = `
            const rl = require('readline').createInterface({ input: process.stdin });
            console.error('Modelo cargado.');
            rl.on('line', () => console.log(JSON.stringify({ zona: 'Gandia', simulados: true, pid: process.pid, predicciones: [] })));`;
        const WORKER_CAE = `
            require('readline').createInterface({ input: process.stdin }).on('line', () => process.exit(3));`;

        // Como el predictor real (joblib/loky): el worker crea un proceso hijo que hereda las tuberías.
        // Va «detached» porque Node mata a sus hijos normales al morir (job object de Windows) y Python no:
        // sin detached la prueba pasaría aunque solo se hiciera kill() y no detectaría los huérfanos.
        const WORKER_CON_NIETO = `
            const { spawn } = require('child_process');
            const nieto = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit', detached: true });
            const responder = () => console.log(JSON.stringify({ zona: 'Gandia', predicciones: [], nieto: nieto.pid }));
            require('readline').createInterface({ input: process.stdin }).on('line', () => ${'${MODO}'});`;
        const WORKER_NIETO_RESPONDE = WORKER_CON_NIETO.replace('${MODO}', 'responder()');

        const lanzarScript = (script) => spawn(process.execPath, ['-e', script], { windowsHide: true });
        const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { return false; } };

        it('al detener el servicio se mata también el árbol de subprocesos (sin huérfanos)', async function () {
            const servicio = new ServicioPrediccion({
                lanzar: () => lanzarScript(WORKER_NIETO_RESPONDE), esperaReinicioMs: 50, tiempoArranqueMs: 15000, log: crearLog()
            });
            abiertos.push(() => servicio.detener());

            const { nieto } = await servicio.predecir();
            assert.ok(vivo(nieto), 'el subproceso nieto debe estar vivo mientras el worker funciona');

            servicio.detener();
            await pausa(1500);
            assert.strictEqual(vivo(nieto), false, 'el nieto debe morir con el worker, no quedar huérfano');
        });

        it('tras un tiempo agotado se mata también el árbol de subprocesos', async function () {
            // Worker que no contesta nunca; el pid de su nieto llega por stderr (que va al log).
            const NO_RESPONDE = `
                const { spawn } = require('child_process');
                const nieto = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit', detached: true });
                console.error('NIETO=' + nieto.pid);
                setInterval(() => {}, 1000);`;
            const log = crearLog();
            const servicio = new ServicioPrediccion({
                lanzar: () => lanzarScript(NO_RESPONDE), tiempoEsperaMs: 600, tiempoArranqueMs: 0, esperaReinicioMs: 50, log
            });
            abiertos.push(() => servicio.detener());

            const error = await rechazo(servicio.predecir());
            assert.strictEqual(error.motivo, MOTIVO_TIEMPO_AGOTADO);
            const linea = log.lineas.find((l) => l.includes('NIETO='));
            assert.ok(linea, 'el stderr del worker debe llegar al log');
            const nieto = Number(linea.split('NIETO=')[1]);
            await pausa(1500);
            assert.strictEqual(vivo(nieto), false, 'el nieto debe morir al descartar el worker colgado');
        });

        it('responde, y tras morir (kill externo) el siguiente intento lanza otro proceso', async function () {
            const log = crearLog();
            const servicio = new ServicioPrediccion({
                lanzar: () => lanzarScript(WORKER_OK), ttlCacheMs: 0, esperaReinicioMs: 50, tiempoArranqueMs: 15000, log
            });
            abiertos.push(() => servicio.detener());

            const primero = await servicio.predecir();
            assert.ok(primero.pid);
            await pausa(150);                                         // stderr y stdout son canales distintos
            assert.ok(log.lineas.some((l) => l.includes('Modelo cargado.')), 'el stderr real llega al log');

            servicio.proceso.kill();                                  // el worker muere por fuera
            await pausa(400);
            const segundo = await servicio.predecir();
            assert.notStrictEqual(segundo.pid, primero.pid, 'es un proceso nuevo');
        });

        it('un worker que sale con error al recibir la petición: 503 rápido y recuperación con otro worker', async function () {
            let lanzados = 0;
            const servicio = new ServicioPrediccion({
                lanzar: () => lanzarScript(lanzados++ === 0 ? WORKER_CAE : WORKER_OK),
                ttlCacheMs: 0, esperaReinicioMs: 50, tiempoArranqueMs: 15000, log: crearLog()
            });
            abiertos.push(() => servicio.detener());

            const error = await rechazo(servicio.predecir());
            assert.strictEqual(error.motivo, MOTIVO_NO_DISPONIBLE);
            await pausa(150);
            assert.strictEqual((await servicio.predecir()).zona, 'Gandia');
            assert.strictEqual(lanzados, 2);
        });
    });
});
