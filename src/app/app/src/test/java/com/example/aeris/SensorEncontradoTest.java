// ---------------------------------------------------------------------------
// Fichero:     SensorEncontradoTest.java
// Descripción: Tests JUnit de SensorEncontrado: textos de la señal y de la
//              distancia de cada fila de «Vincular sensor» (diseño de T005).
// Autores:     Equipo 04 – SenseTech
// Fecha:       05/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class SensorEncontradoTest {

    @Test
    public void textoSenal_fuerteMediaDebil() {
        assertEquals("Señal fuerte", SensorEncontrado.textoSenal(-45));
        assertEquals("Señal fuerte", SensorEncontrado.textoSenal(-60));
        assertEquals("Señal media", SensorEncontrado.textoSenal(-61));
        assertEquals("Señal media", SensorEncontrado.textoSenal(-75));
        assertEquals("Señal débil", SensorEncontrado.textoSenal(-76));
    }

    @Test
    public void textoDistancia_decimalConComaPorDebajoDeUnMetro() {
        assertEquals("a 0,5 m", SensorEncontrado.textoDistancia(0.5));
        assertEquals("a 0,8 m", SensorEncontrado.textoDistancia(0.84));
        assertEquals("a 2 m", SensorEncontrado.textoDistancia(2.2));
        assertEquals("a 6 m", SensorEncontrado.textoDistancia(5.6));
    }

    @Test
    public void detalle_comoEnFigma() {
        assertEquals("Señal fuerte · a 0,5 m", new SensorEncontrado("AERIS N-0412", -55, 0.5).detalle());
        assertEquals("Señal débil · a 6 m", new SensorEncontrado("AERIS N-1130", -85, 6).detalle());
    }
}
