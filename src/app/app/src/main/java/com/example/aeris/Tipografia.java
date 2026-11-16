// ---------------------------------------------------------------------------
// Fichero:     Tipografia.java
// Descripción: Inter con el peso que toca, para los textos que se cambian
//              desde el código (pestaña activa de la barra, fila «Mi sensor»,
//              consejo de Información). Los pesos siguen la Entrega del
//              Sprint 1 (4.4): 400 texto, 500 detalles, 600 títulos y
//              botones, 700 H1.
// Autores:     Equipo 04 – SenseTech
// Fecha:       13/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Context;
import android.graphics.Typeface;

import androidx.core.content.res.ResourcesCompat;

// Tipografia class: Inter typefaces for views styled from Java.
public class Tipografia {

    public static final int NORMAL = 400;
    public static final int MEDIA = 500;
    public static final int SEMINEGRITA = 600;
    public static final int NEGRITA = 700;

    // -----------------------------------------------------------------------
    // contexto: Context, peso: N --> inter() --x
    // Typeface <--
    // What it does: Inter (res/font/inter.xml) with the given weight. If the
    //               font cannot be loaded it falls back to the system font
    //               with the same weight.
    // -----------------------------------------------------------------------
    public static Typeface inter(Context contexto, int peso) {
        Typeface base = ResourcesCompat.getFont(contexto, R.font.inter);
        return Typeface.create(base != null ? base : Typeface.DEFAULT, peso, false);
    }
}
