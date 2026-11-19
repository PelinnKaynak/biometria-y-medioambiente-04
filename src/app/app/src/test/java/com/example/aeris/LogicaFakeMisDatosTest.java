package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.List;

public class LogicaFakeMisDatosTest {

    private static class RespuestaApuntada implements LogicaFakeMisDatos.Respuesta {
        String llamada = "";
        String mensaje = "";
        List<MedicionDiaria> mediciones;

        @Override
        public void datosObtenidos(List<MedicionDiaria> mediciones) {
            llamada = "datosObtenidos";
            this.mediciones = mediciones;
        }

        @Override
        public void sinSensor() {
            llamada = "sinSensor";
        }

        @Override
        public void sesionCaducada() {
            llamada = "sesionCaducada";
        }

        @Override
        public void error(String mensaje) {
            llamada = "error";
            this.mensaje = mensaje;
        }
    }

    @Test
    public void notificarDatos_interpretaExitoSinSensorSesionYErrores() {
        RespuestaApuntada exito = new RespuestaApuntada();
        LogicaFakeMisDatos.notificarDatos(200,
                "[{\"valor\":84,\"fecha\":\"2026-11-19T10:00:00Z\",\"latitud\":38.9,\"longitud\":-0.1}]",
                exito);
        assertEquals("datosObtenidos", exito.llamada);
        assertEquals(1, exito.mediciones.size());

        RespuestaApuntada vacio = new RespuestaApuntada();
        LogicaFakeMisDatos.notificarDatos(200, "[]", vacio);
        assertEquals("datosObtenidos", vacio.llamada);
        assertTrue(vacio.mediciones.isEmpty());

        RespuestaApuntada sinSensor = new RespuestaApuntada();
        LogicaFakeMisDatos.notificarDatos(404, "", sinSensor);
        assertEquals("sinSensor", sinSensor.llamada);

        RespuestaApuntada sesion = new RespuestaApuntada();
        LogicaFakeMisDatos.notificarDatos(401, "", sesion);
        assertEquals("sesionCaducada", sesion.llamada);

        RespuestaApuntada error = new RespuestaApuntada();
        LogicaFakeMisDatos.notificarDatos(0, "", error);
        assertEquals("error", error.llamada);
        assertTrue(error.mensaje.contains("conexión"));

        RespuestaApuntada respuestaInvalida = new RespuestaApuntada();
        LogicaFakeMisDatos.notificarDatos(200, "no es JSON", respuestaInvalida);
        assertEquals("error", respuestaInvalida.llamada);
    }

    @Test
    public void obtenerDatos_sinTokenNoHacePeticion() {
        RespuestaApuntada respuesta = new RespuestaApuntada();

        new LogicaFakeMisDatos().obtenerDatos(null, 0, 1, respuesta);

        assertEquals("sesionCaducada", respuesta.llamada);
    }
}
