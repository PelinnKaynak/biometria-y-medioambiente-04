// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeMiSensorTest.java
// Descripción: Tests JUnit de la lógica de la pantalla Mi sensor (T011):
//              DatosSensor (lectura del JSON, textos y JSON de luz) y
//              LogicaFakeMiSensor (respuestas de estado, luz y desvinculación).
// Autores:     Equipo 04 – SenseTech
// Fecha:       11/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Test;

public class LogicaFakeMiSensorTest {

    static final String JSON_SENSOR_VALIDO = "{\"idSensor\":\"AERIS-04\",\"conectado\":true,"
            + "\"bateria\":85,\"luz\":false,\"ultimaSincronizacion\":\"Hace 2 min\"}";

    private static class SensorApuntado implements LogicaFakeMiSensor.RespuestaSensor {
        String llamado = "";
        String mensaje = "";
        DatosSensor datos;

        @Override
        public void sensorObtenido(DatosSensor datos) {
            llamado = "sensorObtenido";
            this.datos = datos;
        }

        @Override
        public void sinSensor() {
            llamado = "sinSensor";
        }

        @Override
        public void sesionCaducada() {
            llamado = "sesionCaducada";
        }

        @Override
        public void error(String mensaje) {
            llamado = "error";
            this.mensaje = mensaje;
        }
    }

    private static class LuzApuntada implements LogicaFakeMiSensor.RespuestaLuz {
        String llamado = "";
        String mensaje = "";
        boolean encendida;

        @Override
        public void luzCambiada(boolean encendida) {
            llamado = "luzCambiada";
            this.encendida = encendida;
        }

        @Override
        public void sesionCaducada() {
            llamado = "sesionCaducada";
        }

        @Override
        public void error(String mensaje) {
            llamado = "error";
            this.mensaje = mensaje;
        }
    }

    private static class DesvincularApuntado implements LogicaFakeMiSensor.RespuestaDesvincular {
        String llamado = "";
        String mensaje = "";

        @Override
        public void sensorDesvinculado() {
            llamado = "sensorDesvinculado";
        }

        @Override
        public void sesionCaducada() {
            llamado = "sesionCaducada";
        }

        @Override
        public void error(String mensaje) {
            llamado = "error";
            this.mensaje = mensaje;
        }
    }

    // --- DatosSensor -----------------------------------------------------------

    @Test
    public void desdeJSON_leeDatosCorrectamente() {
        DatosSensor d = DatosSensor.desdeJSON(JSON_SENSOR_VALIDO);
        assertNotNull(d);
        assertEquals("AERIS-04", d.idSensor);
        assertTrue(d.conectado);
        assertEquals(85, d.bateria);
        assertFalse(d.luz);
        assertEquals("Hace 2 min", d.ultimaSincronizacion);
    }

    @Test
    public void desdeJSON_valoresPorDefecto() {
        DatosSensor d = DatosSensor.desdeJSON("{\"idSensor\":\"AERIS-01\"}");
        assertNotNull(d);
        assertEquals("AERIS-01", d.idSensor);
        assertFalse(d.conectado);
        assertEquals(0, d.bateria);
        assertFalse(d.luz);
        assertEquals("", d.ultimaSincronizacion);
    }

    @Test
    public void desdeJSON_invalidoOSinIdSensor_null() {
        assertNull(DatosSensor.desdeJSON(null));
        assertNull(DatosSensor.desdeJSON(""));
        assertNull(DatosSensor.desdeJSON("no es un json"));
        assertNull(DatosSensor.desdeJSON("{\"bateria\":85}"));
        assertNull(DatosSensor.desdeJSON("{\"idSensor\":\"\"}"));
    }

    @Test
    public void textoConexion_conectadoYDesconectado() {
        DatosSensor conectado = new DatosSensor("AERIS-04", true, 85, false, "");
        DatosSensor desconectado = new DatosSensor("AERIS-04", false, 0, false, "");
        assertEquals("Conectado", conectado.textoConexion());
        assertEquals("Desconectado", desconectado.textoConexion());
    }

    @Test
    public void textoBateria_formatoPorcentaje() {
        DatosSensor d1 = new DatosSensor("AERIS-04", true, 85, false, "");
        DatosSensor d2 = new DatosSensor("AERIS-04", true, 100, false, "");
        DatosSensor d3 = new DatosSensor("AERIS-04", false, 0, false, "");
        assertEquals("85%", d1.textoBateria());
        assertEquals("100%", d2.textoBateria());
        assertEquals("0%", d3.textoBateria());
    }

