// ---------------------------------------------------------------------------
// Fichero:     AvisosLeidos.java
// Descripción: Recuerda en el teléfono (SharedPreferences) qué avisos de Inicio
//              ya se han leído, por su clave, para quitarles el punto y no
//              contarlos en la campana. Tarea T006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       12/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

// AvisosLeidos class: the keys of the notifications already read.
public class AvisosLeidos {

    private static final String FICHERO = "avisos_leidos";
    private static final String CLAVE = "leidos";

    // -----------------------------------------------------------------------
    // contexto: Context --> leer() --x
    // {Text} <--
    // What it does: the keys of the notifications read on this phone.
    // -----------------------------------------------------------------------
    public static Set<String> leer(Context contexto) {
        return new HashSet<>(preferencias(contexto).getStringSet(CLAVE, new HashSet<>()));
    }

    // -----------------------------------------------------------------------
    // contexto: Context, claves: [Text] --> marcar() -->
    // What it does: adds the keys to the read ones.
    // -----------------------------------------------------------------------
    public static void marcar(Context contexto, Collection<String> claves) {
        Set<String> leidos = leer(contexto);
        if (leidos.addAll(claves)) {
            preferencias(contexto).edit().putStringSet(CLAVE, leidos).apply();
        }
    }

    private static SharedPreferences preferencias(Context contexto) {
        return contexto.getSharedPreferences(FICHERO, Context.MODE_PRIVATE);
    }
}
