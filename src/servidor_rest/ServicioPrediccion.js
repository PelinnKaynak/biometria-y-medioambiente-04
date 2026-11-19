// ---------------------------------------------------------------------------
// Fichero:     ServicioPrediccion.js
// Descripción: Gestiona el proceso Python persistente de la previsión de ozono
//              (src/prevision/worker_prediccion.py) para que su fallo nunca
//              afecte al resto del servidor REST:
//                - arranque perezoso: el worker se lanza en la primera petición;
//                - caché de 5 minutos del último resultado válido;
//                - las peticiones simultáneas comparten un único cálculo;
//                - errores de spawn, stdin, stdout, stderr y exit controlados;
//                - si el worker se detiene, se responde de forma controlada y
//                  se vuelve a lanzar en una petición posterior;
//                - los mensajes y trazas de Python solo van al log del servidor.
//              Diseño en doc/servidor_rest_design.md. Tarea T032.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const TTL_CACHE_MS = 5 * 60 * 1000;     // el resultado válido se reutiliza 5 minutos
const TIEMPO_ESPERA_MS = 10000;         // máximo para que responda un worker ya cargado
const TIEMPO_ARRANQUE_MS = 20000;       // margen extra la primera vez (carga el modelo)
const ESPERA_REINICIO_MS = 5000;        // tras una caída no se relanza antes de este tiempo
const GRACIA_SALIDA_MS = 100;           // tras 'exit', margen para leer la última línea de stdout

const MOTIVO_NO_DISPONIBLE = 'no_disponible';
const MOTIVO_TIEMPO_AGOTADO = 'tiempo_agotado';
const MOTIVO_DESACTIVADA = 'desactivada';

// ---------------------------------------------------------------------------
// motivo: Text, mensaje: Text --> new ErrorPrevision()
// What it does: error controlado del servicio. «mensaje» es el único texto que
//               puede llegar al cliente; el detalle interno se escribe en el log.
// ---------------------------------------------------------------------------
class ErrorPrevision extends Error {
    constructor(motivo, mensaje) {
        super(mensaje);
        this.name = 'ErrorPrevision';
        this.motivo = motivo;
    }
}

// --> lanzarWorkerPython() --> ChildProcess
// What it does: lanza el worker Python con stdin/stdout/stderr por tubería.
function lanzarWorkerPython() {
    const raiz = path.resolve(__dirname, '..', '..');
    const script = path.join(raiz, 'src', 'prevision', 'worker_prediccion.py');
    return spawn(process.env.PYTHON || 'python', [script], { cwd: raiz, windowsHide: true });
}

// ---------------------------------------------------------------------------
// proceso: ChildProcess --> matarArbol() -->
// What it does: para el worker y todos sus procesos hijos. El predictor de
//               Python (scikit-learn/joblib) crea decenas de subprocesos «loky» y,
//               en Windows, kill() solo mata el principal: los demás quedarían
//               huérfanos con las tuberías abiertas. Por eso se cierra stdin (el
//               worker sale solo al leer EOF) y en Windows se usa taskkill /T.
// ---------------------------------------------------------------------------
function matarArbol(proceso) {
    try {
        if (proceso.stdin && typeof proceso.stdin.end === 'function') {
            proceso.stdin.end();
        }
    } catch (error) {
        // el canal ya estaba cerrado
    }
    if (process.platform === 'win32' && proceso.pid) {
        try {
            // kill() va DESPUÉS de taskkill: si el padre muriera antes, taskkill /T ya no
            // encontraría el árbol y los hijos quedarían huérfanos.
            const taskkill = spawn('taskkill', ['/PID', String(proceso.pid), '/T', '/F'],
                { windowsHide: true, stdio: 'ignore' });
            taskkill.on('error', () => proceso.kill());
            taskkill.on('exit', () => proceso.kill());      // respaldo; no hace nada si ya murió
            taskkill.unref();
            return;
        } catch (error) {
            // si taskkill no se puede lanzar, queda kill()
        }
    }
    proceso.kill();
}

// ServicioPrediccion class: one worker, one cache, one calculation at a time.
class ServicioPrediccion {

