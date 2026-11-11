// ------------------------------------------------------------
// logica_cuenta_real.js
// Lógica de la página Mi cuenta que habla con el servidor REST.
// Misma interfaz que LogicaCuentaFake (logica_cuenta_fake.js).
//
// Ya funcionan con el servidor de T016/T010:
//   GET  /usuarioActual     datos del perfil
//   POST /actualizarDatos   editar nombre, apellidos y correo
// Propuestas para T024 (todavía no están en el servidor):
//   GET  /miCuenta                     resumen, lugares y últimas mediciones
//   GET  /miExposicion?periodo=mes     medias diarias de ozono
// Mientras T024 no exista, el servidor responde 404 y la
// página muestra que todavía no hay datos del sensor.
// ------------------------------------------------------------

const sesionCuenta = typeof module !== "undefined" ? require("./logica_cuenta_fake") : window;

class LogicaCuentaReal {

    // --------------------------------------------------------
    // url_servidor: Text --> LogicaCuentaReal() -->
    // --------------------------------------------------------
    constructor(url_servidor) {
        this.url_servidor = url_servidor;
    }

    // --------------------------------------------------------
    // r: Usuario <-- usuarioActual() <--
    // --------------------------------------------------------
    usuarioActual() {
        const guardado = sessionStorage.getItem(sesionCuenta.CLAVE_SESION_CUENTA);
        return guardado ? JSON.parse(guardado) : null;
    }

    // --------------------------------------------------------
    // cerrarSesion() -->
    // --------------------------------------------------------
    cerrarSesion() {
        sessionStorage.removeItem(sesionCuenta.CLAVE_SESION_CUENTA);
    }

    // --------------------------------------------------------
    // ruta: Text, metodo: Text, cuerpo: Objeto --> pedir() --> Respuesta | null
    //
    // Hace la petición con el token de la sesión en la cabecera
    // Authorization. Si no hay conexión, devuelve null.
    // --------------------------------------------------------
    async pedir(ruta, metodo = "GET", cuerpo) {
        const usuario = this.usuarioActual();
        const cabeceras = { Authorization: "Bearer " + (usuario ? usuario.token : "") };
        if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";
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
    // obtenerPerfil() --> r: ResultadoPerfil <--
    //
    // GET /usuarioActual
    //   200 { idUsuario, nombre, apellidos, correo, rol, fechaAlta,
    //         alertas, premiumHasta, foto } · 401
    // --------------------------------------------------------
    async obtenerPerfil() {
        const fallo = (error, sinSesion = false) => ({ correcto: false, perfil: null, error, sinSesion });
        if (!this.usuarioActual()) return fallo("Inicia sesión para ver tu cuenta", true);

        const respuesta = await this.pedir("/usuarioActual");
        if (respuesta === null) return fallo("No se puede conectar con el servidor");
        if (respuesta.status === 401) return fallo("Tu sesión ha caducado. Vuelve a iniciar sesión", true);
        if (!respuesta.ok) return fallo("Ha habido un error. Inténtalo de nuevo");

        const u = await respuesta.json();
        return {
            correcto: true,
            error: "",
            sinSesion: false,
            perfil: {
                nombre: u.nombre,
                apellidos: u.apellidos,
                correo: u.correo,
                rol: u.rol,
                alertas: Boolean(u.alertas),
                premiumHasta: u.premiumHasta || null,
                foto: u.foto || null
            }
        };
    }

    // --------------------------------------------------------
    // obtenerResumen() --> r: ResultadoResumen <--
    //
    // GET /miCuenta (T024)  200 Resumen · 404 todavía sin datos
    // --------------------------------------------------------
    async obtenerResumen() {
        const respuesta = await this.pedir("/miCuenta");
        if (respuesta === null) return { correcto: false, resumen: null, error: "No se puede conectar con el servidor" };
        if (respuesta.status === 404) return { correcto: true, resumen: null, error: "" };
        if (!respuesta.ok) return { correcto: false, resumen: null, error: "No se han podido cargar tus datos" };
        return { correcto: true, resumen: await respuesta.json(), error: "" };
    }

    // --------------------------------------------------------
    // periodo: Text --> obtenerExposicion() --> r: ResultadoExposicion <--
    //
    // GET /miExposicion?periodo=semana|mes|3meses (T024)
    //   200 [ { fecha, ozono } ] · 404 todavía sin datos
    // --------------------------------------------------------
    async obtenerExposicion(periodo) {
        const respuesta = await this.pedir("/miExposicion?periodo=" + encodeURIComponent(periodo));
        if (respuesta === null) return { correcto: false, puntos: [], error: "No se puede conectar con el servidor" };
        if (respuesta.status === 404) return { correcto: true, puntos: [], error: "" };
        if (!respuesta.ok) return { correcto: false, puntos: [], error: "No se ha podido cargar la gráfica" };
        return { correcto: true, puntos: await respuesta.json(), error: "" };
    }

    // --------------------------------------------------------
    // datos: DatosPerfil --> actualizarDatos() --> r: ResultadoEdicion <--
    //
    // POST /actualizarDatos { nombre, apellidos, correo }
    //   200 { nombre, apellidos, correo } · 400 { error, campos }
    //   409 correo de otra cuenta · 401
    // --------------------------------------------------------
    async actualizarDatos(datos) {
        const respuesta = await this.pedir("/actualizarDatos", "POST", datos);
        const fallo = (error, campos = []) => ({ correcto: false, perfil: null, error, campos });

        if (respuesta === null) return fallo("No se puede conectar con el servidor");
        if (respuesta.status === 409) return fallo("Ya hay otra cuenta con ese correo", ["correo"]);
        if (respuesta.status === 400) {
            const cuerpo = await respuesta.json();
            return fallo("Revisa los datos marcados", cuerpo.campos || []);
        }
        if (respuesta.status === 401) return fallo("Tu sesión ha caducado. Vuelve a iniciar sesión");
        if (!respuesta.ok) return fallo("Ha habido un error. Inténtalo de nuevo");

        const perfil = await respuesta.json();
        sesionCuenta.guardarEnSesion({ nombre: perfil.nombre, correo: perfil.correo });
        return { correcto: true, perfil, error: "", campos: [] };
    }
}

if (typeof module !== "undefined") {
    module.exports = { LogicaCuentaReal };
}