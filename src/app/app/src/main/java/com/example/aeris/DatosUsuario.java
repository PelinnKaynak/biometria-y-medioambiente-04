// ---------------------------------------------------------------------------
// Fichero:     DatosUsuario.java
// Descripción: Datos del usuario que devuelve GET /usuarioActual (nombre,
//              apellidos, correo, rol, si quiere recibir alertas, la foto y
//              el sensor vinculado). Los usan las pantallas de perfil y de
//              editar mis datos. Diseño en doc/app_design.md. Tareas T010, T005.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONException;
import org.json.JSONObject;

// DatosUsuario class: the user's data that the server sends for the Perfil screen.
public class DatosUsuario {

    public final String nombre;
    public final String apellidos;
    public final String correo;
    public final String rol;
    public final boolean alertas;
    public final String foto;      // JPEG en base64, o "" si no tiene foto
    public final String sensor;    // nombre del sensor vinculado, o "" si no tiene (T005/T017)

    // -----------------------------------------------------------------------
    // nombre: Text, apellidos: Text, correo: Text, rol: Text, alertas: B,
    // foto: Text, sensor: Text --> constructor()
    // -----------------------------------------------------------------------
    public DatosUsuario(String nombre, String apellidos, String correo, String rol, boolean alertas,
                        String foto, String sensor) {
        this.nombre = nombre;
        this.apellidos = apellidos;
        this.correo = correo;
        this.rol = rol;
        this.alertas = alertas;
        this.foto = foto;
        this.sensor = sensor;
    }

    // -----------------------------------------------------------------------
    // tieneFoto() --x
    // B <--
    // -----------------------------------------------------------------------
    public boolean tieneFoto() {
        return !foto.isEmpty();
    }

    // -----------------------------------------------------------------------
    // tieneSensor() --x
    // B <--
    // -----------------------------------------------------------------------
    public boolean tieneSensor() {
        return !sensor.isEmpty();
    }

    // -----------------------------------------------------------------------
    // nombreCompleto() --x
    // Text <--
    // What it does: returns "nombre apellidos" (only the name if there are no
    //               apellidos).
    // -----------------------------------------------------------------------
    public String nombreCompleto() {
        return apellidos.isEmpty() ? nombre : nombre + " " + apellidos;
    }

    // -----------------------------------------------------------------------
    // cuerpo: Text --> desdeJSON() --x
    // DatosUsuario | null <--
    // What it does: reads {"nombre", "apellidos", "correo", "rol", "alertas", "foto",
    //               "sensor"}
    //               from the answer of GET /usuarioActual. Returns null if the
    //               text is not valid JSON or has no correo. If "alertas" is
    //               missing it is true (the default value in the BD); if
    //               "foto" is missing or null it is "" (no photo). The same
    //               with "sensor": the server will send it when sensors can
    //               be linked (T017); until then the user has no sensor.
    // -----------------------------------------------------------------------
    static DatosUsuario desdeJSON(String cuerpo) {
        if (cuerpo == null || cuerpo.isEmpty()) {
            return null;
        }
        try {
            JSONObject json = new JSONObject(cuerpo);
            String correo = json.optString("correo", "");
            if (correo.isEmpty()) {
                return null;
            }
            return new DatosUsuario(
                    json.optString("nombre", ""),
                    json.optString("apellidos", ""),
                    correo,
                    json.optString("rol", ""),
                    json.optBoolean("alertas", true),
                    textoONada(json, "foto"),
                    textoONada(json, "sensor"));
        } catch (JSONException error) {
            return null;
        }
    }

    // "" si el campo no está o es null (optString devolvería "null")
    private static String textoONada(JSONObject json, String campo) {
        return json.isNull(campo) ? "" : json.optString(campo, "");
    }
}
