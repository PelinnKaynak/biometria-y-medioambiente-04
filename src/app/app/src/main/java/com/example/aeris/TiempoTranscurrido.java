// ---------------------------------------------------------------------------
// Fichero:     TiempoTranscurrido.java
// Descripción: Textos de tiempo de la pantalla de inicio: «hace 5 min», la
//              hora «18:42» y si una medición es antigua (más de 1 hora sin
//              datos nuevos, H006). Diseño en doc/app_design.md. Tarea T006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       12/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

// TiempoTranscurrido class: how long ago a measurement was taken.
public class TiempoTranscurrido {

    static final long MINUTO = 60_000L;
    static final long HORA = 60 * MINUTO;
    static final long DIA = 24 * HORA;

    // A partir de aquí la última medición se avisa como antigua (H006)
    static final long LIMITE_ANTIGUA = HORA;

    private static final DateTimeFormatter FORMATO_HORA = DateTimeFormatter.ofPattern("HH:mm");

    // -----------------------------------------------------------------------
    // momento: Z, ahora: Z --> haceCuanto() --x
    // Text <--
    // What it does: «ahora mismo» (less than 1 min, or a moment in the future
    //               because the clocks are not equal), «hace 5 min»,
    //               «hace 2 h» or «hace 3 días» («hace 1 día»).
    // -----------------------------------------------------------------------
    public static String haceCuanto(long momento, long ahora) {
        long pasado = ahora - momento;
        if (pasado < MINUTO) {
            return "ahora mismo";
        }
        if (pasado < HORA) {
            return "hace " + (pasado / MINUTO) + " min";
        }
        if (pasado < DIA) {
            return "hace " + (pasado / HORA) + " h";
        }
        long dias = pasado / DIA;
        return "hace " + dias + (dias == 1 ? " día" : " días");
    }

    // -----------------------------------------------------------------------
    // momento: Z, ahora: Z --> esAntigua() --x
    // B <--
    // What it does: true if more than 1 hour has passed since the moment.
    // -----------------------------------------------------------------------
    public static boolean esAntigua(long momento, long ahora) {
        return ahora - momento > LIMITE_ANTIGUA;
    }

    // -----------------------------------------------------------------------
    // momento: Z, zona: ZoneId --> hora() --x
    // Text <--
    // What it does: the hour of the moment in the zone, like «18:42».
    // -----------------------------------------------------------------------
    public static String hora(long momento, ZoneId zona) {
        return FORMATO_HORA.format(Instant.ofEpochMilli(momento).atZone(zona));
    }

    // -----------------------------------------------------------------------
    // momento: Z, ahora: Z, zona: ZoneId --> horaODia() --x
    // Text <--
    // What it does: the hour if it is today («18:42»), «Ayer» if it was
    //               yesterday and the date if it is older («09/11»). Used by
    //               the notifications.
    // -----------------------------------------------------------------------
    public static String horaODia(long momento, long ahora, ZoneId zona) {
        LocalDate dia = Instant.ofEpochMilli(momento).atZone(zona).toLocalDate();
        LocalDate hoy = Instant.ofEpochMilli(ahora).atZone(zona).toLocalDate();
        if (!dia.isBefore(hoy)) {
            return hora(momento, zona);
        }
        if (dia.equals(hoy.minusDays(1))) {
            return "Ayer";
        }
        return DateTimeFormatter.ofPattern("dd/MM").format(dia);
    }
}
