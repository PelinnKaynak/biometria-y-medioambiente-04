// ---------------------------------------------------------------------------
// Fichero:     ValidadorLoginTest.java
// Descripción: Tests JUnit de ValidadorLogin (criterios de T003 / H002).
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Map;

public class ValidadorLoginTest {

    @Test
    public void datosCorrectos_noHayErrores() {
        assertTrue(ValidadorLogin.validar("pelin@aeris.es", "aire2026").isEmpty());
    }

    @Test
    public void camposVacios_errorEnLosDos() {
        Map<String, String> errores = ValidadorLogin.validar("  ", "");
        assertEquals(2, errores.size());
        assertEquals("Escribe tu correo electrónico.", errores.get(ValidadorLogin.CAMPO_CORREO));
        assertEquals("Escribe tu contraseña.", errores.get(ValidadorLogin.CAMPO_CONTRASENA));
    }

    @Test
    public void correoMalFormado_errorEnCorreo() {
        Map<String, String> errores = ValidadorLogin.validar("pelin@aeris", "aire2026");
        assertEquals(1, errores.size());
        assertEquals("El correo no tiene un formato válido.", errores.get(ValidadorLogin.CAMPO_CORREO));
    }

    @Test
    public void contrasenaCorta_noSeCompruebaEnElLogin() {
        // Las reglas de la contraseña solo se aplican al registrarse; aquí decide el servidor
        assertTrue(ValidadorLogin.validar("pelin@aeris.es", "abc").isEmpty());
    }

    @Test
    public void validarCorreo_paraRecuperarContrasena() {
        assertNull(ValidadorLogin.validarCorreo(" Pelin@AERIS.es "));
        assertEquals("Escribe tu correo electrónico.", ValidadorLogin.validarCorreo(""));
        assertEquals("El correo no tiene un formato válido.", ValidadorLogin.validarCorreo("pelin@"));
    }
}
