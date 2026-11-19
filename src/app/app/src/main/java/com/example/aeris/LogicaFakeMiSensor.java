package com.example.aeris;

public class LogicaFakeMiSensor {

    static final boolean USAR_DATOS_DE_EJEMPLO = false;
    private static volatile boolean sensorDeEjemploVinculado = true;

    static final int CODIGO_OK = 200;
    static final int CODIGO_DESVINCULADO = 204;
    static final int CODIGO_SIN_SENSOR = 404;
    static final int CODIGO_SIN_SESION = 401;
    static final int CODIGO_SIN_CONEXION = 0;

    static final String MENSAJE_SIN_CONEXION = "No hay conexión con el servidor. Inténtalo de nuevo.";

    private final boolean usarDatosDeEjemplo;

    public LogicaFakeMiSensor() {
        this(USAR_DATOS_DE_EJEMPLO);
    }

    LogicaFakeMiSensor(boolean usarDatosDeEjemplo) {
        this.usarDatosDeEjemplo = usarDatosDeEjemplo;
    }

    public interface RespuestaSensor {
        void sensorObtenido(SensorUsuario sensor);
        void sinSensor();
        void sesionCaducada();
        void error(String mensaje);
    }

    public interface RespuestaDesvinculacion {
        void sensorDesvinculado();
        void sesionCaducada();
        void error(String mensaje);
    }

    public void obtenerMiSensor(String token, final RespuestaSensor respuesta) {
        if (usarDatosDeEjemplo) {
            if (sensorDeEjemploVinculado) {
                respuesta.sensorObtenido(sensorDeEjemplo(System.currentTimeMillis()));
            } else {
                respuesta.sinSensor();
            }
            return;
        }
        new PeticionarioREST().hacerPeticionREST("GET",
                LogicaFakeRegistro.URL_SERVIDOR + "/miSensor", null, token,
                (codigo, cuerpo) -> notificarSensor(codigo, cuerpo, respuesta));
    }

    public void desvincularMiSensor(String token, final RespuestaDesvinculacion respuesta) {
        if (usarDatosDeEjemplo) {
            sensorDeEjemploVinculado = false;
            respuesta.sensorDesvinculado();
            return;
        }
        new PeticionarioREST().hacerPeticionREST("DELETE",
                LogicaFakeRegistro.URL_SERVIDOR + "/miSensor", null, token,
                (codigo, cuerpo) -> notificarDesvinculacion(codigo, respuesta));
    }

    static SensorUsuario sensorDeEjemplo(long ahoraMs) {
        return new SensorUsuario("Sensor AERIS", "092021010920", 78, ahoraMs - 15L * 60L * 1000L);
    }

    static void restablecerSensorDeEjemplo() {
        sensorDeEjemploVinculado = true;
    }

    static void notificarSensor(int codigo, String cuerpo, RespuestaSensor respuesta) {
        if (codigo == CODIGO_OK) {
            SensorUsuario sensor = SensorUsuario.desdeJSON(cuerpo);
            if (sensor != null) {
                respuesta.sensorObtenido(sensor);
            } else {
                respuesta.error("Respuesta del servidor no válida.");
            }
        } else if (codigo == CODIGO_SIN_SENSOR) {
            respuesta.sinSensor();
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se ha podido cargar tu sensor (error " + codigo + ").");
        }
    }

    static void notificarDesvinculacion(int codigo, RespuestaDesvinculacion respuesta) {
        if (codigo == CODIGO_DESVINCULADO) {
            respuesta.sensorDesvinculado();
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se ha podido desvincular el sensor (error " + codigo + ").");
        }
    }
}
