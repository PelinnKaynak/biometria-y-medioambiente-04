// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeMisDatos.java
// Descripción: Consulta las mediciones del día para la pantalla T007.
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.util.List;

public class LogicaFakeMisDatos {

    static final int CODIGO_OK = 200;
    static final int CODIGO_SIN_SENSOR = 404;
    static final int CODIGO_SIN_SESION = 401;
    static final int CODIGO_SIN_CONEXION = 0;

    static final String MENSAJE_SIN_CONEXION = "No hay conexión con el servidor. Inténtalo de nuevo.";

    public interface Respuesta {
        void datosObtenidos(List<MedicionDiaria> mediciones);
        void sinSensor();
        void sesionCaducada();
        void error(String mensaje);
    }

    // Requests the local-day interval; the server scopes it to this session's user.
    public void obtenerDatos(String token, long desde, long hasta, final Respuesta respuesta) {
        if (!LogicaFakeMisLugares.esTokenValido(token)) {
            respuesta.sesionCaducada();
            return;
        }
        String ruta = LogicaFakeRegistro.URL_SERVIDOR + "/misDatos?desde=" + desde + "&hasta=" + hasta;
        new PeticionarioREST().hacerPeticionREST("GET", ruta, null, token,
                (codigo, cuerpo) -> notificarDatos(codigo, cuerpo, respuesta));
    }

    // Translates the REST status and parses the returned measurements.
    static void notificarDatos(int codigo, String cuerpo, Respuesta respuesta) {
        if (codigo == CODIGO_OK) {
            List<MedicionDiaria> mediciones = MedicionDiaria.listaDesdeJSON(cuerpo);
            if (mediciones == null) {
                respuesta.error("Respuesta del servidor no válida.");
            } else {
                respuesta.datosObtenidos(mediciones);
            }
        } else if (codigo == CODIGO_SIN_SENSOR) {
            respuesta.sinSensor();
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se han podido cargar tus datos (error " + codigo + ").");
        }
    }
}
