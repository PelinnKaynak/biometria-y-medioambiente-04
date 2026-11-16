// ------------------------------------------------------------
// configuracion.js (panel de administración)
// Único sitio donde se elige qué lógica usa el panel.
// Mismo funcionamiento que web_publica/js/configuracion.js:
// true → datos de prueba; false → servidor REST real.
// ------------------------------------------------------------

const USAR_LOGICA_FAKE = true;
const URL_SERVIDOR = "";

// --------------------------------------------------------
// crearLogicaAdmin() --> LogicaAdminFake | LogicaAdminReal
// --------------------------------------------------------
function crearLogicaAdmin() {
    return USAR_LOGICA_FAKE ? new LogicaAdminFake() : new LogicaAdminReal(URL_SERVIDOR);
}