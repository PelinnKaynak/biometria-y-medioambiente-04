// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeEditarDatosTest.java
// Descripción: Tests JUnit de «Editar mis datos» (T010): ValidadorEditarDatos
//              (datos y cambio de contraseña) y LogicaFakeEditarDatos (JSON
//              enviado y respuesta según el código del servidor).
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

import java.util.Map;

public class LogicaFakeEditarDatosTest {

    private static class DatosApuntados implements LogicaFakeEditarDatos.RespuestaDatos {
        String llamado = "";
        String mensaje = "";
        DatosUsuario datos;
        @Override public void datosGuardados(DatosUsuario datos) { llamado = "datosGuardados"; this.datos = datos; }
        @Override public void correoYaRegistrado() { llamado = "correoYaRegistrado"; }
        @Override public void sesionCaducada() { llamado = "sesionCaducada"; }
        @Override public void error(String mensaje) { llamado = "error"; this.mensaje = mensaje; }
    }

    private static class ContrasenaApuntada implements LogicaFakeEditarDatos.RespuestaContrasena {
        String llamado = "";
        String mensaje = "";
        DatosSesion datos;
        @Override public void contrasenaCambiada(DatosSesion datos) { llamado = "contrasenaCambiada"; this.datos = datos; }
        @Override public void contrasenaActualIncorrecta() { llamado = "contrasenaActualIncorrecta"; }
        @Override public void sesionCaducada() { llamado = "sesionCaducada"; }
        @Override public void error(String mensaje) { llamado = "error"; this.mensaje = mensaje; }
    }

    // --- ValidadorEditarDatos ---------------------------------------------------

    @Test
    public void validarDatos_correctos_sinErrores() {
        assertTrue(ValidadorEditarDatos.validarDatos("María José", "García-López", "maria@aeris.es").isEmpty());
    }

    @Test
    public void validarDatos_mismasReglasQueElRegistro() {
        Map<String, String> errores = ValidadorEditarDatos.validarDatos("P3lin", "", "pelin@aeris");
        assertEquals(3, errores.size());
        assertTrue(errores.containsKey(ValidadorRegistro.CAMPO_NOMBRE));
        assertEquals("Escribe tus apellidos.", errores.get(ValidadorRegistro.CAMPO_APELLIDOS));
        assertEquals("El correo no tiene un formato válido.", errores.get(ValidadorRegistro.CAMPO_CORREO));
    }

    @Test
    public void validarContrasena_correcta_sinErrores() {
        assertTrue(ValidadorEditarDatos.validarContrasena("aire2026", "ozono2027", "ozono2027").isEmpty());
    }

    @Test
    public void validarContrasena_vacias_debil_igualOQueNoCoincide() {
        Map<String, String> vacias = ValidadorEditarDatos.validarContrasena("", "", "");
        assertEquals(3, vacias.size());

        assertTrue(ValidadorEditarDatos.validarContrasena("aire2026", "corta", "corta")
                .get(ValidadorEditarDatos.CAMPO_NUEVA).startsWith("Mínimo 8"));
        assertEquals("La contraseña nueva tiene que ser distinta de la actual.",
                ValidadorEditarDatos.validarContrasena("aire2026", "aire2026", "aire2026")
                        .get(ValidadorEditarDatos.CAMPO_NUEVA));
        assertEquals("Las contraseñas no coinciden.",
                ValidadorEditarDatos.validarContrasena("aire2026", "ozono2027", "ozono2028")
                        .get(ValidadorEditarDatos.CAMPO_REPETIDA));
    }

    // --- actualizarDatos ---------------------------------------------------------

    @Test
    public void crearJSONDatos_sinEspaciosYCorreoEnMinusculas() throws Exception {
        JSONObject json = new JSONObject(LogicaFakeEditarDatos.crearJSONDatos(" Pelin ", " Kaynak ", " Pelin@AERIS.es "));
        assertEquals("Pelin", json.getString("nombre"));
        assertEquals("Kaynak", json.getString("apellidos"));
        assertEquals("pelin@aeris.es", json.getString("correo"));
        assertEquals(3, json.length());
    }

    @Test
    public void datos200_datosGuardados() {
        DatosApuntados r = new DatosApuntados();
        LogicaFakeEditarDatos.notificarDatos(200,
                "{\"nombre\":\"Pelin\",\"apellidos\":\"Kaynak\",\"correo\":\"pelin.k@aeris.es\"}", r);
        assertEquals("datosGuardados", r.llamado);
        assertEquals("pelin.k@aeris.es", r.datos.correo);
    }

    @Test
    public void datos409_401_400_0() {
        DatosApuntados r = new DatosApuntados();
        LogicaFakeEditarDatos.notificarDatos(409, "", r);
        assertEquals("correoYaRegistrado", r.llamado);

        DatosApuntados r2 = new DatosApuntados();
        LogicaFakeEditarDatos.notificarDatos(401, "", r2);
        assertEquals("sesionCaducada", r2.llamado);

        DatosApuntados r3 = new DatosApuntados();
        LogicaFakeEditarDatos.notificarDatos(400, "", r3);
        assertEquals("error", r3.llamado);

        DatosApuntados r4 = new DatosApuntados();
        LogicaFakeEditarDatos.notificarDatos(0, "", r4);
        assertTrue(r4.mensaje.contains("conexión"));
    }

    // --- cambiarContrasena -------------------------------------------------------

    @Test
    public void crearJSONContrasena_actualYNueva() throws Exception {
        JSONObject json = new JSONObject(LogicaFakeEditarDatos.crearJSONContrasena("aire2026", "ozono2027"));
        assertEquals("aire2026", json.getString("contrasenaActual"));
        assertEquals("ozono2027", json.getString("contrasenaNueva"));
        assertEquals(2, json.length());
    }

    @Test
    public void contrasena200_sesionNueva() {
        ContrasenaApuntada r = new ContrasenaApuntada();
        LogicaFakeEditarDatos.notificarContrasena(200, LogicaFakeSesionTest.CUERPO_SESION, r);
        assertEquals("contrasenaCambiada", r.llamado);
        assertEquals("abc.123", r.datos.token);
    }

    @Test
    public void contrasena403_actualIncorrecta_y_otros() {
        ContrasenaApuntada r = new ContrasenaApuntada();
        LogicaFakeEditarDatos.notificarContrasena(403, "", r);
        assertEquals("contrasenaActualIncorrecta", r.llamado);

        ContrasenaApuntada r2 = new ContrasenaApuntada();
        LogicaFakeEditarDatos.notificarContrasena(401, "", r2);
        assertEquals("sesionCaducada", r2.llamado);

        ContrasenaApuntada r3 = new ContrasenaApuntada();
        LogicaFakeEditarDatos.notificarContrasena(200, "", r3);
        assertEquals("error", r3.llamado);

        ContrasenaApuntada r4 = new ContrasenaApuntada();
        LogicaFakeEditarDatos.notificarContrasena(500, "", r4);
        assertTrue(r4.mensaje.contains("500"));
    }
}
