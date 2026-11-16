// ------------------------------------------------------------
// nodos.js
// Funciones sobre los nodos que no dependen de la pantalla:
// cuánto tiempo llevan sin enviar datos, en qué estado están
// y cómo se escriben los números y los tiempos.
// Las usan la lógica fake y el panel de nodos.
// ------------------------------------------------------------

// Se declaran con var para que en el navegador estén también
// en window, como las funciones.
var UMBRAL_INACTIVO_HORAS = 24;
const MINUTOS_EN_UN_DIA = 24 * 60;

// EstadoNodo = { ACTIVO, INACTIVO, CALIBRAR }
var EstadoNodo = Object.freeze({
    ACTIVO: "ACTIVO",
    INACTIVO: "INACTIVO",
    CALIBRAR: "CALIBRAR"
});

// --------------------------------------------------------
// ultima_medicion: Text, ahora: Fecha --> minutosSinDatos() --> N
//
// ultima_medicion es una fecha en formato ISO
// ("2026-11-04T10:30:00Z"). Devuelve los minutos que han
// pasado desde entonces, nunca un número negativo.
// --------------------------------------------------------
function minutosSinDatos(ultima_medicion, ahora) {
    const diferencia = ahora.getTime() - new Date(ultima_medicion).getTime();
    return Math.max(0, Math.floor(diferencia / 60000));
}

// --------------------------------------------------------
// nodo: Nodo, ahora: Fecha, umbral_horas: N --> estadoNodo()
//                                           --> EstadoNodo
//
// Nodo = ( id: Text, portador: Text, ultimaMedicion: Text,
//          bateria: N, latitud: R, longitud: R,
//          necesitaCalibrar: B )
//
// Un nodo es INACTIVO si lleva más de umbral_horas sin enviar
// datos. Si no, es CALIBRAR si necesita calibración y ACTIVO
// en el resto de casos.
// --------------------------------------------------------
function estadoNodo(nodo, ahora, umbral_horas = UMBRAL_INACTIVO_HORAS) {
    if (minutosSinDatos(nodo.ultimaMedicion, ahora) > umbral_horas * 60) {
        return EstadoNodo.INACTIVO;
    }
    return nodo.necesitaCalibrar ? EstadoNodo.CALIBRAR : EstadoNodo.ACTIVO;
}

// --------------------------------------------------------
// minutos: N --> textoTiempoSinDatos() --> Text
//
// 12 → "12 min" · 125 → "2 h" · 4320 → "3 días" · 1440 → "1 día"
// --------------------------------------------------------
function textoTiempoSinDatos(minutos) {
    if (minutos < 60) return minutos + " min";
    if (minutos < MINUTOS_EN_UN_DIA) return Math.floor(minutos / 60) + " h";
    const dias = Math.floor(minutos / MINUTOS_EN_UN_DIA);
    return dias + (dias === 1 ? " día" : " días");
}

// --------------------------------------------------------
// n: N --> formatearNumero() --> Text
//
// Escribe el número con punto de miles: 1248 → "1.248".
// --------------------------------------------------------
function formatearNumero(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

if (typeof module !== "undefined") {
    module.exports = {
        EstadoNodo,
        UMBRAL_INACTIVO_HORAS,
        minutosSinDatos,
        estadoNodo,
        textoTiempoSinDatos,
        formatearNumero
    };
}