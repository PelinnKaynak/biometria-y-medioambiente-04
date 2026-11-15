// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeMisDatosTest.java
// Descripción: Tests JUnit de la lógica de la pantalla «Mis datos» (T007):
//              ResumenMisDatos (cálculo de promedios, calidad del aire,
//              formato de distancia recorrida) y LogicaFakeMisDatos (respuestas
//              del servidor, aviso de sensor y comprobación de sesión).
// Autores:     Equipo 04 – SenseTech
// Fecha:       15/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class LogicaFakeMisDatosTest {

    private static class ResumenApuntado implements LogicaFakeMisDatos.RespuestaMisDatos {
        String llamado = "";
        String mensaje = "";
        ResumenMisDatos datos;

        @Override
        public void datosObtenidos(ResumenMisDatos datos) {
            this.llamado = "datosObtenidos";
            this.datos = datos;
        }

        @Override
        public void sesionCaducada() {
            this.llamado = "sesionCaducada";
        }

        @Override
        public void error(String mensaje) {
            this.llamado = "error";
            this.mensaje = mensaje;
        }
    }

    // --- ResumenMisDatos -------------------------------------------------------

    @Test
    public void textoDistancia_formatoCorrecto() {
        ResumenMisDatos r0 = new ResumenMisDatos(0.0, 50, "50 µg/m³", Collections.emptyList(), true);
        ResumenMisDatos r1 = new ResumenMisDatos(4.2, 50, "50 µg/m³", Collections.emptyList(), true);
        ResumenMisDatos r2 = new ResumenMisDatos(12.0, 50, "50 µg/m³", Collections.emptyList(), true);

        assertEquals("0 km", r0.textoDistancia());
        assertEquals("4,2 km", r1.textoDistancia());
        assertEquals("12,0 km", r2.textoDistancia());
    }

    @Test
    public void calcularDesdeMediciones_promediosYNiveles() {
        List<Medicion> listaBuena = new ArrayList<>();
        listaBuena.add(new Medicion(60, 1000));
        listaBuena.add(new Medicion(80, 2000));
        listaBuena.add(new Medicion(100, 3000));

        ResumenMisDatos resBueno = ResumenMisDatos.calcularDesdeMediciones(listaBuena, 3.5, true);
        assertEquals(80.0, resBueno.ozonoMedio, 0.01);
        assertEquals(NivelOzono.BUENO, resBueno.nivelCalidadMedia());
        assertEquals("Buena", resBueno.textoCalidadMedia());
        assertEquals("80 µg/m³", resBueno.textoOzonoRespirado());
        assertTrue(resBueno.tieneMediciones());

        List<Medicion> listaModerada = new ArrayList<>();
        listaModerada.add(new Medicion(120, 1000));
        listaModerada.add(new Medicion(150, 2000));

        ResumenMisDatos resMod = ResumenMisDatos.calcularDesdeMediciones(listaModerada, 5.0, true);
        assertEquals(135.0, resMod.ozonoMedio, 0.01);
        assertEquals(NivelOzono.MODERADO, resMod.nivelCalidadMedia());
        assertEquals("Moderada", resMod.textoCalidadMedia());

        List<Medicion> listaMala = Collections.singletonList(new Medicion(210, 1000));
        ResumenMisDatos resMalo = ResumenMisDatos.calcularDesdeMediciones(listaMala, 1.0, true);
        assertEquals(NivelOzono.MALO, resMalo.nivelCalidadMedia());
        assertEquals("Mala", resMalo.textoCalidadMedia());
    }

    @Test
    public void calcularDesdeMediciones_vacia() {
        ResumenMisDatos resVacio = ResumenMisDatos.calcularDesdeMediciones(Collections.emptyList(), 0.0, true);
        assertEquals(0.0, resVacio.ozonoMedio, 0.01);
        assertEquals("0 km", resVacio.textoDistancia());
        assertEquals("0 µg/m³", resVacio.textoOzonoRespirado());
        assertFalse(resVacio.tieneMediciones());
    }

    @Test
    public void desdeJSON_parseaCorrectamente() {
        String json = "{\"distanciaKm\":5.2,\"ozonoMedio\":75.0,\"ozonoRespirado\":\"75 µg/m³\",\"mediciones\":[]}";
        ResumenMisDatos r = ResumenMisDatos.desdeJSON(json, true);
        assertNotNull(r);
        assertEquals(5.2, r.distanciaKm, 0.01);
        assertEquals("5,2 km", r.textoDistancia());
        assertEquals(75.0, r.ozonoMedio, 0.01);
        assertEquals("Buena", r.textoCalidadMedia());
        assertTrue(r.tieneSensor);

        assertNull(ResumenMisDatos.desdeJSON(null, true));
        assertNull(ResumenMisDatos.desdeJSON("", true));
        assertNull(ResumenMisDatos.desdeJSON("invalido", true));
    }

    // --- LogicaFakeMisDatos ----------------------------------------------------

    @Test
    public void notificarResumen_200_datosObtenidos() {
        ResumenApuntado r = new ResumenApuntado();
        String json = "{\"distanciaKm\":3.0,\"ozonoMedio\":82.0,\"ozonoRespirado\":\"82 µg/m³\"}";
        LogicaFakeMisDatos.notificarResumen(200, json, true, r);
        assertEquals("datosObtenidos", r.llamado);
        assertNotNull(r.datos);
        assertEquals(3.0, r.datos.distanciaKm, 0.01);
    }

    @Test
    public void notificarResumen_401_sesionCaducada() {
        ResumenApuntado r = new ResumenApuntado();
        LogicaFakeMisDatos.notificarResumen(401, "{}", true, r);
        assertEquals("sesionCaducada", r.llamado);
    }

    @Test
    public void notificarResumen_0_sinConexion() {
        ResumenApuntado r = new ResumenApuntado();
        LogicaFakeMisDatos.notificarResumen(0, "", true, r);
        assertEquals("error", r.llamado);
        assertEquals(LogicaFakeMisDatos.MENSAJE_SIN_CONEXION, r.mensaje);
    }

    @Test
    public void obtenerDatosHoy_sinToken_sesionCaducada() {
        ResumenApuntado r = new ResumenApuntado();
        LogicaFakeMisDatos logica = new LogicaFakeMisDatos();
        logica.obtenerDatosHoy(null, true, r);
        assertEquals("sesionCaducada", r.llamado);

        r = new ResumenApuntado();
        logica.obtenerDatosHoy("   ", true, r);
        assertEquals("sesionCaducada", r.llamado);
    }

    @Test
    public void obtenerDatosHoy_sinSensor_retornaTieneSensorFalse() {
        ResumenApuntado r = new ResumenApuntado();
        LogicaFakeMisDatos logica = new LogicaFakeMisDatos();
        logica.obtenerDatosHoy("token_valido", false, r);
        assertEquals("datosObtenidos", r.llamado);
        assertNotNull(r.datos);
        assertFalse(r.datos.tieneSensor);
        assertEquals("0 km", r.datos.textoDistancia());
    }

    @Test
    public void datosDeEjemplo_conSensor_tieneMedicionesYDistancia() {
        ResumenMisDatos r = LogicaFakeMisDatos.datosDeEjemplo(System.currentTimeMillis(), true);
        assertTrue(r.tieneSensor);
        assertTrue(r.distanciaKm > 0);
        assertTrue(r.tieneMediciones());
        assertEquals("4,2 km", r.textoDistancia());
        assertEquals(LogicaFakeMisDatos.VALORES_HOY_EJEMPLO.length, r.medicionesHoy.size());
    }
}
