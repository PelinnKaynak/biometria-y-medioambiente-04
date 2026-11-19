// ---------------------------------------------------------------------------
// Fichero:     TramaAERISTest.java
// Descripción: Tests de TramaAERIS (recepción por Bluetooth, T023).
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class TramaAERISTest {

    // Datos del fabricante como los envía Publicador.h: tipo, contador y valor
    static byte[] trama(String serie, int tipo, int contador, int valor) {
        byte[] d = new byte[TramaAERIS.LARGO];
        System.arraycopy(TramaAERIS.PREFIJO, 0, d, 0, TramaAERIS.PREFIJO.length);
        for (int i = 0; i < serie.length(); i++) {
            d[6 + i] = (byte) serie.charAt(i);
        }
        d[18] = (byte) tipo;
        d[19] = (byte) contador;
        d[20] = (byte) (valor >> 8);
        d[21] = (byte) valor;
        d[22] = 4;          // txPower
        return d;
    }

    @Test
    public void leeSerieTipoContadorYValor() {
        TramaAERIS t = TramaAERIS.leer(trama("092021011003", TramaAERIS.OZONO, 200, 84));
        assertEquals("092021011003", t.numeroSerie);
        assertEquals(TramaAERIS.OZONO, t.tipo);
        assertEquals(200, t.contador);
        assertEquals(84, t.valor);
        assertTrue(t.esOzono());
    }

    @Test
    public void elValorTieneSigno() {
        TramaAERIS t = TramaAERIS.leer(trama("092021011003", TramaAERIS.TEMPERATURA, 7, -35));   // -3,5 °C
        assertEquals(-35, t.valor);
        assertFalse(t.esOzono());
        assertEquals(1500, TramaAERIS.leer(trama("092021011003", TramaAERIS.OZONO, 1, 1500)).valor);
    }

    @Test
    public void loQueNoEsUnaTramaAERISEsNull() {
        assertNull(TramaAERIS.leer(null));
        assertNull(TramaAERIS.leer(new byte[5]));
        byte[] otroBeacon = trama("092021011003", TramaAERIS.OZONO, 1, 84);
        otroBeacon[2] = 'E';                                   // "EERI": no es AERIS
        assertNull(TramaAERIS.leer(otroBeacon));
        assertNull(TramaAERIS.leer(trama("09202101100X", TramaAERIS.OZONO, 1, 84)));
    }
}
