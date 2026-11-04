// ------------------------------------------------------------
// configuracion.js
// Único sitio donde se elige qué lógica usa la web.
// Para pasar al servidor real, cambia USAR_LOGICA_FAKE a false
// y pon la dirección del servidor en URL_SERVIDOR.
// ------------------------------------------------------------

const USAR_LOGICA_FAKE = true;
const URL_SERVIDOR = "http://localhost:3000";

// --------------------------------------------------------
// crearLogica() --> LogicaFake | LogicaReal
// --------------------------------------------------------
function crearLogica() {
  return USAR_LOGICA_FAKE ? new LogicaFake() : new LogicaReal(URL_SERVIDOR);
}
