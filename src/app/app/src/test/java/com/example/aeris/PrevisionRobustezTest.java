// ---------------------------------------------------------------------------
// Fichero:     PrevisionRobustezTest.java
// Descripción: Pruebas de robustez de la previsión de ozono (T032): caducidad a
//              los 30 minutos, campos JSON null, una sola petición compartida
//              (girar el móvil, Inicio y la pantalla a la vez) y la diferencia
//              entre servicio ocupado, caído y desactivado.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.util.ArrayList;
import java.util.List;

public class PrevisionRobustezTest {

    private static final long MINUTO = 60 * 1000L;

    private static final String JSON_OK = "{\"zona\":\"Gandia\",\"simulados\":true,\"advertencia\":\"Datos simulados\","
            + "\"modelo\":\"m.joblib\",\"ultima_observacion_utilizada\":\"2026-11-19T10:00:00\","
            + "\"predicciones\":[{\"fecha_hora\":\"2026-11-19T11:00:00\",\"ozono_predicho\":50},"
            + "{\"fecha_hora\":\"2026-11-19T12:00:00\",\"ozono_predicho\":60}]}";

    // Transporte falso: apunta las peticiones y las contesta cuando el test quiere
    private static class TransporteFalso implements LogicaFakePrevision.Transporte {
        final List<String> urls = new ArrayList<>();
        final List<PeticionarioREST.RespuestaREST> pendientes = new ArrayList<>();
        RuntimeException fallar;

        @Override
        public void get(String url, PeticionarioREST.RespuestaREST respuesta) {
            urls.add(url);
            if (fallar != null) {
                throw fallar;
            }
            pendientes.add(respuesta);
        }

        void contestar(int codigo, String cuerpo) {
            pendientes.remove(0).callback(codigo, cuerpo);
        }
    }

    private static class Capturador implements LogicaFakePrevision.RespuestaPrevision {
        final List<String> eventos = new ArrayList<>();
        PrevisionOzono recibida;
        RuntimeException lanzar;

        @Override public void previsionObtenida(PrevisionOzono p) {
            recibida = p;
            eventos.add("ok");
            if (lanzar != null) throw lanzar;
        }
        @Override public void zonaSinModelo(String zona) { eventos.add("zona:" + zona); }
        @Override public void sinDatos() { eventos.add("sinDatos"); }
        @Override public void error(String mensaje) { eventos.add("error:" + mensaje); }
        @Override public void servicioOcupado() { eventos.add("ocupado"); }
        @Override public void servicioNoDisponible() { eventos.add("noDisponible"); }
    }

    private TransporteFalso transporte;

    @Before
    public void preparar() {
        LogicaFakePrevision.reiniciarEstado();
        transporte = new TransporteFalso();
        LogicaFakePrevision.transporte = transporte;
    }

    @After
    public void limpiar() {
        LogicaFakePrevision.reiniciarEstado();
    }

    private static String notificar(int codigo, String cuerpo) {
        Capturador c = new Capturador();
        LogicaFakePrevision.notificarPrevision(codigo, cuerpo, c);
        assertEquals(1, c.eventos.size());
        return c.eventos.get(0);
    }

    // ---- Caducidad de 30 minutos ----

    @Test
    public void caducidad_alos30MinutosDesdeLaRecepcion() {
        PrevisionOzono p = PrevisionOzono.desdeJSON(JSON_OK, 1_000_000L);
        assertEquals(1_000_000L, p.recibidaMs);
        assertFalse(p.estaCaducada(1_000_000L));
        assertFalse(p.estaCaducada(1_000_000L + 29 * MINUTO));
        assertFalse("justo a los 30 minutos todavía vale", p.estaCaducada(1_000_000L + 30 * MINUTO));
        assertTrue(p.estaCaducada(1_000_000L + 30 * MINUTO + 1));
        assertTrue(p.estaCaducada(1_000_000L + 3 * 60 * MINUTO));
    }

