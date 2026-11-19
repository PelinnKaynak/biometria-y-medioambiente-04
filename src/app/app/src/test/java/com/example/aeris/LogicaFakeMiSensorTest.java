package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class LogicaFakeMiSensorTest {

    private static class SensorApuntado implements LogicaFakeMiSensor.RespuestaSensor {
        String llamado = "";
        String mensaje = "";
        SensorUsuario sensor;
        @Override public void sensorObtenido(SensorUsuario sensor) {
            llamado = "sensorObtenido";
            this.sensor = sensor;
        }
        @Override public void sinSensor() { llamado = "sinSensor"; }
        @Override public void sesionCaducada() { llamado = "sesionCaducada"; }
        @Override public void error(String mensaje) {
            llamado = "error";
            this.mensaje = mensaje;
        }
    }

    private static class DesvinculacionApuntada implements LogicaFakeMiSensor.RespuestaDesvinculacion {
        String llamado = "";
        String mensaje = "";
        @Override public void sensorDesvinculado() { llamado = "sensorDesvinculado"; }
        @Override public void sesionCaducada() { llamado = "sesionCaducada"; }
        @Override public void error(String mensaje) {
            llamado = "error";
            this.mensaje = mensaje;
        }
    }

    @Test
    public void desdeJSON_leeDatosYPermiteBateriaNoDisponible() {
        SensorUsuario sensor = SensorUsuario.desdeJSON(
                "{\"nombre\":\"AERIS\",\"numeroSerie\":\"092021010920\",\"bateria\":null,"
                        + "\"ultimaConexion\":\"2026-11-18T12:00:00.000Z\"}");
        assertEquals("AERIS", sensor.nombre);
        assertEquals("092021010920", sensor.numeroSerie);
        assertNull(sensor.bateria);
        assertEquals(Long.valueOf(1795003200000L), sensor.ultimaConexionMs);

        SensorUsuario conBateria = SensorUsuario.desdeJSON(
                "{\"nombre\":\"AERIS\",\"numeroSerie\":\"092021010920\",\"bateria\":73,"
                        + "\"ultimaConexion\":null}");
        assertEquals(Integer.valueOf(73), conBateria.bateria);
        assertNull(conBateria.ultimaConexionMs);
    }

    @Test
    public void conectado_dependeDeUnaSincronizacionDeLasUltimas24Horas() {
        long ahora = 1_800_000_000_000L;
        SensorUsuario reciente = new SensorUsuario("AERIS", "serie", null, ahora - 1000L);
        SensorUsuario antiguo = new SensorUsuario("AERIS", "serie", null,
                ahora - SensorUsuario.UMBRAL_CONEXION_MS - 1L);
        SensorUsuario sinConexion = new SensorUsuario("AERIS", "serie", null, null);

        assertTrue(reciente.estaConectado(ahora));
        assertFalse(antiguo.estaConectado(ahora));
        assertFalse(sinConexion.estaConectado(ahora));
        assertFalse(reciente.estaConectado(ahora - 2000L));
    }

    @Test
    public void desdeJSON_rechazaDatosInvalidos() {
        assertNull(SensorUsuario.desdeJSON(null));
        assertNull(SensorUsuario.desdeJSON("no es json"));
        assertNull(SensorUsuario.desdeJSON(
                "{\"nombre\":\"AERIS\",\"numeroSerie\":\"serie\",\"bateria\":101,\"ultimaConexion\":null}"));
        assertNull(SensorUsuario.desdeJSON(
                "{\"nombre\":\"AERIS\",\"numeroSerie\":\"serie\",\"bateria\":null,\"ultimaConexion\":\"ayer\"}"));
    }

    @Test
    public void obtenerSensor_interpretaExitoSinSensorSesionYErrores() {
        SensorApuntado exito = new SensorApuntado();
        LogicaFakeMiSensor.notificarSensor(200,
                "{\"nombre\":\"AERIS\",\"numeroSerie\":\"serie\",\"bateria\":null,\"ultimaConexion\":null}", exito);
        assertEquals("sensorObtenido", exito.llamado);
        assertEquals("serie", exito.sensor.numeroSerie);

        SensorApuntado sinSensor = new SensorApuntado();
        LogicaFakeMiSensor.notificarSensor(404, "", sinSensor);
        assertEquals("sinSensor", sinSensor.llamado);

        SensorApuntado sesion = new SensorApuntado();
        LogicaFakeMiSensor.notificarSensor(401, "", sesion);
        assertEquals("sesionCaducada", sesion.llamado);

        SensorApuntado error = new SensorApuntado();
        LogicaFakeMiSensor.notificarSensor(200, "{}", error);
        assertEquals("error", error.llamado);
    }

    @Test
    public void desvinculacion_interpreta204401YError() {
        DesvinculacionApuntada exito = new DesvinculacionApuntada();
        LogicaFakeMiSensor.notificarDesvinculacion(204, exito);
        assertEquals("sensorDesvinculado", exito.llamado);

        DesvinculacionApuntada sesion = new DesvinculacionApuntada();
        LogicaFakeMiSensor.notificarDesvinculacion(401, sesion);
        assertEquals("sesionCaducada", sesion.llamado);

        DesvinculacionApuntada error = new DesvinculacionApuntada();
        LogicaFakeMiSensor.notificarDesvinculacion(500, error);
        assertEquals("error", error.llamado);
        assertTrue(error.mensaje.contains("500"));
    }

    @Test
    public void modoDeEjemplo_muestraDatosYPermiteDesvincular() {
        LogicaFakeMiSensor.restablecerSensorDeEjemplo();
        try {
            LogicaFakeMiSensor logica = new LogicaFakeMiSensor(true);
            SensorApuntado cargado = new SensorApuntado();
            logica.obtenerMiSensor(null, cargado);
            assertEquals("sensorObtenido", cargado.llamado);
            assertEquals(Integer.valueOf(78), cargado.sensor.bateria);

            DesvinculacionApuntada desvinculado = new DesvinculacionApuntada();
            logica.desvincularMiSensor(null, desvinculado);
            assertEquals("sensorDesvinculado", desvinculado.llamado);

            SensorApuntado sinSensor = new SensorApuntado();
            logica.obtenerMiSensor(null, sinSensor);
            assertEquals("sinSensor", sinSensor.llamado);
        } finally {
            LogicaFakeMiSensor.restablecerSensorDeEjemplo();
        }
    }

    @Test
    public void luzSimulada_cambiaYSeApagaAlDesvincular() {
        LuzSensorSimulada luz = new LuzSensorSimulada(false);
        luz.establecer(true);
        assertTrue(luz.estaEncendida());
        luz.establecer(false);
        assertFalse(luz.estaEncendida());
        luz.establecer(true);
        luz.desvincular();
        assertFalse(luz.estaEncendida());
    }
}
