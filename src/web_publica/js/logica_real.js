// ------------------------------------------------------------
// logica_real.js
// Lógica del navegador que habla con el servidor REST de AERIS
// (src/servidor_rest, T016). Tiene la misma interfaz que
// LogicaFake (logica_fake.js).
// Rutas y respuestas según doc/servidor_rest_design.md.
// ------------------------------------------------------------

const CLAVE_SESION_REAL = "aeris_usuario";

class LogicaReal {

  // --------------------------------------------------------
  // url_servidor: Text --> LogicaReal() -->
  //
  // url_servidor vacío ("") significa que la web la sirve el
  // mismo servidor REST, así que las peticiones van a la misma
  // dirección que la página.
  // --------------------------------------------------------
  constructor(url_servidor) {
    this.url_servidor = url_servidor;
  }

  // --------------------------------------------------------
  // ruta: Text, cuerpo: Objeto --> enviarPost() --> Respuesta
  //
  // Hace un POST con el cuerpo en JSON. Si no hay conexión,
  // devuelve null.
  // --------------------------------------------------------
  async enviarPost(ruta, cuerpo) {
    try {
      return await fetch(this.url_servidor + ruta, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo)
      });
    } catch (e) {
      return null;
    }
  }

  // --------------------------------------------------------
  // credenciales: Credenciales --> iniciarSesion() -->
  //                r: ResultadoSesion <--
  //
  // POST /iniciarSesion { correo, contrasena }
  //   200 { idUsuario, token, rol, nombre } · 401 { error }
  // --------------------------------------------------------
  async iniciarSesion(credenciales) {
    const respuesta = await this.enviarPost("/iniciarSesion", credenciales);

    if (respuesta === null) {
      return { correcto: false, usuario: null, error: "No se puede conectar con el servidor" };
    }
    if (respuesta.status === 401) {
      return { correcto: false, usuario: null, error: "Correo o contraseña incorrectos" };
    }
    if (!respuesta.ok) {
      return { correcto: false, usuario: null, error: "Ha habido un error. Inténtalo de nuevo" };
    }

    const sesion = await respuesta.json();
    const usuario = {
      id: sesion.idUsuario,
      nombre: sesion.nombre,
      correo: credenciales.correo.trim().toLowerCase(),
      rol: sesion.rol,
      token: sesion.token
    };
    sessionStorage.setItem(CLAVE_SESION_REAL, JSON.stringify(usuario));
    return { correcto: true, usuario, error: "" };
  }

  // --------------------------------------------------------
  // datos: DatosRegistro --> registrarUsuario() -->
  //       r: ResultadoRegistro <--
  //
  // POST /registrarUsuario { nombre, apellidos, correo, contrasena }
  //   201 { idUsuario, token, rol, nombre }
  //   400 { error, campos } · 409 { error } (correo ya registrado)
  // --------------------------------------------------------
  async registrarUsuario(datos) {
    const respuesta = await this.enviarPost("/registrarUsuario", datos);
    const fallo = (error, campos = [], correoRepetido = false) =>
        ({ correcto: false, usuario: null, error, campos, correoRepetido });

    if (respuesta === null) return fallo("No se puede conectar con el servidor");
    if (respuesta.status === 409) return fallo("Ya hay una cuenta con ese correo", ["correo"], true);
    if (respuesta.status === 400) {
      const cuerpo = await respuesta.json();
      return fallo("Revisa los datos marcados", cuerpo.campos || []);
    }
    if (!respuesta.ok) return fallo("Ha habido un error. Inténtalo de nuevo");

    const sesion = await respuesta.json();
    const usuario = {
      id: sesion.idUsuario,
      nombre: sesion.nombre,
      correo: datos.correo.trim().toLowerCase(),
      rol: sesion.rol,
      token: sesion.token
    };
    sessionStorage.setItem(CLAVE_SESION_REAL, JSON.stringify(usuario));
    return { correcto: true, usuario, error: "", campos: [], correoRepetido: false };
  }

  // --------------------------------------------------------
  // correo: Text --> solicitarRecuperacion() -->
  //       r: ResultadoOperacion <--
  //
  // POST /solicitarRecuperacion { correo }
  //   200 siempre, exista o no el correo
  // --------------------------------------------------------
  async solicitarRecuperacion(correo) {
    const respuesta = await this.enviarPost("/solicitarRecuperacion", { correo });

    if (respuesta === null) {
      return { correcto: false, error: "No se puede conectar con el servidor" };
    }
    if (!respuesta.ok) {
      return { correcto: false, error: "Ha habido un error. Inténtalo de nuevo" };
    }
    return { correcto: true, error: "" };
  }

  // --------------------------------------------------------
  // token: Text, contrasena: Text --> restablecerContrasena() -->
  //       r: ResultadoOperacion <--
  //
  // POST /restablecerContrasenya { token, contrasena }
  //   204 · 400 { error } (enlace caducado, ya usado o
  //   contraseña que no cumple el formato)
  // --------------------------------------------------------
  async restablecerContrasena(token, contrasena) {
    const respuesta = await this.enviarPost("/restablecerContrasenya", { token, contrasena });

    if (respuesta === null) {
      return { correcto: false, error: "No se puede conectar con el servidor" };
    }
    if (respuesta.status === 400) {
      return { correcto: false, error: "El enlace no es válido o ha caducado. Pide uno nuevo" };
    }
    if (!respuesta.ok) {
      return { correcto: false, error: "Ha habido un error. Inténtalo de nuevo" };
    }
    return { correcto: true, error: "" };
  }

  // --------------------------------------------------------
  // cerrarSesion() -->
  // --------------------------------------------------------
  cerrarSesion() {
    sessionStorage.removeItem(CLAVE_SESION_REAL);
  }

  // --------------------------------------------------------
  // r: Usuario <-- usuarioActual() <--
  // --------------------------------------------------------
  usuarioActual() {
    const guardado = sessionStorage.getItem(CLAVE_SESION_REAL);
    return guardado ? JSON.parse(guardado) : null;
  }
}

if (typeof module !== "undefined") {
  module.exports = { LogicaReal };
}