    // opciones (todas opcionales; las usan los tests):
    //   lanzar() --> proceso        cómo se crea el worker
    //   matar(proceso)              cómo se para (por defecto, él y todos sus hijos)
    //   ahora() --> ms              reloj
    //   ttlCacheMs, tiempoEsperaMs, tiempoArranqueMs, esperaReinicioMs, graciaSalidaMs
    //   log: { error(), warn() }
    constructor(opciones = {}) {
        this.lanzar = opciones.lanzar || lanzarWorkerPython;
        this.matar = opciones.matar || matarArbol;
        this.ahora = opciones.ahora || Date.now;
        this.ttlCacheMs = opciones.ttlCacheMs ?? TTL_CACHE_MS;
        this.tiempoEsperaMs = opciones.tiempoEsperaMs ?? TIEMPO_ESPERA_MS;
        this.tiempoArranqueMs = opciones.tiempoArranqueMs ?? TIEMPO_ARRANQUE_MS;
        this.esperaReinicioMs = opciones.esperaReinicioMs ?? ESPERA_REINICIO_MS;
        this.graciaSalidaMs = opciones.graciaSalidaMs ?? GRACIA_SALIDA_MS;
        this.log = opciones.log || console;

        this.proceso = null;        // worker vivo, o null
        this.pendiente = null;      // { resolve, reject, temporizador } de la petición en curso
        this.enCurso = null;        // promesa compartida por las peticiones simultáneas
        this.cache = null;          // { valor, momento }
        this.noRelanzarHasta = 0;   // instante hasta el que no se relanza tras una caída
    }

    // -----------------------------------------------------------------------
    // --> predecir() -->
    // Promise<Object> <--     (rechaza siempre con ErrorPrevision)
    // What it does: devuelve la previsión: de la caché si tiene menos de 5
    //               minutos; si no, la calcula con el worker (lanzándolo si
    //               hace falta). Las llamadas simultáneas comparten el cálculo.
    // -----------------------------------------------------------------------
    predecir() {
        if (this.cache && this.ahora() - this.cache.momento < this.ttlCacheMs) {
            return Promise.resolve(this.cache.valor);
        }
        if (this.enCurso) {
            return this.enCurso;
        }
        this.enCurso = this._calcular()
            .then((valor) => {
                this.cache = { valor, momento: this.ahora() };
                return valor;
            })
            .finally(() => {
                this.enCurso = null;
            });
        return this.enCurso;
    }

    // -----------------------------------------------------------------------
    // --> detener() -->
    // What it does: para el worker (si existe) y vacía la caché.
    // -----------------------------------------------------------------------
    detener() {
        const proceso = this.proceso;
        this.proceso = null;
        this.cache = null;
        this._cerrarPendiente(new ErrorPrevision(MOTIVO_NO_DISPONIBLE, 'Servicio detenido.'));
        if (proceso) {
            this._matar(proceso);
        }
    }

    // Pide una predicción al worker y espera su línea de respuesta
    _calcular() {
        return new Promise((resolve, reject) => {
            let proceso;
            try {
                proceso = this._obtenerProceso();
            } catch (error) {
                reject(error instanceof ErrorPrevision
                    ? error
                    : this._fallo('no se pudo lanzar el worker', error));
                return;
            }

            const espera = this.tiempoEsperaMs + (proceso.recienLanzado ? this.tiempoArranqueMs : 0);
            const temporizador = setTimeout(() => {
                // Un worker que no responde se descarta: así su respuesta tardía
                // no se podría entregar a otra petición.
                this.log.error(`[previsión] el worker no respondió en ${espera} ms; se reinicia`);
                this._descartar(proceso, 'tiempo de espera agotado', MOTIVO_TIEMPO_AGOTADO);
            }, espera);
            this.pendiente = { resolve, reject, temporizador };

            try {
                proceso.stdin.write(JSON.stringify({ accion: 'predecir' }) + '\n');
            } catch (error) {
                this._descartar(proceso, `no se pudo escribir en el worker: ${error.message}`, MOTIVO_NO_DISPONIBLE);
            }
        });
    }

