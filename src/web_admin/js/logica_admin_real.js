// ------------------------------------------------------------
// logica_admin_real.js
// Lógica del panel de administración que habla con el
// servidor REST. Las rutas de nodos (T021 y T022) están
// definidas en doc/web_admin_design.md y las tiene que
// implementar el servidor. Envía el token de la sesión en la
// cabecera Authorization.
// ------------------------------------------------------------

const CLAVE_SESION_ADMIN_REAL = "aeris_usuario";

class LogicaAdminReal {

    // --------------------------------------------------------
    // url_servidor: Text --> LogicaAdminReal() -->
    // --------------------------------------------------------
    constructor(url_servidor) {
        this.url_servidor = url_servidor;
    }

    // --------------------------------------------------------
    // r: Usuario <-- usuarioActual() <--
    // --------------------------------------------------------
    usuarioActual() {
        const guardado = sessionStorage.getItem(CLAVE_SESION_ADMIN_REAL);
        return guardado ? JSON.parse(guardado) : null;
    }

    // --------------------------------------------------------
    // cerrarSesion() -->
    // --------------------------------------------------------
    cerrarSesion() {
        sessionStorage.removeItem(CLAVE_SESION_ADMIN_REAL);
    }

    // --------------------------------------------------------
    // ruta: Text --> pedir() --> ( respuesta: Respuesta, error: Text )
    //
    // Hace un GET con el token de la sesión. Si algo falla,
    // devuelve el mensaje de error que hay que mostrar.
    // --------------------------------------------------------
    async pedir(ruta) {
        const usuario = this.usuarioActual();
        let respuesta;
        try {
            respuesta = await fetch(this.url_servidor + ruta, {
                headers: { Authorization: "Bearer " + (usuario ? usuario.token : "") }
            });
        } catch (e) {
            return { respuesta: null, error: "No se puede conectar con el servidor" };
        }
        if (respuesta.status === 401) return { respuesta: null, error: "La sesión ha caducado. Vuelve a iniciar sesión" };
        if (respuesta.status === 403) return { respuesta: null, error: "Tu cuenta no tiene permiso para ver los nodos" };
        if (!respuesta.ok) return { respuesta: null, error: "Ha habido un error. Inténtalo de nuevo" };
        return { respuesta, error: "" };
    }

    // --------------------------------------------------------
    // r: ResultadoResumen <-- obtenerResumenNodos() <--
    //
    // GET /nodos/resumen
    //   200 { total, activos, inactivos24h, inactivos7d, porCalibrar }
    // --------------------------------------------------------
    async obtenerResumenNodos() {
        const { respuesta, error } = await this.pedir("/nodos/resumen");
        if (!respuesta) return { correcto: false, resumen: null, error };
        return { correcto: true, resumen: await respuesta.json(), error: "" };
    }

    // --------------------------------------------------------
    // filtro: FiltroNodos --> obtenerNodos() -->
    //       r: ResultadoNodos <--
    //
    // GET /nodos?busqueda=&estado=&pagina=&porPagina=
    //   200 { nodos: [ Nodo ], total }
    // --------------------------------------------------------
    async obtenerNodos(filtro) {
        return this.pedirNodos("/nodos", filtro);
    }

    // --------------------------------------------------------
    // filtro: FiltroNodos --> obtenerNodosMapa() -->
    //       r: ResultadoNodos <--
    //
    // GET /nodos/mapa?busqueda=&estado=
    //   200 { nodos: [ Nodo ], total }   (sin paginar)
    // --------------------------------------------------------
    async obtenerNodosMapa(filtro) {
        return this.pedirNodos("/nodos/mapa", { busqueda: filtro.busqueda, estado: filtro.estado, pagina: 1, porPagina: 0 });
    }

    // --------------------------------------------------------
    // ruta: Text, filtro: FiltroNodos --> pedirNodos() -->
    //       r: ResultadoNodos <--
    // --------------------------------------------------------
    async pedirNodos(ruta, filtro) {
        const parametros = new URLSearchParams({
            busqueda: filtro.busqueda || "",
            estado: filtro.estado || "todos",
            pagina: String(filtro.pagina),
            porPagina: String(filtro.porPagina)
        });
        const { respuesta, error } = await this.pedir(ruta + "?" + parametros);
        if (!respuesta) return { correcto: false, nodos: [], total: 0, error };

        const datos = await respuesta.json();
        return { correcto: true, nodos: datos.nodos, total: datos.total, error: "" };
    }
}

if (typeof module !== "undefined") {
    module.exports = { LogicaAdminReal };
}