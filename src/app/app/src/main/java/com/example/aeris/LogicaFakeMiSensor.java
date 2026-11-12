// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeMiSensor.java
// Descripción: Lógica fake del teléfono para la pantalla de Mi sensor. Gestiona
//              la consulta de estado (GET /miSensor), el cambio de luz LED
//              (POST /cambiarLuzSensor) y la desvinculación (POST /desvincularSensor).
//              Hasta disponer de Bluetooth y endpoints reales, mantiene un estado
//              simulado interactivo. Diseño en doc/app_design.md. Tarea T011.
// Autores:     Equipo 04 – SenseTech
// Fecha:       11/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONException;

// LogicaFakeMiSensor class: fake phone logic for sensor status, light control, and unlinking.
public class LogicaFakeMiSensor {

    static final int CODIGO_OK = 200;
    static final int CODIGO_GUARDADO = 204;
    static final int CODIGO_SIN_SESION = 401;
    static final int CODIGO_NO_ENCONTRADO = 404;
    static final int CODIGO_SIN_CONEXION = 0;

    static final String MENSAJE_SIN_CONEXION = "No hay conexión con el servidor. Inténtalo de nuevo.";

    // Estado simulado en memoria para la maqueta previa de la pantalla (T011)
    private static boolean sensorVinculado = true;
    private static DatosSensor estadoSimulado = new DatosSensor("AERIS-04", true, 85, false, "Hace 2 min");

    // -----------------------------------------------------------------------
    // Callback de obtenerEstadoSensor()
    // -----------------------------------------------------------------------
    public interface RespuestaSensor {
        // datos: DatosSensor --> sensorObtenido() -->     (200 con datos válidos)
        void sensorObtenido(DatosSensor datos);
        // sinSensor() -->                                 (404 o no tiene sensor)
        void sinSensor();
        // sesionCaducada() -->                            (401)
        void sesionCaducada();
        // mensaje: Text --> error() -->                   (error del servidor o conexión)
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // Callback de cambiarLuz()
    // -----------------------------------------------------------------------
    public interface RespuestaLuz {
        // encendida: B --> luzCambiada() -->              (200 o 204)
        void luzCambiada(boolean encendida);
        // sesionCaducada() -->                            (401)
        void sesionCaducada();
        // mensaje: Text --> error() -->                   (error)
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // Callback de desvincularSensor()
    // -----------------------------------------------------------------------
    public interface RespuestaDesvincular {
        // sensorDesvinculado() -->                        (200 o 204)
        void sensorDesvinculado();
        // sesionCaducada() -->                            (401)
        void sesionCaducada();
        // mensaje: Text --> error() -->                   (error)
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // token: Text --> obtenerEstadoSensor() -->
    // What it does: requests the sensor data. If the server is not ready or returns 0,
    //               falls back to the interactive simulated state for UI testing.
    // -----------------------------------------------------------------------
    public void obtenerEstadoSensor(String token, final RespuestaSensor respuesta) {
        new PeticionarioREST().hacerPeticionREST("GET",
                LogicaFakeRegistro.URL_SERVIDOR + "/miSensor", null, token,
                (codigo, cuerpo) -> {
                    if (codigo == CODIGO_SIN_CONEXION) {
                        // En modo simulación/maqueta previa (sin backend aún):
                        if (sensorVinculado) {
                            respuesta.sensorObtenido(estadoSimulado);
                        } else {
                            respuesta.sinSensor();
                        }
                    } else {
                        notificarEstado(codigo, cuerpo, respuesta);
                    }
                });
    }

