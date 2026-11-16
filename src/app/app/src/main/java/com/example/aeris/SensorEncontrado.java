// ---------------------------------------------------------------------------
// Fichero:     SensorEncontrado.java
// Descripción: Un sensor AERIS encontrado por Bluetooth en «Vincular sensor»:
//              su nombre, la intensidad de la señal (RSSI) y la distancia
//              aproximada, y los textos que se enseñan en la fila
//              («Señal fuerte · a 0,5 m»). Diseño en doc/app_design.md. T005.
// Autores:     Equipo 04 – SenseTech
// Fecha:       05/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.util.Locale;

// SensorEncontrado class: one sensor found by the Bluetooth search.
public class SensorEncontrado {

    // Límites de la señal (RSSI en dBm): cuanto más cerca de 0, más fuerte
    static final int RSSI_FUERTE = -60;
    static final int RSSI_MEDIA = -75;

    public final String nombre;
    public final int rssi;
    public final double distanciaMetros;

    // -----------------------------------------------------------------------
    // nombre: Text, rssi: Z, distanciaMetros: R --> constructor()
    // -----------------------------------------------------------------------
    public SensorEncontrado(String nombre, int rssi, double distanciaMetros) {
        this.nombre = nombre;
        this.rssi = rssi;
        this.distanciaMetros = distanciaMetros;
    }

    // -----------------------------------------------------------------------
    // detalle() --x
    // Text <--
    // What it does: the second line of the row, e.g. "Señal fuerte · a 0,5 m".
    // -----------------------------------------------------------------------
    public String detalle() {
        return textoSenal(rssi) + " · " + textoDistancia(distanciaMetros);
    }

    // -----------------------------------------------------------------------
    // rssi: Z --> textoSenal() --x
    // Text <--
    // What it does: -60 dBm or more -> "Señal fuerte"; from -75 -> "Señal
    //               media"; less -> "Señal débil".
    // -----------------------------------------------------------------------
    static String textoSenal(int rssi) {
        if (rssi >= RSSI_FUERTE) {
            return "Señal fuerte";
        }
        return rssi >= RSSI_MEDIA ? "Señal media" : "Señal débil";
    }

    // -----------------------------------------------------------------------
    // metros: R --> textoDistancia() --x
    // Text <--
    // What it does: under 1 m with one decimal and a comma ("a 0,5 m"); from
    //               1 m, rounded to whole metres ("a 2 m").
    // -----------------------------------------------------------------------
    static String textoDistancia(double metros) {
        if (metros < 1) {
            return String.format(Locale.forLanguageTag("es-ES"), "a %.1f m", metros);
        }
        return "a " + Math.round(metros) + " m";
    }
}
