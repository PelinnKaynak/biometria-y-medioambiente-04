// ---------------------------------------------------------------------------
// Fichero:     DatosUsuario.java
// Descripción: Datos del usuario que devuelve GET /usuarioActual (nombre,
//              apellidos, correo, rol, si quiere recibir alertas y la foto).
//              Los usan las pantallas de perfil y de editar mis datos.
//              Diseño en doc/app_design.md. Tarea T010.
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

    // -----------------------------------------------------------------------
    // nombre: Text, apellidos: Text, correo: Text, rol: Text, alertas: B,
    // foto: Text --> constructor()
    // -----------------------------------------------------------------------
    public DatosUsuario(String nombre, String apellidos, String correo, String rol, boolean alertas,
                        String foto) {
        this.nombre = nombre;
        this.apellidos = apellidos;
        this.correo = correo;
        this.rol = rol;
        this.alertas = alertas;
        this.foto = foto;
    }

    // -----------------------------------------------------------------------
    // tieneFoto() --x
    // B <--
    // -----------------------------------------------------------------------
    public boolean tieneFoto() {
        return !foto.isEmpty();
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
    // What it does: reads {"nombre", "apellidos", "correo", "rol", "alertas", "foto"}
    //               from the answer of GET /usuarioActual. Returns null if the
    //               text is not valid JSON or has no correo. If "alertas" is
    //               missing it is true (the default value in the BD); if
    //               "foto" is missing or null it is "" (no photo).
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
                    json.optString("foto", ""));
        } catch (JSONException error) {
            return null;
        }
    }
}
