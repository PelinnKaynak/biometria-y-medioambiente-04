package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Arrays;
import java.util.List;

public class MisDatosTest {

    @Test
    public void resumen_ordenaMedicionesYCalculaDistanciaYCalidadMedia() {
        List<MedicionDiaria> mediciones = Arrays.asList(
                new MedicionDiaria(120, 3000, 0, 2),
                new MedicionDiaria(80, 1000, 0, 0),
                new MedicionDiaria(100, 2000, 0, 1));

        ResumenMisDatos resumen = ResumenMisDatos.calcular(mediciones);

        assertEquals(80, resumen.mediciones.get(0).valor, 0.001);
        assertEquals(100, resumen.calidadMedia, 0.001);
        assertEquals(NivelOzono.BUENO, resumen.nivelMedio);
        assertEquals(222.39, resumen.distanciaKm, 0.2);
    }

    @Test
    public void resumen_sinMedicionesNoInventaValores() {
        ResumenMisDatos resumen = ResumenMisDatos.calcular(java.util.Collections.emptyList());

        assertEquals(0, resumen.distanciaKm, 0);
        assertNull(resumen.calidadMedia);
        assertNull(resumen.nivelMedio);
    }

    @Test
    public void desdeJSON_leeCoordenadasOrdenaYDescartaFilasInvalidas() {
        List<MedicionDiaria> mediciones = MedicionDiaria.listaDesdeJSON("["
                + "{\"valor\":100,\"fecha\":\"2026-11-19T10:02:00Z\",\"latitud\":0,\"longitud\":1},"
                + "{\"valor\":80,\"fecha\":\"2026-11-19T10:01:00Z\",\"latitud\":0,\"longitud\":0},"
                + "{\"valor\":-1,\"fecha\":\"2026-11-19T10:03:00Z\",\"latitud\":0,\"longitud\":2},"
                + "{\"valor\":90,\"fecha\":\"ayer\",\"latitud\":0,\"longitud\":2}]");

        assertEquals(2, mediciones.size());
        assertEquals(80, mediciones.get(0).valor, 0.001);
        assertEquals(1, mediciones.get(1).longitud, 0.001);
        assertTrue(MedicionDiaria.listaDesdeJSON("[]").isEmpty());
        assertNull(MedicionDiaria.listaDesdeJSON("no es JSON"));
    }
}