    // Devuelve el worker vivo; si no hay, lo lanza (si no está en periodo de espera)
    _obtenerProceso() {
        if (this.proceso) {
            return this.proceso;
        }
        if (this.ahora() < this.noRelanzarHasta) {
            throw new ErrorPrevision(MOTIVO_NO_DISPONIBLE, 'Servicio de predicción no disponible.');
        }

        const proceso = this.lanzar();
        proceso.recienLanzado = true;
        this.proceso = proceso;

        // Cualquier error de un canal o la salida del proceso lo descarta; ninguno
        // queda sin manejar (un 'error' sin oyente tumbaría todo el servidor).
        proceso.on('error', (error) => this._descartar(proceso, `error del proceso: ${error.message}`, MOTIVO_NO_DISPONIBLE));
        // 'close' llega cuando ya se han leído todas las líneas; 'exit' puede llegar antes que
        // la última línea de stdout, así que se espera un instante por si aún viene la respuesta.
        proceso.on('close', (codigo, senyal) =>
            this._descartar(proceso, `el worker terminó (código ${codigo}, señal ${senyal})`, MOTIVO_NO_DISPONIBLE));
        proceso.on('exit', (codigo, senyal) => {
            const espera = setTimeout(() => this._descartar(
                proceso, `el worker terminó (código ${codigo}, señal ${senyal})`, MOTIVO_NO_DISPONIBLE),
            this.graciaSalidaMs);
            if (espera.unref) {
                espera.unref();
            }
        });
        this._vigilar(proceso, proceso.stdin, 'stdin');

        if (proceso.stdout) {
            this._vigilar(proceso, proceso.stdout, 'stdout');
            readline.createInterface({ input: proceso.stdout })
                .on('line', (linea) => this._alRecibirLinea(proceso, linea));
        }
        if (proceso.stderr) {
            this._vigilar(proceso, proceso.stderr, 'stderr');
            readline.createInterface({ input: proceso.stderr })
                .on('line', (linea) => this.log.error(`[previsión] ${linea}`));
        }
        return proceso;
    }

    _vigilar(proceso, canal, nombre) {
        if (canal && typeof canal.on === 'function') {
            canal.on('error', (error) => this._descartar(proceso, `error en ${nombre}: ${error.message}`, MOTIVO_NO_DISPONIBLE));
        }
    }

    // Una línea de stdout = la respuesta del worker a la petición en curso
    _alRecibirLinea(proceso, linea) {
        if (proceso !== this.proceso) {
            return;
        }
        let resultado;
        try {
            resultado = JSON.parse(linea);
        } catch (error) {
            this.log.error(`[previsión] línea no válida del worker: ${linea.slice(0, 200)}`);
            return;
        }
        proceso.recienLanzado = false;
        if (!this.pendiente) {
            this.log.error('[previsión] respuesta del worker sin petición pendiente; se ignora');
            return;
        }
        const { resolve, reject, temporizador } = this.pendiente;
        this.pendiente = null;
        clearTimeout(temporizador);

        if (resultado && resultado.error) {
            // El detalle (trazas, rutas…) se queda en el log del servidor
            this.log.error(`[previsión] el worker devolvió un error: ${String(resultado.error).slice(0, 500)}`);
            reject(new ErrorPrevision(MOTIVO_NO_DISPONIBLE, 'Servicio de predicción no disponible.'));
            return;
        }
        resolve(resultado);
    }

    // Da el worker por perdido: lo mata, no se relanza hasta pasada la espera y
    // la petición en curso (si hay) falla de inmediato.
    _descartar(proceso, causa, motivo) {
        if (proceso !== this.proceso) {
            return;     // ya descartado (error, exit y timeout pueden coincidir)
        }
        this.proceso = null;
        this.noRelanzarHasta = this.ahora() + this.esperaReinicioMs;
        this.log.error(`[previsión] worker descartado: ${causa}`);
        this._matar(proceso);
        this._cerrarPendiente(motivo === MOTIVO_TIEMPO_AGOTADO
            ? new ErrorPrevision(MOTIVO_TIEMPO_AGOTADO, 'Tiempo de espera agotado.')
            : new ErrorPrevision(MOTIVO_NO_DISPONIBLE, 'Servicio de predicción no disponible.'));
    }

    _cerrarPendiente(error) {
        if (!this.pendiente) {
            return;
        }
        const { reject, temporizador } = this.pendiente;
        this.pendiente = null;
        clearTimeout(temporizador);
        reject(error);
    }

    _matar(proceso) {
        try {
            this.matar(proceso);
        } catch (error) {
            this.log.error(`[previsión] no se pudo parar el worker: ${error.message}`);
        }
    }

    _fallo(causa, error) {
        this.log.error(`[previsión] ${causa}: ${error.message}`);
        return new ErrorPrevision(MOTIVO_NO_DISPONIBLE, 'Servicio de predicción no disponible.');
    }
}

module.exports = {
    ServicioPrediccion,
    ErrorPrevision,
    MOTIVO_NO_DISPONIBLE,
    MOTIVO_TIEMPO_AGOTADO,
    MOTIVO_DESACTIVADA,
    TTL_CACHE_MS
};
