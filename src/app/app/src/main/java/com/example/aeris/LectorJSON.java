// ---------------------------------------------------------------------------
// Fichero:     LectorJSON.java
// Descripción: Lectura segura de campos de texto y de fechas de un JSON del
//              servidor. El org.json de Android devuelve el texto «null» con
//              optString() cuando el campo vale null, y ese texto acabaría en
//              la pantalla. Lo usan Incidencia y MensajeIncidencia (T043).
// Autores:     Equipo 04 – SenseTech
// Fecha:       20/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONObject;

import java.time.Instant;
import java.time.format.DateTimeParseException;

// LectorJSON class: reads fields of a JSONObject without ever returning "null".
final class LectorJSON {

    private LectorJSON() {
    }

    // -----------------------------------------------------------------------
    // json: JSONObject, clave: Text --> texto() --x
    // Text <--
    // What it does: the text of the field, or "" if it is missing, JSON null
    //               or says «null».
    // -----------------------------------------------------------------------
    static String texto(JSONObject json, String clave) {
        if (json.isNull(clave)) {
            return "";
        }
        String valor = json.optString(clave, "");
        return valor == null || valor.trim().equalsIgnoreCase("null") ? "" : valor;
    }

    // -----------------------------------------------------------------------
    // json: JSONObject, clave: Text --> fechaMs() --x
    // Z <--
    // What it does: the date ISO-8601 (UTC, like "2026-11-19T10:00:00.000Z") of
    //               the field in milliseconds, or 0 if there is none or it is not valid.
    // -----------------------------------------------------------------------
    static long fechaMs(JSONObject json, String clave) {
        String texto = texto(json, clave);
        if (texto.isEmpty()) {
            return 0;
        }
        try {
            return Instant.parse(texto).toEpochMilli();
        } catch (DateTimeParseException noEsFecha) {
            return 0;
        }
    }
}
