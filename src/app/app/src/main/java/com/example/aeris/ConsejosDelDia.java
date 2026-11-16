// ---------------------------------------------------------------------------
// Fichero:     ConsejosDelDia.java
// Descripción: Elige qué consejo se enseña en la tarjeta «Consejo de hoy» de la
//              pantalla «Información»: cada día empieza por uno distinto y
//              después van pasando solos o al tocar la tarjeta.
//              Diseño en doc/app_design.md. Tarea T009.
// Autores:     Equipo 04 – SenseTech
// Fecha:       11/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

// ConsejosDelDia class: index of the tip to show.
public class ConsejosDelDia {

    // -----------------------------------------------------------------------
    // diaDelAnyo: N, total: N --> deHoy() --x
    // N <--
    // What it does: the first tip of the day (0..total-1): each day of the
    //               year starts with the next one. 0 if there are no tips.
    // -----------------------------------------------------------------------
    public static int deHoy(int diaDelAnyo, int total) {
        if (total <= 0) {
            return 0;
        }
        return Math.floorMod(diaDelAnyo, total);
    }

    // -----------------------------------------------------------------------
    // actual: N, total: N --> siguiente() --x
    // N <--
    // What it does: the next tip; after the last one comes the first again.
    // -----------------------------------------------------------------------
    public static int siguiente(int actual, int total) {
        if (total <= 0) {
            return 0;
        }
        return Math.floorMod(actual + 1, total);
    }
}