    @Test
    public void caducidad_siElRelojDelTelefonoSeAtrasa_secuentaComoCaducada() {
        PrevisionOzono p = PrevisionOzono.desdeJSON(JSON_OK, 1_000_000L);
        assertTrue(p.estaCaducada(1_000_000L - 1));
    }

    @Test
    public void vigente_sinPrevisionRecibida_esNull() {
        assertNull(LogicaFakePrevision.vigente(System.currentTimeMillis()));
    }

    @Test
    public void vigente_recuerdaLaUltimaMientrasTengaMenosDe30Minutos() {
        long ahora = System.currentTimeMillis();
        assertEquals("ok", notificar(200, JSON_OK));

        PrevisionOzono v = LogicaFakePrevision.vigente(ahora + 29 * MINUTO);
        assertNotNull(v);
        assertEquals("Gandia", v.zona);
        assertNull("a los 31 minutos no se reutiliza", LogicaFakePrevision.vigente(ahora + 31 * MINUTO));
    }

    @Test
    public void vigente_unErrorNoGuardaNada() {
        notificar(503, "{}");
        notificar(504, "");
        notificar(0, "(IOException)");
        notificar(200, "{\"predicciones\":[]}");
        assertNull(LogicaFakePrevision.vigente(System.currentTimeMillis()));
    }

    // ---- Campos JSON null: nunca debe salir el texto "null" ----

    @Test
    public void camposNull_sonCadenaVacia() {
        String cuerpo = "{\"zona\":null,\"simulados\":null,\"advertencia\":null,\"modelo\":null,"
                + "\"ultima_observacion_utilizada\":null,"
                + "\"predicciones\":[{\"fecha_hora\":\"2026-11-19T11:00:00\",\"ozono_predicho\":50}]}";
        PrevisionOzono p = PrevisionOzono.desdeJSON(cuerpo);
        assertNotNull(p);
        assertEquals("", p.zona);
        assertEquals("", p.advertencia);
        assertEquals("", p.modelo);
        assertEquals("", p.ultimaObservacion);
        assertFalse(p.simulados);
    }

    @Test
    public void textoLiteralNull_tambienSeTrataComoVacio() {
        // Aunque la librería devuelva el texto "null" (org.json de Android con optString), no debe verse
        String cuerpo = "{\"zona\":\"null\",\"advertencia\":\" NULL \",\"modelo\":\"Null\","
                + "\"ultima_observacion_utilizada\":\"null\","
                + "\"predicciones\":[{\"fecha_hora\":\"2026-11-19T11:00:00\",\"ozono_predicho\":50}]}";
        PrevisionOzono p = PrevisionOzono.desdeJSON(cuerpo);
        assertNotNull(p);
        assertEquals("", p.zona);
        assertEquals("", p.advertencia);
        assertEquals("", p.modelo);
        assertEquals("", p.ultimaObservacion);
    }

    @Test
    public void textoNormal_noSeAltera() {
        PrevisionOzono p = PrevisionOzono.desdeJSON(JSON_OK);
        assertEquals("Gandia", p.zona);
        assertEquals("Datos simulados", p.advertencia);
        assertEquals("m.joblib", p.modelo);
        assertTrue(p.simulados);
    }

    @Test
    public void horasConFechaOValorNull_seSaltan() {
        String cuerpo = "{\"predicciones\":["
                + "{\"fecha_hora\":null,\"ozono_predicho\":50},"
                + "{\"fecha_hora\":\"2026-11-19T11:00:00\",\"ozono_predicho\":null},"
                + "{\"fecha_hora\":\"null\",\"ozono_predicho\":30},"
                + "{\"fecha_hora\":\"2026-11-19T12:00:00\",\"ozono_predicho\":70}]}";
        PrevisionOzono p = PrevisionOzono.desdeJSON(cuerpo);
        assertNotNull(p);
        assertEquals(1, p.horas.size());
        assertEquals(70, p.horas.get(0).ozono, 0.001);
    }

