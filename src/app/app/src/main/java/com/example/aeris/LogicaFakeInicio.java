// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeInicio.java
// Descripción: Lógica fake del teléfono para la pantalla de inicio. Pide las
//              últimas mediciones (GET /ultimasMediciones) al servidor REST
//              con el token de la sesión. Ese recurso es la tarea T017; hasta
//              entonces USAR_DATOS_DE_EJEMPLO = true y devuelve mediciones de
//              ejemplo. Cuando exista T017, basta con ponerlo a false.
//              Diseño en doc/app_design.md. Tarea T006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       12/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.util.ArrayList;
import java.util.List;

// LogicaFakeInicio class: the phone's fake logic for the Inicio screen.
public class LogicaFakeInicio {

    // T017: poner a false cuando el servidor tenga GET /ultimasMediciones
    static final boolean USAR_DATOS_DE_EJEMPLO = true;

    // Cuántas mediciones pide Inicio: la de ahora (arco) y 4 anteriores (cajas)
    static final int CANTIDAD = 5;

    static final int CODIGO_OK = 200;
    static final int CODIGO_SIN_SESION = 401;
    static final int CODIGO_SIN_CONEXION = 0;

    // Resto de datos de ejemplo del Figma (sin servidor que los dé aún):
    // batería del sensor (%), mejor hora para salir y el nivel de Mis lugares
    static final int BATERIA_EJEMPLO = 78;
    // T017: el servidor aún no envía el sensor del usuario (GET /usuarioActual),
    // así que se da por vinculado un sensor de ejemplo para ver «Mi sensor».
    // Para ver la tarjeta «Vincular» (sin sensor), poner a false.
    static final boolean SENSOR_DE_EJEMPLO = true;
    static final String MEJOR_HORA_EJEMPLO = "Hoy de 8:00 a 10:00 · pico a las 14:00";
    static final String[] LUGARES_EJEMPLO = {"Casa", "Trabajo"};
    static final double[] VALORES_LUGARES_EJEMPLO = {84, 150};

    // Mediciones de ejemplo: valor (µg/m³) y hace cuántos minutos se tomó
    static final double[] VALORES_EJEMPLO = {84, 90, 102, 96, 88};
    static final long[] MINUTOS_EJEMPLO = {4, 24, 44, 64, 84};

    // -----------------------------------------------------------------------
    // Callback de obtenerUltimasMediciones() (se omite en la notación)
    // -----------------------------------------------------------------------
    public interface RespuestaMediciones {
        // mediciones: [Medicion], deEjemplo: B --> medicionesObtenidas() -->
        // (de la más nueva a la más antigua; puede estar vacía)
        void medicionesObtenidas(List<Medicion> mediciones, boolean deEjemplo);
        // sesionCaducada() -->                            (401)
        void sesionCaducada();
        // mensaje: Text --> error() -->
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // token: Text --> obtenerUltimasMediciones() -->
    // What it does: with USAR_DATOS_DE_EJEMPLO, answers at once with the
    //               example measurements. If not, sends
    //               GET /ultimasMediciones?cantidad=5 with the session token
    //               and calls medicionesObtenidas(), sesionCaducada() or error().
    // -----------------------------------------------------------------------
    public void obtenerUltimasMediciones(String token, final RespuestaMediciones respuesta) {
        if (USAR_DATOS_DE_EJEMPLO) {
            respuesta.medicionesObtenidas(medicionesDeEjemplo(System.currentTimeMillis()), true);
            return;
        }
        new PeticionarioREST().hacerPeticionREST("GET",
                LogicaFakeRegistro.URL_SERVIDOR + "/ultimasMediciones?cantidad=" + CANTIDAD, null, token,
                (codigo, cuerpo) -> notificarMediciones(codigo, cuerpo, respuesta));
    }

    // -----------------------------------------------------------------------
    // ahora: Z --> medicionesDeEjemplo() --x
    // [Medicion] <--
    // What it does: 5 measurements, one every 20 min, the newest 4 min ago
    //               (the values of the Figma design: 84 now and 90, 102, 96
    //               in the boxes, plus one more).
    // -----------------------------------------------------------------------
    static List<Medicion> medicionesDeEjemplo(long ahora) {
        List<Medicion> lista = new ArrayList<>();
        for (int i = 0; i < VALORES_EJEMPLO.length; i++) {
            lista.add(new Medicion(VALORES_EJEMPLO[i], ahora - MINUTOS_EJEMPLO[i] * TiempoTranscurrido.MINUTO));
        }
        return lista;
    }

    // -----------------------------------------------------------------------
    // tieneSensorServidor: B --> tieneSensor() --x
    // B <--
    // What it does: true if the server says the user has a sensor or, until
    //               T017, if SENSOR_DE_EJEMPLO is on.
    // -----------------------------------------------------------------------
    static boolean tieneSensor(boolean tieneSensorServidor) {
        return tieneSensorServidor || SENSOR_DE_EJEMPLO;
    }

    // -----------------------------------------------------------------------
    // ahora: Z --> avisosDeEjemplo() --x
    // [Aviso] <--
    // What it does: the 3 notifications of the Figma design (contaminación
    //               alta 4 min ago, batería baja 1,5 h ago, sensor
    //               desconectado yesterday). Their keys are fixed
    //               («ejemplo:TIPO»), so once read they stay read.
    // -----------------------------------------------------------------------
    static List<Aviso> avisosDeEjemplo(long ahora) {
        List<Aviso> lista = new ArrayList<>();
        lista.add(new Aviso(Aviso.Tipo.CONTAMINACION, "Contaminación alta",
                "El ozono ha superado el límite en tu zona.", ahora - 4 * TiempoTranscurrido.MINUTO,
                "ejemplo:CONTAMINACION"));
        lista.add(new Aviso(Aviso.Tipo.BATERIA, "Batería baja",
                "Tu sensor tiene poca batería.", ahora - 92 * TiempoTranscurrido.MINUTO,
                "ejemplo:BATERIA"));
        lista.add(new Aviso(Aviso.Tipo.DESCONECTADO, "Sensor desconectado",
                "No recibimos datos desde hace 1 hora.", ahora - TiempoTranscurrido.DIA,
                "ejemplo:DESCONECTADO"));
        return lista;
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text --> notificarMediciones() --x
    // What it does: 200 with a valid list -> medicionesObtenidas() (at most
    //               CANTIDAD); 401 -> sesionCaducada(); anything else -> error().
    // -----------------------------------------------------------------------
    static void notificarMediciones(int codigo, String cuerpo, RespuestaMediciones respuesta) {
        if (codigo == CODIGO_OK) {
            List<Medicion> lista = Medicion.listaDesdeJSON(cuerpo);
            if (lista == null) {
                respuesta.error("Respuesta del servidor no válida.");
            } else {
                respuesta.medicionesObtenidas(
                        lista.size() > CANTIDAD ? new ArrayList<>(lista.subList(0, CANTIDAD)) : lista, false);
            }
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(LogicaFakePerfil.MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se han podido cargar las mediciones (error " + codigo + ").");
        }
    }
}
