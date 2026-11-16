// ---------------------------------------------------------------------------
// Fichero:     LogicaFakePerfilTest.java
// Descripción: Tests JUnit de la lógica de la pantalla de perfil (T010):
//              DatosUsuario (lectura del JSON de GET /usuarioActual),
//              LogicaFakePerfil (JSON del interruptor y de la foto y respuesta según el
//              código del servidor) y BarraNavegacion (qué pantalla se cierra).
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

public class LogicaFakePerfilTest {

    static final String CUERPO_USUARIO = "{\"idUsuario\":1,\"nombre\":\"Pelin\",\"apellidos\":\"Kaynak\","
            + "\"correo\":\"pelin@aeris.es\",\"rol\":\"portador\",\"fechaAlta\":\"2026-11-04T10:00:00.000Z\","
            + "\"alertas\":false,\"premiumHasta\":null,\"foto\":\"/9j/4AAQ\"}";

    private static class UsuarioApuntado implements LogicaFakePerfil.RespuestaUsuario {
        String llamado = "";
        String mensaje = "";
        DatosUsuario datos;
        @Override public void usuarioObtenido(DatosUsuario datos) { llamado = "usuarioObtenido"; this.datos = datos; }
        @Override public void sesionCaducada() { llamado = "sesionCaducada"; }
        @Override public void error(String mensaje) { llamado = "error"; this.mensaje = mensaje; }
    }

    private static class CambioApuntado implements LogicaFakePerfil.RespuestaCambio {
        String llamado = "";
        String mensaje = "";
        @Override public void cambioGuardado() { llamado = "cambioGuardado"; }
        @Override public void sesionCaducada() { llamado = "sesionCaducada"; }
        @Override public void error(String mensaje) { llamado = "error"; this.mensaje = mensaje; }
    }

    // --- DatosUsuario ----------------------------------------------------------

    @Test
    public void desdeJSON_leeNombreCorreoYAlertas() {
        DatosUsuario d = DatosUsuario.desdeJSON(CUERPO_USUARIO);
        assertEquals("Pelin", d.nombre);
        assertEquals("pelin@aeris.es", d.correo);
        assertEquals("portador", d.rol);
        assertFalse(d.alertas);
        assertEquals("Pelin Kaynak", d.nombreCompleto());
        assertEquals("/9j/4AAQ", d.foto);
        assertTrue(d.tieneFoto());
    }

    @Test
    public void desdeJSON_sinAlertasEsTrueYSinApellidosSoloNombre() {
        DatosUsuario d = DatosUsuario.desdeJSON("{\"nombre\":\"Pelin\",\"correo\":\"pelin@aeris.es\"}");
        assertTrue(d.alertas);
        assertEquals("Pelin", d.nombreCompleto());
        assertFalse(d.tieneFoto());
        assertFalse(DatosUsuario.desdeJSON("{\"correo\":\"a@b.es\",\"foto\":null}").tieneFoto());
    }

    @Test
    public void desdeJSON_sensor() {
        // El servidor aún no envía «sensor» (T017): sin el campo, no tiene sensor
        assertFalse(DatosUsuario.desdeJSON(CUERPO_USUARIO).tieneSensor());
        assertFalse(DatosUsuario.desdeJSON("{\"correo\":\"a@b.es\",\"sensor\":null}").tieneSensor());
        DatosUsuario d = DatosUsuario.desdeJSON("{\"correo\":\"a@b.es\",\"sensor\":\"AERIS-04\"}");
        assertTrue(d.tieneSensor());
        assertEquals("AERIS-04", d.sensor);
    }

    @Test
    public void desdeJSON_textoNoValidoOSinCorreo_null() {
        assertNull(DatosUsuario.desdeJSON(null));
        assertNull(DatosUsuario.desdeJSON(""));
        assertNull(DatosUsuario.desdeJSON("no es json"));
        assertNull(DatosUsuario.desdeJSON("{\"nombre\":\"Pelin\"}"));
    }

    // --- obtenerUsuario ------------------------------------------------------

