// ---------------------------------------------------------------------------
// Fichero:     PrevisionTest.java
// Descripción: Pruebas de la previsión de ozono de 48 horas: lectura del JSON,
//              niveles de NivelOzono, mejor momento para salir y respuestas del
//              servidor (200, 400, 503, 504, sin conexión). T032.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class PrevisionTest {

    // JSON como el del servidor: n horas consecutivas desde 'inicio' con los valores dados
    private static String json(LocalDateTime inicio, double... valores) {
        StringBuilder lista = new StringBuilder();
        for (int i = 0; i < valores.length; i++) {
            if (i > 0) {
                lista.append(",");
            }
            lista.append("{\"fecha_hora\":\"").append(inicio.plusHours(i))
                    .append("\",\"ozono_predicho\":").append(valores[i])
                    .append(",\"nivel\":\"alto\"}");
        }
        return "{\"zona\":\"Gandia\",\"simulados\":true,\"advertencia\":\"Datos simulados\","
                + "\"modelo\":\"m.joblib\",\"ultima_observacion_utilizada\":\"2026-11-19T10:00:00\","
                + "\"predicciones\":[" + lista + "]}";
    }

    private static final LocalDateTime MEDIANOCHE = LocalDateTime.of(2026, 11, 20, 0, 0);

    // 48 horas: 50 de madrugada, subida a mediodía, pico de 130 a las 15:00
    private static double[] cuarentaYOchoHoras() {
        double[] v = new double[48];
        for (int i = 0; i < 48; i++) {
            int h = i % 24;
            v[i] = h == 15 ? 130 : (h >= 11 && h <= 18 ? 90 : 40 + h);
        }
        return v;
    }

    @Test
    public void desdeJSON_leeLosDatos() {
        PrevisionOzono p = PrevisionOzono.desdeJSON(json(MEDIANOCHE, cuarentaYOchoHoras()));
        assertNotNull(p);
        assertEquals("Gandia", p.zona);
        assertTrue(p.simulados);
        assertEquals("Datos simulados", p.advertencia);
        assertEquals(48, p.horas.size());
        assertEquals(130, p.pico.ozono, 0.001);
        assertEquals(15, p.pico.fecha.getHour());
    }

    @Test
    public void desdeJSON_sinPrediccionesOInvalido_devuelveNull() {
        assertNull(PrevisionOzono.desdeJSON(null));
        assertNull(PrevisionOzono.desdeJSON(""));
        assertNull(PrevisionOzono.desdeJSON("no es json"));
        assertNull(PrevisionOzono.desdeJSON("{\"zona\":\"Gandia\"}"));
        assertNull(PrevisionOzono.desdeJSON("{\"predicciones\":[]}"));
    }

    @Test
    public void desdeJSON_saltaLasHorasIncorrectas() {
        String cuerpo = "{\"simulados\":true,\"predicciones\":["
                + "{\"fecha_hora\":\"ayer\",\"ozono_predicho\":50},"
                + "{\"fecha_hora\":\"2026-11-20T10:00:00\",\"ozono_predicho\":\"abc\"},"
                + "{\"fecha_hora\":\"2026-11-20T11:00:00\"},"
                + "{\"fecha_hora\":\"2026-11-20T12:00:00\",\"ozono_predicho\":70}]}";
        PrevisionOzono p = PrevisionOzono.desdeJSON(cuerpo);
        assertNotNull(p);
        assertEquals(1, p.horas.size());
        assertEquals(70, p.horas.get(0).ozono, 0.001);
    }

    @Test
    public void nivel_usaNivelOzonoYNoElDeLaApi() {
        // La API dice "alto" para todo; la app usa 100 / 180 / 240
        PrevisionOzono p = PrevisionOzono.desdeJSON(json(MEDIANOCHE, 99, 130, 200, 300));
        assertEquals(NivelOzono.BUENO, p.horas.get(0).nivel());
        assertEquals(NivelOzono.MODERADO, p.horas.get(1).nivel());
        assertEquals(NivelOzono.MALO, p.horas.get(2).nivel());
        assertEquals(NivelOzono.MUY_MALO, p.horas.get(3).nivel());
        assertEquals(NivelOzono.MUY_MALO, p.pico.nivel());
    }

    @Test
    public void mejorMomento_sonDosHorasConsecutivasDeDia() {
        // Las horas de madrugada valen menos pero no cuentan: solo de 07:00 a 22:00
        PrevisionOzono p = PrevisionOzono.desdeJSON(json(MEDIANOCHE, cuarentaYOchoHoras()));
        PrevisionOzono.Franja f = p.mejorMomento();
        assertEquals(2, f.horas);
        assertEquals(7, f.inicio.getHour());          // 47 y 48 µg/m³ a las 07:00 y 08:00
        assertEquals(9, f.fin.getHour());
        assertEquals(47.5, f.media, 0.001);
    }

    @Test
    public void mejorMomento_noMezclaHorasNoConsecutivas() {
        // Huecos en la lista: 08:00 y 12:00 son baratas pero no consecutivas
        String cuerpo = "{\"predicciones\":["
                + "{\"fecha_hora\":\"2026-11-20T08:00:00\",\"ozono_predicho\":10},"
                + "{\"fecha_hora\":\"2026-11-20T12:00:00\",\"ozono_predicho\":10},"
                + "{\"fecha_hora\":\"2026-11-20T13:00:00\",\"ozono_predicho\":50}]}";
        PrevisionOzono.Franja f = PrevisionOzono.desdeJSON(cuerpo).mejorMomento();
        assertEquals(12, f.inicio.getHour());
        assertEquals(30, f.media, 0.001);
    }

    @Test
    public void mejorMomento_sinFranjaDeDia_usaLaHoraMasBajaDeTodas() {
        PrevisionOzono p = PrevisionOzono.desdeJSON(json(MEDIANOCHE, 30, 20, 25));
        PrevisionOzono.Franja f = p.mejorMomento();
        assertEquals(1, f.horas);
        assertEquals(1, f.inicio.getHour());
        assertEquals(20, f.media, 0.001);
    }

    @Test
    public void mejorMomento_unaSolaHoraDeDia() {
        PrevisionOzono p = PrevisionOzono.desdeJSON(json(LocalDateTime.of(2026, 11, 20, 12, 0), 80));
        PrevisionOzono.Franja f = p.mejorMomento();
        assertEquals(1, f.horas);
        assertEquals(12, f.inicio.getHour());
    }

    @Test
    public void diasDesdeHoy_conLaFechaDeLaUltimaObservacion() {
        // Última observación: 19/11 a las 10:00; la previsión empieza el 19/11 a las 11:00
        PrevisionOzono p = PrevisionOzono.desdeJSON(json(LocalDateTime.of(2026, 11, 19, 11, 0), 50, 60));
        assertEquals(0, p.diasDesdeHoy(LocalDateTime.of(2026, 11, 19, 23, 0)));
        assertEquals(1, p.diasDesdeHoy(LocalDateTime.of(2026, 11, 20, 0, 0)));
        assertEquals(2, p.diasDesdeHoy(LocalDateTime.of(2026, 11, 21, 12, 0)));
    }

    @Test
    public void escalaDeLaGrafica_llegaSiempreAlLimiteDeBueno() {
        assertEquals(100, GraficaPrevision.escalaMaxima(0), 0.001);
        assertEquals(100, GraficaPrevision.escalaMaxima(68.86), 0.001);
        assertEquals(100, GraficaPrevision.escalaMaxima(90.9), 0.001);      // 90,9 * 1,1 = 100
        assertEquals(150, GraficaPrevision.escalaMaxima(130), 0.001);
        assertEquals(300, GraficaPrevision.escalaMaxima(250), 0.001);
    }

    @Test
    public void conservaElJSONOriginal() {
        String cuerpo = json(MEDIANOCHE, 50, 60);
        assertEquals(cuerpo, PrevisionOzono.desdeJSON(cuerpo).json);
    }

    // ---- Respuestas del servidor ----

    private static class Capturador implements LogicaFakePrevision.RespuestaPrevision {
        final List<String> eventos = new ArrayList<>();

        @Override public void previsionObtenida(PrevisionOzono p) { eventos.add("ok"); }
        @Override public void zonaSinModelo(String zona) { eventos.add("zona:" + zona); }
        @Override public void sinDatos() { eventos.add("sinDatos"); }
        @Override public void error(String mensaje) { eventos.add("error:" + mensaje); }
    }

    private static String notificar(int codigo, String cuerpo) {
        Capturador c = new Capturador();
        LogicaFakePrevision.notificarPrevision(codigo, cuerpo, c);
        assertEquals(1, c.eventos.size());
        return c.eventos.get(0);
    }

    @Test
    public void respuesta200_conDatos() {
        assertEquals("ok", notificar(200, json(MEDIANOCHE, 50, 60)));
    }

    @Test
    public void respuesta200_sinDatos() {
        assertEquals("sinDatos", notificar(200, "{\"predicciones\":[]}"));
        assertEquals("sinDatos", notificar(200, "basura"));
        assertEquals("sinDatos", notificar(200, ""));
    }

    @Test
    public void respuesta400_zonaSinModelo() {
        assertEquals("zona:Gandia", notificar(400,
                "{\"error\":\"x\",\"zona_solicitada\":\"Valencia\",\"zona_disponible\":\"Gandia\"}"));
        assertEquals("zona:Gandia", notificar(400, ""));
    }

    @Test
    public void respuestasDeError() {
        assertEquals("error:" + LogicaFakePrevision.MENSAJE_SERVICIO_NO_DISPONIBLE, notificar(503, "{}"));
        assertEquals("error:" + LogicaFakePrevision.MENSAJE_TIEMPO_AGOTADO, notificar(504, "{}"));
        assertEquals("error:" + LogicaFakePrevision.MENSAJE_SIN_CONEXION, notificar(0, "(IOException)"));
        assertTrue(notificar(500, "").contains("500"));
    }

    @Test
    public void crearURL_codificaLaZona() {
        assertEquals(LogicaFakeRegistro.URL_SERVIDOR + "/api/prevision/ozono?zona=Gandia",
                LogicaFakePrevision.crearURL("Gandia"));
        assertTrue(LogicaFakePrevision.crearURL("La Safor").endsWith("zona=La+Safor"));
    }
}
