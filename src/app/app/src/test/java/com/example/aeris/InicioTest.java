// ---------------------------------------------------------------------------
// Fichero:     InicioTest.java
// Descripción: Tests de la pantalla de inicio: lectura de las mediciones,
//              «hace X min», aviso de más de 1 hora, respuestas del servidor y
//              pestañas de la barra de navegación. Tarea T006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       12/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

public class InicioTest {

    private static final long MIN = TiempoTranscurrido.MINUTO;
    private static final long AHORA = Instant.parse("2026-11-12T17:46:00Z").toEpochMilli();

    // Apunta qué callback de RespuestaMediciones se ha llamado
    private static class MedicionesApuntadas implements LogicaFakeInicio.RespuestaMediciones {
        String llamado;
        List<Medicion> mediciones;
        boolean deEjemplo;
        String mensaje;

        @Override
        public void medicionesObtenidas(List<Medicion> lista, boolean ejemplo) {
            llamado = "obtenidas";
            mediciones = lista;
            deEjemplo = ejemplo;
        }

        @Override
        public void sesionCaducada() {
            llamado = "caducada";
        }

        @Override
        public void error(String texto) {
            llamado = "error";
            mensaje = texto;
        }
    }

    // --- Medicion --------------------------------------------------------------

    @Test
    public void medicion_nivelSegunElValor() {
        assertEquals(NivelOzono.BUENO, new Medicion(84, AHORA).nivel());
        assertEquals(NivelOzono.MODERADO, new Medicion(150, AHORA).nivel());
        assertEquals(NivelOzono.MALO, new Medicion(200, AHORA).nivel());
        assertEquals(NivelOzono.MUY_MALO, new Medicion(260, AHORA).nivel());
        assertEquals(85, new Medicion(84.6, AHORA).valorRedondeado());
    }

    @Test
    public void medicion_leeLaListaDeLaMasNuevaALaMasAntigua() {
        List<Medicion> lista = Medicion.listaDesdeJSON("["
                + "{\"valor\": 90, \"fecha\": \"2026-11-12T17:22:00Z\"},"
                + "{\"valor\": 84, \"fecha\": \"2026-11-12T17:42:00Z\"},"
                + "{\"valor\": 96, \"fecha\": " + (AHORA - 64 * MIN) + "}]");
        assertNotNull(lista);
        assertEquals(3, lista.size());
        assertEquals(84, lista.get(0).valor, 0.001);
        assertEquals(AHORA - 4 * MIN, lista.get(0).momento);
        assertEquals(96, lista.get(2).valor, 0.001);
    }

    @Test
    public void medicion_saltaLasNoValidasYRechazaLoQueNoEsUnaLista() {
        List<Medicion> lista = Medicion.listaDesdeJSON("["
                + "{\"valor\": -3, \"fecha\": \"2026-11-12T17:42:00Z\"},"
                + "{\"valor\": 50, \"fecha\": \"ayer\"},"
                + "{\"valor\": 50},"
                + "{\"valor\": 70, \"fecha\": \"2026-11-12T17:42:00Z\"}]");
        assertEquals(1, lista.size());
        assertEquals(70, lista.get(0).valor, 0.001);

        assertTrue(Medicion.listaDesdeJSON("[]").isEmpty());
        assertNull(Medicion.listaDesdeJSON("{\"valor\": 84}"));
        assertNull(Medicion.listaDesdeJSON(""));
        assertNull(Medicion.listaDesdeJSON(null));
    }

    // --- TiempoTranscurrido ----------------------------------------------------

    @Test
    public void tiempo_haceCuanto() {
        assertEquals("ahora mismo", TiempoTranscurrido.haceCuanto(AHORA - 30_000, AHORA));
        assertEquals("ahora mismo", TiempoTranscurrido.haceCuanto(AHORA + 5 * MIN, AHORA));
        assertEquals("hace 5 min", TiempoTranscurrido.haceCuanto(AHORA - 5 * MIN, AHORA));
        assertEquals("hace 59 min", TiempoTranscurrido.haceCuanto(AHORA - 59 * MIN, AHORA));
        assertEquals("hace 2 h", TiempoTranscurrido.haceCuanto(AHORA - 130 * MIN, AHORA));
        assertEquals("hace 1 día", TiempoTranscurrido.haceCuanto(AHORA - 25 * 60 * MIN, AHORA));
        assertEquals("hace 3 días", TiempoTranscurrido.haceCuanto(AHORA - 3 * TiempoTranscurrido.DIA, AHORA));
    }

