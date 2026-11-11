// ------------------------------------------------------------
// logica_mapa_fake.js
// Mediciones de prueba para el mapa de la página principal
// (index.html, T012). Misma interfaz que LogicaMapaReal
// (logica_mapa_real.js).
//
// Los sensores ciudadanos de AERIS solo miden ozono. El resto
// de contaminantes viene de las estaciones oficiales.
// ------------------------------------------------------------

var CLAVE_SESION_MAPA = "aeris_usuario";

// municipio, lat, lon, tipo, O3, NO2, PM10, CO
var PUNTOS_PRUEBA = [
    ["Gandia", 38.967, -0.181, "ciudadano", 84],
    ["Gandia", 38.995, -0.163, "oficial", 79, 18, 16, 0.3],
    ["Valencia", 39.470, -0.376, "ciudadano", 128],
    ["Valencia", 39.481, -0.341, "oficial", 121, 46, 24, 0.5],
    ["Alicante", 38.345, -0.481, "ciudadano", 196],
    ["Murcia", 37.992, -1.130, "oficial", 204, 38, 31, 0.4],
    ["Castelló de la Plana", 39.986, -0.051, "ciudadano", 118],
    ["Barcelona", 41.387, 2.170, "oficial", 189, 92, 38, 0.8],
    ["Girona", 41.979, 2.821, "ciudadano", 176],
    ["Zaragoza", 41.649, -0.889, "oficial", 72, 31, 19, 0.3],
    ["Bilbao", 43.263, -2.935, "oficial", 58, 34, 15, 0.4],
    ["A Coruña", 43.362, -8.411, "ciudadano", 63],
    ["Valladolid", 41.652, -4.724, "oficial", 132, 27, 17, 0.3],
    ["Madrid", 40.417, -3.704, "oficial", 142, 71, 29, 0.7],
    ["Toledo", 39.863, -4.027, "ciudadano", 151],
    ["Sevilla", 37.389, -5.984, "oficial", 147, 44, 33, 0.5],
    ["Córdoba", 37.888, -4.779, "ciudadano", 158],
    ["Málaga", 36.721, -4.421, "oficial", 96, 39, 26, 0.4],
    ["Granada", 37.177, -3.599, "ciudadano", 112],
    ["Badajoz", 38.879, -6.971, "oficial", 103, 15, 21, 0.2]
];

var COLUMNA_CONTAMINANTE = { O3: 4, NO2: 5, PM10: 6, CO: 7 };
var UNIDAD_CONTAMINANTE = { O3: "µg/m³", NO2: "µg/m³", PM10: "µg/m³", CO: "mg/m³" };

class LogicaMapaFake {

    // --------------------------------------------------------
    // retardo_ms: N, ahora: Fecha --> LogicaMapaFake() -->
    // --------------------------------------------------------
    constructor(retardo_ms = 200, ahora = new Date()) {
        this.retardo_ms = retardo_ms;
        this.ahora = ahora;
    }

    // --------------------------------------------------------
    // r: Usuario | null <-- usuarioActual() <--
    //
    // La página principal es pública: la sesión solo sirve para
    // cambiar «Acceder» por el acceso a la cuenta.
    // --------------------------------------------------------
    usuarioActual() {
        const guardado = sessionStorage.getItem(CLAVE_SESION_MAPA);
        return guardado ? JSON.parse(guardado) : null;
    }

    // --------------------------------------------------------
    // contaminante: Text --> obtenerMediciones() --> r: ResultadoMapa <--
    //
    // contaminante = "O3" | "NO2" | "PM10" | "CO"
    // ResultadoMapa = ( correcto: B, mediciones: [ MedicionMapa ], error: Text )
    // MedicionMapa = ( id: N, municipio: Text, lat: R, lon: R, valor: R,
    //                  unidad: Text, tipo: "ciudadano" | "oficial", fecha: Text (ISO) )
    //
    // Última medición de cada sensor o estación.
    // --------------------------------------------------------
    async obtenerMediciones(contaminante) {
        await new Promise(resolver => setTimeout(resolver, this.retardo_ms));
        const columna = COLUMNA_CONTAMINANTE[contaminante];
        if (columna === undefined) {
            return { correcto: false, mediciones: [], error: "Contaminante desconocido" };
        }
        const mediciones = PUNTOS_PRUEBA
            .map((p, i) => ({ p, i }))
            .filter(({ p }) => p[columna] !== undefined)
            .map(({ p, i }) => ({
                id: i + 1,
                municipio: p[0],
                lat: p[1],
                lon: p[2],
                tipo: p[3],
                valor: p[columna],
                unidad: UNIDAD_CONTAMINANTE[contaminante],
                fecha: new Date(this.ahora.getTime() - (8 + i * 3) * 60000).toISOString()
            }));
        return { correcto: true, mediciones, error: "" };
    }
}

if (typeof module !== "undefined") {
    module.exports = { LogicaMapaFake, CLAVE_SESION_MAPA, UNIDAD_CONTAMINANTE };
}