    @Test
    public void texto_deUnJSONObject() throws Exception {
        JSONObject json = new JSONObject("{\"a\":null,\"b\":\"null\",\"c\":\"hola\",\"d\":12}");
        assertEquals("", PrevisionOzono.texto(json, "a"));
        assertEquals("", PrevisionOzono.texto(json, "b"));
        assertEquals("", PrevisionOzono.texto(json, "inexistente"));
        assertEquals("hola", PrevisionOzono.texto(json, "c"));
        assertEquals("12", PrevisionOzono.texto(json, "d"));
    }

    // ---- Una sola petición compartida (girar el móvil, Inicio + pantalla) ----

    @Test
    public void peticionesSimultaneas_envianUnaSolaPeticion_yTodasRecibenLaRespuesta() {
        Capturador inicio = new Capturador();
        Capturador pantalla = new Capturador();
        Capturador pantallaGirada = new Capturador();      // la actividad recreada al girar el móvil

        new LogicaFakePrevision().obtenerPrevision("Gandia", inicio);
        new LogicaFakePrevision().obtenerPrevision("Gandia", pantalla);
        new LogicaFakePrevision().obtenerPrevision("Gandia", pantallaGirada);

        assertEquals("una sola petición HTTP", 1, transporte.urls.size());
        assertTrue(inicio.eventos.isEmpty());

        transporte.contestar(200, JSON_OK);

        assertEquals("ok", inicio.eventos.get(0));
        assertEquals("ok", pantalla.eventos.get(0));
        assertEquals("ok", pantallaGirada.eventos.get(0));
        assertEquals("Gandia", pantallaGirada.recibida.zona);
    }

    @Test
    public void tras_responder_unaPeticionNuevaVuelveAEnviarse() {
        new LogicaFakePrevision().obtenerPrevision("Gandia", new Capturador());
        transporte.contestar(200, JSON_OK);
        new LogicaFakePrevision().obtenerPrevision("Gandia", new Capturador());
        assertEquals(2, transporte.urls.size());
    }

    @Test
    public void zonasDistintas_noSeMezclan() {
        new LogicaFakePrevision().obtenerPrevision("Gandia", new Capturador());
        new LogicaFakePrevision().obtenerPrevision("Valencia", new Capturador());
        assertEquals(2, transporte.urls.size());
        assertTrue(transporte.urls.get(1).endsWith("zona=Valencia"));
    }

    @Test
    public void unFalloDeRespuesta_tambienLlegaATodos_yPermiteReintentar() {
        Capturador a = new Capturador();
        Capturador b = new Capturador();
        new LogicaFakePrevision().obtenerPrevision("Gandia", a);
        new LogicaFakePrevision().obtenerPrevision("Gandia", b);

        transporte.contestar(0, "(IOException)");
        assertEquals("error:" + LogicaFakePrevision.MENSAJE_SIN_CONEXION, a.eventos.get(0));
        assertEquals("error:" + LogicaFakePrevision.MENSAJE_SIN_CONEXION, b.eventos.get(0));

        new LogicaFakePrevision().obtenerPrevision("Gandia", new Capturador());      // «Reintentar»
        assertEquals(2, transporte.urls.size());
    }

    @Test
    public void siElTransporteFalla_seAvisaYNoQuedaBloqueada() {
        transporte.fallar = new IllegalStateException("sin red");
        Capturador a = new Capturador();
        new LogicaFakePrevision().obtenerPrevision("Gandia", a);
        assertEquals("error:" + LogicaFakePrevision.MENSAJE_SIN_CONEXION, a.eventos.get(0));

        transporte.fallar = null;
        new LogicaFakePrevision().obtenerPrevision("Gandia", new Capturador());
        assertEquals("se puede volver a pedir", 2, transporte.urls.size());
    }

    @Test
    public void siUnCallbackFalla_losDemasRecibenLaRespuesta() {
        Capturador roto = new Capturador();
        roto.lanzar = new IllegalStateException("actividad destruida");
        Capturador sano = new Capturador();
        new LogicaFakePrevision().obtenerPrevision("Gandia", roto);
        new LogicaFakePrevision().obtenerPrevision("Gandia", sano);

        try {
            transporte.contestar(200, JSON_OK);
            fail("debía relanzar el primer fallo");
        } catch (IllegalStateException esperado) {
            assertEquals("actividad destruida", esperado.getMessage());
        }
        assertEquals("ok", sano.eventos.get(0));
        new LogicaFakePrevision().obtenerPrevision("Gandia", new Capturador());
        assertEquals("el estado no queda bloqueado", 2, transporte.urls.size());
    }

