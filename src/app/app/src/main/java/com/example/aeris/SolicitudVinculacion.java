// ---------------------------------------------------------------------------
// Fichero:     SolicitudVinculacion.java
// Descripción: La petición de vincular un sensor a la cuenta. Al pulsar
//              «Vincular» el servidor envía un correo a la persona que compró
//              el sensor (puede ser otra, si se lo han regalado) y la
//              vinculación queda pendiente hasta que la confirma o la rechaza.
//              Lee la respuesta del servidor y prepara los textos de la
//              pantalla (correo oculto y «hoy, 18:40»). Diseño en
//              doc/app_design.md. T005.
// Autores:     Equipo 04 – SenseTech
// Fecha:       13/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONException;
import org.json.JSONObject;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;

// SolicitudVinculacion class: a request to link a sensor, waiting for the e-mail.
public class SolicitudVinculacion {

    // Estados de la solicitud (en el JSON van en minúsculas)
    public enum Estado { PENDIENTE, CONFIRMADA, RECHAZADA }

    public final String numeroSerie;
    public final String correoComprador;    // ya oculto, p. ej. «m•••••@gmail.com»
    public final Estado estado;
    public final long momento;              // cuándo se pidió (ms desde 1970, UTC)

    // -----------------------------------------------------------------------
    // numeroSerie: Text, correoComprador: Text, estado: Estado, momento: Z
    // --> constructor()
    // -----------------------------------------------------------------------
    public SolicitudVinculacion(String numeroSerie, String correoComprador, Estado estado, long momento) {
        this.numeroSerie = numeroSerie;
        this.correoComprador = correoComprador;
        this.estado = estado;
        this.momento = momento;
    }

    // -----------------------------------------------------------------------
    // json: Text --> desdeJSON() --x
    // SolicitudVinculacion | null <--
    // What it does: reads {"numeroSerie", "correoComprador", "estado",
    //               "fecha"} (estado: pendiente, confirmada or rechazada;
    //               fecha in ISO 8601, UTC). Anything missing or unknown: null.
    // -----------------------------------------------------------------------
    public static SolicitudVinculacion desdeJSON(String json) {
        if (json == null) {
            return null;
        }
        try {
            JSONObject objeto = new JSONObject(json);
            String serie = objeto.getString("numeroSerie");
            String correo = objeto.getString("correoComprador");
            Estado estado = Estado.valueOf(objeto.getString("estado").toUpperCase(Locale.ROOT));
            long momento = Instant.parse(objeto.getString("fecha")).toEpochMilli();
            return new SolicitudVinculacion(serie, correo, estado, momento);
        } catch (JSONException | IllegalArgumentException | DateTimeParseException error) {
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // correo: Text --> ocultarCorreo() --x
    // Text <--
    // What it does: keeps the first letter and the domain:
    //               «maria.lopez@gmail.com» -> «m•••••@gmail.com». The real
    //               server sends it already hidden; this is for the example
    //               data. Without «@» it hides everything: «•••••».
    // -----------------------------------------------------------------------
    public static String ocultarCorreo(String correo) {
        if (correo == null) {
            return "•••••";
        }
        int arroba = correo.indexOf('@');
        if (arroba <= 0) {
            return "•••••";
        }
        return correo.charAt(0) + "•••••" + correo.substring(arroba);
    }

    // -----------------------------------------------------------------------
    // momento: Z, ahora: Z, zona: ZoneId --> cuando() --x
    // Text <--
    // What it does: «hoy, 18:40», «ayer, 18:40» or «12 nov, 18:40» in that
    //               time zone.
    // -----------------------------------------------------------------------
    public static String cuando(long momento, long ahora, ZoneId zona) {
        ZonedDateTime fecha = Instant.ofEpochMilli(momento).atZone(zona);
        LocalDate hoy = Instant.ofEpochMilli(ahora).atZone(zona).toLocalDate();
        String hora = fecha.format(DateTimeFormatter.ofPattern("HH:mm"));
        if (fecha.toLocalDate().equals(hoy)) {
            return "hoy, " + hora;
        }
        if (fecha.toLocalDate().equals(hoy.minusDays(1))) {
            return "ayer, " + hora;
        }
        String dia = fecha.format(DateTimeFormatter.ofPattern("d MMM", Locale.forLanguageTag("es-ES")));
        return dia.replace(".", "") + ", " + hora;
    }
}
