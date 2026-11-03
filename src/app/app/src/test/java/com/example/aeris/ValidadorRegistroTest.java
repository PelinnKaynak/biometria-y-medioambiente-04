// ---------------------------------------------------------------------------
// Fichero:     ValidadorRegistroTest.java
// Descripción: Tests JUnit de ValidadorRegistro (criterios de T002 / H001).
//              Se ejecutan sin teléfono: ./gradlew test desde src/app.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Map;

public class ValidadorRegistroTest {

    private static Map<String, String> validarCon(String nombre, String apellidos, String correo,
                                                  String contrasena, String confirmacion) {
        return ValidadorRegistro.validar(nombre, apellidos, correo, contrasena, confirmacion);
    }

    @Test
    public void datosValidos_noHayErrores() {
        assertTrue(validarCon("Pelin", "Kaynak", "pelin@aeris.es", "aire2026", "aire2026").isEmpty());
    }

    @Test
    public void camposVacios_indicaCadaCampoQueFalta() {
        Map<String, String> errores = validarCon("", "  ", "", "", "");
        assertEquals(5, errores.size());
        assertTrue(errores.containsKey(ValidadorRegistro.CAMPO_NOMBRE));
        assertTrue(errores.containsKey(ValidadorRegistro.CAMPO_APELLIDOS));
        assertTrue(errores.containsKey(ValidadorRegistro.CAMPO_CORREO));
        assertTrue(errores.containsKey(ValidadorRegistro.CAMPO_CONTRASENA));
        assertTrue(errores.containsKey(ValidadorRegistro.CAMPO_CONFIRMACION));
    }

    @Test
    public void soloFaltaUnCampo_soloHayUnError() {
        Map<String, String> errores = validarCon("Pelin", "", "pelin@aeris.es", "aire2026", "aire2026");
        assertEquals(1, errores.size());
        assertTrue(errores.containsKey(ValidadorRegistro.CAMPO_APELLIDOS));
    }

    @Test
    public void contrasenasDistintas_errorEnConfirmacion() {
        Map<String, String> errores = validarCon("Pelin", "Kaynak", "pelin@aeris.es", "aire2026", "aire2027");
        assertEquals(1, errores.size());
        assertEquals("Las contraseñas no coinciden.", errores.get(ValidadorRegistro.CAMPO_CONFIRMACION));
    }

    @Test
    public void contrasenaCorta_noEsSegura() {
        assertFalse(ValidadorRegistro.esContrasenaSegura("aire26"));
    }

    @Test
    public void contrasenaSinNumero_noEsSegura() {
        assertFalse(ValidadorRegistro.esContrasenaSegura("airelimpio"));
    }

    @Test
    public void contrasenaSinLetra_noEsSegura() {
        assertFalse(ValidadorRegistro.esContrasenaSegura("12345678"));
    }

    @Test
    public void contrasenaConLetraYNumeroY8Caracteres_esSegura() {
        assertTrue(ValidadorRegistro.esContrasenaSegura("aire2026"));
    }

    @Test
    public void correosValidosEInvalidos() {
        assertTrue(ValidadorRegistro.esCorreoValido("pelin@aeris.es"));
        assertTrue(ValidadorRegistro.esCorreoValido("  pelin.kaynak@upv.edu.es  "));
        assertFalse(ValidadorRegistro.esCorreoValido("pelin@aeris"));
        assertFalse(ValidadorRegistro.esCorreoValido("pelinaeris.es"));
        assertFalse(ValidadorRegistro.esCorreoValido("pelin @aeris.es"));
    }

    @Test
    public void correoMalEscrito_errorEnCorreo() {
        Map<String, String> errores = validarCon("Pelin", "Kaynak", "pelin@", "aire2026", "aire2026");
        assertEquals("El correo no tiene un formato válido.", errores.get(ValidadorRegistro.CAMPO_CORREO));
    }
}
