// ---------------------------------------------------------------------------
// Fichero:     MensajeIncidencia.java
// Descripción: Un mensaje de la conversación de una incidencia, tal como lo
//              devuelve el servidor (GET /mensajesIncidencia y
//              POST /enviarMensajeIncidencia, T043): lo que escribe el usuario
//              y lo que responde el equipo. La descripción de la incidencia es
//              el primer mensaje del usuario y no va en esta lista.
//              Diseño en doc/app_design.md. Tarea T043.
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

// MensajeIncidencia class: a message of the conversation of an incidence.
public final class MensajeIncidencia {

    public final int idMensaje;
    public final String texto;
    public final long fechaMs;              // 0 si el servidor no la dio
    public final boolean delUsuario;        // V: lo escribió quien envió la incidencia («Tú»)
    public final String autorNombre;        // "" si su cuenta se borró
    public final String autorRol;           // administrador, tecnico, portador, ciudadano o ""

    MensajeIncidencia(int idMensaje, String texto, long fechaMs, boolean delUsuario,
                      String autorNombre, String autorRol) {
        this.idMensaje = idMensaje;
        this.texto = texto;
        this.fechaMs = fechaMs;
        this.delUsuario = delUsuario;
        this.autorNombre = autorNombre;
        this.autorRol = autorRol;
    }

    // Quién escribió el mensaje, para ponerle su rótulo en la conversación
    public static final String QUIEN_USUARIO = "usuario";
    public static final String QUIEN_TECNICO = "tecnico";
    public static final String QUIEN_ADMINISTRADOR = "administrador";
    public static final String QUIEN_EQUIPO = "equipo";

    // -----------------------------------------------------------------------
    // --> quienEs() --x
    // Text <--
    // What it does: «usuario» if it was written by who sent the incidence;
    //               «tecnico» or «administrador» if it was written by the team
    //               (with that role); «equipo» if the role is unknown or the
    //               author deleted his account.
    // -----------------------------------------------------------------------
    public String quienEs() {
        if (delUsuario) {
            return QUIEN_USUARIO;
        }
        if (QUIEN_TECNICO.equals(autorRol) || QUIEN_ADMINISTRADOR.equals(autorRol)) {
            return autorRol;
        }
        return QUIEN_EQUIPO;
    }

    // -----------------------------------------------------------------------
    // cuerpo: Text --> desdeJSON() --x
    // MensajeIncidencia | null <--
    // What it does: reads one message ({idMensaje, texto, fecha, delUsuario,
    //               autor: {nombre, rol} | null}). null if it is not JSON or it
    //               has no id or no text.
    // -----------------------------------------------------------------------
    static MensajeIncidencia desdeJSON(String cuerpo) {
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
    // Lista<MensajeIncidencia> | null <--
    // What it does: reads the conversation, in the same order (the oldest
    //               first). The wrong items are skipped. null if it is not an array.
    // -----------------------------------------------------------------------
    static List<MensajeIncidencia> listaDesdeJSON(String cuerpo) {
        if (cuerpo == null) {
            return null;
        }
        try {
            JSONArray lista = new JSONArray(cuerpo);
            List<MensajeIncidencia> mensajes = new ArrayList<>();
            for (int i = 0; i < lista.length(); i++) {
                JSONObject item = lista.optJSONObject(i);
                MensajeIncidencia mensaje = item == null ? null : desdeJSON(item);
                if (mensaje != null) {
                    mensajes.add(mensaje);
                }
            }
            return mensajes;
        } catch (JSONException noEsLista) {
            return null;
        }
    }

    private static MensajeIncidencia desdeJSON(JSONObject json) {
        int id = json.optInt("idMensaje", 0);
        String texto = LectorJSON.texto(json, "texto");
        if (id <= 0 || texto.trim().isEmpty()) {
            return null;
        }
        JSONObject autor = json.optJSONObject("autor");
        return new MensajeIncidencia(id, texto,
                LectorJSON.fechaMs(json, "fecha"),
                json.optBoolean("delUsuario", false),
                autor == null ? "" : LectorJSON.texto(autor, "nombre"),
                autor == null ? "" : LectorJSON.texto(autor, "rol"));
    }
}
