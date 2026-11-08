// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeSesionTest.java
// Descripción: Tests JUnit de LogicaFakeSesion y DatosSesion: JSON enviado y
//              respuesta según el código del servidor (200, 401, otros,
//              sin conexión). Criterios de T003 / H002.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

public class LogicaFakeSesionTest {

    static final String CUERPO_SESION =
            "{\"idUsuario\":1,\"token\":\"abc.123\",\"rol\":\"portador\",\"nombre\":\"Pelin\"}";

    private static class InicioApuntado implements LogicaFakeSesion.RespuestaInicioSesion {
        String llamado = "";
        String mensaje = "";
        DatosSesion datos;
        @Override public void sesionIniciada(DatosSesion datos) { llamado = "sesionIniciada"; this.datos = datos; }
        @Override public void credencialesIncorrectas() { llamado = "credencialesIncorrectas"; }
        @Override public void error(String mensaje) { llamado = "error"; this.mensaje = mensaje; }
    }

    private static class RecuperacionApuntada implements LogicaFakeSesion.RespuestaRecuperacion {
        String llamado = "";
        String mensaje = "";
        @Override public void enlaceEnviado() { llamado = "enlaceEnviado"; }
        @Override public void correoNoRegistrado() { llamado = "correoNoRegistrado"; }
        @Override public void error(String mensaje) { llamado = "error"; this.mensaje = mensaje; }
    }

    @Test
    public void crearJSONInicioSesion_correoNormalizado() throws Exception {
        JSONObject json = new JSONObject(LogicaFakeSesion.crearJSONInicioSesion(" Pelin@AERIS.es ", "aire2026"));
        assertEquals("pelin@aeris.es", json.getString("correo"));
        assertEquals("aire2026", json.getString("contrasena"));
        assertEquals(2, json.length());
    }

    @Test
    public void codigo200_sesionIniciadaConToken() {
        InicioApuntado r = new InicioApuntado();
        LogicaFakeSesion.notificarInicioSesion(200, CUERPO_SESION, r);
        assertEquals("sesionIniciada", r.llamado);
        assertEquals("abc.123", r.datos.token);
        assertEquals("portador", r.datos.rol);
        assertEquals("Pelin", r.datos.nombre);
    }

    @Test
    public void codigo200SinToken_error() {
        InicioApuntado r = new InicioApuntado();
        LogicaFakeSesion.notificarInicioSesion(200, "", r);
        assertEquals("error", r.llamado);
    }

    @Test
    public void codigo401_credencialesIncorrectas() {
        InicioApuntado r = new InicioApuntado();
        LogicaFakeSesion.notificarInicioSesion(401, "", r);
        assertEquals("credencialesIncorrectas", r.llamado);
    }

    @Test
    public void sinConexionUOtroCodigo_error() {
        InicioApuntado r = new InicioApuntado();
        LogicaFakeSesion.notificarInicioSesion(0, "", r);
        assertEquals("error", r.llamado);
        assertTrue(r.mensaje.contains("conexión"));

        InicioApuntado r2 = new InicioApuntado();
        LogicaFakeSesion.notificarInicioSesion(500, "", r2);
        assertEquals("error", r2.llamado);
        assertTrue(r2.mensaje.contains("500"));
    }

    @Test
    public void recuperacion_200EnviadoY0Error() {
        RecuperacionApuntada r = new RecuperacionApuntada();
        LogicaFakeSesion.notificarRecuperacion(200, r);
        assertEquals("enlaceEnviado", r.llamado);

        RecuperacionApuntada r2 = new RecuperacionApuntada();
        LogicaFakeSesion.notificarRecuperacion(0, r2);
        assertEquals("error", r2.llamado);
        assertTrue(r2.mensaje.contains("conexión"));
    }

    @Test
    public void recuperacion_404CorreoNoRegistrado() {
        RecuperacionApuntada r = new RecuperacionApuntada();
        LogicaFakeSesion.notificarRecuperacion(404, r);
        assertEquals("correoNoRegistrado", r.llamado);
        assertEquals("No hay ninguna cuenta con este correo.", LogicaFakeSesion.MENSAJE_CORREO_NO_REGISTRADO);
    }

    @Test
    public void datosSesion_noValeSinToken() {
        assertNull(DatosSesion.desdeJSON(null));
        assertNull(DatosSesion.desdeJSON(""));
        assertNull(DatosSesion.desdeJSON("{\"rol\":\"portador\"}"));
    }

    @Test
    public void mensajeCredencialesIncorrectas_esElDelCriterio() {
        assertEquals("Correo o contraseña incorrectos", LogicaFakeSesion.MENSAJE_CREDENCIALES_INCORRECTAS);
    }
}
