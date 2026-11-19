// ---------------------------------------------------------------------------
// Fichero:     PermisosMedicionTest.java
// Descripción: Tests de PermisosMedicion (T023).
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertArrayEquals;

import org.junit.Test;

public class PermisosMedicionTest {

    private static final String P = PermisosMedicion.UBICACION_PRECISA;
    private static final String A = PermisosMedicion.UBICACION_APROXIMADA;
    private static final String B = PermisosMedicion.BUSCAR_BLUETOOTH;
    private static final String N = PermisosMedicion.NOTIFICACIONES;

    @Test
    public void segunLaVersionDeAndroid() {
        assertArrayEquals(new String[]{P, A}, PermisosMedicion.obligatorios(29));       // Android 10
        assertArrayEquals(new String[]{P, A}, PermisosMedicion.aPedir(30));
        assertArrayEquals(new String[]{P, A, B}, PermisosMedicion.obligatorios(31));    // Android 12
        assertArrayEquals(new String[]{P, A, B}, PermisosMedicion.aPedir(32));
        assertArrayEquals(new String[]{P, A, B}, PermisosMedicion.obligatorios(35));
        assertArrayEquals(new String[]{P, A, B, N}, PermisosMedicion.aPedir(33));       // Android 13
    }
}
