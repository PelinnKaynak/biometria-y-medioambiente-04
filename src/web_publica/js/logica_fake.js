// ------------------------------------------------------------
// logica_fake.js
// Simula el servidor de AERIS para poder desarrollar y probar
// la web sin el backend real. Tiene la misma interfaz que
// LogicaReal (logica_real.js).
// ------------------------------------------------------------

const CLAVE_SESION = "aeris_usuario";

class LogicaFake {

  // --------------------------------------------------------
  // retardo_ms: N --> LogicaFake() -->
  //
  // Crea la lógica fake con dos usuarios de prueba.
  // retardo_ms simula lo que tarda el servidor en responder
  // (en las pruebas se pasa 0).
  // --------------------------------------------------------
  constructor(retardo_ms = 300) {
    this.retardo_ms = retardo_ms;
    this.solicitudes = [];
    this.usuarios = [
      {
        credenciales: { correo: "admin@aeris.es", contrasena: "admin1234" },
        usuario: { id: 1, nombre: "Administración AERIS", correo: "admin@aeris.es", rol: "ADMINISTRADOR" }
      },
      {
        credenciales: { correo: "laura@correo.es", contrasena: "laura1234" },
        usuario: { id: 2, nombre: "Laura Martínez", correo: "laura@correo.es", rol: "PORTADOR" }
      }
    ];
  }

  // --------------------------------------------------------
  // credenciales: Credenciales --> iniciarSesion() -->
  //                r: ResultadoSesion <--
  //
  // Credenciales = ( correo: Text, contrasena: Text )
  // ResultadoSesion = ( correcto: B, usuario: Usuario, error: Text )
  //
  // Si el correo y la contraseña coinciden con un usuario de
  // prueba, guarda el usuario en la sesión del navegador.
  // --------------------------------------------------------
  async iniciarSesion(credenciales) {
    await esperar(this.retardo_ms);

    const correo = credenciales.correo.trim().toLowerCase();
    const encontrado = this.usuarios.find(u =>
      u.credenciales.correo === correo &&
      u.credenciales.contrasena === credenciales.contrasena
    );

    if (!encontrado) {
      return { correcto: false, usuario: null, error: "Correo o contraseña incorrectos" };
    }

    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(encontrado.usuario));
    return { correcto: true, usuario: encontrado.usuario, error: "" };
  }

  // --------------------------------------------------------
  // correo: Text --> solicitarRecuperacion() -->
  //       r: ResultadoOperacion <--
  //
  // ResultadoOperacion = ( correcto: B, error: Text )
  //
  // Simula el envío del enlace para crear una contraseña
  // nueva. Responde que ha ido bien aunque el correo no
  // exista, igual que hará el servidor real, para no revelar
  // qué correos están registrados. Las solicitudes se guardan
  // en this.solicitudes para poder comprobarlas en las pruebas.
  // --------------------------------------------------------
  async solicitarRecuperacion(correo) {
    await esperar(this.retardo_ms);
    this.solicitudes.push(correo.trim().toLowerCase());
    return { correcto: true, error: "" };
  }

  // --------------------------------------------------------
  // cerrarSesion() -->
  //
  // Borra el usuario guardado en la sesión del navegador.
  // --------------------------------------------------------
  cerrarSesion() {
    sessionStorage.removeItem(CLAVE_SESION);
  }

  // --------------------------------------------------------
  // r: Usuario <-- usuarioActual() <--
  //
  // Devuelve el usuario que ha iniciado sesión, o null si no
  // hay ninguno.
  // --------------------------------------------------------
  usuarioActual() {
    const guardado = sessionStorage.getItem(CLAVE_SESION);
    return guardado ? JSON.parse(guardado) : null;
  }
}

// --------------------------------------------------------
// ms: N --> esperar()
//
// Espera ms milisegundos antes de continuar.
// --------------------------------------------------------
function esperar(ms) {
  return new Promise(resolver => setTimeout(resolver, ms));
}

if (typeof module !== "undefined") {
  module.exports = { LogicaFake, CLAVE_SESION };
}
