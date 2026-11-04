// ---------------------------------------------------------------------------
// Fichero:     Sesion.java
// Descripción: Guarda en el teléfono la sesión (correo, token, rol y nombre)
//              iniciada, para que la sesión siga abierta al cerrar y volver
//              a abrir la app (H001, H002). Diseño en doc/app_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Context;
import android.content.SharedPreferences;

// Sesion class: remembers who is logged in (email, token, rol and name),
// using SharedPreferences, so the session stays open after closing the app.
public class Sesion {

    private static final String FICHERO = "sesion_aeris";
    private static final String CLAVE_CORREO = "correo";
    private static final String CLAVE_TOKEN = "token";
    private static final String CLAVE_ROL = "rol";
    private static final String CLAVE_NOMBRE = "nombre";

    // -----------------------------------------------------------------------
    // contexto: Context, correo: Text, datos: DatosSesion --> iniciar() --x
    // What it does: saves the session the server has just opened.
    // -----------------------------------------------------------------------
    public static void iniciar(Context contexto, String correo, DatosSesion datos) {
        preferencias(contexto).edit()
                .putString(CLAVE_CORREO, correo)
                .putString(CLAVE_TOKEN, datos.token)
                .putString(CLAVE_ROL, datos.rol)
                .putString(CLAVE_NOMBRE, datos.nombre)
                .apply();
    }

    // -----------------------------------------------------------------------
    // contexto: Context --> haySesion() --x
    // B <--
    // What it does: true if there is a saved session token.
    // -----------------------------------------------------------------------
    public static boolean haySesion(Context contexto) {
        return token(contexto) != null;
    }

    // -----------------------------------------------------------------------
    // contexto: Context --> token() --x                 Text | null <--
    // contexto: Context --> rol() --x                   Text | null <--
    // contexto: Context --> nombre() --x                Text | null <--
    // contexto: Context --> correoActual() --x          Text | null <--
    // What it does: return the saved data, or null if nobody is logged in.
    //               The token goes in "Authorization: Bearer <token>".
    // -----------------------------------------------------------------------
    public static String token(Context contexto) {
        return preferencias(contexto).getString(CLAVE_TOKEN, null);
    }

    public static String rol(Context contexto) {
        return preferencias(contexto).getString(CLAVE_ROL, null);
    }

    public static String nombre(Context contexto) {
        return preferencias(contexto).getString(CLAVE_NOMBRE, null);
    }

    public static String correoActual(Context contexto) {
        return preferencias(contexto).getString(CLAVE_CORREO, null);
    }

    // -----------------------------------------------------------------------
    // contexto: Context --> cerrar() --x
    // What it does: forgets the session (log out). The server keeps nothing,
    //               so deleting the token is enough.
    // -----------------------------------------------------------------------
    public static void cerrar(Context contexto) {
        preferencias(contexto).edit().clear().apply();
    }

    private static SharedPreferences preferencias(Context contexto) {
        return contexto.getSharedPreferences(FICHERO, Context.MODE_PRIVATE);
    }
}