    @Test
    public void tiempo_avisaSiPasaMasDeUnaHora() {
        assertFalse(TiempoTranscurrido.esAntigua(AHORA - 59 * MIN, AHORA));
        assertFalse(TiempoTranscurrido.esAntigua(AHORA - 60 * MIN, AHORA));
        assertTrue(TiempoTranscurrido.esAntigua(AHORA - 61 * MIN, AHORA));
    }

    @Test
    public void tiempo_horaEnLaZona() {
        assertEquals("18:42", TiempoTranscurrido.hora(AHORA - 4 * MIN, ZoneId.of("Europe/Madrid")));
        assertEquals("17:42", TiempoTranscurrido.hora(AHORA - 4 * MIN, ZoneId.of("UTC")));
    }

    @Test
    public void tiempo_horaODiaParaLasNotificaciones() {
        ZoneId madrid = ZoneId.of("Europe/Madrid");
        assertEquals("18:42", TiempoTranscurrido.horaODia(AHORA - 4 * MIN, AHORA, madrid));
        assertEquals("Ayer", TiempoTranscurrido.horaODia(AHORA - TiempoTranscurrido.DIA, AHORA, madrid));
        assertEquals("09/11", TiempoTranscurrido.horaODia(AHORA - 3 * TiempoTranscurrido.DIA, AHORA, madrid));
    }

    // --- Aviso -----------------------------------------------------------------

    @Test
    public void avisos_sinNadaRaroNoHayAvisos() {
        List<Medicion> lista = LogicaFakeInicio.medicionesDeEjemplo(AHORA);
        assertTrue(Aviso.calcular(lista, true, AHORA).isEmpty());
        assertTrue(Aviso.calcular(java.util.Collections.emptyList(), true, AHORA).isEmpty());
        assertTrue(Aviso.calcular(null, false, AHORA).isEmpty());
    }

    @Test
    public void avisos_contaminacionAltaPorEncimaDe180() {
        List<Medicion> lista = java.util.Arrays.asList(new Medicion(181, AHORA - 2 * MIN));
        List<Aviso> avisos = Aviso.calcular(lista, false, AHORA);
        assertEquals(1, avisos.size());
        assertEquals(Aviso.Tipo.CONTAMINACION, avisos.get(0).tipo);
        assertTrue(Aviso.calcular(java.util.Arrays.asList(new Medicion(180, AHORA)), false, AHORA).isEmpty());
    }

    @Test
    public void avisos_sensorDesconectadoSoloConSensor() {
        List<Medicion> lista = java.util.Arrays.asList(new Medicion(84, AHORA - 2 * TiempoTranscurrido.HORA));
        List<Aviso> avisos = Aviso.calcular(lista, true, AHORA);
        assertEquals(1, avisos.size());
        assertEquals(Aviso.Tipo.DESCONECTADO, avisos.get(0).tipo);
        assertTrue(avisos.get(0).texto.contains("hace 2 h"));
        assertTrue(Aviso.calcular(lista, false, AHORA).isEmpty());
    }

    @Test
    public void avisos_losTresDeEjemploDelFigma() {
        List<Aviso> avisos = LogicaFakeInicio.avisosDeEjemplo(AHORA);
        assertEquals(3, avisos.size());
        assertEquals(Aviso.Tipo.CONTAMINACION, avisos.get(0).tipo);
        assertEquals(Aviso.Tipo.BATERIA, avisos.get(1).tipo);
        assertEquals(Aviso.Tipo.DESCONECTADO, avisos.get(2).tipo);
    }

    @Test
    public void avisos_cuantosSinLeerYClaves() {
        List<Aviso> avisos = LogicaFakeInicio.avisosDeEjemplo(AHORA);
        java.util.Set<String> leidos = new java.util.HashSet<>();
        assertEquals(3, Aviso.cuantosSinLeer(avisos, leidos));
        leidos.add("ejemplo:BATERIA");
        assertEquals(2, Aviso.cuantosSinLeer(avisos, leidos));
        // los de ejemplo tienen la misma clave aunque se creen en otro momento
        assertEquals(avisos.get(0).clave, LogicaFakeInicio.avisosDeEjemplo(AHORA + 5 * MIN).get(0).clave);
        // los calculados: TIPO:momento de la medición
        Aviso alto = Aviso.calcular(java.util.Arrays.asList(new Medicion(200, AHORA)), false, AHORA).get(0);
        assertEquals("CONTAMINACION:" + AHORA, alto.clave);
    }

    // --- LogicaFakeInicio ------------------------------------------------------