    @Test
    public void laPrevisionRecibida_laVenTodasLasPantallas() {
        Capturador a = new Capturador();
        new LogicaFakePrevision().obtenerPrevision("Gandia", a);
        transporte.contestar(200, JSON_OK);
        assertNotNull(LogicaFakePrevision.vigente());
        assertEquals(a.recibida.json, LogicaFakePrevision.vigente().json);
        assertSame(LogicaFakePrevision.vigente(), LogicaFakePrevision.vigente());
    }

    // ---- Servicio ocupado, caído o desactivado ----

    @Test
    public void respuesta503_ocupado_seDiferenciaDeCaido() {
        assertEquals("ocupado", notificar(503, "{\"error\":\"x\",\"motivo\":\"ocupado\"}"));
        // Servidor anterior a T032: sin «motivo», solo lo decía el texto
        assertEquals("ocupado", notificar(503, "{\"error\":\"El servicio está ocupado. Inténtalo de nuevo.\"}"));
        assertEquals("noDisponible", notificar(503, "{\"error\":\"Servicio de predicción no disponible.\",\"motivo\":\"no_disponible\"}"));
        assertEquals("noDisponible", notificar(503, "{\"error\":\"Servicio de predicción no disponible.\"}"));
        assertEquals("noDisponible", notificar(503, ""));
        assertEquals("noDisponible", notificar(503, "no es json"));
    }

    @Test
    public void respuesta503_desactivada_tieneSuPropioMensaje() {
        assertEquals("error:" + LogicaFakePrevision.MENSAJE_DESACTIVADA,
                notificar(503, "{\"error\":\"La previsión no está activada en el servidor.\",\"motivo\":\"desactivada\"}"));
    }

    @Test
    public void mensajes_porDefecto_deOcupadoYCaido() {
        // Quien no sobreescribe servicioOcupado()/servicioNoDisponible() recibe el mensaje en error()
        final List<String> mensajes = new ArrayList<>();
        LogicaFakePrevision.RespuestaPrevision simple = new LogicaFakePrevision.RespuestaPrevision() {
            @Override public void previsionObtenida(PrevisionOzono p) { }
            @Override public void zonaSinModelo(String zona) { }
            @Override public void sinDatos() { }
            @Override public void error(String mensaje) { mensajes.add(mensaje); }
        };
        LogicaFakePrevision.notificarPrevision(503, "{\"motivo\":\"ocupado\"}", simple);
        LogicaFakePrevision.notificarPrevision(503, "{\"motivo\":\"no_disponible\"}", simple);
        assertEquals(LogicaFakePrevision.MENSAJE_SERVICIO_OCUPADO, mensajes.get(0));
        assertEquals(LogicaFakePrevision.MENSAJE_SERVICIO_NO_DISPONIBLE, mensajes.get(1));
        assertFalse(mensajes.get(0).equals(mensajes.get(1)));
    }

    @Test
    public void respuesta504_yResto_mantienenSusMensajes() {
        assertEquals("error:" + LogicaFakePrevision.MENSAJE_TIEMPO_AGOTADO, notificar(504, "{\"motivo\":\"tiempo_agotado\"}"));
        assertEquals("error:" + LogicaFakePrevision.MENSAJE_SIN_CONEXION, notificar(0, "(IOException)"));
        assertEquals("zona:Gandia", notificar(400, "{\"zona_disponible\":\"Gandia\"}"));
        assertEquals("zona:Gandia", notificar(400, "{\"zona_disponible\":null}"));
        assertEquals("sinDatos", notificar(200, "{\"predicciones\":[]}"));
        assertTrue(notificar(404, "").contains("404"));
    }
}
