// ---------------------------------------------------------------------------
// Fichero:     UuidAERISTest.java
// Descripción: Tests de UuidAERIS (luz de aviso del sensor, H033).
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import org.junit.Test;

public class UuidAERISTest {

    @Test
    public void losMismosUuidQueElNodo() {
        // Los bytes del UUID son las letras del nombre, como en ServicioLuz.h
        assertEquals("41455249-532d-5345-5256-4943494f2d31", UuidAERIS.desdeTexto("AERIS-SERVICIO-1").toString());
        assertEquals("41455249-532d-4c55-5a2d-414354495641", UuidAERIS.desdeTexto("AERIS-LUZ-ACTIVA").toString());
    }

    @Test
    public void elNombreTieneQueTener16Letras() {
        assertThrows(IllegalArgumentException.class, () -> UuidAERIS.desdeTexto("AERIS"));
        assertThrows(IllegalArgumentException.class, () -> UuidAERIS.desdeTexto("AERIS-LUZ-ACTIVA-2"));
    }
}
