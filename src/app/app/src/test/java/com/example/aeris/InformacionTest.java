// ---------------------------------------------------------------------------
// Fichero:     InformacionTest.java
// Descripción: Pruebas de la lógica de la pantalla «Información»: niveles de
//              ozono (NivelOzono), consejo del día (ConsejosDelDia) y la
//              pestaña «Info» de la barra de navegación. T009.
// Autores:     Equipo 04 – SenseTech
// Fecha:       11/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class InformacionTest {

    @Test
    public void nivelOzono_limites() {
        assertEquals(NivelOzono.BUENO, NivelOzono.desdeValor(0));
        assertEquals(NivelOzono.BUENO, NivelOzono.desdeValor(100));
        assertEquals(NivelOzono.MODERADO, NivelOzono.desdeValor(100.5));
        assertEquals(NivelOzono.MODERADO, NivelOzono.desdeValor(180));
        assertEquals(NivelOzono.MALO, NivelOzono.desdeValor(181));
        assertEquals(NivelOzono.MALO, NivelOzono.desdeValor(240));
        assertEquals(NivelOzono.MUY_MALO, NivelOzono.desdeValor(241));
        assertEquals(NivelOzono.BUENO, NivelOzono.desdeValor(-5));
    }

    @Test
    public void consejoDeHoy_cambiaCadaDia() {
        assertEquals(0, ConsejosDelDia.deHoy(0, 5));
        assertEquals(1, ConsejosDelDia.deHoy(1, 5));
        assertEquals(0, ConsejosDelDia.deHoy(5, 5));
        assertEquals(0, ConsejosDelDia.deHoy(3, 0));
    }

    @Test
    public void consejoSiguiente_vuelveAlPrimero() {
        assertEquals(1, ConsejosDelDia.siguiente(0, 3));
        assertEquals(0, ConsejosDelDia.siguiente(2, 3));
        assertEquals(0, ConsejosDelDia.siguiente(0, 0));
    }

    @Test
    public void pestanyaInfo_abreInformacion() {
        assertEquals(InformacionActivity.class, BarraNavegacion.pantallaDe(BarraNavegacion.Pestanya.INFO));
    }
}
