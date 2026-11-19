// ---------------------------------------------------------------------------
// Fichero:     Lugar.java
// Descripción: Modelo de datos para un lugar habitual del usuario (T019, H034).
//              Contiene nombre, dirección, coordenadas, concentración de ozono
//              actual (obtenida del mapa interpolado) y estado del interruptor
//              de avisos.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Locale;
import java.util.Objects;

// Lugar class: represents a saved place for the user with ozone level and alert switch.
public class Lugar {

    public final int id;
    public final int idUsuario;
    public final String nombre;
    public final String tipo;
    public final String direccion;
    public final double latitud;
    public final double longitud;
    public final Double ozonoActual;
    public boolean avisosActivos;

    // -----------------------------------------------------------------------
    // id: Z, idUsuario: Z, nombre: Text, direccion: Text, latitud: R,
    // longitud: R, ozonoActual: R, avisosActivos: B --> Lugar() -->
    // What it does: constructs a place with full details.
    // -----------------------------------------------------------------------
    public Lugar(int id, int idUsuario, String nombre, String direccion,
                 double latitud, double longitud, double ozonoActual, boolean avisosActivos) {
        this(id, idUsuario, nombre, "otro", direccion, latitud, longitud, ozonoActual, avisosActivos);
    }

    public Lugar(int id, int idUsuario, String nombre, String tipo, String direccion,
                 double latitud, double longitud, Double ozonoActual, boolean avisosActivos) {
        this.id = id;
        this.idUsuario = idUsuario;
        this.nombre = nombre != null ? nombre.trim() : "";
        this.tipo = tipo != null ? tipo.trim() : "otro";
        this.direccion = direccion != null ? direccion.trim() : "";
        this.latitud = latitud;
        this.longitud = longitud;
        this.ozonoActual = ozonoActual;
        this.avisosActivos = avisosActivos;
    }

    // -----------------------------------------------------------------------
    // id: Z, nombre: Text, direccion: Text, ozonoActual: R, avisosActivos: B --> Lugar() -->
    // What it does: simplified constructor with default coordinates.
    // -----------------------------------------------------------------------
    public Lugar(int id, String nombre, String direccion, double ozonoActual, boolean avisosActivos) {
        this(id, 0, nombre, direccion, 0.0, 0.0, ozonoActual, avisosActivos);
    }

    // -----------------------------------------------------------------------
    // nivelOzono() --x
    // NivelOzono <--
    // What it does: returns the ozone level (BUENO, MODERADO, MALO, MUY_MALO)
    //               for the current ozone value.
    // -----------------------------------------------------------------------
    public NivelOzono nivelOzono() {
        return ozonoActual == null ? null : NivelOzono.desdeValor(ozonoActual);
    }

    // -----------------------------------------------------------------------
    // textoOzono() --x
    // Text <--
    // What it does: returns the ozone value formatted with µg/m³.
    // -----------------------------------------------------------------------
    public String textoOzono() {
        return ozonoActual == null
                ? "Sin datos recientes"
                : String.format(Locale.getDefault(), "%.0f µg/m³", ozonoActual);
    }

    // -----------------------------------------------------------------------
    // json: JSONObject --> desdeJSON() --x
    // Lugar | null <--
    // What it does: parses a JSON object into a Lugar instance.
    // -----------------------------------------------------------------------
    public static Lugar desdeJSON(JSONObject json) {
        if (json == null) {
            return null;
        }
        try {
            int id = json.optInt("id", json.optInt("idLugar", 0));
            int idUsuario = json.optInt("idUsuario", 0);
            String nombre = json.optString("nombre", "");
            String tipo = json.optString("tipo", "otro");
            String direccion = json.optString("direccion", json.optString("zona", ""));
            double latitud = json.optDouble("latitud", 0.0);
            double longitud = json.optDouble("longitud", 0.0);
            Double ozonoActual = null;
            if (json.has("ozonoActual") && !json.isNull("ozonoActual")) {
                ozonoActual = json.optDouble("ozonoActual");
            } else if (json.has("ozono") && !json.isNull("ozono")) {
                ozonoActual = json.optDouble("ozono");
            } else if (json.has("valor") && !json.isNull("valor")) {
                ozonoActual = json.optDouble("valor");
            }
            boolean avisos = json.optBoolean("avisosActivos", json.optBoolean("alertas", true));

            return new Lugar(id, idUsuario, nombre, tipo, direccion, latitud, longitud, ozonoActual, avisos);
        } catch (Exception e) {
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // aJSON() --x
    // JSONObject <--
    // What it does: serializes the place into a JSONObject.
    // -----------------------------------------------------------------------
    public JSONObject aJSON() {
        JSONObject json = new JSONObject();
        try {
            json.put("id", id);
            json.put("idUsuario", idUsuario);
            json.put("nombre", nombre);
            json.put("direccion", direccion);
            json.put("latitud", latitud);
            json.put("longitud", longitud);
            json.put("tipo", tipo);
            json.put("ozonoActual", ozonoActual == null ? JSONObject.NULL : ozonoActual);
            json.put("avisosActivos", avisosActivos);
        } catch (JSONException ignored) {
        }
        return json;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Lugar lugar = (Lugar) o;
        return id == lugar.id;
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
