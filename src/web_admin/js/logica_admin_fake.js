// ------------------------------------------------------------
// logica_admin_fake.js
// Simula el servidor para el panel de administración, con
// nodos de prueba repartidos por la provincia de Valencia.
// Tiene la misma interfaz que LogicaAdminReal.
// ------------------------------------------------------------

const utilNodos = typeof module !== "undefined" ? require("./nodos") : window;

const CLAVE_SESION_ADMIN = "aeris_usuario";

const MUNICIPIOS_PRUEBA = [
    [38.968, -0.181], [39.470, -0.376], [39.151, -0.435], [38.990, -0.520],
    [38.920, -0.120], [38.840, 0.106], [39.204, -0.311], [39.165, -0.250],
    [38.698, -0.474], [38.821, -0.609]
];

const NOMBRES_PRUEBA = [
    "Laura Martínez", "Pau Ferrer", "Marta Soler", "Joan Climent", "Lucía Pastor",
    "Andrés Gil", "Núria Bosch", "Sergio Romero", "Elena Navarro", "Vicent Mira",
    "Carla Peris", "Álex Serra"
];

// Minutos sin datos de los nodos de prueba: la mayoría
// recientes, algunos de más de 24 horas y otros de más de
// una semana.
const MINUTOS_PRUEBA = [5, 12, 35, 48, 90, 120, 180, 300, 600, 1000,
    1560, 2900, 4320, 6000, 11520, 20000];

class LogicaAdminFake {

    // --------------------------------------------------------
    // cantidad: N, ahora: Fecha, retardo_ms: N --> LogicaAdminFake()
    //
    // Crea `cantidad` nodos de prueba. Siempre salen los mismos
    // para que las pruebas den el mismo resultado.
    // --------------------------------------------------------
    constructor(cantidad = 64, ahora = new Date(), retardo_ms = 300) {
        this.ahora = ahora;
        this.retardo_ms = retardo_ms;
        this.nodos = [];
        for (let i = 0; i < cantidad; i++) {
            const [lat, lon] = MUNICIPIOS_PRUEBA[i % MUNICIPIOS_PRUEBA.length];
            const minutos = MINUTOS_PRUEBA[(i * 7) % MINUTOS_PRUEBA.length];
            this.nodos.push({
                id: "N-" + String(100 + i * 17).padStart(4, "0"),
                portador: NOMBRES_PRUEBA[(i * 5) % NOMBRES_PRUEBA.length],
                ultimaMedicion: new Date(ahora.getTime() - minutos * 60000).toISOString(),
                bateria: (i * 37 + 11) % 101,
                latitud: lat + ((i * 13) % 9 - 4) * 0.012,
                longitud: lon + ((i * 7) % 9 - 4) * 0.015,
                necesitaCalibrar: i % 9 === 4
            });
        }
    }

    // --------------------------------------------------------
    // r: Usuario <-- usuarioActual() <--
    // --------------------------------------------------------
    usuarioActual() {
        const guardado = sessionStorage.getItem(CLAVE_SESION_ADMIN);
        return guardado ? JSON.parse(guardado) : null;
    }

    // --------------------------------------------------------
    // cerrarSesion() -->
    // --------------------------------------------------------
    cerrarSesion() {
        sessionStorage.removeItem(CLAVE_SESION_ADMIN);
    }

    // --------------------------------------------------------
    // r: ResultadoResumen <-- obtenerResumenNodos() <--
    //
    // ResumenNodos = ( total: N, activos: N, inactivos24h: N,
    //                  inactivos7d: N, porCalibrar: N )
    // ResultadoResumen = ( correcto: B, resumen: ResumenNodos, error: Text )
    // --------------------------------------------------------
    async obtenerResumenNodos() {
        await esperarAdmin(this.retardo_ms);
        const resumen = { total: this.nodos.length, activos: 0, inactivos24h: 0, inactivos7d: 0, porCalibrar: 0 };

        for (const nodo of this.nodos) {
            const minutos = utilNodos.minutosSinDatos(nodo.ultimaMedicion, this.ahora);
            if (minutos > 24 * 60) resumen.inactivos24h++;
            else resumen.activos++;
            if (minutos > 7 * 24 * 60) resumen.inactivos7d++;
            if (nodo.necesitaCalibrar) resumen.porCalibrar++;
        }
        return { correcto: true, resumen, error: "" };
    }

    // --------------------------------------------------------
    // filtro: FiltroNodos --> obtenerNodos() -->
    //       r: ResultadoNodos <--
    //
    // FiltroNodos = ( busqueda: Text, estado: Text, pagina: N, porPagina: N )
    //   estado: "todos" | "activos" | "inactivos" | "calibrar"
    // ResultadoNodos = ( correcto: B, nodos: [ Nodo ], total: N, error: Text )
    //
    // Busca por identificador o portador, filtra por estado y
    // ordena de más a menos tiempo sin enviar datos. total es
    // el número de nodos que cumplen el filtro, sin paginar.
    // --------------------------------------------------------
    async obtenerNodos(filtro) {
        await esperarAdmin(this.retardo_ms);
        const encontrados = this.filtrar(filtro);
        const inicio = (filtro.pagina - 1) * filtro.porPagina;
        return {
            correcto: true,
            nodos: encontrados.slice(inicio, inicio + filtro.porPagina),
            total: encontrados.length,
            error: ""
        };
    }

    // --------------------------------------------------------
    // filtro: FiltroNodos --> obtenerNodosMapa() -->
    //       r: ResultadoNodos <--
    //
    // Igual que obtenerNodos() pero sin paginar: devuelve todos
    // los nodos que cumplen el filtro, para pintarlos en el mapa.
    // --------------------------------------------------------
    async obtenerNodosMapa(filtro) {
        await esperarAdmin(this.retardo_ms);
        const encontrados = this.filtrar(filtro);
        return { correcto: true, nodos: encontrados, total: encontrados.length, error: "" };
    }

    // --------------------------------------------------------
    // filtro: FiltroNodos --> filtrar() --> [ Nodo ]
    //
    // Aplica la búsqueda y el estado y ordena de más a menos
    // tiempo sin datos.
    // --------------------------------------------------------
    filtrar(filtro) {
        const busqueda = normalizarTexto(filtro.busqueda || "");
        const estado = filtro.estado || "todos";

        const encontrados = this.nodos
            .filter(n => !busqueda ||
                normalizarTexto(n.id).includes(busqueda) ||
                normalizarTexto(n.portador).includes(busqueda))
            .filter(n => {
                const e = utilNodos.estadoNodo(n, this.ahora);
                if (estado === "activos") return e !== utilNodos.EstadoNodo.INACTIVO;
                if (estado === "inactivos") return e === utilNodos.EstadoNodo.INACTIVO;
                if (estado === "calibrar") return n.necesitaCalibrar;
                return true;
            })
            .sort((a, b) => new Date(a.ultimaMedicion) - new Date(b.ultimaMedicion));
        return encontrados;
    }
}

// --------------------------------------------------------
// texto: Text --> normalizarTexto() --> Text
//
// Pasa a minúsculas y quita las tildes, para que buscar
// "lucia" encuentre "Lucía".
// --------------------------------------------------------
function normalizarTexto(texto) {
    return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// --------------------------------------------------------
// ms: N --> esperarAdmin()
// --------------------------------------------------------
function esperarAdmin(ms) {
    return new Promise(resolver => setTimeout(resolver, ms));
}

if (typeof module !== "undefined") {
    module.exports = { LogicaAdminFake, normalizarTexto };
}