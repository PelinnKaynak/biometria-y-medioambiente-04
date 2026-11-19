// ------------------------------------------------------------
// logica_admin_fake.js
// Simula el servidor para el panel de administración, con
// nodos de prueba repartidos por la provincia de Valencia.
// Tiene la misma interfaz que LogicaAdminReal.
// ------------------------------------------------------------

const utilNodos = typeof module !== "undefined" ? require("./nodos") : window;
const rolesFake = typeof module !== "undefined" ? require("../../web_publica/js/roles") : window;

const MENSAJE_SOLO_ADMIN = "Solo un administrador puede gestionar usuarios";
const MENSAJE_SOLO_GESTION = "Solo técnicos y administradores pueden gestionar incidencias";

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

const APELLIDOS_PRUEBA = ["García", "Martí", "Llorca", "Sanchis", "Ortega", "Vidal", "Ribes", "Cano"];

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
        this.usuarios = crearUsuariosPrueba(ahora, this.nodos);
        this.incidencias = crearIncidenciasPrueba(ahora);
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
    // id: Text --> desvincularNodo() --> r: ResultadoOperacion <--
    //
    // Quita el nodo de la lista y deja a su portador sin sensor.
    // Solo lo puede hacer un administrador (el servidor real
    // responde 403).
    // --------------------------------------------------------
    async desvincularNodo(id) {
        await esperarAdmin(this.retardo_ms);
        if (!this.esAdministradorActual()) {
            return { correcto: false, error: "Tu cuenta no tiene permiso para hacer esto" };
        }
        const posicion = this.nodos.findIndex(n => n.id === id);
        if (posicion === -1) {
            return { correcto: false, error: "Ese sensor no existe o no está vinculado a nadie" };
        }
        this.nodos.splice(posicion, 1);
        for (const usuario of this.usuarios) {
            if (usuario.nodo === id) usuario.nodo = null;
        }
        return { correcto: true, error: "" };
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

    // --------------------------------------------------------
    // r: ResultadoConteo <-- obtenerConteoUsuarios() <--
    //
    // ConteoUsuarios = ( todos: N, portadores: N, premium: N,
    //                    administradores: N, tecnicos: N )
    // ResultadoConteo = ( correcto: B, conteo: ConteoUsuarios, error: Text )
    //
    // Los usuarios dados de baja no cuentan.
    // --------------------------------------------------------
    async obtenerConteoUsuarios() {
        await esperarAdmin(this.retardo_ms);
        const vivos = this.usuarios.filter(u => u.estado !== "baja");
        const conteo = {
            todos: vivos.length,
            portadores: vivos.filter(u => u.rol === "portador").length,
            premium: vivos.filter(u => u.premium).length,
            administradores: vivos.filter(u => u.rol === "administrador").length,
            tecnicos: vivos.filter(u => u.rol === "tecnico").length
        };
        return { correcto: true, conteo, error: "" };
    }

    // --------------------------------------------------------
    // filtro: FiltroUsuarios --> obtenerUsuarios() -->
    //       r: ResultadoUsuarios <--
    //
    // FiltroUsuarios = ( busqueda: Text, grupo: Text, estado: Text,
    //                    pagina: N, porPagina: N )
    //   grupo: "todos" | "portadores" | "premium" | "administradores" | "tecnicos"
    //   estado: "todos" | "activo" | "pendiente" | "baja"
    // ResultadoUsuarios = ( correcto: B, usuarios: [ UsuarioAdmin ], total: N, error: Text )
    //
    // Busca por nombre, apellidos o correo y ordena del alta
    // más reciente a la más antigua.
    // --------------------------------------------------------
    async obtenerUsuarios(filtro) {
        await esperarAdmin(this.retardo_ms);
        const busqueda = normalizarTexto(filtro.busqueda || "");
        const grupo = filtro.grupo || "todos";
        const estado = filtro.estado || "todos";
        const rolDelGrupo = { portadores: "portador", administradores: "administrador", tecnicos: "tecnico" };

        const encontrados = this.usuarios
            .filter(u => !busqueda ||
                normalizarTexto(u.nombre + " " + u.apellidos).includes(busqueda) ||
                normalizarTexto(u.correo).includes(busqueda))
            .filter(u => grupo === "todos" ||
                (grupo === "premium" ? u.premium : u.rol === rolDelGrupo[grupo]))
            .filter(u => estado === "todos" ? u.estado !== "baja" : u.estado === estado)
            .sort((a, b) => new Date(b.fechaAlta) - new Date(a.fechaAlta));

        const inicio = (filtro.pagina - 1) * filtro.porPagina;
        return {
            correcto: true,
            usuarios: encontrados.slice(inicio, inicio + filtro.porPagina),
            total: encontrados.length,
            error: ""
        };
    }

    // --------------------------------------------------------
    // filtros: { estado?, tipo? } --> obtenerIncidencias()
    // --------------------------------------------------------
    async obtenerIncidencias(filtros = {}) {
        await esperarAdmin(this.retardo_ms);
        if (!this.puedeGestionarIncidencias()) {
            return { correcto: false, incidencias: [], error: MENSAJE_SOLO_GESTION };
        }
        const incidencias = this.incidencias.filter(incidencia =>
            (!filtros.estado || filtros.estado === "todos" || incidencia.estado === filtros.estado) &&
            (!filtros.tipo || filtros.tipo === "todos" || incidencia.tipo === filtros.tipo));
        return { correcto: true, incidencias, error: "" };
    }

    // --------------------------------------------------------
    // id_incidencia: N --> obtenerIncidencia()
    // --------------------------------------------------------
    async obtenerIncidencia(id_incidencia) {
        await esperarAdmin(this.retardo_ms);
        if (!this.puedeGestionarIncidencias()) {
            return { correcto: false, incidencia: null, error: MENSAJE_SOLO_GESTION };
        }
        const incidencia = this.incidencias.find(i => i.idIncidencia === Number(id_incidencia));
        return incidencia
            ? { correcto: true, incidencia, error: "" }
            : { correcto: false, incidencia: null, error: "Esa incidencia no existe" };
    }

    // --------------------------------------------------------
    // id_incidencia: N --> obtenerMensajesIncidencia()   (T043)
    //
    // La conversación de la incidencia, el más antiguo primero
    // (como GET /mensajesIncidencia). La descripción no va en la lista.
    // --------------------------------------------------------
    async obtenerMensajesIncidencia(id_incidencia) {
        await esperarAdmin(this.retardo_ms);
        if (!this.puedeGestionarIncidencias()) {
            return { correcto: false, mensajes: [], error: MENSAJE_SOLO_GESTION };
        }
        const incidencia = this.incidencias.find(i => i.idIncidencia === Number(id_incidencia));
        return incidencia
            ? { correcto: true, mensajes: incidencia.mensajes.slice(), error: "" }
            : { correcto: false, mensajes: [], error: "Esa incidencia no existe" };
    }

    // --------------------------------------------------------
    // --> obtenerNumeroIncidenciasAbiertas() --> { abiertas }
    // --------------------------------------------------------
    async obtenerNumeroIncidenciasAbiertas() {
        await esperarAdmin(this.retardo_ms);
        if (!this.puedeGestionarIncidencias()) {
            return { correcto: false, abiertas: null, error: MENSAJE_SOLO_GESTION };
        }
        const abiertas = this.incidencias.filter(i => i.estado === "abierta").length;
        return { correcto: true, abiertas, error: "" };
    }

    // --------------------------------------------------------
    // datos: { idIncidencia, respuesta?, estado? } --> responderIncidencia()
    // --------------------------------------------------------
    async responderIncidencia(datos) {
        await esperarAdmin(this.retardo_ms);
        if (!this.puedeGestionarIncidencias()) {
            return { correcto: false, incidencia: null, error: MENSAJE_SOLO_GESTION };
        }
        const incidencia = this.incidencias.find(i => i.idIncidencia === Number(datos.idIncidencia));
        if (!incidencia) return { correcto: false, incidencia: null, error: "Esa incidencia no existe" };
        if (datos.respuesta !== undefined && !datos.respuesta.trim()) {
            return { correcto: false, incidencia: null, error: "La respuesta no puede estar vacía", campos: ["respuesta"] };
        }
        if (datos.estado !== undefined && !["abierta", "en curso", "resuelta"].includes(datos.estado)) {
            return { correcto: false, incidencia: null, error: "El estado no es válido", campos: ["estado"] };
        }
        if (datos.respuesta !== undefined) {
            incidencia.respuesta = datos.respuesta.trim();
            incidencia.fechaRespuesta = this.ahora.toISOString();
            const usuario = this.usuarioActual();
            incidencia.responsable = { nombre: usuario && usuario.nombre || "Equipo AERIS", rol: usuario && usuario.rol || "tecnico" };
            // La respuesta también es un mensaje de la conversación (T043)
            incidencia.mensajes.push({
                idMensaje: incidencia.idIncidencia * 100 + incidencia.mensajes.length + 1,
                idIncidencia: incidencia.idIncidencia,
                texto: incidencia.respuesta,
                fecha: incidencia.fechaRespuesta,
                autor: { idUsuario: usuario && usuario.id || 1, nombre: incidencia.responsable.nombre, rol: incidencia.responsable.rol },
                delUsuario: false
            });
        }
        if (datos.estado !== undefined) incidencia.estado = datos.estado;
        else if (datos.respuesta !== undefined) incidencia.estado = "resuelta";
        return { correcto: true, incidencia, error: "", modoDemo: true };
    }

    puedeGestionarIncidencias() {
        const usuario = this.usuarioActual();
        return rolesFake.esAdministrador(usuario) || rolesFake.esTecnico(usuario);
    }

    // --------------------------------------------------------
    // r: B <-- esAdministradorActual() <--
    //
    // Simula la comprobación del servidor: crear cuentas,
    // cambiar el rol y dar de baja solo lo puede hacer un
    // administrador (el servidor real responde 403).
    // --------------------------------------------------------
    esAdministradorActual() {
        return rolesFake.esAdministrador(this.usuarioActual());
    }

    // --------------------------------------------------------
    // datos: NuevoUsuario --> crearUsuario() -->
    //       r: ResultadoCreacion <--
    //
    // NuevoUsuario = ( nombre: Text, apellidos: Text, correo: Text, rol: Text )
    // ResultadoCreacion = ( correcto: B, error: Text, campos: [ Text ] )
    //
    // Crea una cuenta de técnico o administrador en estado
    // "pendiente": el servidor real le envía un correo para que
    // elija su contraseña.
    // --------------------------------------------------------
    async crearUsuario(datos) {
        await esperarAdmin(this.retardo_ms);
        if (!this.esAdministradorActual()) return { correcto: false, error: MENSAJE_SOLO_ADMIN, campos: [] };
        const correo = datos.correo.trim().toLowerCase();
        if (this.usuarios.some(u => u.correo === correo)) {
            return { correcto: false, error: "Ya hay una cuenta con ese correo", campos: ["correo"] };
        }
        this.usuarios.push({
            idUsuario: this.usuarios.length + 1,
            nombre: datos.nombre.trim(),
            apellidos: datos.apellidos.trim(),
            correo,
            rol: datos.rol,
            premium: false,
            nodo: null,
            estado: "pendiente",
            fechaAlta: this.ahora.toISOString()
        });
        return { correcto: true, error: "", campos: [] };
    }

    // --------------------------------------------------------
    // id_usuario: N, rol: Text --> cambiarRol() -->
    //       r: ResultadoOperacion <--
    //
    // Un administrador no puede cambiarse su propio rol.
    // --------------------------------------------------------
    async cambiarRol(id_usuario, rol) {
        await esperarAdmin(this.retardo_ms);
        if (!this.esAdministradorActual()) return { correcto: false, error: MENSAJE_SOLO_ADMIN };
        const actual = this.usuarioActual();
        if (actual && actual.id === id_usuario) {
            return { correcto: false, error: "No puedes cambiar tu propio rol" };
        }
        const usuario = this.usuarios.find(u => u.idUsuario === id_usuario);
        if (!usuario) return { correcto: false, error: "El usuario no existe" };
        usuario.rol = rol;
        return { correcto: true, error: "" };
    }

    // --------------------------------------------------------
    // ids: [ N ] --> darDeBaja() --> r: ResultadoOperacion <--
    //
    // Marca los usuarios como "baja". Un administrador no puede
    // darse de baja a sí mismo.
    // --------------------------------------------------------
    async darDeBaja(ids) {
        await esperarAdmin(this.retardo_ms);
        if (!this.esAdministradorActual()) return { correcto: false, error: MENSAJE_SOLO_ADMIN };
        const actual = this.usuarioActual();
        if (actual && ids.includes(actual.id)) {
            return { correcto: false, error: "No puedes darte de baja a ti mismo" };
        }
        for (const usuario of this.usuarios) {
            if (ids.includes(usuario.idUsuario)) usuario.estado = "baja";
        }
        return { correcto: true, error: "" };
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
// ahora: Fecha, nodos: [ Nodo ] --> crearUsuariosPrueba()
//                               --> [ UsuarioAdmin ]
//
// UsuarioAdmin = ( idUsuario: N, nombre: Text, apellidos: Text,
//                  correo: Text, rol: Text, premium: B, nodo: Text,
//                  estado: Text, fechaAlta: Text )
//
// El usuario 1 es admin@aeris.es (el de la lógica fake del
// login) y el 2 es laura@correo.es.
// --------------------------------------------------------
function crearUsuariosPrueba(ahora, nodos) {
    const usuarios = [
        { nombre: "Administración", apellidos: "AERIS", correo: "admin@aeris.es", rol: "administrador" },
        { nombre: "Laura", apellidos: "Martínez", correo: "laura@correo.es", rol: "portador" }
    ];
    for (let i = 0; i < 40; i++) {
        const [nombre] = NOMBRES_PRUEBA[i % NOMBRES_PRUEBA.length].split(" ");
        const apellidos = APELLIDOS_PRUEBA[(i * 3) % APELLIDOS_PRUEBA.length];
        usuarios.push({
            nombre, apellidos,
            correo: normalizarTexto(nombre + "." + apellidos + (i + 1)) + "@correo.es",
            rol: i % 13 === 5 ? "tecnico" : i % 17 === 8 ? "administrador" : "portador"
        });
    }
    return usuarios.map((u, i) => ({
        idUsuario: i + 1,
        nombre: u.nombre,
        apellidos: u.apellidos,
        correo: u.correo,
        rol: u.rol,
        premium: u.rol === "portador" && i % 4 === 1,
        nodo: u.rol === "portador" && i % 3 !== 2 ? nodos[i % nodos.length].id : null,
        estado: i > 1 && i % 11 === 7 ? "pendiente" : i > 1 && i % 19 === 10 ? "baja" : "activo",
        fechaAlta: new Date(ahora.getTime() - (i * 2 + 1) * 86400000).toISOString()
    }));
}

function crearIncidenciasPrueba(ahora) {
    const crear = (id, tipo, asunto, descripcion, estado, nombre, apellidos, correo, sensor, dias) => {
        const resuelta = estado === "resuelta";
        const fechaRespuesta = resuelta ? new Date(ahora.getTime() - (dias - 0.5) * 86400000).toISOString() : null;
        const responsable = resuelta ? { idUsuario: 1, nombre: "Administración", rol: "administrador" } : null;
        const respuesta = resuelta ? "Hemos revisado el caso y ya está solucionado." : null;
        return {
            idIncidencia: id,
            tipo,
            asunto,
            descripcion,
            estado,
            respuesta,
            responsable,
            fechaCreacion: new Date(ahora.getTime() - dias * 86400000).toISOString(),
            fechaRespuesta,
            usuario: { idUsuario: id + 20, nombre, apellidos, correo },
            sensor,
            // La conversación (T043): la respuesta de siempre es su primer mensaje del equipo
            mensajes: resuelta ? [{
                idMensaje: id * 100 + 1, idIncidencia: id, texto: respuesta, fecha: fechaRespuesta,
                autor: { idUsuario: responsable.idUsuario, nombre: responsable.nombre, rol: responsable.rol },
                delUsuario: false
            }] : []
        };
    };
    const sensorLaura = {
        idSensor: 1, numeroSerie: "AER-24001", nombre: "Sensor Laura",
        estado: "activo", bateria: 72,
        ultimaConexion: new Date(ahora.getTime() - 12 * 60000).toISOString(),
        necesitaCalibracion: false
    };
    const sensorPau = {
        idSensor: 2, numeroSerie: "AER-24002", nombre: "Sensor Pau",
        estado: "inactivo", bateria: 18,
        ultimaConexion: new Date(ahora.getTime() - 28 * 3600000).toISOString(),
        necesitaCalibracion: true
    };
    const incidencias = [
        crear(101, "sensor", "El sensor no enciende", "El sensor dejó de encender después de cargarlo.", "abierta",
            "Laura", "Martínez", "laura@correo.es", sensorLaura, 0.2),
        crear(102, "datos", "Faltan mediciones", "No aparecen mediciones de esta mañana en la aplicación.", "en curso",
            "Pau", "Ferrer", "pau@correo.es", sensorPau, 1),
        crear(103, "cuenta", "No puedo cambiar mi correo", "Al guardar el correo nuevo aparece un error.", "abierta",
            "Lucía", "Pastor", "lucia@correo.es", null, 2),
        crear(104, "otra", "Consulta sobre el servicio", "Quería saber cuándo se publicarán los datos del último mes.", "resuelta",
            "Andrés", "Gil", "andres@correo.es", null, 4)
    ];
    // La usuaria de la 103 ha añadido un mensaje después de enviarla (T043)
    incidencias[2].mensajes.push({
        idMensaje: 10301, idIncidencia: 103, texto: "Sigue sin dejarme guardar el correo. ¿Podéis mirarlo?",
        fecha: new Date(ahora.getTime() - 1.5 * 86400000).toISOString(),
        autor: { idUsuario: 123, nombre: "Lucía", rol: "ciudadano" }, delUsuario: true
    });
    return incidencias;
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