    // -----------------------------------------------------------------------
    // token: Text, encendida: B --> cambiarLuz() -->
    // What it does: sends POST /cambiarLuzSensor {"luz": true|false}. If offline,
    //               updates the simulated state so the switch responds.
    // -----------------------------------------------------------------------
    public void cambiarLuz(String token, boolean encendida, final RespuestaLuz respuesta) {
        String cuerpo;
        try {
            cuerpo = DatosSensor.crearJSONLuz(encendida);
        } catch (JSONException error) {
            respuesta.error("No se pudo preparar la petición.");
            return;
        }

        new PeticionarioREST().hacerPeticionREST("POST",
                LogicaFakeRegistro.URL_SERVIDOR + "/cambiarLuzSensor", cuerpo, token,
                (codigo, cuerpoRespuesta) -> {
                    if (codigo == CODIGO_SIN_CONEXION) {
                        // Simulación previa
                        estadoSimulado = new DatosSensor(
                                estadoSimulado.idSensor,
                                estadoSimulado.conectado,
                                estadoSimulado.bateria,
                                encendida,
                                "Ahora mismo");
                        respuesta.luzCambiada(encendida);
                    } else {
                        notificarLuz(codigo, encendida, respuesta);
                    }
                });
    }

    // -----------------------------------------------------------------------
    // token: Text --> desvincularSensor() -->
    // What it does: sends POST /desvincularSensor. If offline, unbinds the simulated
    //               sensor state so the user can verify the unbind flow.
    // -----------------------------------------------------------------------
    public void desvincularSensor(String token, final RespuestaDesvincular respuesta) {
        new PeticionarioREST().hacerPeticionREST("POST",
                LogicaFakeRegistro.URL_SERVIDOR + "/desvincularSensor", null, token,
                (codigo, cuerpoRespuesta) -> {
                    if (codigo == CODIGO_SIN_CONEXION) {
                        sensorVinculado = false;
                        respuesta.sensorDesvinculado();
                    } else {
                        notificarDesvinculacion(codigo, respuesta);
                    }
                });
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text --> notificarEstado() --x
    // What it does: 200 with valid data -> sensorObtenido(); 404 -> sinSensor();
    //               401 -> sesionCaducada(); 0 -> error(sin conexion); other -> error().
    // -----------------------------------------------------------------------
    static void notificarEstado(int codigo, String cuerpo, RespuestaSensor respuesta) {
        if (codigo == CODIGO_OK) {
            DatosSensor datos = DatosSensor.desdeJSON(cuerpo);
            if (datos != null) {
                respuesta.sensorObtenido(datos);
            } else {
                respuesta.error("Respuesta del servidor no válida.");
            }
        } else if (codigo == CODIGO_NO_ENCONTRADO) {
            respuesta.sinSensor();
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se ha podido cargar el sensor (error " + codigo + ").");
        }
    }

    // -----------------------------------------------------------------------
    // codigo: Z, encendida: B --> notificarLuz() --x
    // What it does: 200/204 -> luzCambiada(); 401 -> sesionCaducada();
    //               0 -> error(sin conexion); other -> error().
    // -----------------------------------------------------------------------
    static void notificarLuz(int codigo, boolean encendida, RespuestaLuz respuesta) {
        if (codigo == CODIGO_OK || codigo == CODIGO_GUARDADO) {
            respuesta.luzCambiada(encendida);
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se pudo cambiar la luz del sensor (error " + codigo + ").");
        }
    }

    // -----------------------------------------------------------------------
    // codigo: Z --> notificarDesvinculacion() --x
    // What it does: 200/204 -> sensorDesvinculado(); 401 -> sesionCaducada();
    //               0 -> error(sin conexion); other -> error().
    // -----------------------------------------------------------------------
    static void notificarDesvinculacion(int codigo, RespuestaDesvincular respuesta) {
        if (codigo == CODIGO_OK || codigo == CODIGO_GUARDADO) {
            respuesta.sensorDesvinculado();
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se pudo desvincular el sensor (error " + codigo + ").");
        }
    }

    // Métodos auxiliares para reiniciar el estado simulado en tests si fuese necesario
    static void reiniciarSimulacion() {
        sensorVinculado = true;
        estadoSimulado = new DatosSensor("AERIS-04", true, 85, false, "Hace 2 min");
    }

    static DatosSensor obtenerEstadoSimulado() {
        return estadoSimulado;
    }

    static boolean estaSensorVinculado() {
        return sensorVinculado;
    }
}