    @Test
    public void ejemplo_cuatroMedicionesRecientesDeLaMasNueva() {
        List<Medicion> lista = LogicaFakeInicio.medicionesDeEjemplo(AHORA);
        assertEquals(LogicaFakeInicio.CANTIDAD, lista.size());
        assertEquals(84, lista.get(0).valor, 0.001);
        assertFalse(TiempoTranscurrido.esAntigua(lista.get(0).momento, AHORA));
        for (int i = 1; i < lista.size(); i++) {
            assertTrue(lista.get(i - 1).momento > lista.get(i).momento);
        }
    }

    @Test
    public void servidor_200DevuelveComoMucho5Mediciones() {
        MedicionesApuntadas r = new MedicionesApuntadas();
        StringBuilder json = new StringBuilder("[");
        for (int i = 0; i < 7; i++) {
            json.append(i == 0 ? "" : ",").append("{\"valor\": ").append(80 + i)
                    .append(", \"fecha\": ").append(AHORA - i * 20 * MIN).append("}");
        }
        LogicaFakeInicio.notificarMediciones(200, json.append("]").toString(), r);
        assertEquals("obtenidas", r.llamado);
        assertEquals(5, r.mediciones.size());
        assertEquals(80, r.mediciones.get(0).valor, 0.001);
        assertFalse(r.deEjemplo);
    }

    @Test
    public void servidor_200SinMedicionesDevuelveListaVacia() {
        MedicionesApuntadas r = new MedicionesApuntadas();
        LogicaFakeInicio.notificarMediciones(200, "[]", r);
        assertEquals("obtenidas", r.llamado);
        assertTrue(r.mediciones.isEmpty());
    }

    @Test
    public void servidor_erroresYSesionCaducada() {
        MedicionesApuntadas r = new MedicionesApuntadas();
        LogicaFakeInicio.notificarMediciones(401, "", r);
        assertEquals("caducada", r.llamado);

        MedicionesApuntadas r2 = new MedicionesApuntadas();
        LogicaFakeInicio.notificarMediciones(0, null, r2);
        assertEquals("error", r2.llamado);
        assertTrue(r2.mensaje.contains("conexión"));

        MedicionesApuntadas r3 = new MedicionesApuntadas();
        LogicaFakeInicio.notificarMediciones(500, "", r3);
        assertTrue(r3.mensaje.contains("500"));

        MedicionesApuntadas r4 = new MedicionesApuntadas();
        LogicaFakeInicio.notificarMediciones(200, "no es json", r4);
        assertEquals("error", r4.llamado);
    }

    @Test
    public void sensor_deEjemploHastaT017() {
        assertTrue(LogicaFakeInicio.tieneSensor(true));
        assertEquals(LogicaFakeInicio.SENSOR_DE_EJEMPLO, LogicaFakeInicio.tieneSensor(false));
    }

    // --- Barra de navegación y tarjeta de nivel ---------------------------------

    @Test
    public void barra_todasLasPestanyasAbrenUnaPantalla() {
        for (BarraNavegacion.Pestanya pestanya : BarraNavegacion.Pestanya.values()) {
            assertNotNull(pestanya.name(), BarraNavegacion.pantallaDe(pestanya));
        }
        assertEquals(InicioActivity.class, BarraNavegacion.pantallaDe(BarraNavegacion.Pestanya.INICIO));
        assertEquals(ProximamenteActivity.class, BarraNavegacion.pantallaDe(BarraNavegacion.Pestanya.MAPA));
        assertEquals(ProximamenteActivity.Seccion.MAPA,
                ProximamenteActivity.seccionDe(BarraNavegacion.Pestanya.MAPA));
        assertEquals(ProximamenteActivity.Seccion.MI_SENSOR, ProximamenteActivity.Seccion.valueOf("MI_SENSOR"));
        assertEquals(ProximamenteActivity.Seccion.MIS_DATOS,
                ProximamenteActivity.seccionDe(BarraNavegacion.Pestanya.MIS_DATOS));
        assertNull(ProximamenteActivity.seccionDe(BarraNavegacion.Pestanya.PERFIL));
    }

    @Test
    public void nivel_colorYTextoDeCadaNivel() {
        assertEquals(R.color.nivel_bueno, InicioActivity.colorDe(NivelOzono.BUENO));
        assertEquals(R.color.nivel_muy_malo, InicioActivity.colorDe(NivelOzono.MUY_MALO));
        assertEquals(R.string.inicio_mensaje_moderado, InicioActivity.mensajeDe(NivelOzono.MODERADO));
        assertEquals(R.string.inicio_calidad_mala, InicioActivity.nombreDe(NivelOzono.MALO));
    }
}
