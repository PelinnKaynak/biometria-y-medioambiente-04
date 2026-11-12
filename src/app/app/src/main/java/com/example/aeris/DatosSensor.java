// ---------------------------------------------------------------------------
// Fichero:     DatosSensor.java
// Descripción: Datos del sensor vinculado (identificador, si está conectado,
//              nivel de batería, estado de la luz y última sincronización).
//              Los usa la pantalla de Mi sensor (T011).
//              Diseño en doc/app_design.md. Tarea T011.
// Autores:     Equipo 04 – SenseTech
// Fecha:       11/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONException;
import org.json.JSONObject;

// DatosSensor class: sensor status data (identifier, connection, battery, light, last sync).
public class DatosSensor {

    public final String idSensor;
    public final boolean conectado;
    public final int bateria;
    public final boolean luz;
    public final String ultimaSincronizacion;

    // -----------------------------------------------------------------------
    // idSensor: Text, conectado: B, bateria: Z, luz: B,
    // ultimaSincronizacion: Text --> constructor()
    // -----------------------------------------------------------------------
    public DatosSensor(String idSensor, boolean conectado, int bateria, boolean luz,
                       String ultimaSincronizacion) {
        this.idSensor = idSensor;
        this.conectado = conectado;
        this.bateria = bateria;
        this.luz = luz;
        this.ultimaSincronizacion = ultimaSincronizacion;
    }

    // -----------------------------------------------------------------------
    // textoConexion() --x
    // Text <--
    // What it does: returns "Conectado" if connected is true, "Desconectado" otherwise.
    // -----------------------------------------------------------------------
    public String textoConexion() {
        return conectado ? "Conectado" : "Desconectado";
    }

    // -----------------------------------------------------------------------
    // textoBateria() --x
    // Text <--
    // What it does: formats battery level as a percentage string (e.g. "85%").
    // -----------------------------------------------------------------------
    public String textoBateria() {
        return bateria + "%";
    }

    // -----------------------------------------------------------------------
    // textoUltimaSincronizacion() --x
    // Text <--
    // What it does: returns the formatted last sync text, or "Desconocida" if empty.
    // -----------------------------------------------------------------------
    public String textoUltimaSincronizacion() {
        return (ultimaSincronizacion == null || ultimaSincronizacion.isEmpty())
                ? "Desconocida"
                : ultimaSincronizacion;
    }

    // -----------------------------------------------------------------------
    // luz: B --> crearJSONLuz() --x
    // Text <--
    // What it does: builds {"luz": true | false}.
    // -----------------------------------------------------------------------
    public static String crearJSONLuz(boolean luz) throws JSONException {
        return new JSONObject().put("luz", luz).toString();
    }

    // -----------------------------------------------------------------------
    // cuerpo: Text --> desdeJSON() --x
    // DatosSensor | null <--
    // What it does: parses {"idSensor", "conectado", "bateria", "luz", "ultimaSincronizacion"}
    //               from JSON text. Returns null if invalid or missing idSensor.
    // -----------------------------------------------------------------------
    public static DatosSensor desdeJSON(String cuerpo) {
        if (cuerpo == null || cuerpo.isEmpty()) {
            return null;
        }
        try {
            JSONObject json = new JSONObject(cuerpo);
            String idSensor = json.optString("idSensor", "");
            if (idSensor.isEmpty()) {
                return null;
            }
            boolean conectado = json.optBoolean("conectado", false);
            int bateria = json.optInt("bateria", 0);
            boolean luz = json.optBoolean("luz", false);
            String ultima = json.optString("ultimaSincronizacion", "");

            return new DatosSensor(idSensor, conectado, bateria, luz, ultima);
        } catch (JSONException error) {
            return null;
        }
    }
}
