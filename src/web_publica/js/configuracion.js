// ------------------------------------------------------------
// configuracion.js
// Único sitio donde se elige qué lógica usa la web.
//
// USAR_LOGICA_FAKE = true  → datos de prueba, sin servidor.
//                             Funciona abriendo la página desde PhpStorm.
// USAR_LOGICA_FAKE = false → servidor REST real (src/servidor_rest).
//                             Arranca el servidor con npm start y abre
//                             http://localhost:8080/login.html
//
// URL_SERVIDOR vacío significa que la web y la API están en el mismo
// servidor. Si algún día van separadas, pon aquí su dirección.
// ------------------------------------------------------------

const USAR_LOGICA_FAKE = true;
const URL_SERVIDOR = "";

// --------------------------------------------------------
// crearLogica() --> LogicaFake | LogicaReal
// --------------------------------------------------------
function crearLogica() {
  return USAR_LOGICA_FAKE ? new LogicaFake() : new LogicaReal(URL_SERVIDOR);
}