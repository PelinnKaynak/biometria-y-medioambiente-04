// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeMisDatos.java
// Descripción: Lógica del teléfono para la pantalla «Mis datos» (T007).
//              Pide las mediciones del día actual (GET /misDatos/hoy) al
//              servidor REST con el token de sesión. Mientras no esté
//              disponible el endpoint en backend, provee datos de ejemplo
//              (USAR_DATOS_DE_EJEMPLO = true).
// Autores:     Equipo 04 – SenseTech
// Fecha:       15/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

// LogicaFakeMisDatos class: fetches today's summary metrics and measurements for the logged-in user.
public class LogicaFakeMisDatos {

    static final boolean USAR_DATOS_DE_EJEMPLO = true;

    static final int CODIGO_OK = 200;
    static final int CODIGO_SIN_SESION = 401;
    static final int CODIGO_SIN_CONEXION = 0;

    static final String MENSAJE_SIN_CONEXION = "No hay conexión con el servidor. Inténtalo de nuevo.";

    // Datos de ejemplo representativos para el día de hoy
    static final double DISTANCIA_EJEMPLO = 4.2;
    static final double[] VALORES_HOY_EJEMPLO = {68.0, 75.0, 82.0, 74.0, 71.0};
    static final long[] MINUTOS_ATRAS_EJEMPLO = {15, 60, 120, 240, 360};

    // -----------------------------------------------------------------------
    // Callback de obtenerDatosHoy()
    // -----------------------------------------------------------------------
    public interface RespuestaMisDatos {
        // datos: ResumenMisDatos --> datosObtenidos() -->
        void datosObtenidos(ResumenMisDatos datos);
        // sesionCaducada() -->                                (401)
        void sesionCaducada();
        // mensaje: Text --> error() -->
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // token: Text, tieneSensor: B --> obtenerDatosHoy() -->
    // What it does: fetches today's summary for the logged-in user. If the user
    //               has no linked sensor, returns a summary with tieneSensor=false.
    //               In preview mode (USAR_DATOS_DE_EJEMPLO), returns representative
    //               data for today.
    // -----------------------------------------------------------------------
    public void obtenerDatosHoy(String token, boolean tieneSensor, final RespuestaMisDatos respuesta) {
        if (token == null || token.trim().isEmpty()) {
            respuesta.sesionCaducada();
            return;
        }

        if (!tieneSensor) {
            respuesta.datosObtenidos(new ResumenMisDatos(0.0, 0.0, "0 µg/m³", Collections.emptyList(), false));
            return;
        }

        if (USAR_DATOS_DE_EJEMPLO) {
            respuesta.datosObtenidos(datosDeEjemplo(System.currentTimeMillis(), true));
            return;
        }

        new PeticionarioREST().hacerPeticionREST("GET",
                LogicaFakeRegistro.URL_SERVIDOR + "/misDatos/hoy", null, token,
                (codigo, cuerpo) -> notificarResumen(codigo, cuerpo, tieneSensor, respuesta));
    }

    // -----------------------------------------------------------------------
    // ahora: Z, tieneSensor: B --> datosDeEjemplo() --x
    // ResumenMisDatos <--
    // What it does: builds sample daily summary with realistic measurements.
    // -----------------------------------------------------------------------
    public static ResumenMisDatos datosDeEjemplo(long ahora, boolean tieneSensor) {
        if (!tieneSensor) {
            return new ResumenMisDatos(0.0, 0.0, "0 µg/m³", Collections.emptyList(), false);
        }
        List<Medicion> lista = new ArrayList<>();
        for (int i = 0; i < VALORES_HOY_EJEMPLO.length; i++) {
            lista.add(new Medicion(VALORES_HOY_EJEMPLO[i], ahora - MINUTOS_ATRAS_EJEMPLO[i] * TiempoTranscurrido.MINUTO));
        }
        return ResumenMisDatos.calcularDesdeMediciones(lista, DISTANCIA_EJEMPLO, true);
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text, tieneSensor: B --> notificarResumen() --x
    // What it does: parses the REST response. 200 -> datosObtenidos();
    //               401 -> sesionCaducada(); 0/other -> error().
    // -----------------------------------------------------------------------
    static void notificarResumen(int codigo, String cuerpo, boolean tieneSensor, RespuestaMisDatos respuesta) {
        if (codigo == CODIGO_OK) {
            ResumenMisDatos resumen = ResumenMisDatos.desdeJSON(cuerpo, tieneSensor);
            if (resumen != null) {
                respuesta.datosObtenidos(resumen);
            } else {
                respuesta.datosObtenidos(new ResumenMisDatos(0.0, 0.0, "0 µg/m³", Collections.emptyList(), tieneSensor));
            }
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se han podido cargar tus datos de hoy (error " + codigo + ").");
        }
    }
}
