// ---------------------------------------------------------------------------
// Fichero:     RecorteCentralTest.java
// Descripción: Tests de RecorteCentral (escáner propio, T039).
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class RecorteCentralTest {

    @Test
    public void ladoEsUnaParteDelLadoCorto() {
        assertEquals(648, RecorteCentral.lado(1920, 1080, 0.6));
        assertEquals(1080, RecorteCentral.lado(1920, 1080, 2.0));   // nunca más que la imagen
        assertEquals(1, RecorteCentral.lado(3, 2, 0.0));
    }

    @Test
    public void recortaElCuadradoDelCentro() {
        // 4 × 4: valor = fila * 10 + columna
        byte[] y = {0, 1, 2, 3,
                    10, 11, 12, 13,
                    20, 21, 22, 23,
                    30, 31, 32, 33};
        assertArrayEquals(new byte[]{11, 12, 21, 22}, RecorteCentral.recortar(y, 4, 4, 4, 2));
    }

    @Test
    public void saltaElRellenoDeCadaFila() {
        // 3 × 3 con pasoFila 5 (2 bytes de relleno, 99)
        byte[] y = {1, 2, 3, 99, 99,
                    4, 5, 6, 99, 99,
                    7, 8, 9, 99, 99};
        assertArrayEquals(new byte[]{5}, RecorteCentral.recortar(y, 3, 3, 5, 1));
        assertArrayEquals(new byte[]{1, 2, 3, 4, 5, 6, 7, 8, 9}, RecorteCentral.recortar(y, 3, 3, 5, 3));
    }
}
