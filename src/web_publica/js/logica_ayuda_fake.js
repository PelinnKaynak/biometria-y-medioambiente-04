// ------------------------------------------------------------
// logica_ayuda_fake.js
// Datos y lógica de prueba para la página Ayuda (T042 · H038).
// Permite listar y enviar incidencias sin depender del servidor.
// Misma interfaz que LogicaAyudaReal (logica_ayuda_real.js).
// ------------------------------------------------------------

const CLAVE_SESION_AYUDA = "aeris_usuario";

class LogicaAyudaFake {

    // --------------------------------------------------------
    // retardo_ms: N --> LogicaAyudaFake() -->
    // --------------------------------------------------------
    constructor(retardo_ms = 150) {
        this.retardo_ms = retardo_ms;
        this.incidencias = [
            {
                idIncidencia: 1,
                idUsuario: 2,
                tipo: "sensor",
                asunto: "El sensor no se conecta por Bluetooth",
                descripcion: "Al pulsar el botón del sensor, la luz azul parpadea pero en la app de Android no aparece en la lista de dispositivos cercanos.",
                estado: "resuelta",
                respuesta: "Hola Laura, hemos verificado el número de serie de tu sensor. Había un problema de emparejamiento con la versión de firmware anterior. Ya hemos actualizado los parámetros y debería conectar en menos de 10 segundos.",
                responsable: { nombre: "Marc", rol: "tecnico" },
                fechaCreacion: "2026-11-15T11:20:00Z",
                fechaRespuesta: "2026-11-15T13:45:00Z",
                sensor: { idSensor: 1, numeroSerie: "092021010920" }
            },
            {
                idIncidencia: 2,
                idUsuario: 2,
                tipo: "datos",
                asunto: "Duda sobre pico de ozono en el Grao",
                descripcion: "Ayer a las 15:30 mi sensor marcó 145 µg/m³ mientras que el mapa marcaba nivel bueno en la misma calle. ¿A qué se puede deber?",
                estado: "en curso",
                respuesta: null,
                responsable: null,
                fechaCreacion: "2026-11-18T09:10:00Z",
                fechaRespuesta: null,
                sensor: { idSensor: 1, numeroSerie: "092021010920" }
            }
        ];
    }

    // --------------------------------------------------------
    // r: Usuario | null <-- usuarioActual() <--
    // --------------------------------------------------------
    usuarioActual() {
        if (typeof sessionStorage === "undefined") return null;
        const guardado = sessionStorage.getItem(CLAVE_SESION_AYUDA);
        return guardado ? JSON.parse(guardado) : null;
    }

    // --------------------------------------------------------
    // --> obtenerMisIncidencias() --> ResultadoMisIncidencias
    //
    // ResultadoMisIncidencias = { correcto: B, incidencias: [ Incidencia ], error: Text, sinSesion: B }
    // --------------------------------------------------------
    async obtenerMisIncidencias() {
        if (this.retardo_ms > 0) {
            await new Promise(resolver => setTimeout(resolver, this.retardo_ms));
        }
        const usuario = this.usuarioActual();
        if (!usuario) {
            return { correcto: false, incidencias: [], error: "No has iniciado sesión", sinSesion: true };
        }
        // Devuelve las incidencias ordenadas por fecha más reciente primero
        const lista = [...this.incidencias].sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
        return { correcto: true, incidencias: lista, error: "", sinSesion: false };
    }

    // --------------------------------------------------------
    // datos: { tipo, asunto, descripcion } --> crearIncidencia() --> ResultadoCrearIncidencia
    //
    // ResultadoCrearIncidencia = { correcto: B, incidencia: Incidencia | null, error: Text, campos: [ Text ] }
    // --------------------------------------------------------
    async crearIncidencia(datos) {
        if (this.retardo_ms > 0) {
            await new Promise(resolver => setTimeout(resolver, this.retardo_ms));
        }
        const usuario = this.usuarioActual();
        if (!usuario) {
            return { correcto: false, incidencia: null, error: "Debes iniciar sesión para enviar una incidencia", campos: [], sinSesion: true };
        }

        const asunto = (datos.asunto || "").trim();
        const descripcion = (datos.descripcion || "").trim();
        const tipo = datos.tipo || "otra";

        if (!asunto) {
            return { correcto: false, incidencia: null, error: "Escribe un asunto para la incidencia", campos: ["asunto"] };
        }
        if (!descripcion) {
            return { correcto: false, incidencia: null, error: "Escribe una descripción del problema", campos: ["descripcion"] };
        }

        const nueva = {
            idIncidencia: this.incidencias.length + 1,
            idUsuario: usuario.id || 2,
            tipo,
            asunto,
            descripcion,
            estado: "abierta",
            respuesta: null,
            responsable: null,
            fechaCreacion: new Date().toISOString(),
            fechaRespuesta: null,
            sensor: null
        };

        this.incidencias.unshift(nueva);
        return { correcto: true, incidencia: nueva, error: "", campos: [] };
    }
}

if (typeof module !== "undefined") {
    module.exports = { LogicaAyudaFake, CLAVE_SESION_AYUDA };
}
