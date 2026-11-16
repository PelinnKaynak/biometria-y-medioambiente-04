// ---------------------------------------------------------------------------
// Fichero:     EfectoPulsar.java
// Descripción: Efecto al pulsar tarjetas y botones de Inicio: mientras el dedo
//              está encima, la vista se hunde un poco (escala 0,97) y al
//              soltarla vuelve con un pequeño rebote. Tarea T006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       12/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.annotation.SuppressLint;
import android.view.MotionEvent;
import android.view.View;
import android.view.animation.OvershootInterpolator;

// EfectoPulsar class: press effect for cards and buttons.
public class EfectoPulsar {

    static final float ESCALA_PULSADA = 0.97f;

    // -----------------------------------------------------------------------
    // vistas: [View] --> aplicar() -->
    // What it does: each view shrinks a little while it is pressed and comes
    //               back when it is released. The click still works (the
    //               touch is not consumed).
    // -----------------------------------------------------------------------
    @SuppressLint("ClickableViewAccessibility")
    public static void aplicar(View... vistas) {
        for (View vista : vistas) {
            vista.setOnTouchListener((v, evento) -> {
                switch (evento.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        v.animate().scaleX(ESCALA_PULSADA).scaleY(ESCALA_PULSADA)
                                .setDuration(110).setInterpolator(null).start();
                        break;
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        v.animate().scaleX(1f).scaleY(1f).setDuration(260)
                                .setInterpolator(new OvershootInterpolator(2.2f)).start();
                        break;
                    default:
                        break;
                }
                return false;
            });
        }
    }
}
