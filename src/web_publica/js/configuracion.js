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

const USAR_LOGICA_FAKE = false;
const URL_SERVIDOR = "";

// --------------------------------------------------------
// crearLogica() --> LogicaFake | LogicaReal
// --------------------------------------------------------
function crearLogica() {
  return USAR_LOGICA_FAKE ? new LogicaFake() : new LogicaReal(URL_SERVIDOR);
}

// --------------------------------------------------------
// crearLogicaCuenta() --> LogicaCuentaFake | LogicaCuentaReal
//
// Lógica de la página Mi cuenta (T018). Usa el mismo
// interruptor que el resto de la web.
// --------------------------------------------------------
function crearLogicaCuenta() {
  return USAR_LOGICA_FAKE ? new LogicaCuentaFake() : new LogicaCuentaReal(URL_SERVIDOR);
}

// --------------------------------------------------------
// crearLogicaMapa() --> LogicaMapaFake | LogicaMapaReal
//
// Lógica del mapa de la página principal (T012).
// --------------------------------------------------------
function crearLogicaMapa() {
  return USAR_LOGICA_FAKE ? new LogicaMapaFake() : new LogicaMapaReal(URL_SERVIDOR);
}