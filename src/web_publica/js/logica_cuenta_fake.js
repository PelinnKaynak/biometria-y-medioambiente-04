// ------------------------------------------------------------
// logica_cuenta_fake.js
// Datos de prueba de la página Mi cuenta (T018 · H035).
// Tiene la misma interfaz que LogicaCuentaReal
// (logica_cuenta_real.js), así la página se puede desarrollar
// sin las rutas del servidor de T024.
// ------------------------------------------------------------

var CLAVE_SESION_CUENTA = "aeris_usuario";

var DIAS_POR_PERIODO = { semana: 7, mes: 30, "3meses": 90 };

class LogicaCuentaFake {

    // --------------------------------------------------------
    // retardo_ms: N, ahora: Fecha --> LogicaCuentaFake() -->
    //
    // ahora se puede fijar en las pruebas para que las fechas
    // de los datos de ejemplo no dependan del día.
    // --------------------------------------------------------
    constructor(retardo_ms = 250, ahora = new Date()) {
        this.retardo_ms = retardo_ms;
        this.ahora = ahora;
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

function esperarCuenta(ms) {
    return new Promise(resolver => setTimeout(resolver, ms));
}

if (typeof module !== "undefined") {
    module.exports = { LogicaCuentaFake, CLAVE_SESION_CUENTA, guardarEnSesion };
}
