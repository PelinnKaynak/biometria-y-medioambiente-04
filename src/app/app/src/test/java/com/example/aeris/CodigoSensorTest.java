// ---------------------------------------------------------------------------
// Fichero:     CodigoSensorTest.java
// Descripción: Pruebas de CodigoSensor: lectura del código de la etiqueta del
//              sensor en «Vincular sensor». T005.
// Autores:     Equipo 04 – SenseTech
// Fecha:       11/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class CodigoSensorTest {

    @Test
    public void codigoDeLaEtiqueta_seLeeEntero() {
        CodigoSensor c = CodigoSensor.desdeTexto("092021010920 110406 03 2109 -44.75");
        assertNotNull(c);
        assertEquals("092021010920", c.numeroSerie);
        assertEquals("110406", c.modelo);
        assertEquals("03", c.gas);
        assertEquals("2109", c.fecha);
        assertEquals(-44.75, c.sensibilidad, 0.0001);
    }

    @Test
    public void espaciosDeMas_seIgnoran() {
        assertNotNull(CodigoSensor.desdeTexto("  092021010920  110406 03   2109 -44.75 \n"));
    }

    @Test
    public void escritoAMano_seLeeConComaOPunto() {
        CodigoSensor c = CodigoSensor.desdeCampos(" 092021010920 ", "-44,75");
        assertNotNull(c);
        assertEquals("092021010920", c.numeroSerie);
        assertEquals(-44.75, c.sensibilidad, 0.0001);
        assertEquals("", c.fecha);
        assertEquals(-44.75, CodigoSensor.desdeCampos("092021010920", "-44.75").sensibilidad, 0.0001);
    }

    @Test
    public void escritoAMano_noValido_null() {
        assertNull(CodigoSensor.desdeCampos("0920210109", "-44,75"));      // serie corta
        assertNull(CodigoSensor.desdeCampos("09202101092A", "-44,75"));    // letra en la serie
        assertNull(CodigoSensor.desdeCampos("092021010920", ""));          // sin sensibilidad
        assertNull(CodigoSensor.desdeCampos("092021010920", "abc"));
    }

    @Test
    public void codigoQueNoEsDeUnSensor_null() {
        assertNull(CodigoSensor.desdeTexto(null));
        assertNull(CodigoSensor.desdeTexto(""));
        assertNull(CodigoSensor.desdeTexto("https://www.ejemplo.com"));
        assertNull(CodigoSensor.desdeTexto("092021010920 110406 03 2109"));          // falta la sensibilidad
        assertNull(CodigoSensor.desdeTexto("09202101092 110406 03 2109 -44.75"));    // serie de 11 cifras
        assertNull(CodigoSensor.desdeTexto("092021010920 110406 03 2109 abc"));      // sensibilidad no numérica
    }
}
