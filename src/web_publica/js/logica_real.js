// ------------------------------------------------------------
// logica_real.js
// Lógica del navegador que habla con el servidor REST de AERIS.
// Tiene la misma interfaz que LogicaFake (logica_fake.js).
// ------------------------------------------------------------

const CLAVE_SESION_REAL = "aeris_usuario";

class LogicaReal {

  // --------------------------------------------------------
  // url_servidor: Text --> LogicaReal() -->
  // --------------------------------------------------------
  constructor(url_servidor) {
    this.url_servidor = url_servidor;
  }

  // --------------------------------------------------------
  // credenciales: Credenciales --> iniciarSesion() -->
  //                r: ResultadoSesion <--
  //
  // Envía el correo y la contraseña a POST /api/sesion.
  // El formato exacto de la respuesta se define en
  // servidor_rest_design.md.
  // --------------------------------------------------------
  async iniciarSesion(credenciales) {
    let respuesta;
    try {
      respuesta = await fetch(this.url_servidor + "/api/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credenciales)
      });
    } catch (e) {
      return { correcto: false, usuario: null, error: "No se puede conectar con el servidor" };
    }

    if (respuesta.status === 401) {
      return { correcto: false, usuario: null, error: "Correo o contraseña incorrectos" };
    }
    if (!respuesta.ok) {
      return { correcto: false, usuario: null, error: "Ha habido un error. Inténtalo de nuevo" };
    }

    const datos = await respuesta.json();
    sessionStorage.setItem(CLAVE_SESION_REAL, JSON.stringify(datos.usuario));
    return { correcto: true, usuario: datos.usuario, error: "" };
  }

  // --------------------------------------------------------
  // correo: Text --> solicitarRecuperacion() -->
  //       r: ResultadoOperacion <--
  //
  // Pide al servidor (POST /api/recuperacion) que envíe el
  // enlace para crear una contraseña nueva. El servidor
  // responde igual exista o no el correo.
  // --------------------------------------------------------
  async solicitarRecuperacion(correo) {
    let respuesta;
    try {
      respuesta = await fetch(this.url_servidor + "/api/recuperacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo })
      });
    } catch (e) {
      return { correcto: false, error: "No se puede conectar con el servidor" };
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
