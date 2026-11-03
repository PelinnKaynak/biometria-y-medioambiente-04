// ---------------------------------------------------------------------------
// Fichero:     Sesion.java
// Descripción: Guarda en el teléfono el correo del usuario con sesión
//              iniciada, para que la sesión siga abierta al cerrar y volver
//              a abrir la app (H001, H002). Diseño en doc/app_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Context;
import android.content.SharedPreferences;

// Sesion class: remembers who is logged in, using SharedPreferences.
public class Sesion {

    private static final String FICHERO = "sesion_aeris";
    private static final String CLAVE_CORREO = "correo";

    // -----------------------------------------------------------------------
    // contexto: Context, correo: Text --> iniciar() --x
    // What it does: saves the email of the user who has just logged in.
    // -----------------------------------------------------------------------
    public static void iniciar(Context contexto, String correo) {
        preferencias(contexto).edit().putString(CLAVE_CORREO, correo).apply();
    }

    // -----------------------------------------------------------------------
    // contexto: Context --> correoActual() --x
    // Text <--
    // What it does: returns the email of the logged-in user, or null if nobody is.
    // -----------------------------------------------------------------------
    public static String correoActual(Context contexto) {
        return preferencias(contexto).getString(CLAVE_CORREO, null);
    }

    // -----------------------------------------------------------------------
    // contexto: Context --> cerrar() --x
    // What it does: forgets the logged-in user (log out).
    // -----------------------------------------------------------------------
    public static void cerrar(Context contexto) {
        preferencias(contexto).edit().remove(CLAVE_CORREO).apply();
    }

    private static SharedPreferences preferencias(Context contexto) {
        return contexto.getSharedPreferences(FICHERO, Context.MODE_PRIVATE);
    }
}
