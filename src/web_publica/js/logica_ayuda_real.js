// ------------------------------------------------------------
// logica_ayuda_real.js
// Lógica de la página Ayuda que conecta con el servidor REST
// (/crearIncidencia y /misIncidencias, T041).
// Misma interfaz que LogicaAyudaFake (logica_ayuda_fake.js).
// ------------------------------------------------------------

const CLAVE_SESION_AYUDA_REAL = "aeris_usuario";

class LogicaAyudaReal {

    // --------------------------------------------------------
    // url_servidor: Text --> LogicaAyudaReal() -->
    // --------------------------------------------------------
    constructor(url_servidor = "") {
        this.url_servidor = url_servidor;
    }

    // --------------------------------------------------------
    // r: Usuario | null <-- usuarioActual() <--
    // --------------------------------------------------------
    usuarioActual() {
        if (typeof sessionStorage === "undefined") return null;
        const guardado = sessionStorage.getItem(CLAVE_SESION_AYUDA_REAL);
        return guardado ? JSON.parse(guardado) : null;
    }

    // --------------------------------------------------------
    // ruta: Text, metodo: Text, cuerpo: Objeto --> pedir() --> Respuesta | null
    // --------------------------------------------------------
    async pedir(ruta, metodo = "GET", cuerpo) {
        const usuario = this.usuarioActual();
        const cabeceras = {
            Authorization: "Bearer " + (usuario ? usuario.token : "")
        };
        if (cuerpo !== undefined) {
            cabeceras["Content-Type"] = "application/json";
        }
        try {
            return await fetch(this.url_servidor + ruta, {
                method: metodo,
                headers: cabeceras,
                body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
            });
        } catch (e) {
            return null;
        }
    }

    // --------------------------------------------------------
    // --> obtenerMisIncidencias() --> ResultadoMisIncidencias
    // --------------------------------------------------------
    async obtenerMisIncidencias() {
        const usuario = this.usuarioActual();
        if (!usuario) {
            return { correcto: false, incidencias: [], error: "No has iniciado sesión", sinSesion: true };
        }

        const respuesta = await this.pedir("/misIncidencias", "GET");
        if (respuesta === null) {
            return { correcto: false, incidencias: [], error: "No se puede conectar con el servidor", sinSesion: false };
        }
        if (respuesta.status === 401) {
            return { correcto: false, incidencias: [], error: "Tu sesión ha caducado", sinSesion: true };
        }
        if (!respuesta.ok) {
            return { correcto: false, incidencias: [], error: "Error al cargar tus incidencias", sinSesion: false };
        }

        const lista = await respuesta.json();
        return { correcto: true, incidencias: lista, error: "", sinSesion: false };
    }

    // --------------------------------------------------------
    // datos: { tipo, asunto, descripcion } --> crearIncidencia() --> ResultadoCrearIncidencia
    // --------------------------------------------------------
    async crearIncidencia(datos) {
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

        const respuesta = await this.pedir("/crearIncidencia", "POST", { tipo, asunto, descripcion });
        if (respuesta === null) {
            return { correcto: false, incidencia: null, error: "No se puede conectar con el servidor", campos: [] };
        }
        if (respuesta.status === 401) {
            return { correcto: false, incidencia: null, error: "Tu sesión ha caducado. Vuelve a iniciar sesión", campos: [], sinSesion: true };
        }
        if (respuesta.status === 400) {
            const errorJSON = await respuesta.json().catch(() => ({}));
            return { correcto: false, incidencia: null, error: errorJSON.error || "Datos incorrectos", campos: errorJSON.campos || [] };
        }
        if (!respuesta.ok) {
            return { correcto: false, incidencia: null, error: "Error al enviar la incidencia", campos: [] };
        }

        const nueva = await respuesta.json();
        return { correcto: true, incidencia: nueva, error: "", campos: [] };
    }
}

if (typeof module !== "undefined") {
    module.exports = { LogicaAyudaReal, CLAVE_SESION_AYUDA_REAL };
}
