// ---------------------------------------------------------------------------
// Fichero:     TeclaEnter.java
// Descripción: Hace que la tecla Enter (o «Hecho» del teclado del móvil) en el
//              último campo de un formulario pulse su botón: «Acceder» en el
//              login, «Continuar» en el registro, «Enviar enlace» en recuperar
//              contraseña y los dos botones de «Editar mis datos».
//              Diseño en doc/app_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       05/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;

// TeclaEnter class: connects the Enter key of a field to a button.
public class TeclaEnter {

    // -----------------------------------------------------------------------
    // campo: EditText, boton: View --> pulsaBoton() -->
    // What it does: the keyboard shows «Hecho» (✓) in the field, and Enter or
    //               «Hecho» clicks the button, as if the user had pressed it
    //               (only if the button is enabled).
    // -----------------------------------------------------------------------
    public static void pulsaBoton(EditText campo, View boton) {
        campo.setImeOptions(EditorInfo.IME_ACTION_DONE);
        campo.setOnEditorActionListener((vista, accion, evento) -> {
            boolean hecho = accion == EditorInfo.IME_ACTION_DONE || accion == EditorInfo.IME_ACTION_GO;
            boolean enter = evento != null && evento.getKeyCode() == KeyEvent.KEYCODE_ENTER;
            if (!hecho && !enter) {
                return false;
            }
            // Con la tecla física llegan dos eventos (pulsar y soltar): solo se usa el primero
            if (enter && evento.getAction() != KeyEvent.ACTION_DOWN) {
                return true;
            }
            if (boton.isEnabled() && boton.isClickable()) {
                boton.performClick();
            }
            return true;
        });
    }
}
