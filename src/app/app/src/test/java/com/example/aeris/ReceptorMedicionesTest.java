// ---------------------------------------------------------------------------
// Fichero:     ReceptorMedicionesTest.java
// Descripción: Tests de ReceptorMediciones y ColaMediciones (T023).
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class ReceptorMedicionesTest {

    private static final String SERIE = "092021011003";

    private static TramaAERIS ozono(int contador, int valor) {
        return TramaAERIS.leer(TramaAERISTest.trama(SERIE, TramaAERIS.OZONO, contador, valor));
    }

    @Test
    public void guardaComoMuchoUnaPorMinutoYNoRepite() {
        ReceptorMediciones r = new ReceptorMediciones();
        assertTrue(r.esNueva(ozono(1, 84), 0));
        assertFalse(r.esNueva(ozono(1, 84), 500));                 // la misma trama repetida
        assertFalse(r.esNueva(ozono(2, 85), 9_000));               // nueva, pero antes del minuto
        assertTrue(r.esNueva(ozono(8, 90), 61_000));
        assertFalse(r.esNueva(ozono(8, 90), 200_000));             // mismo contador
        assertTrue(r.esNueva(ozono(9, 91), 200_000));
    }

    @Test
    public void laTemperaturaNoSeGuarda() {
        ReceptorMediciones r = new ReceptorMediciones();
        assertFalse(r.esNueva(TramaAERIS.leer(TramaAERISTest.trama(SERIE, TramaAERIS.TEMPERATURA, 1, 215)), 0));
        assertTrue(r.esNueva(ozono(1, 84), 0));
    }

    @Test
    public void cuerpoConElFormatoDelServidor() {
        long momento = 1_795_000_000_123L;          // con milisegundos: se quitan
        assertEquals("{\"numeroSerie\":\"092021011003\",\"contaminante\":\"O3\",\"valor\":84,"
                        + "\"latitud\":38.996500,\"longitud\":-0.166300,\"fecha\":\"2026-11-18T11:06:40Z\"}",
                ReceptorMediciones.cuerpo(SERIE, 84, 38.9965, -0.1663, momento));
        assertTrue(ReceptorMediciones.cuerpo(SERIE, -3, 0, 0, 0).contains("\"valor\":0,"));
        assertTrue(ReceptorMediciones.cuerpo(SERIE, 5000, 0, 0, 0).contains("\"valor\":2000,"));
    }

    @Test
    public void queHacerSegunLaRespuesta() {
        assertEquals(ReceptorMediciones.Resultado.ENVIADA, ReceptorMediciones.queHacer(201));
        assertEquals(ReceptorMediciones.Resultado.ENVIADA, ReceptorMediciones.queHacer(200));
        assertEquals(ReceptorMediciones.Resultado.SIN_SESION, ReceptorMediciones.queHacer(401));
        assertEquals(ReceptorMediciones.Resultado.REINTENTAR, ReceptorMediciones.queHacer(0));
        assertEquals(ReceptorMediciones.Resultado.REINTENTAR, ReceptorMediciones.queHacer(503));
        assertEquals(ReceptorMediciones.Resultado.DESCARTAR, ReceptorMediciones.queHacer(400));
        assertEquals(ReceptorMediciones.Resultado.DESCARTAR, ReceptorMediciones.queHacer(403));
        assertEquals(ReceptorMediciones.Resultado.DESCARTAR, ReceptorMediciones.queHacer(404));
    }

    @Test
    public void colaEnOrdenYDeIdaYVueltaATexto() {
        ColaMediciones c = ColaMediciones.desdeTexto("a\n\n b \nc");
        assertEquals(3, c.tamano());
        assertEquals("a", c.primero());
        c.quitarPrimero();
        c.anadir("d");
        assertEquals("b\nc\nd", c.aTexto());
        assertTrue(ColaMediciones.desdeTexto(null).vacia());
        assertNull(ColaMediciones.desdeTexto("").primero());
    }

    @Test
    public void colaLlenaPierdeLasMasAntiguas() {
        ColaMediciones c = new ColaMediciones();
        for (int i = 0; i < ColaMediciones.MAXIMO + 3; i++) {
            c.anadir("m" + i);
        }
        assertEquals(ColaMediciones.MAXIMO, c.tamano());
        assertEquals("m3", c.primero());
    }
}
