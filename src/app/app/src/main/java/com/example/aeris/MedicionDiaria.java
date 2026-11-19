// ---------------------------------------------------------------------------
// Fichero:     MedicionDiaria.java
// Descripción: Medición de ozono con hora y ubicación para la pantalla T007.
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

public final class MedicionDiaria {

    public final double valor;
    public final long momento;
    public final double latitud;
    public final double longitud;

    public MedicionDiaria(double valor, long momento, double latitud, double longitud) {
        this.valor = valor;
        this.momento = momento;
        this.latitud = latitud;
        this.longitud = longitud;
    }

    // Reads the authenticated API response and returns valid readings oldest first.
    static List<MedicionDiaria> listaDesdeJSON(String cuerpo) {
        if (cuerpo == null || cuerpo.isEmpty()) {
            return null;
        }
        try {
            JSONArray array = new JSONArray(cuerpo);
            List<MedicionDiaria> mediciones = new ArrayList<>();
            for (int i = 0; i < array.length(); i++) {
                JSONObject json = array.optJSONObject(i);
                MedicionDiaria medicion = json == null ? null : desdeJSON(json);
                if (medicion != null) {
                    mediciones.add(medicion);
                }
            }
            Collections.sort(mediciones, (a, b) -> Long.compare(a.momento, b.momento));
            return mediciones;
        } catch (JSONException error) {
            return null;
        }
    }

    private static MedicionDiaria desdeJSON(JSONObject json) {
        double valor = json.optDouble("valor", Double.NaN);
        double latitud = json.optDouble("latitud", Double.NaN);
        double longitud = json.optDouble("longitud", Double.NaN);
        Object fecha = json.opt("fecha");
        long momento;
        if (fecha instanceof Number) {
            momento = ((Number) fecha).longValue();
        } else if (fecha instanceof String) {
            try {
                momento = Instant.parse((String) fecha).toEpochMilli();
            } catch (DateTimeParseException error) {
                return null;
            }
        } else {
            return null;
        }
        if (Double.isNaN(valor) || Double.isInfinite(valor) || valor < 0
                || valor > ReceptorMediciones.VALOR_MAXIMO
                || Double.isNaN(latitud) || Double.isInfinite(latitud) || latitud < -90 || latitud > 90
                || Double.isNaN(longitud) || Double.isInfinite(longitud) || longitud < -180 || longitud > 180) {
            return null;
        }
        return new MedicionDiaria(valor, momento, latitud, longitud);
    }
}
