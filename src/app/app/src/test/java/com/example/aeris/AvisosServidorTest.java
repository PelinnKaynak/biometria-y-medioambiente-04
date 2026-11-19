// ---------------------------------------------------------------------------
// Fichero:     AvisosServidorTest.java
// Descripción: Tests del panel de notificaciones con los avisos del servidor
//              (GET /avisos, T008): lectura de un aviso con y sin
//              coordenadas, descarte de los que no tienen los datos
//              imprescindibles, respuestas del servidor, paginación con
//              desdeId (avance, parada, tope), los 20 más recientes, la lista
//              que junta los del servidor y los locales y el contador de sin
//              leer al marcar solo uno.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class AvisosServidorTest {

    private static final long BASE = Instant.parse("2026-11-19T10:00:00Z").toEpochMilli();

    // Apunta qué callback de RespuestaAvisos se ha llamado (y cuántas veces)
    private static class AvisosApuntados implements LogicaFakeAvisos.RespuestaAvisos {
        String llamado;
        int llamadas = 0;
        List<Aviso> avisos;
        String mensaje;

        @Override
        public void avisosObtenidos(List<Aviso> lista) {
            llamado = "obtenidos";
            llamadas++;
            avisos = lista;
        }

        @Override
        public void sesionCaducada() {
            llamado = "caducada";
            llamadas++;
        }

        @Override
        public void error(String texto) {
            llamado = "error";
            llamadas++;
            mensaje = texto;
        }
    }

    // Una fila de GET /avisos
    private static String fila(long id, String tipo, double valor, String zona, Double lat, Double lon,
                               String fecha) {
        return "{\"idAviso\":" + id + ",\"tipo\":\"" + tipo + "\",\"contaminante\":\"O3\",\"valor\":" + valor
                + ",\"unidad\":\"µg/m³\",\"zona\":" + (zona == null ? "null" : "\"" + zona + "\"")
                + ",\"latitud\":" + lat + ",\"longitud\":" + lon + ",\"fechaCreacion\":\"" + fecha + "\"}";
    }

    // Una fila completa de un lugar: el aviso id ocurre `id` minutos después de BASE
    private static String filaDeLugar(long id) {
        return fila(id, "lugar", 200, "Casa (Gandía)", 38.9965, -0.1663,
                Instant.ofEpochMilli(BASE + id * 60_000).toString());
    }

    private static String pagina(long desde, long hasta) {
        StringBuilder texto = new StringBuilder("[");
        for (long id = desde; id <= hasta; id++) {
            texto.append(id > desde ? "," : "").append(filaDeLugar(id));
        }
        return texto.append("]").toString();
    }

    // Servidor falso: responde con las páginas que se le den y apunta los desdeId pedidos
    private static class ServidorFalso implements LogicaFakeAvisos.Servidor {
        final List<Long> pedidos = new ArrayList<>();
        final List<String> paginas;
        final int codigo;

        ServidorFalso(int codigo, String... paginas) {
            this.codigo = codigo;
            this.paginas = Arrays.asList(paginas);
        }

        @Override
        public void pedir(long desdeId, PeticionarioREST.RespuestaREST respuesta) {
            int numero = pedidos.size();
            pedidos.add(desdeId);
            // la última página se repite si piden más (un servidor que no avanza)
            String cuerpo = paginas.get(Math.min(numero, paginas.size() - 1));
            respuesta.callback(codigo, cuerpo);
        }
    }

    // --- Aviso del servidor ----------------------------------------------------

    @Test
    public void aviso_deLugarConZonaYCoordenadas() {
        List<Aviso> lista = Aviso.listaDesdeJSON("[" + fila(7, "lugar", 200, "Casa (Gandía)", 38.9965, -0.1663,
                "2026-11-19T10:05:00.123Z") + "]");
        assertNotNull(lista);
        assertEquals(1, lista.size());
        Aviso aviso = lista.get(0);
        assertEquals(Aviso.Tipo.CONTAMINACION, aviso.tipo);
        assertEquals("AVISO:7", aviso.clave);
        assertEquals("Contaminación alta", aviso.titulo);
        assertEquals("200 µg/m³ de ozono en Casa (Gandía).", aviso.texto);
        assertEquals("Casa (Gandía)", aviso.zona);
        assertEquals(38.9965, aviso.latitud, 0.0);
        assertEquals(-0.1663, aviso.longitud, 0.0);
        assertTrue(aviso.tieneZona());
        assertEquals(Instant.parse("2026-11-19T10:05:00.123Z").toEpochMilli(), aviso.momento);
    }

    @Test
    public void aviso_personalHablaDeTuSensorYNoEnseniaLasCoordenadasComoZona() {
        Aviso aviso = Aviso.listaDesdeJSON("[" + fila(3, "personal", 250, "38.99650, -0.16630", 38.9965,
                -0.1663, "2026-11-19T10:00:00Z") + "]").get(0);
        assertEquals("Contaminación muy alta", aviso.titulo);
        assertEquals("250 µg/m³ de ozono cerca de tu sensor.", aviso.texto);
        assertEquals("Cerca de tu sensor", aviso.zona);
        assertTrue(aviso.tieneZona());
    }

    @Test
    public void aviso_tituloSegunElNivelDelValor() {
        assertEquals("Contaminación baja", tituloDe(90));
        assertEquals("Contaminación moderada", tituloDe(180));
        assertEquals("Contaminación alta", tituloDe(181));
        assertEquals("Contaminación alta", tituloDe(240));
        assertEquals("Contaminación muy alta", tituloDe(241));
    }

    private static String tituloDe(double valor) {
        return Aviso.listaDesdeJSON("[" + fila(1, "lugar", valor, "Casa", 1.0, 1.0, "2026-11-19T10:00:00Z")
                + "]").get(0).titulo;
    }

    @Test
    public void aviso_sinCoordenadasSeConservaPeroNoAbreElMapa() {
        // El aviso es válido: solo le faltan las coordenadas (null, ausentes o fuera de rango)
        String sinCoordenadas = "{\"idAviso\":1,\"valor\":200,\"zona\":\"Casa\",\"latitud\":null,"
                + "\"longitud\":null,\"fechaCreacion\":\"2026-11-19T10:00:00Z\"}";
        String ausentes = "{\"idAviso\":2,\"valor\":200,\"fechaCreacion\":\"2026-11-19T10:00:00Z\"}";
        String fuera = fila(3, "lugar", 200, "Casa", 123.0, -0.16, "2026-11-19T10:00:00Z");
        String mediaPareja = "{\"idAviso\":4,\"valor\":200,\"latitud\":38.9,\"fechaCreacion\":\"2026-11-19T10:00:00Z\"}";
        List<Aviso> lista = Aviso.listaDesdeJSON("[" + sinCoordenadas + "," + ausentes + "," + fuera + ","
                + mediaPareja + "]");
        assertEquals(4, lista.size());
        for (Aviso aviso : lista) {
            assertFalse(aviso.clave, aviso.tieneZona());
            assertNull(aviso.latitud);
            assertNull(aviso.longitud);
        }
        assertEquals("200 µg/m³ de ozono en Casa.", lista.get(0).texto);
        assertEquals("200 µg/m³ de ozono.", lista.get(1).texto);
    }

    @Test
    public void aviso_sinDatosImprescindiblesSeDescarta() {
        String sinId = "{\"valor\":200,\"fechaCreacion\":\"2026-11-19T10:00:00Z\"}";
        String idCero = "{\"idAviso\":0,\"valor\":200,\"fechaCreacion\":\"2026-11-19T10:00:00Z\"}";
        String idDecimal = "{\"idAviso\":1.5,\"valor\":200,\"fechaCreacion\":\"2026-11-19T10:00:00Z\"}";
        String sinValor = "{\"idAviso\":3,\"fechaCreacion\":\"2026-11-19T10:00:00Z\"}";
        String valorNegativo = "{\"idAviso\":4,\"valor\":-5,\"fechaCreacion\":\"2026-11-19T10:00:00Z\"}";
        String sinFecha = "{\"idAviso\":5,\"valor\":200}";
        String fechaMala = "{\"idAviso\":6,\"valor\":200,\"fechaCreacion\":\"ayer\"}";
        String valorTexto = "{\"idAviso\":7,\"valor\":\"200\",\"fechaCreacion\":\"2026-11-19T10:00:00Z\"}";
        String buena = filaDeLugar(8);
        List<Aviso> lista = Aviso.listaDesdeJSON("[" + sinId + "," + idCero + "," + idDecimal + "," + sinValor
                + "," + valorNegativo + "," + sinFecha + "," + fechaMala + "," + valorTexto + ",5," + buena + "]");
        assertEquals(1, lista.size());
        assertEquals("AVISO:8", lista.get(0).clave);
    }

    @Test
    public void aviso_cuerpoQueNoEsUnaListaDevuelveNull() {
        assertNull(Aviso.listaDesdeJSON(null));
        assertNull(Aviso.listaDesdeJSON(""));
        assertNull(Aviso.listaDesdeJSON("no es json"));
        assertNull(Aviso.listaDesdeJSON("{\"error\":\"x\"}"));
        assertTrue(Aviso.listaDesdeJSON("[]").isEmpty());
    }

    @Test
    public void aviso_losAntiguosSiguenSinCoordenadasEnElConstructor() {
        Aviso local = new Aviso(Aviso.Tipo.DESCONECTADO, "Sensor desconectado", "x", BASE);
        assertFalse(local.tieneZona());
        assertNull(local.zona);
        Aviso fueraDeRango = new Aviso(Aviso.Tipo.CONTAMINACION, "t", "x", BASE, "k", "Z", 95.0, 10.0);
        assertFalse(fueraDeRango.tieneZona());
        assertTrue(new Aviso(Aviso.Tipo.CONTAMINACION, "t", "x", BASE, "k", "Z", -90.0, 180.0).tieneZona());
    }

    // --- Respuestas del servidor -----------------------------------------------

    @Test
    public void servidor_200ConAvisos() {
        AvisosApuntados apuntado = new AvisosApuntados();
        ServidorFalso servidor = new ServidorFalso(200, pagina(1, 3));
        LogicaFakeAvisos.obtenerAvisos(servidor, apuntado);
        assertEquals("obtenidos", apuntado.llamado);
        assertEquals(1, apuntado.llamadas);
        assertEquals(3, apuntado.avisos.size());
        // del más nuevo al más antiguo
        assertEquals("AVISO:3", apuntado.avisos.get(0).clave);
        assertEquals("AVISO:1", apuntado.avisos.get(2).clave);
        assertEquals(Arrays.asList(0L), servidor.pedidos);
    }

    @Test
    public void servidor_200SinAvisosDevuelveListaVacia() {
        AvisosApuntados apuntado = new AvisosApuntados();
        LogicaFakeAvisos.obtenerAvisos(new ServidorFalso(200, "[]"), apuntado);
        assertEquals("obtenidos", apuntado.llamado);
        assertTrue(apuntado.avisos.isEmpty());
    }

    @Test
    public void servidor_erroresYSesionCaducada() {
        AvisosApuntados caducada = new AvisosApuntados();
        LogicaFakeAvisos.obtenerAvisos(new ServidorFalso(401, "{}"), caducada);
        assertEquals("caducada", caducada.llamado);

        AvisosApuntados sinConexion = new AvisosApuntados();
        LogicaFakeAvisos.obtenerAvisos(new ServidorFalso(0, ""), sinConexion);
        assertEquals("error", sinConexion.llamado);
        assertEquals(LogicaFakePerfil.MENSAJE_SIN_CONEXION, sinConexion.mensaje);

        AvisosApuntados fallo = new AvisosApuntados();
        LogicaFakeAvisos.obtenerAvisos(new ServidorFalso(500, "{}"), fallo);
        assertEquals("error", fallo.llamado);
        assertTrue(fallo.mensaje.contains("500"));

        AvisosApuntados roto = new AvisosApuntados();
        LogicaFakeAvisos.obtenerAvisos(new ServidorFalso(200, "no es json"), roto);
        assertEquals("error", roto.llamado);
        assertEquals("Respuesta del servidor no válida.", roto.mensaje);
    }

    // --- Paginación con desdeId -------------------------------------------------

    @Test
    public void paginacion_avanzaConElUltimoIdYSeParaConLaPaginaIncompleta() {
        ServidorFalso servidor = new ServidorFalso(200, pagina(1, 100), pagina(101, 200), pagina(201, 230));
        AvisosApuntados apuntado = new AvisosApuntados();
        LogicaFakeAvisos.obtenerAvisos(servidor, apuntado);
        assertEquals(Arrays.asList(0L, 100L, 200L), servidor.pedidos);
        assertEquals(1, apuntado.llamadas);
        assertEquals("obtenidos", apuntado.llamado);
        // los 20 más recientes de los 230: del 230 al 211
        assertEquals(20, apuntado.avisos.size());
        assertEquals("AVISO:230", apuntado.avisos.get(0).clave);
        assertEquals("AVISO:211", apuntado.avisos.get(19).clave);
    }

    @Test
    public void paginacion_conPaginaCompletaPideUnaMasYSeParaSiVieneVacia() {
        ServidorFalso servidor = new ServidorFalso(200, pagina(1, 100), "[]");
        AvisosApuntados apuntado = new AvisosApuntados();
        LogicaFakeAvisos.obtenerAvisos(servidor, apuntado);
        assertEquals(Arrays.asList(0L, 100L), servidor.pedidos);
        assertEquals(20, apuntado.avisos.size());
        assertEquals("AVISO:100", apuntado.avisos.get(0).clave);
    }

    @Test
    public void paginacion_noHaceBucleSiElServidorNoAvanza() {
        // el servidor devuelve siempre la misma página llena: el cursor no se mueve
        ServidorFalso servidor = new ServidorFalso(200, pagina(1, 100));
        AvisosApuntados apuntado = new AvisosApuntados();
        LogicaFakeAvisos.obtenerAvisos(servidor, apuntado);
        assertEquals(Arrays.asList(0L, 100L), servidor.pedidos);
        assertEquals(1, apuntado.llamadas);
        assertEquals(20, apuntado.avisos.size());
    }

    @Test
    public void paginacion_unaFilaInvalidaNoDetieneElCursor() {
        // 99 buenos y una fila sin datos con el id 100: la página está llena y el cursor llega a 100
        String invalida = "{\"idAviso\":100,\"valor\":\"mal\"}";
        String cuerpo = pagina(1, 99).replace("]", "," + invalida + "]");
        ServidorFalso servidor = new ServidorFalso(200, cuerpo, pagina(101, 102));
        AvisosApuntados apuntado = new AvisosApuntados();
        LogicaFakeAvisos.obtenerAvisos(servidor, apuntado);
        assertEquals(Arrays.asList(0L, 100L), servidor.pedidos);
        assertEquals("AVISO:102", apuntado.avisos.get(0).clave);
        assertEquals("AVISO:101", apuntado.avisos.get(1).clave);
        assertEquals("AVISO:99", apuntado.avisos.get(2).clave);
    }

    @Test
    public void paginacion_unaPaginaSinNingunIdValidoSePara() {
        // 100 filas rotas: no hay cursor al que avanzar
        StringBuilder rotas = new StringBuilder("[");
        for (int i = 0; i < LogicaFakeAvisos.TAMANO_PAGINA; i++) {
            rotas.append(i > 0 ? "," : "").append("{\"valor\":1}");
        }
        ServidorFalso servidor = new ServidorFalso(200, rotas.append("]").toString());
        AvisosApuntados apuntado = new AvisosApuntados();
        LogicaFakeAvisos.obtenerAvisos(servidor, apuntado);
        assertEquals(1, servidor.pedidos.size());
        assertTrue(apuntado.avisos.isEmpty());
    }

    @Test
    public void paginacion_tieneUnTopeDePaginas() {
        // cada página avanza 100 ids y siempre viene llena: se para en MAX_PAGINAS
        String[] paginas = new String[LogicaFakeAvisos.MAX_PAGINAS + 10];
        for (int i = 0; i < paginas.length; i++) {
            paginas[i] = pagina(i * 100L + 1, i * 100L + 100);
        }
        ServidorFalso servidor = new ServidorFalso(200, paginas);
        AvisosApuntados apuntado = new AvisosApuntados();
        LogicaFakeAvisos.obtenerAvisos(servidor, apuntado);
        assertEquals(LogicaFakeAvisos.MAX_PAGINAS, servidor.pedidos.size());
        assertEquals(1, apuntado.llamadas);
        assertEquals(20, apuntado.avisos.size());
        assertEquals("AVISO:" + LogicaFakeAvisos.MAX_PAGINAS * 100L, apuntado.avisos.get(0).clave);
    }

    @Test
    public void paginacion_siFallaUnaPaginaSeNotificaUnSoloError() {
        ServidorFalso servidor = new ServidorFalso(200, pagina(1, 100)) {
            @Override
            public void pedir(long desdeId, PeticionarioREST.RespuestaREST respuesta) {
                pedidos.add(desdeId);
                if (pedidos.size() == 1) {
                    respuesta.callback(200, pagina(1, 100));
                } else {
                    respuesta.callback(500, "{}");
                }
            }
        };
        AvisosApuntados apuntado = new AvisosApuntados();
        LogicaFakeAvisos.obtenerAvisos(servidor, apuntado);
        assertEquals(1, apuntado.llamadas);
        assertEquals("error", apuntado.llamado);
        assertEquals(Arrays.asList(0L, 100L), servidor.pedidos);
    }

    @Test
    public void paginacion_hayOtraPaginaSoloSiLlenaYAvanza() {
        LogicaFakeAvisos.Pagina llena = new LogicaFakeAvisos.Pagina(new ArrayList<>(), 100, 100);
        LogicaFakeAvisos.Pagina incompleta = new LogicaFakeAvisos.Pagina(new ArrayList<>(), 99, 99);
        assertTrue(LogicaFakeAvisos.hayOtraPagina(llena, 0, 1));
        assertFalse(LogicaFakeAvisos.hayOtraPagina(llena, 100, 2));      // no avanza
        assertFalse(LogicaFakeAvisos.hayOtraPagina(llena, 200, 2));      // retrocede
        assertFalse(LogicaFakeAvisos.hayOtraPagina(incompleta, 0, 1));
        assertFalse(LogicaFakeAvisos.hayOtraPagina(llena, 0, LogicaFakeAvisos.MAX_PAGINAS));
    }

    // --- Los más recientes y la lista del panel ---------------------------------

    @Test
    public void masRecientes_ordenaDeMasNuevoAMasAntiguoSinRepetirYConLimite() {
        List<Aviso> avisos = new ArrayList<>(Aviso.listaDesdeJSON(pagina(1, 30)));
        avisos.addAll(Aviso.listaDesdeJSON(pagina(25, 30)));            // repetidos
        List<Aviso> recientes = LogicaFakeAvisos.masRecientes(avisos, LogicaFakeAvisos.MAX_AVISOS);
        assertEquals(20, recientes.size());
        assertEquals("AVISO:30", recientes.get(0).clave);
        assertEquals("AVISO:11", recientes.get(19).clave);
        Set<String> claves = new HashSet<>();
        for (Aviso aviso : recientes) {
            assertTrue(claves.add(aviso.clave));
        }
        assertEquals(3, LogicaFakeAvisos.masRecientes(Aviso.listaDesdeJSON(pagina(1, 3)), 20).size());
    }

    @Test
    public void masRecientes_conLaMismaFechaVaPrimeroElIdMayor() {
        String fecha = "2026-11-19T10:00:00Z";
        List<Aviso> avisos = Aviso.listaDesdeJSON("[" + fila(1, "lugar", 200, "A", 1.0, 1.0, fecha) + ","
                + fila(2, "lugar", 200, "B", 1.0, 1.0, fecha) + "]");
        List<Aviso> recientes = LogicaFakeAvisos.masRecientes(avisos, 20);
        assertEquals("AVISO:2", recientes.get(0).clave);
    }

    @Test
    public void combinar_juntaServidorYLocalesSinRepetirLaContaminacionLocal() {
        long ahora = BASE + 10 * 60_000;
        List<Aviso> delServidor = Aviso.listaDesdeJSON(pagina(1, 2));
        // 200 µg/m³ ahora: Aviso.calcular daría «contaminación» (la del servidor la sustituye)
        // y el sensor lleva 2 h sin dar datos
        List<Medicion> mediciones = Arrays.asList(new Medicion(200, ahora - 2 * TiempoTranscurrido.HORA));
        List<Aviso> locales = Aviso.calcular(mediciones, true, ahora);
        assertEquals(2, locales.size());
        List<Aviso> lista = LogicaFakeAvisos.combinar(delServidor, locales);
        assertEquals(3, lista.size());
        int contaminacion = 0;
        for (Aviso aviso : lista) {
            if (aviso.tipo == Aviso.Tipo.CONTAMINACION) {
                contaminacion++;
                assertTrue(aviso.clave.startsWith("AVISO:"));
            }
        }
        assertEquals(2, contaminacion);
        // del más nuevo al más antiguo
        assertEquals("AVISO:2", lista.get(0).clave);
        assertEquals(Aviso.Tipo.DESCONECTADO, lista.get(2).tipo);
    }

    @Test
    public void combinar_sinNadaDaListaVacia() {
        assertTrue(LogicaFakeAvisos.combinar(new ArrayList<>(), new ArrayList<>()).isEmpty());
    }

    // --- Contador de sin leer ----------------------------------------------------

    @Test
    public void contador_marcarUnoSoloDejaLosDemasSinLeer() {
        List<Aviso> avisos = Aviso.listaDesdeJSON(pagina(1, 3));
        Set<String> leidos = new HashSet<>();
        assertEquals(3, Aviso.cuantosSinLeer(avisos, leidos));
        leidos.add("AVISO:2");                                          // solo el pulsado
        assertEquals(2, Aviso.cuantosSinLeer(avisos, leidos));
        leidos.add("AVISO:99");                                         // uno que ya no está en la lista
        assertEquals(2, Aviso.cuantosSinLeer(avisos, leidos));
        // un aviso nuevo del servidor aparece como sin leer
        List<Aviso> conNuevo = Aviso.listaDesdeJSON(pagina(1, 4));
        assertEquals(3, Aviso.cuantosSinLeer(conNuevo, leidos));
    }
}