    @Test
    public void usuario200_usuarioObtenido() {
        UsuarioApuntado r = new UsuarioApuntado();
        LogicaFakePerfil.notificarUsuario(200, CUERPO_USUARIO, r);
        assertEquals("usuarioObtenido", r.llamado);
        assertEquals("pelin@aeris.es", r.datos.correo);
    }

    @Test
    public void usuario200SinDatos_error() {
        UsuarioApuntado r = new UsuarioApuntado();
        LogicaFakePerfil.notificarUsuario(200, "", r);
        assertEquals("error", r.llamado);
    }

    @Test
    public void usuario401_sesionCaducada() {
        UsuarioApuntado r = new UsuarioApuntado();
        LogicaFakePerfil.notificarUsuario(401, "{\"error\":\"Hay que iniciar sesión\"}", r);
        assertEquals("sesionCaducada", r.llamado);
    }

    @Test
    public void usuarioSinConexionUOtroCodigo_error() {
        UsuarioApuntado r = new UsuarioApuntado();
        LogicaFakePerfil.notificarUsuario(0, "", r);
        assertEquals("error", r.llamado);
        assertTrue(r.mensaje.contains("conexión"));

        UsuarioApuntado r2 = new UsuarioApuntado();
        LogicaFakePerfil.notificarUsuario(500, "", r2);
        assertEquals("error", r2.llamado);
        assertTrue(r2.mensaje.contains("500"));
    }

    // --- cambiarAlertas --------------------------------------------------------

    @Test
    public void crearJSONAlertas_soloElValor() throws Exception {
        JSONObject json = new JSONObject(LogicaFakePerfil.crearJSONAlertas(false));
        assertFalse(json.getBoolean("alertas"));
        assertEquals(1, json.length());
        assertTrue(new JSONObject(LogicaFakePerfil.crearJSONAlertas(true)).getBoolean("alertas"));
    }

    @Test
    public void crearJSONFoto_base64OSinFoto() throws Exception {
        assertEquals("/9j/4AAQ", new JSONObject(LogicaFakePerfil.crearJSONFoto("/9j/4AAQ")).getString("foto"));
        assertTrue(new JSONObject(LogicaFakePerfil.crearJSONFoto(null)).isNull("foto"));
    }

    @Test
    public void cambio204_cambioGuardado() {
        CambioApuntado r = new CambioApuntado();
        LogicaFakePerfil.notificarCambio(204, r);
        assertEquals("cambioGuardado", r.llamado);
    }

    @Test
    public void cambio401_sesionCaducada() {
        CambioApuntado r = new CambioApuntado();
        LogicaFakePerfil.notificarCambio(401, r);
        assertEquals("sesionCaducada", r.llamado);
    }

    @Test
    public void cambioSinConexionUOtroCodigo_error() {
        CambioApuntado r = new CambioApuntado();
        LogicaFakePerfil.notificarCambio(0, r);
        assertEquals("error", r.llamado);
        assertTrue(r.mensaje.contains("conexión"));

        CambioApuntado r2 = new CambioApuntado();
        LogicaFakePerfil.notificarCambio(400, r2);
        assertEquals("error", r2.llamado);
        assertTrue(r2.mensaje.contains("400"));
    }

    // --- BarraNavegacion -------------------------------------------------------

    @Test
    public void barra_inicioSeQuedaDebajoYLasDemasSeCierran() {
        assertFalse(BarraNavegacion.cierraLaActual(BarraNavegacion.Pestanya.INICIO, BarraNavegacion.Pestanya.PERFIL));
        assertTrue(BarraNavegacion.cierraLaActual(BarraNavegacion.Pestanya.PERFIL, BarraNavegacion.Pestanya.INICIO));
        assertTrue(BarraNavegacion.cierraLaActual(BarraNavegacion.Pestanya.PERFIL, BarraNavegacion.Pestanya.MAPA));
        assertFalse(BarraNavegacion.cierraLaActual(BarraNavegacion.Pestanya.PERFIL, BarraNavegacion.Pestanya.PERFIL));
    }
}
