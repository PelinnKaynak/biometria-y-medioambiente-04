// ---------------------------------------------------------------------------
// Fichero:     Medicion.java
// Descripción: Una medición de ozono: el valor en µg/m³ y el momento en que se
//              tomó. La usa la pantalla de inicio para la calidad del aire
//              actual y las últimas mediciones. Lee la respuesta de
//              GET /ultimasMediciones (T017). Diseño en doc/app_design.md.
//              Tarea T006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       12/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

// Medicion class: one ozone measurement (value and moment).
public class Medicion {

    public final double valor;      // µg/m³
    public final long momento;      // milisegundos desde 1970 (UTC)

    // -----------------------------------------------------------------------
    // valor: R, momento: Z --> constructor()
    // -----------------------------------------------------------------------
    public Medicion(double valor, long momento) {
        this.valor = valor;
        this.momento = momento;
    }

    // -----------------------------------------------------------------------
    // nivel() --x
    // NivelOzono <--
    // What it does: the level of the value (Bueno, Moderado, Malo, Muy malo).
    // -----------------------------------------------------------------------
    public NivelOzono nivel() {
        return NivelOzono.desdeValor(valor);
    }

    // -----------------------------------------------------------------------
    // valorRedondeado() --x
    // Z <--
    // What it does: the value without decimals, as it is shown on screen.
    // -----------------------------------------------------------------------
    public long valorRedondeado() {
        return Math.round(valor);
    }

    // -----------------------------------------------------------------------
    // cuerpo: Text --> listaDesdeJSON() --x
    // [Medicion] | null <--
    // What it does: reads [{"valor": 84, "fecha": "2026-11-11T17:42:00Z"}, ...]
    //               from the answer of GET /ultimasMediciones. "fecha" can be
    //               an ISO text (what MySQL gives) or milliseconds. Items
    //               without a valid valor or fecha are skipped. The list is
    //               returned from the newest to the oldest. Returns null if
    //               the text is not a JSON array.
    // -----------------------------------------------------------------------
    static List<Medicion> listaDesdeJSON(String cuerpo) {
        if (cuerpo == null || cuerpo.isEmpty()) {
            return null;
        }
        try {
            JSONArray array = new JSONArray(cuerpo);
            List<Medicion> lista = new ArrayList<>();
            for (int i = 0; i < array.length(); i++) {
                JSONObject json = array.optJSONObject(i);
                Medicion medicion = json == null ? null : desdeJSON(json);
                if (medicion != null) {
                    lista.add(medicion);
                }
            }
            Collections.sort(lista, (a, b) -> Long.compare(b.momento, a.momento));
            return lista;
        } catch (JSONException error) {
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // json: JSONObject --> desdeJSON() --x                                 (privado)
    // Medicion | null <--
    // -----------------------------------------------------------------------
    private static Medicion desdeJSON(JSONObject json) {
        double valor = json.optDouble("valor", Double.NaN);
        if (Double.isNaN(valor) || valor < 0) {
            return null;
        }
        Object fecha = json.opt("fecha");
        if (fecha instanceof Number) {
            return new Medicion(valor, ((Number) fecha).longValue());
        }
        if (fecha instanceof String) {
            try {
                return new Medicion(valor, Instant.parse((String) fecha).toEpochMilli());
            } catch (DateTimeParseException error) {
                return null;
            }
        }
        return null;
    }
}
