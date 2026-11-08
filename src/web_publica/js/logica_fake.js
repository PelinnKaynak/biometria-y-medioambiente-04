// ------------------------------------------------------------
// logica_fake.js
// Simula el servidor de AERIS para poder desarrollar y probar
// la web sin el backend real. Tiene la misma interfaz que
// LogicaReal (logica_real.js).
// ------------------------------------------------------------

const CLAVE_SESION = "aeris_usuario";
const TOKEN_PRUEBA = "token-prueba";

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
    this.tokenUsado = false;
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
  // datos: DatosRegistro --> registrarUsuario() -->
  //       r: ResultadoRegistro <--
  //
  // DatosRegistro = ( nombre: Text, apellidos: Text, correo: Text, contrasena: Text )
  // ResultadoRegistro = ( correcto: B, usuario: Usuario, error: Text,
  //                       campos: [ Text ], correoRepetido: B )
  //
  // Crea la cuenta como portador y deja la sesión iniciada.
  // Si el correo ya tiene cuenta, lo indica en correoRepetido.
  // --------------------------------------------------------
  async registrarUsuario(datos) {
    await esperar(this.retardo_ms);
    const correo = datos.correo.trim().toLowerCase();
    if (this.usuarios.some(u => u.credenciales.correo === correo)) {
      return { correcto: false, usuario: null, error: "Ya hay una cuenta con ese correo",
        campos: ["correo"], correoRepetido: true };
    }
    const usuario = {
      id: this.usuarios.length + 1,
      nombre: datos.nombre.trim(),
      correo,
      rol: "PORTADOR"
    };
    this.usuarios.push({ credenciales: { correo, contrasena: datos.contrasena }, usuario });
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(usuario));
    return { correcto: true, usuario, error: "", campos: [], correoRepetido: false };
  }

  // --------------------------------------------------------
  // correo: Text --> solicitarRecuperacion() -->
  //       r: ResultadoOperacion <--
  //
  // ResultadoOperacion = ( correcto: B, error: Text )
  //
  // Simula el envío del enlace para crear una contraseña
  // nueva. Igual que el servidor real (T016), avisa si el
  // correo no tiene cuenta. Las solicitudes que sí se envían
  // se guardan en this.solicitudes para las pruebas.
  // --------------------------------------------------------
  async solicitarRecuperacion(correo) {
    await esperar(this.retardo_ms);
    const limpio = correo.trim().toLowerCase();
    if (!this.usuarios.some(u => u.credenciales.correo === limpio)) {
      return { correcto: false, error: "No hay ninguna cuenta con ese correo" };
    }
    this.solicitudes.push(limpio);
    return { correcto: true, error: "" };
  }

  // --------------------------------------------------------
  // token: Text, contrasena: Text --> restablecerContrasena() -->
  //       r: ResultadoOperacion <--
  //
  // Simula el cambio de contraseña desde el enlace del correo.
  // Solo acepta el token de prueba "token-prueba" y, como el
  // servidor real, solo una vez.
  // --------------------------------------------------------
  async restablecerContrasena(token, contrasena) {
    await esperar(this.retardo_ms);
    if (token !== TOKEN_PRUEBA || this.tokenUsado) {
      return { correcto: false, error: "El enlace no es válido o ha caducado. Pide uno nuevo" };
    }
    this.tokenUsado = true;
    this.usuarios[1].credenciales.contrasena = contrasena;
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
  module.exports = { LogicaFake, CLAVE_SESION, TOKEN_PRUEBA };
}