    @Test
    public void textoUltimaSincronizacion_valorODesconocida() {
        DatosSensor conFecha = new DatosSensor("AERIS-04", true, 85, false, "Hace 5 minutos");
        DatosSensor sinFecha = new DatosSensor("AERIS-04", true, 85, false, "");
        DatosSensor nula = new DatosSensor("AERIS-04", true, 85, false, null);
        assertEquals("Hace 5 minutos", conFecha.textoUltimaSincronizacion());
        assertEquals("Desconocida", sinFecha.textoUltimaSincronizacion());
        assertEquals("Desconocida", nula.textoUltimaSincronizacion());
    }

    @Test
    public void crearJSONLuz_generaCorrectamente() throws JSONException {
        String jsonTrue = DatosSensor.crearJSONLuz(true);
        String jsonFalse = DatosSensor.crearJSONLuz(false);
        assertTrue(new JSONObject(jsonTrue).getBoolean("luz"));
        assertFalse(new JSONObject(jsonFalse).getBoolean("luz"));
    }

    // --- notificarEstado -------------------------------------------------------

    @Test
    public void notificarEstado_200ConDatos_sensorObtenido() {
        SensorApuntado r = new SensorApuntado();
        LogicaFakeMiSensor.notificarEstado(200, JSON_SENSOR_VALIDO, r);
        assertEquals("sensorObtenido", r.llamado);
        assertEquals("AERIS-04", r.datos.idSensor);
    }

    @Test
    public void notificarEstado_200Invalido_error() {
        SensorApuntado r = new SensorApuntado();
        LogicaFakeMiSensor.notificarEstado(200, "{\"datos\":123}", r);
        assertEquals("error", r.llamado);
    }

    @Test
    public void notificarEstado_404_sinSensor() {
        SensorApuntado r = new SensorApuntado();
        LogicaFakeMiSensor.notificarEstado(404, "{}", r);
        assertEquals("sinSensor", r.llamado);
    }

    @Test
    public void notificarEstado_401_sesionCaducada() {
        SensorApuntado r = new SensorApuntado();
        LogicaFakeMiSensor.notificarEstado(401, "{}", r);
        assertEquals("sesionCaducada", r.llamado);
    }

    @Test
    public void notificarEstado_sinConexion_error() {
        SensorApuntado r = new SensorApuntado();
        LogicaFakeMiSensor.notificarEstado(0, "", r);
        assertEquals("error", r.llamado);
        assertEquals(LogicaFakeMiSensor.MENSAJE_SIN_CONEXION, r.mensaje);
    }

    // --- notificarLuz ----------------------------------------------------------

    @Test
    public void notificarLuz_200Y204_luzCambiada() {
        LuzApuntada r = new LuzApuntada();
        LogicaFakeMiSensor.notificarLuz(200, true, r);
        assertEquals("luzCambiada", r.llamado);
        assertTrue(r.encendida);

        LogicaFakeMiSensor.notificarLuz(204, false, r);
        assertEquals("luzCambiada", r.llamado);
        assertFalse(r.encendida);
    }

    @Test
    public void notificarLuz_401_sesionCaducada() {
        LuzApuntada r = new LuzApuntada();
        LogicaFakeMiSensor.notificarLuz(401, true, r);
        assertEquals("sesionCaducada", r.llamado);
    }

    @Test
    public void notificarLuz_sinConexion_error() {
        LuzApuntada r = new LuzApuntada();
        LogicaFakeMiSensor.notificarLuz(0, true, r);
        assertEquals("error", r.llamado);
        assertEquals(LogicaFakeMiSensor.MENSAJE_SIN_CONEXION, r.mensaje);
    }

    // --- notificarDesvinculacion -----------------------------------------------

    @Test
    public void notificarDesvinculacion_200Y204_sensorDesvinculado() {
        DesvincularApuntado r = new DesvincularApuntado();
        LogicaFakeMiSensor.notificarDesvinculacion(200, r);
        assertEquals("sensorDesvinculado", r.llamado);

        r = new DesvincularApuntado();
        LogicaFakeMiSensor.notificarDesvinculacion(204, r);
        assertEquals("sensorDesvinculado", r.llamado);
    }

    @Test
    public void notificarDesvinculacion_401_sesionCaducada() {
        DesvincularApuntado r = new DesvincularApuntado();
        LogicaFakeMiSensor.notificarDesvinculacion(401, r);
        assertEquals("sesionCaducada", r.llamado);
    }

    @Test
    public void notificarDesvinculacion_sinConexion_error() {
        DesvincularApuntado r = new DesvincularApuntado();
        LogicaFakeMiSensor.notificarDesvinculacion(0, r);
        assertEquals("error", r.llamado);
        assertEquals(LogicaFakeMiSensor.MENSAJE_SIN_CONEXION, r.mensaje);
    }
}
