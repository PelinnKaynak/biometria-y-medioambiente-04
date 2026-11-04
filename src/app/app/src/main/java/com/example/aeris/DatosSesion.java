// ---------------------------------------------------------------------------
// Fichero:     DatosSesion.java
// Descripción: Datos de una sesión que devuelve el servidor al registrarse
//              o al iniciar sesión: token, rol y nombre. Sabe leerlos del JSON
//              de la respuesta. Diseño en doc/app_design.md. Tarea T003.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONException;
import org.json.JSONObject;

// DatosSesion class: the token, rol and name that the server sends after
// sign-up (201) or log-in (200).
public class DatosSesion {

    public final String token;
    public final String rol;
    public final String nombre;

    // -----------------------------------------------------------------------
    // token: Text, rol: Text, nombre: Text --> constructor()
    // -----------------------------------------------------------------------
    public DatosSesion(String token, String rol, String nombre) {
        this.token = token;
        this.rol = rol;
        this.nombre = nombre;
    }

    // -----------------------------------------------------------------------
    // cuerpo: Text --> desdeJSON() --x
    // DatosSesion | null <--
    // What it does: reads {"token", "rol", "nombre"} from the server's answer.
    //               Returns null if the text is not valid or has no token.
    // -----------------------------------------------------------------------
    static DatosSesion desdeJSON(String cuerpo) {
        if (cuerpo == null || cuerpo.isEmpty()) {
            return null;
        }
        try {
            JSONObject json = new JSONObject(cuerpo);
            String token = json.optString("token", "");
            if (token.isEmpty()) {
                return null;
            }
            return new DatosSesion(token, json.optString("rol", ""), json.optString("nombre", ""));
        } catch (JSONException error) {
            return null;
        }
    }
}
