// ------------------------------------------------------------
// logica_mapa_real.js
// Lógica del mapa de la página principal que habla con el
// servidor REST. Misma interfaz que LogicaMapaFake.
//
// Ruta propuesta para T017 (todavía no está en el servidor):
//   GET /mediciones?contaminante=O3
//     200 [ MedicionMapa ]  última medición de cada sensor o estación
// Mientras no exista, el servidor responde 404 y el mapa sale
// vacío con un aviso.
// ------------------------------------------------------------

const sesionMapa = typeof module !== "undefined" ? require("./logica_mapa_fake") : window;

class LogicaMapaReal {

    // --------------------------------------------------------
    // url_servidor: Text --> LogicaMapaReal() -->
    // --------------------------------------------------------
    constructor(url_servidor) {
        this.url_servidor = url_servidor;
    }

    // --------------------------------------------------------
    // r: Usuario | null <-- usuarioActual() <--
    // --------------------------------------------------------
    usuarioActual() {
        const guardado = sessionStorage.getItem(sesionMapa.CLAVE_SESION_MAPA);
        return guardado ? JSON.parse(guardado) : null;
    }

    // --------------------------------------------------------
    // contaminante: Text --> obtenerMediciones() --> r: ResultadoMapa <--
    //
    // GET /mediciones?contaminante=O3   200 [ MedicionMapa ] · 404 sin datos
    // --------------------------------------------------------
    async obtenerMediciones(contaminante) {
        let respuesta;
        try {
            respuesta = await fetch(this.url_servidor + "/mediciones?contaminante=" + encodeURIComponent(contaminante));
        } catch (e) {
            return { correcto: false, mediciones: [], error: "No se puede conectar con el servidor" };
        }
        if (respuesta.status === 404) return { correcto: true, mediciones: [], error: "" };
        if (!respuesta.ok) return { correcto: false, mediciones: [], error: "No se han podido cargar las mediciones" };
        return { correcto: true, mediciones: await respuesta.json(), error: "" };
    }
}

if (typeof module !== "undefined") {
    module.exports = { LogicaMapaReal };
}