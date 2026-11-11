// ---------------------------------------------------------------------------
// Fichero:     NivelOzono.java
// Descripción: Los cuatro niveles de ozono de AERIS (Bueno, Moderado, Malo y
//              Muy malo) con sus límites en µg/m³, los mismos que el mapa de la
//              web. Lo usa la pantalla «Información» y lo podrá usar Inicio.
//              Diseño en doc/app_design.md. Tarea T009.
// Autores:     Equipo 04 – SenseTech
// Fecha:       11/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

// NivelOzono enum: level of ozone for a concentration in µg/m³.
public enum NivelOzono {

    // Límite superior de cada nivel (µg/m³). Muy malo no tiene límite.
    BUENO(100),         // valor guía de la OMS (2021)
    MODERADO(180),      // umbral de información (Directiva 2008/50/CE)
    MALO(240),          // umbral de alerta
    MUY_MALO(Double.POSITIVE_INFINITY);

    public final double limiteSuperior;

    NivelOzono(double limiteSuperior) {
        this.limiteSuperior = limiteSuperior;
    }

    // -----------------------------------------------------------------------
    // microgramos: R --> desdeValor() --x
    // NivelOzono <--
    // What it does: the level of a concentration: up to 100 Bueno, up to 180
    //               Moderado, up to 240 Malo and more Muy malo. A negative
    //               value (sensor error) counts as Bueno.
    // -----------------------------------------------------------------------
    public static NivelOzono desdeValor(double microgramos) {
        for (NivelOzono nivel : values()) {
            if (microgramos <= nivel.limiteSuperior) {
                return nivel;
            }
        }
        return MUY_MALO;
    }
}
