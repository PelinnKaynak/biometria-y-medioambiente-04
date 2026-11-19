// ------------------------------------------------------------
// logica_cuenta_fake.js
// Datos de prueba de la página Mi cuenta (T018 · H035) y del
// estado de la vinculación del sensor (T040 · H037).
// Tiene la misma interfaz que LogicaCuentaReal
// (logica_cuenta_real.js), así la página se puede desarrollar
// sin las rutas del servidor de T024.
// ------------------------------------------------------------

var CLAVE_SESION_CUENTA = "aeris_usuario";

var DIAS_POR_PERIODO = { semana: 7, mes: 30, "3meses": 90 };

// Estado de la vinculación que guarda la lógica fake. Lo usará
// también la página Vincular sensor (T045).
var CLAVE_VINCULACION_FAKE = "aeris_vinculacion_fake";
var ESTADOS_VINCULACION = ["sin_sensor", "pendiente", "rechazada", "caducada", "confirmada"];

// Cuentas de prueba que ya tienen el sensor vinculado. Las
// cuentas nuevas empiezan sin sensor.
var CUENTAS_CON_SENSOR = ["laura@correo.es", "admin@aeris.es"];
var CORREO_COMPRADOR_FAKE = "maria.lopez@gmail.com";
var NODO_FAKE = "N-0412";
var HORAS_PARA_CONFIRMAR = 48;
var NUMERO_SERIE_FAKE = "092021010920";
var NUMERO_SERIE_VINCULADO_FAKE = "999999999999";

// --------------------------------------------------------
// --> estadoDeLaUrl() --> Text | null
//
// Solo para enseñar la página con la lógica fake: con
// mi_cuenta.html?vinculacion=pendiente se ve ese estado.
// --------------------------------------------------------
function estadoDeLaUrl() {
    if (typeof window === "undefined" || !window.location) return null;
    const estado = new URLSearchParams(window.location.search).get("vinculacion");
    return ESTADOS_VINCULACION.includes(estado) ? estado : null;
}

class LogicaCuentaFake {

    // --------------------------------------------------------
    // retardo_ms: N, ahora: Fecha --> LogicaCuentaFake() -->
    //
    // ahora se puede fijar en las pruebas para que las fechas
    // de los datos de ejemplo no dependan del día.
    // --------------------------------------------------------
    constructor(retardo_ms = 250, ahora = new Date(), estadoForzado = estadoDeLaUrl()) {
        this.retardo_ms = retardo_ms;
        this.ahora = ahora;
        this.estadoForzado = estadoForzado;
        this.correosOcupados = ["admin@aeris.es"];
        this.datosEditados = null;
    }

    // --------------------------------------------------------
    // r: Usuario <-- usuarioActual() <--
    // --------------------------------------------------------
    usuarioActual() {
        const guardado = sessionStorage.getItem(CLAVE_SESION_CUENTA);
        return guardado ? JSON.parse(guardado) : null;
    }

    // --------------------------------------------------------
    // cerrarSesion() -->
    // --------------------------------------------------------
    cerrarSesion() {
        sessionStorage.removeItem(CLAVE_SESION_CUENTA);
    }

    // --------------------------------------------------------
    // obtenerPerfil() --> r: ResultadoPerfil <--
    //
    // ResultadoPerfil = ( correcto: B, perfil: Perfil, error: Text, sinSesion: B )
    // Perfil = ( nombre: Text, apellidos: Text, correo: Text, rol: Text,
    //            alertas: B, premiumHasta: Text | null, foto: Text | null )
    //
    // Saca el nombre y el correo de la sesión guardada al
    // iniciar sesión.
    // --------------------------------------------------------
    async obtenerPerfil() {
        await esperarCuenta(this.retardo_ms);
        const usuario = this.usuarioActual();
        if (!usuario) {
            return { correcto: false, perfil: null, error: "Inicia sesión para ver tu cuenta", sinSesion: true };
        }
        const partes = String(usuario.nombre || "").trim().split(/\s+/);
        const perfil = this.datosEditados || {
            nombre: partes[0] || "",
            apellidos: partes.slice(1).join(" ") || "Martínez",
            correo: usuario.correo
        };
        return {
            correcto: true,
            perfil: { ...perfil, rol: usuario.rol, alertas: true, premiumHasta: null, foto: null },
            error: "",
            sinSesion: false
        };
    }

