// ---------------------------------------------------------------------------
// Fichero:     AyudaTest.java
// Descripción: Pruebas de la pantalla Ayuda (T043): lectura de las incidencias y
//              de los mensajes de su conversación (también con campos null),
//              validación del formulario y de la caja de mensajes, JSON que se
//              envía y respuestas del servidor (200, 201, 400, 401, 404, 0 y otros).
// Autores:     Equipo 04 – SenseTech
// Fecha:       20/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class AyudaTest {

    private static final String JSON_INCIDENCIA = "{\"idIncidencia\":7,\"tipo\":\"sensor\",\"asunto\":\"No conecta\","
            + "\"descripcion\":\"La luz parpadea\",\"estado\":\"en curso\",\"respuesta\":\"Reinícialo\","
            + "\"responsable\":{\"nombre\":\"Marc\",\"rol\":\"tecnico\"},\"fechaCreacion\":\"2026-11-19T10:00:00.000Z\","
            + "\"fechaRespuesta\":\"2026-11-19T11:00:00.000Z\",\"sensor\":{\"idSensor\":3,\"numeroSerie\":\"092021010920\"}}";

    private static final String JSON_MENSAJE = "{\"idMensaje\":5,\"idIncidencia\":7,\"texto\":\"Sigue igual\","
            + "\"fecha\":\"2026-11-19T12:30:00.000Z\",\"autor\":{\"idUsuario\":2,\"nombre\":\"Pelin\",\"rol\":\"ciudadano\"},"
            + "\"delUsuario\":true}";

    // ---- Incidencia ----

    @Test
    public void incidencia_leeTodosLosCampos() {
        Incidencia i = Incidencia.desdeJSON(JSON_INCIDENCIA);
        assertNotNull(i);
        assertEquals(7, i.idIncidencia);
        assertEquals(Incidencia.TIPO_SENSOR, i.tipo);
        assertEquals("No conecta", i.asunto);
        assertEquals("La luz parpadea", i.descripcion);
        assertEquals(Incidencia.ESTADO_EN_CURSO, i.estado);
        assertTrue(i.tieneRespuesta);
        assertEquals(Instant.parse("2026-11-19T10:00:00Z").toEpochMilli(), i.fechaCreacionMs);
        assertEquals("092021010920", i.numeroSerie);
    }

    @Test
    public void incidencia_sinSensorNiRespuestaNiFecha() {
        Incidencia i = Incidencia.desdeJSON("{\"idIncidencia\":8,\"tipo\":\"cuenta\",\"asunto\":\"Foto\","
                + "\"descripcion\":\"No puedo\",\"estado\":\"abierta\",\"respuesta\":null,\"sensor\":null,"
                + "\"fechaCreacion\":null}");
        assertNotNull(i);
        assertFalse(i.tieneRespuesta);
        assertEquals("", i.numeroSerie);
        assertEquals(0, i.fechaCreacionMs);
    }

    @Test
    public void incidencia_nuncaDevuelveElTextoNull() {
        Incidencia i = Incidencia.desdeJSON("{\"idIncidencia\":9,\"tipo\":null,\"asunto\":\"Hola\","
                + "\"descripcion\":null,\"estado\":\"null\",\"respuesta\":\"null\",\"sensor\":{\"numeroSerie\":null}}");
        assertNotNull(i);
        assertEquals("", i.descripcion);
        assertEquals("", i.numeroSerie);
        assertFalse("una respuesta «null» no cuenta como respuesta", i.tieneRespuesta);
        assertEquals(Incidencia.TIPO_OTRA, i.tipo);
        assertEquals(Incidencia.ESTADO_ABIERTA, i.estado);
    }

    @Test
    public void incidencia_tipoYEstadoDesconocidosSeNormalizan() {
        Incidencia i = Incidencia.desdeJSON("{\"idIncidencia\":1,\"tipo\":\"queja\",\"asunto\":\"A\",\"estado\":\"cerrada\"}");
        assertEquals(Incidencia.TIPO_OTRA, i.tipo);
        assertEquals(Incidencia.ESTADO_ABIERTA, i.estado);
        assertEquals(Incidencia.TIPO_DATOS, Incidencia.normalizarTipo("datos"));
        assertEquals(Incidencia.ESTADO_RESUELTA, Incidencia.normalizarEstado("resuelta"));
    }

    @Test
    public void incidencia_invalidaDaNull() {
        assertNull(Incidencia.desdeJSON(null));
        assertNull(Incidencia.desdeJSON("no es json"));
        assertNull(Incidencia.desdeJSON("{\"asunto\":\"Sin id\"}"));
        assertNull(Incidencia.desdeJSON("{\"idIncidencia\":3,\"asunto\":\"   \"}"));
        assertNull(Incidencia.desdeJSON("{\"idIncidencia\":3,\"asunto\":null}"));
    }

    @Test
    public void incidencia_lista_mantieneElOrdenYSaltaLasMalas() {
        String cuerpo = "[" + JSON_INCIDENCIA + ",{\"asunto\":\"sin id\"},5,null,"
                + "{\"idIncidencia\":2,\"asunto\":\"Otra\",\"tipo\":\"otra\"}]";
        List<Incidencia> lista = Incidencia.listaDesdeJSON(cuerpo);
        assertEquals(2, lista.size());
        assertEquals(7, lista.get(0).idIncidencia);
        assertEquals(2, lista.get(1).idIncidencia);
        assertTrue(Incidencia.listaDesdeJSON("[]").isEmpty());
        assertNull(Incidencia.listaDesdeJSON("{\"idIncidencia\":1}"));
        assertNull(Incidencia.listaDesdeJSON(null));
        assertNull(Incidencia.listaDesdeJSON("basura"));
    }

    // ---- MensajeIncidencia ----

    @Test
    public void mensaje_leeTodosLosCampos() {
        MensajeIncidencia m = MensajeIncidencia.desdeJSON(JSON_MENSAJE);
        assertNotNull(m);
        assertEquals(5, m.idMensaje);
        assertEquals("Sigue igual", m.texto);
        assertEquals(Instant.parse("2026-11-19T12:30:00Z").toEpochMilli(), m.fechaMs);
        assertTrue(m.delUsuario);
        assertEquals("Pelin", m.autorNombre);
        assertEquals("ciudadano", m.autorRol);
    }

    @Test
    public void mensaje_delEquipoYConAutorBorrado() {
        MensajeIncidencia equipo = MensajeIncidencia.desdeJSON("{\"idMensaje\":6,\"texto\":\"Prueba esto\","
                + "\"autor\":{\"nombre\":\"Marc\",\"rol\":\"tecnico\"},\"delUsuario\":false}");
        assertFalse(equipo.delUsuario);
        assertEquals("tecnico", equipo.autorRol);
        assertEquals(0, equipo.fechaMs);

        MensajeIncidencia borrado = MensajeIncidencia.desdeJSON("{\"idMensaje\":7,\"texto\":\"Hecho\","
                + "\"autor\":null,\"delUsuario\":false}");
        assertEquals("", borrado.autorNombre);
        assertEquals("", borrado.autorRol);
    }

    @Test
    public void mensaje_nuncaDevuelveElTextoNull() {
        MensajeIncidencia m = MensajeIncidencia.desdeJSON("{\"idMensaje\":8,\"texto\":\"Hola\","
                + "\"fecha\":\"null\",\"autor\":{\"nombre\":null,\"rol\":\"null\"}}");
        assertEquals("", m.autorNombre);
        assertEquals("", m.autorRol);
        assertEquals(0, m.fechaMs);
        assertFalse(m.delUsuario);
    }

    @Test
    public void mensaje_invalidoDaNull_yLaListaSaltaLosMalos() {
        assertNull(MensajeIncidencia.desdeJSON(null));
        assertNull(MensajeIncidencia.desdeJSON("{\"texto\":\"sin id\"}"));
        assertNull(MensajeIncidencia.desdeJSON("{\"idMensaje\":1,\"texto\":\"  \"}"));
        assertNull(MensajeIncidencia.desdeJSON("{\"idMensaje\":1,\"texto\":null}"));

        List<MensajeIncidencia> lista = MensajeIncidencia.listaDesdeJSON(
                "[" + JSON_MENSAJE + ",{\"idMensaje\":9},\"x\",{\"idMensaje\":10,\"texto\":\"Dos\"}]");
        assertEquals(2, lista.size());
        assertEquals(5, lista.get(0).idMensaje);
        assertEquals(10, lista.get(1).idMensaje);
        assertTrue(MensajeIncidencia.listaDesdeJSON("[]").isEmpty());
        assertNull(MensajeIncidencia.listaDesdeJSON("{}"));
    }

    @Test
    public void mensaje_quienEs_decideElLadoYElRotulo() {
        assertEquals(MensajeIncidencia.QUIEN_USUARIO, MensajeIncidencia.desdeJSON(JSON_MENSAJE).quienEs());
        assertEquals(MensajeIncidencia.QUIEN_TECNICO, MensajeIncidencia.desdeJSON("{\"idMensaje\":1,\"texto\":\"a\","
                + "\"autor\":{\"nombre\":\"Marc\",\"rol\":\"tecnico\"},\"delUsuario\":false}").quienEs());
        assertEquals(MensajeIncidencia.QUIEN_ADMINISTRADOR, MensajeIncidencia.desdeJSON("{\"idMensaje\":2,\"texto\":\"a\","
                + "\"autor\":{\"nombre\":\"Alba\",\"rol\":\"administrador\"},\"delUsuario\":false}").quienEs());
        // rol desconocido o autor borrado: «equipo»
        assertEquals(MensajeIncidencia.QUIEN_EQUIPO, MensajeIncidencia.desdeJSON("{\"idMensaje\":3,\"texto\":\"a\","
                + "\"autor\":{\"nombre\":\"X\",\"rol\":\"ciudadano\"},\"delUsuario\":false}").quienEs());
        assertEquals(MensajeIncidencia.QUIEN_EQUIPO, MensajeIncidencia.desdeJSON(
                "{\"idMensaje\":4,\"texto\":\"a\",\"autor\":null,\"delUsuario\":false}").quienEs());
        // si lo escribió el dueño de la incidencia siempre es suyo, sea del equipo o no
        assertEquals(MensajeIncidencia.QUIEN_USUARIO, MensajeIncidencia.desdeJSON("{\"idMensaje\":5,\"texto\":\"a\","
                + "\"autor\":{\"nombre\":\"Ana\",\"rol\":\"tecnico\"},\"delUsuario\":true}").quienEs());
    }

    // ---- ValidadorIncidencia ----

    @Test
    public void validadorNueva_correcta() {
        assertTrue(ValidadorIncidencia.validarNueva("sensor", "No conecta", "Cuéntanos").isEmpty());
        assertTrue(ValidadorIncidencia.validarNueva("otra", "x".repeat(120), "x".repeat(2000)).isEmpty());
    }

    @Test
    public void validadorNueva_dicePorCadaCampoQueFalla() {
        Map<String, String> errores = ValidadorIncidencia.validarNueva("queja", "   ", "");
        assertEquals(3, errores.size());
        assertTrue(errores.containsKey(ValidadorIncidencia.CAMPO_TIPO));
        assertTrue(errores.containsKey(ValidadorIncidencia.CAMPO_ASUNTO));
        assertTrue(errores.containsKey(ValidadorIncidencia.CAMPO_DESCRIPCION));

        assertTrue(ValidadorIncidencia.validarNueva(null, "A", "B").containsKey(ValidadorIncidencia.CAMPO_TIPO));
        assertTrue(ValidadorIncidencia.validarNueva("otra", null, "B").containsKey(ValidadorIncidencia.CAMPO_ASUNTO));
        assertTrue(ValidadorIncidencia.validarNueva("otra", "A", null).containsKey(ValidadorIncidencia.CAMPO_DESCRIPCION));
    }

    @Test
    public void validadorNueva_loslimites() {
        assertTrue(ValidadorIncidencia.validarNueva("otra", "x".repeat(121), "B")
                .containsKey(ValidadorIncidencia.CAMPO_ASUNTO));
        assertTrue(ValidadorIncidencia.validarNueva("otra", "A", "x".repeat(2001))
                .containsKey(ValidadorIncidencia.CAMPO_DESCRIPCION));
        // los espacios de los extremos no cuentan
        assertTrue(ValidadorIncidencia.validarNueva("otra", "  " + "x".repeat(120) + "  ", "B").isEmpty());
    }

    @Test
    public void validadorMensaje() {
        assertNull(ValidadorIncidencia.validarMensaje("Hola"));
        assertNull(ValidadorIncidencia.validarMensaje("x".repeat(2000)));
        assertNotNull(ValidadorIncidencia.validarMensaje(null));
        assertNotNull(ValidadorIncidencia.validarMensaje("   "));
        assertNotNull(ValidadorIncidencia.validarMensaje("x".repeat(2001)));
    }

    // ---- LogicaFakeAyuda: lo que se envía ----

    @Test
    public void json_deLaIncidencia_sinSensor_yConLosTextosRecortados() throws Exception {
        JSONObject json = new JSONObject(LogicaFakeAyuda.crearJSONIncidencia("sensor", "  No conecta ", " La luz parpadea  "));
        assertEquals("sensor", json.getString("tipo"));
        assertEquals("No conecta", json.getString("asunto"));
        assertEquals("La luz parpadea", json.getString("descripcion"));
        assertFalse("el sensor lo añade el servidor", json.has("idSensor"));
        assertEquals(3, json.length());
    }

    @Test
    public void json_delMensaje() throws Exception {
        JSONObject json = new JSONObject(LogicaFakeAyuda.crearJSONMensaje(7, "  Gracias "));
        assertEquals(7, json.getInt("idIncidencia"));
        assertEquals("Gracias", json.getString("texto"));
        assertEquals(2, json.length());
    }

    // ---- LogicaFakeAyuda: lo que responde el servidor ----

    private static class Eventos implements LogicaFakeAyuda.RespuestaIncidencias, LogicaFakeAyuda.RespuestaCreacion,
            LogicaFakeAyuda.RespuestaMensajes, LogicaFakeAyuda.RespuestaEnvio {
        final List<String> eventos = new ArrayList<>();

        @Override public void incidenciasObtenidas(List<Incidencia> l) { eventos.add("lista:" + l.size()); }
        @Override public void incidenciaCreada(Incidencia i) { eventos.add("creada:" + i.idIncidencia); }
        @Override public void mensajesObtenidos(List<MensajeIncidencia> l) { eventos.add("mensajes:" + l.size()); }
        @Override public void mensajeEnviado(MensajeIncidencia m) { eventos.add("enviado:" + m.idMensaje); }
        @Override public void datosNoValidos(String mensaje) { eventos.add("datos:" + mensaje); }
        @Override public void incidenciaNoExiste() { eventos.add("noExiste"); }
        @Override public void sesionCaducada() { eventos.add("sesion"); }
        @Override public void error(String mensaje) { eventos.add("error:" + mensaje); }

        String unico() {
            assertEquals(1, eventos.size());
            return eventos.get(0);
        }
    }

    @Test
    public void respuestaDeLaLista() {
        Eventos e = new Eventos();
        LogicaFakeAyuda.notificarIncidencias(200, "[" + JSON_INCIDENCIA + "]", e);
        assertEquals("lista:1", e.unico());

        Eventos vacia = new Eventos();
        LogicaFakeAyuda.notificarIncidencias(200, "[]", vacia);
        assertEquals("lista:0", vacia.unico());

        Eventos mala = new Eventos();
        LogicaFakeAyuda.notificarIncidencias(200, "no es json", mala);
        assertEquals("error:" + LogicaFakeAyuda.MENSAJE_RESPUESTA_NO_VALIDA, mala.unico());

        Eventos sesion = new Eventos();
        LogicaFakeAyuda.notificarIncidencias(401, "{}", sesion);
        assertEquals("sesion", sesion.unico());

        Eventos sinRed = new Eventos();
        LogicaFakeAyuda.notificarIncidencias(0, "(IOException)", sinRed);
        assertEquals("error:" + LogicaFakeAyuda.MENSAJE_SIN_CONEXION, sinRed.unico());

        Eventos otro = new Eventos();
        LogicaFakeAyuda.notificarIncidencias(500, "", otro);
        assertTrue(otro.unico().contains("500"));
    }

    @Test
    public void respuestaDeLaCreacion() {
        Eventos creada = new Eventos();
        LogicaFakeAyuda.notificarCreacion(201, JSON_INCIDENCIA, creada);
        assertEquals("creada:7", creada.unico());

        Eventos sinCuerpo = new Eventos();
        LogicaFakeAyuda.notificarCreacion(201, "", sinCuerpo);
        assertEquals("error:" + LogicaFakeAyuda.MENSAJE_RESPUESTA_NO_VALIDA, sinCuerpo.unico());

        Eventos mal = new Eventos();
        LogicaFakeAyuda.notificarCreacion(400, "{\"error\":\"Datos de la incidencia no válidos\",\"campos\":[\"asunto\"]}", mal);
        assertEquals("datos:Datos de la incidencia no válidos", mal.unico());

        Eventos malSinTexto = new Eventos();
        LogicaFakeAyuda.notificarCreacion(400, "", malSinTexto);
        assertEquals("datos:" + LogicaFakeAyuda.MENSAJE_DATOS_NO_VALIDOS, malSinTexto.unico());

        Eventos sesion = new Eventos();
        LogicaFakeAyuda.notificarCreacion(401, "{}", sesion);
        assertEquals("sesion", sesion.unico());

        Eventos sinRed = new Eventos();
        LogicaFakeAyuda.notificarCreacion(0, "(IOException)", sinRed);
        assertEquals("error:" + LogicaFakeAyuda.MENSAJE_SIN_CONEXION, sinRed.unico());
    }

    @Test
    public void respuestaDeLosMensajes() {
        Eventos ok = new Eventos();
        LogicaFakeAyuda.notificarMensajes(200, "[" + JSON_MENSAJE + "]", ok);
        assertEquals("mensajes:1", ok.unico());

        Eventos sinMensajes = new Eventos();
        LogicaFakeAyuda.notificarMensajes(200, "[]", sinMensajes);
        assertEquals("mensajes:0", sinMensajes.unico());

        Eventos noExiste = new Eventos();
        LogicaFakeAyuda.notificarMensajes(404, "{\"error\":\"Esa incidencia no existe\"}", noExiste);
        assertEquals("noExiste", noExiste.unico());

        Eventos sesion = new Eventos();
        LogicaFakeAyuda.notificarMensajes(401, "{}", sesion);
        assertEquals("sesion", sesion.unico());

        Eventos mala = new Eventos();
        LogicaFakeAyuda.notificarMensajes(200, "{}", mala);
        assertEquals("error:" + LogicaFakeAyuda.MENSAJE_RESPUESTA_NO_VALIDA, mala.unico());

        Eventos sinRed = new Eventos();
        LogicaFakeAyuda.notificarMensajes(0, "", sinRed);
        assertEquals("error:" + LogicaFakeAyuda.MENSAJE_SIN_CONEXION, sinRed.unico());
    }

    @Test
    public void respuestaDelEnvio() {
        Eventos ok = new Eventos();
        LogicaFakeAyuda.notificarEnvio(201, JSON_MENSAJE, ok);
        assertEquals("enviado:5", ok.unico());

        Eventos mal = new Eventos();
        LogicaFakeAyuda.notificarEnvio(400, "{\"error\":\"El mensaje no es válido\",\"campos\":[\"texto\"]}", mal);
        assertEquals("datos:El mensaje no es válido", mal.unico());

        Eventos noExiste = new Eventos();
        LogicaFakeAyuda.notificarEnvio(404, "{}", noExiste);
        assertEquals("noExiste", noExiste.unico());

        Eventos sesion = new Eventos();
        LogicaFakeAyuda.notificarEnvio(401, "{}", sesion);
        assertEquals("sesion", sesion.unico());

        Eventos mala = new Eventos();
        LogicaFakeAyuda.notificarEnvio(201, "basura", mala);
        assertEquals("error:" + LogicaFakeAyuda.MENSAJE_RESPUESTA_NO_VALIDA, mala.unico());

        Eventos otro = new Eventos();
        LogicaFakeAyuda.notificarEnvio(503, "", otro);
        assertTrue(otro.unico().contains("503"));
    }
}
