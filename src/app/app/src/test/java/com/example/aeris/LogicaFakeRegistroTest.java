// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeRegistroTest.java
// Descripción: Tests JUnit de LogicaFakeRegistro: JSON enviado y respuesta
//              según el código del servidor (201, 409, otros, sin conexión).
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

public class LogicaFakeRegistroTest {

    // Callback de prueba que apunta qué método se ha llamado
    private static class RespuestaApuntada implements LogicaFakeRegistro.RespuestaRegistro {
        String llamado = "";
        String mensaje = "";
        @Override public void registrado() { llamado = "registrado"; }
        @Override public void correoYaRegistrado() { llamado = "correoYaRegistrado"; }
        @Override public void error(String mensaje) { llamado = "error"; this.mensaje = mensaje; }
    }

    @Test
    public void crearJSON_tieneLosCuatroCamposYNormalizaElCorreo() throws Exception {
        JSONObject json = new JSONObject(
                LogicaFakeRegistro.crearJSON(" Pelin ", "Kaynak", "  Pelin@AERIS.es ", "aire2026"));
        assertEquals("Pelin", json.getString("nombre"));
        assertEquals("Kaynak", json.getString("apellidos"));
        assertEquals("pelin@aeris.es", json.getString("correo"));
        assertEquals("aire2026", json.getString("contrasena"));
        assertEquals(4, json.length());
        assertFalse(json.has("confirmacion"));
    }

    @Test
    public void interpretarCodigo() {
        assertEquals(LogicaFakeRegistro.ResultadoRegistro.REGISTRADO, LogicaFakeRegistro.interpretarCodigo(201));
        assertEquals(LogicaFakeRegistro.ResultadoRegistro.CORREO_YA_REGISTRADO, LogicaFakeRegistro.interpretarCodigo(409));
        assertEquals(LogicaFakeRegistro.ResultadoRegistro.ERROR, LogicaFakeRegistro.interpretarCodigo(400));
        assertEquals(LogicaFakeRegistro.ResultadoRegistro.ERROR, LogicaFakeRegistro.interpretarCodigo(500));
        assertEquals(LogicaFakeRegistro.ResultadoRegistro.ERROR, LogicaFakeRegistro.interpretarCodigo(0));
    }

    @Test
    public void codigo201_llamaARegistrado() {
        RespuestaApuntada respuesta = new RespuestaApuntada();
        LogicaFakeRegistro.notificarResultado(201, respuesta);
        assertEquals("registrado", respuesta.llamado);
    }

    @Test
    public void codigo409_llamaACorreoYaRegistrado() {
        RespuestaApuntada respuesta = new RespuestaApuntada();
        LogicaFakeRegistro.notificarResultado(409, respuesta);
        assertEquals("correoYaRegistrado", respuesta.llamado);
    }

    @Test
    public void codigo500_llamaAErrorConElCodigo() {
        RespuestaApuntada respuesta = new RespuestaApuntada();
        LogicaFakeRegistro.notificarResultado(500, respuesta);
        assertEquals("error", respuesta.llamado);
        assertTrue(respuesta.mensaje.contains("500"));
    }

    @Test
    public void sinConexion_llamaAErrorDeConexion() {
        RespuestaApuntada respuesta = new RespuestaApuntada();
        LogicaFakeRegistro.notificarResultado(0, respuesta);
        assertEquals("error", respuesta.llamado);
        assertTrue(respuesta.mensaje.contains("conexión"));
    }
}