    // --------------------------------------------------------
    // obtenerResumen() --> r: ResultadoResumen <--
    //
    // ResultadoResumen = ( correcto: B, resumen: Resumen | null, error: Text )
    // Resumen = ( nodo: Text, ultimaSincronizacion: Text (ISO),
    //             medicionesMes: N, medicionesMesAnterior: N,
    //             puntos: N, nivel: Text, siguienteNivel: Text, puntosSiguienteNivel: N,
    //             exposicionMedia: R, horasOzonoAlto: N,
    //             lugares: [ Lugar ], ultimasMediciones: [ Medicion ] )
    // Lugar = ( nombre: Text, zona: Text, ozono: R )
    // Medicion = ( fecha: Text (ISO), lugar: Text, ozono: R )
    // --------------------------------------------------------
    async obtenerResumen() {
        await esperarCuenta(this.retardo_ms);
        const haceMinutos = minutos => new Date(this.ahora.getTime() - minutos * 60000).toISOString();

        return {
            correcto: true,
            error: "",
            resumen: {
                nodo: "N-0412",
                ultimaSincronizacion: haceMinutos(5),
                medicionesMes: 1284,
                medicionesMesAnterior: 1146,
                puntos: 2350,
                nivel: "Explorador",
                siguienteNivel: "Guardián",
                puntosSiguienteNivel: 3000,
                exposicionMedia: 86,
                horasOzonoAlto: 3,
                lugares: [
                    { nombre: "Casa", zona: "Benimaclet", ozono: 62 },
                    { nombre: "Trabajo", zona: "Campus de Gandia", ozono: 118 },
                    { nombre: "Gimnasio", zona: "El Grau", ozono: 74 }
                ],
                ultimasMediciones: [
                    { fecha: haceMinutos(50), lugar: "Campus de Gandia", ozono: 104 },
                    { fecha: haceMinutos(255), lugar: "Benimaclet", ozono: 58 },
                    { fecha: haceMinutos(1120), lugar: "Paseo marítimo", ozono: 132 },
                    { fecha: haceMinutos(1555), lugar: "El Grau", ozono: 70 }
                ]
            }
        };
    }

    // --------------------------------------------------------
    // periodo: Text --> obtenerExposicion() --> r: ResultadoExposicion <--
    //
    // periodo = "semana" | "mes" | "3meses"
    // ResultadoExposicion = ( correcto: B, puntos: [ PuntoExposicion ], error: Text )
    // PuntoExposicion = ( fecha: Text (ISO), ozono: R )   media de ese día
    //
    // Genera una curva parecida a la del diseño, con un pico
    // por encima del umbral de aviso hace una semana.
    // --------------------------------------------------------
    async obtenerExposicion(periodo) {
        await esperarCuenta(this.retardo_ms);
        const dias = DIAS_POR_PERIODO[periodo] || DIAS_POR_PERIODO.mes;
        const puntos = [];

        for (let i = dias - 1; i >= 0; i--) {
            const fecha = new Date(this.ahora.getTime() - i * 86400000);
            fecha.setHours(12, 0, 0, 0);
            const base = 92 + 22 * Math.sin(i / 2.6) + 10 * Math.cos(i / 1.3);
            const pico = i === 7 ? 85 : (i === 6 || i === 8) ? 30 : 0;
            puntos.push({ fecha: fecha.toISOString(), ozono: Math.round(base + pico) });
        }
        return { correcto: true, puntos, error: "" };
    }

    // --------------------------------------------------------
    // obtenerVinculacion() --> r: ResultadoVinculacion <--
    //
    // ResultadoVinculacion = ( correcto: B, vinculacion: Vinculacion | null, error: Text )
    // Vinculacion = ( estado: Text, nodo: Text | null, emailConfirmacion: Text | null,
    //                 fechaSolicitud: Text (ISO) | null, caducaEn: Text (ISO) | null )
    // estado = "sin_sensor" | "pendiente" | "rechazada" | "caducada" | "confirmada"
    // --------------------------------------------------------
    async obtenerVinculacion() {
        await esperarCuenta(this.retardo_ms);
        const usuario = this.usuarioActual();
        if (!usuario) return { correcto: false, vinculacion: null, error: "Inicia sesión para ver tu cuenta" };

        const guardada = leerVinculacionFake();
        const estado = this.estadoForzado || (guardada && guardada.estado) ||
            (CUENTAS_CON_SENSOR.includes(String(usuario.correo).toLowerCase()) ? "confirmada" : "sin_sensor");

        if (estado === "sin_sensor") {
            return { correcto: true, error: "",
                vinculacion: { estado, nodo: null, emailConfirmacion: null, fechaSolicitud: null, caducaEn: null } };
        }
        const fechaSolicitud = (guardada && guardada.fechaSolicitud) ||
            new Date(this.ahora.getTime() - 20 * 60000).toISOString();
        return {
            correcto: true,
            error: "",
            vinculacion: {
                estado,
                nodo: (guardada && guardada.nodo) || NODO_FAKE,
                emailConfirmacion: (guardada && guardada.emailConfirmacion) || CORREO_COMPRADOR_FAKE,
                fechaSolicitud,
                caducaEn: new Date(new Date(fechaSolicitud).getTime() + HORAS_PARA_CONFIRMAR * 3600000).toISOString()
            }
        };
    }

