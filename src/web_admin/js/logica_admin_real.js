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
    // ruta: Text, metodo: Text, cuerpo: Objeto --> pedir()
    //       --> ( respuesta: Respuesta, error: Text, cuerpoError: Objeto )
    //
    // Hace la petición con el token de la sesión. Si algo
    // falla, devuelve el mensaje que hay que mostrar y, si el
    // servidor lo manda, el cuerpo del error ({ error, campos }).
    // --------------------------------------------------------
    async pedir(ruta, metodo = "GET", cuerpo = null) {
        const usuario = this.usuarioActual();
        const opciones = {
            method: metodo,
            headers: { Authorization: "Bearer " + (usuario ? usuario.token : "") }
        };
        if (cuerpo !== null) {
            opciones.headers["Content-Type"] = "application/json";
            opciones.body = JSON.stringify(cuerpo);
        }

        let respuesta;
        try {
            respuesta = await fetch(this.url_servidor + ruta, opciones);
        } catch (e) {
            return { respuesta: null, error: "No se puede conectar con el servidor", cuerpoError: null };
        }
        if (respuesta.ok) return { respuesta, error: "", cuerpoError: null };

        let cuerpoError = null;
        try { cuerpoError = await respuesta.json(); } catch (e) { /* sin cuerpo */ }

        const mensajes = {
            401: "La sesión ha caducado. Vuelve a iniciar sesión",
            403: "Tu cuenta no tiene permiso para hacer esto"
        };
        const error = mensajes[respuesta.status] ||
            (cuerpoError && cuerpoError.error) || "Ha habido un error. Inténtalo de nuevo";
        return { respuesta: null, error, cuerpoError };
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

    // --------------------------------------------------------
    // r: ResultadoConteo <-- obtenerConteoUsuarios() <--
    //
    // GET /usuarios/conteo
    //   200 { todos, portadores, premium, administradores, tecnicos }
    // --------------------------------------------------------
    async obtenerConteoUsuarios() {
        const { respuesta, error } = await this.pedir("/usuarios/conteo");
        if (!respuesta) return { correcto: false, conteo: null, error };
        return { correcto: true, conteo: await respuesta.json(), error: "" };
    }

    // --------------------------------------------------------
    // filtro: FiltroUsuarios --> obtenerUsuarios() -->
    //       r: ResultadoUsuarios <--
    //
    // GET /usuarios?busqueda=&grupo=&estado=&pagina=&porPagina=
    //   200 { usuarios: [ UsuarioAdmin ], total }
    // --------------------------------------------------------
    async obtenerUsuarios(filtro) {
        const parametros = new URLSearchParams({
            busqueda: filtro.busqueda || "",
            grupo: filtro.grupo || "todos",
            estado: filtro.estado || "todos",
            pagina: String(filtro.pagina),
            porPagina: String(filtro.porPagina)
        });
        const { respuesta, error } = await this.pedir("/usuarios?" + parametros);
        if (!respuesta) return { correcto: false, usuarios: [], total: 0, error };
        const datos = await respuesta.json();
        return { correcto: true, usuarios: datos.usuarios, total: datos.total, error: "" };
    }

    // --------------------------------------------------------
    // datos: NuevoUsuario --> crearUsuario() -->
    //       r: ResultadoCreacion <--
    //
    // POST /usuarios { nombre, apellidos, correo, rol }
    //   201 { idUsuario } · 400 { error, campos } · 409 { error }
    // --------------------------------------------------------
    async crearUsuario(datos) {
        const { respuesta, error, cuerpoError } = await this.pedir("/usuarios", "POST", datos);
        if (respuesta) return { correcto: true, error: "", campos: [] };
        const campos = (cuerpoError && cuerpoError.campos) || [];
        if (error === "El correo ya tiene una cuenta") return { correcto: false, error, campos: ["correo"] };
        return { correcto: false, error, campos };
    }

    // --------------------------------------------------------
    // id_usuario: N, rol: Text --> cambiarRol() -->
    //       r: ResultadoOperacion <--
    //
    // PATCH /usuarios/:idUsuario/rol { rol }
    //   204 · 400 { error } · 403 (su propio rol)
    // --------------------------------------------------------
    async cambiarRol(id_usuario, rol) {
        const { respuesta, error, cuerpoError } =
            await this.pedir("/usuarios/" + id_usuario + "/rol", "PATCH", { rol });
        if (respuesta) return { correcto: true, error: "" };
        return { correcto: false, error: (cuerpoError && cuerpoError.error) || error };
    }

    // --------------------------------------------------------
    // ids: [ N ] --> darDeBaja() --> r: ResultadoOperacion <--
    //
    // POST /usuarios/baja { ids }
    //   204 · 400 { error }
    // --------------------------------------------------------
    async darDeBaja(ids) {
        const { respuesta, error, cuerpoError } = await this.pedir("/usuarios/baja", "POST", { ids });
        if (respuesta) return { correcto: true, error: "" };
        return { correcto: false, error: (cuerpoError && cuerpoError.error) || error };
    }
}

if (typeof module !== "undefined") {
    module.exports = { LogicaAdminReal };
}