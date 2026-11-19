// ---------------------------------------------------------------------------
// Fichero:     Incidencia.java
// Descripción: Una incidencia que el usuario ha enviado desde la pantalla Ayuda,
//              tal como la devuelve el servidor (GET /misIncidencias y
//              POST /crearIncidencia, T041). La conversación (mensajes) es
//              otra cosa: MensajeIncidencia. Diseño en doc/app_design.md. T043.
// Autores:     Equipo 04 – SenseTech
// Fecha:       20/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

// Incidencia class: an incidence of the user (read-only data).
public final class Incidencia {

    public static final String TIPO_SENSOR = "sensor";
    public static final String TIPO_DATOS = "datos";
    public static final String TIPO_CUENTA = "cuenta";
    public static final String TIPO_OTRA = "otra";

    public static final String ESTADO_ABIERTA = "abierta";
    public static final String ESTADO_EN_CURSO = "en curso";
    public static final String ESTADO_RESUELTA = "resuelta";

    // Los cuatro tipos, en el orden en que se enseñan en el formulario
    static final String[] TIPOS = {TIPO_SENSOR, TIPO_DATOS, TIPO_CUENTA, TIPO_OTRA};

    public final int idIncidencia;
    public final String tipo;
    public final String asunto;
    public final String descripcion;
    public final String estado;
    public final boolean tieneRespuesta;
    public final long fechaCreacionMs;      // 0 si el servidor no la dio
    public final String numeroSerie;        // "" si no habla de ningún sensor

    Incidencia(int idIncidencia, String tipo, String asunto, String descripcion, String estado,
               boolean tieneRespuesta, long fechaCreacionMs, String numeroSerie) {
        this.idIncidencia = idIncidencia;
        this.tipo = tipo;
        this.asunto = asunto;
        this.descripcion = descripcion;
        this.estado = estado;
        this.tieneRespuesta = tieneRespuesta;
        this.fechaCreacionMs = fechaCreacionMs;
        this.numeroSerie = numeroSerie;
    }

    // -----------------------------------------------------------------------
    // cuerpo: Text --> desdeJSON() --x
    // Incidencia | null <--
    // What it does: reads one incidence ({idIncidencia, tipo, asunto, descripcion,
    //               estado, respuesta, fechaCreacion, sensor: {numeroSerie} | null}).
    //               null if it is not JSON or has no id or no subject.
    // -----------------------------------------------------------------------
    static Incidencia desdeJSON(String cuerpo) {
        if (cuerpo == null) {
            return null;
        }
        try {
            return desdeJSON(new JSONObject(cuerpo));
        } catch (JSONException noEsJSON) {
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // cuerpo: Text --> listaDesdeJSON() --x
    // Lista<Incidencia> | null <--
    // What it does: reads the array of /misIncidencias, in the same order. The
    //               wrong items are skipped. null if it is not a JSON array.
    // -----------------------------------------------------------------------
    static List<Incidencia> listaDesdeJSON(String cuerpo) {
        if (cuerpo == null) {
            return null;
        }
        try {
            JSONArray lista = new JSONArray(cuerpo);
            List<Incidencia> incidencias = new ArrayList<>();
            for (int i = 0; i < lista.length(); i++) {
                JSONObject item = lista.optJSONObject(i);
                Incidencia incidencia = item == null ? null : desdeJSON(item);
                if (incidencia != null) {
                    incidencias.add(incidencia);
                }
            }
            return incidencias;
        } catch (JSONException noEsLista) {
            return null;
        }
    }

    private static Incidencia desdeJSON(JSONObject json) {
        int id = json.optInt("idIncidencia", 0);
        String asunto = LectorJSON.texto(json, "asunto");
        if (id <= 0 || asunto.trim().isEmpty()) {
            return null;
        }
        JSONObject sensor = json.optJSONObject("sensor");
        return new Incidencia(id,
                normalizarTipo(LectorJSON.texto(json, "tipo")),
                asunto,
                LectorJSON.texto(json, "descripcion"),
                normalizarEstado(LectorJSON.texto(json, "estado")),
                !LectorJSON.texto(json, "respuesta").trim().isEmpty(),
                LectorJSON.fechaMs(json, "fechaCreacion"),
                sensor == null ? "" : LectorJSON.texto(sensor, "numeroSerie"));
    }

    // un tipo desconocido cuenta como «otra»
    static String normalizarTipo(String tipo) {
        for (String conocido : TIPOS) {
            if (conocido.equals(tipo)) {
                return conocido;
            }
        }
        return TIPO_OTRA;
    }

    // un estado desconocido cuenta como «abierta»
    static String normalizarEstado(String estado) {
        if (ESTADO_EN_CURSO.equals(estado) || ESTADO_RESUELTA.equals(estado)) {
            return estado;
        }
        return ESTADO_ABIERTA;
    }
}