    // --------------------------------------------------------
    // codigo: CodigoSensor --> solicitarVinculacion() --> r: ResultadoSolicitud
    //
    // Simula un sensor de prueba registrado y otro ya vinculado.
    // --------------------------------------------------------
    async solicitarVinculacion(codigo) {
        await esperarCuenta(this.retardo_ms);
        const usuario = this.usuarioActual();
        const fallo = (error, sinSesion = false) => ({ correcto: false, solicitud: null, error, sinSesion });

        if (!usuario) return fallo("Inicia sesión para vincular tu sensor", true);
        if (!codigo || !/^\d{12}$/.test(String(codigo.numeroSerie || ""))) {
            return fallo("El código del sensor no es válido. Revisa la etiqueta.");
        }
        if (codigo.numeroSerie === NUMERO_SERIE_VINCULADO_FAKE) {
            return fallo("Este sensor ya está vinculado a otra cuenta.");
        }
        if (codigo.numeroSerie !== NUMERO_SERIE_FAKE) {
            return fallo("Este sensor no está registrado. Revisa el código o escríbenos desde Ayuda.");
        }

        const estado = CUENTAS_CON_SENSOR.includes(String(usuario.correo).toLowerCase())
            ? "confirmada"
            : "pendiente";
        const fechaSolicitud = this.ahora.toISOString();
        const solicitud = {
            numeroSerie: codigo.numeroSerie,
            correoComprador: CORREO_COMPRADOR_FAKE,
            estado,
            fecha: fechaSolicitud
        };
        if (estado === "pendiente") {
            guardarVinculacionFake({
                estado,
                nodo: codigo.numeroSerie,
                emailConfirmacion: CORREO_COMPRADOR_FAKE,
                fechaSolicitud
            });
        }
        return { correcto: true, solicitud, error: "", sinSesion: false };
    }

    // --------------------------------------------------------
    // reenviarCorreo() --> r: ResultadoReenvio <--
    //
    // ResultadoReenvio = ( correcto: B, emailConfirmacion: Text | null, error: Text )
    // Solo se puede reenviar si hay una vinculación pendiente.
    // --------------------------------------------------------
    async reenviarCorreo() {
        const r = await this.obtenerVinculacion();
        if (!r.correcto) return { correcto: false, emailConfirmacion: null, error: r.error };
        if (r.vinculacion.estado !== "pendiente") {
            return { correcto: false, emailConfirmacion: null, error: "No hay ninguna vinculación pendiente" };
        }
        guardarVinculacionFake({ ...r.vinculacion, fechaSolicitud: this.ahora.toISOString() });
        return { correcto: true, emailConfirmacion: r.vinculacion.emailConfirmacion, error: "" };
    }

    // --------------------------------------------------------
    // datos: DatosPerfil --> actualizarDatos() --> r: ResultadoEdicion <--
    //
    // DatosPerfil = ( nombre: Text, apellidos: Text, correo: Text )
    // ResultadoEdicion = ( correcto: B, perfil: DatosPerfil, error: Text, campos: [ Text ] )
    //
    // Como el servidor real (POST /actualizarDatos), rechaza un
    // correo que ya usa otra cuenta.
    // --------------------------------------------------------
    async actualizarDatos(datos) {
        await esperarCuenta(this.retardo_ms);
        const correo = datos.correo.trim().toLowerCase();
        if (this.correosOcupados.includes(correo)) {
            return { correcto: false, perfil: null, error: "Ya hay otra cuenta con ese correo", campos: ["correo"] };
        }
        this.datosEditados = { nombre: datos.nombre.trim(), apellidos: datos.apellidos.trim(), correo };
        guardarEnSesion({ nombre: this.datosEditados.nombre, correo });
        return { correcto: true, perfil: { ...this.datosEditados }, error: "", campos: [] };
    }
}

// --------------------------------------------------------
// cambios: Objeto --> guardarEnSesion()
//
// Actualiza el nombre y el correo de la sesión guardada para
// que la cabecera y el resto de páginas los vean.
// --------------------------------------------------------
function guardarEnSesion(cambios) {
    const guardado = sessionStorage.getItem(CLAVE_SESION_CUENTA);
    if (!guardado) return;
    sessionStorage.setItem(CLAVE_SESION_CUENTA, JSON.stringify({ ...JSON.parse(guardado), ...cambios }));
}

function leerVinculacionFake() {
    const guardada = sessionStorage.getItem(CLAVE_VINCULACION_FAKE);
    return guardada ? JSON.parse(guardada) : null;
}

function guardarVinculacionFake(vinculacion) {
    sessionStorage.setItem(CLAVE_VINCULACION_FAKE, JSON.stringify(vinculacion));
}

function esperarCuenta(ms) {
    return new Promise(resolver => setTimeout(resolver, ms));
}

if (typeof module !== "undefined") {
    module.exports = {
        LogicaCuentaFake, CLAVE_SESION_CUENTA, CLAVE_VINCULACION_FAKE, ESTADOS_VINCULACION,
        guardarEnSesion, guardarVinculacionFake
    };
}