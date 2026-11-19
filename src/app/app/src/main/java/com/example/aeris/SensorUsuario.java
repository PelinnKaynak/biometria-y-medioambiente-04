package com.example.aeris;

import org.json.JSONException;
import org.json.JSONObject;

import java.time.Instant;
import java.time.format.DateTimeParseException;

public final class SensorUsuario {

    static final long UMBRAL_CONEXION_MS = 24L * 60L * 60L * 1000L;

    public final String nombre;
    public final String numeroSerie;
    public final Integer bateria;
    public final Long ultimaConexionMs;

    SensorUsuario(String nombre, String numeroSerie, Integer bateria, Long ultimaConexionMs) {
        this.nombre = nombre;
        this.numeroSerie = numeroSerie;
        this.bateria = bateria;
        this.ultimaConexionMs = ultimaConexionMs;
    }

    static SensorUsuario desdeJSON(String cuerpo) {
        if (cuerpo == null || cuerpo.isEmpty()) {
            return null;
        }
        try {
            JSONObject json = new JSONObject(cuerpo);
            String nombre = json.optString("nombre", "");
            String numeroSerie = json.optString("numeroSerie", "");
            if (nombre.trim().isEmpty() || numeroSerie.trim().isEmpty()) {
                return null;
            }

            Integer bateria = null;
            if (!json.isNull("bateria")) {
                bateria = json.getInt("bateria");
                if (bateria < 0 || bateria > 100) {
                    return null;
                }
            }

            Long ultimaConexionMs = null;
            if (!json.isNull("ultimaConexion")) {
                ultimaConexionMs = Instant.parse(json.getString("ultimaConexion")).toEpochMilli();
            }
            return new SensorUsuario(nombre, numeroSerie, bateria, ultimaConexionMs);
        } catch (JSONException | DateTimeParseException error) {
            return null;
        }
    }

    public boolean estaConectado(long ahoraMs) {
        return ultimaConexionMs != null && ahoraMs >= ultimaConexionMs
                && ahoraMs - ultimaConexionMs <= UMBRAL_CONEXION_MS;
    }
}
