// ---------------------------------------------------------------------------
// Fichero:     ValidadorEditarDatos.java
// Descripción: Comprueba los dos formularios de «Editar mis datos»: los datos
//              (nombre, apellidos y correo, con las mismas reglas que el
//              registro) y el cambio de contraseña. Diseño en doc/app_design.md.
//              Tarea T010.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.util.LinkedHashMap;
import java.util.Map;

// ValidadorEditarDatos class: checks the forms of «Editar mis datos» and
// returns one error message per wrong field.
public class ValidadorEditarDatos {

    public static final String CAMPO_ACTUAL = "contrasenaActual";
    public static final String CAMPO_NUEVA = "contrasenaNueva";
    public static final String CAMPO_REPETIDA = "repetida";

    // -----------------------------------------------------------------------
    // nombre: Text, apellidos: Text, correo: Text --> validarDatos() --x
    // Lista<( campo: Text, mensaje: Text )> <--
    // What it does: same rules and messages as the sign-up form for these
    //               three fields (keys of ValidadorRegistro).
    // -----------------------------------------------------------------------
    public static Map<String, String> validarDatos(String nombre, String apellidos, String correo) {
        // Se reutiliza el validador del registro con una contraseña válida de relleno
        Map<String, String> errores = ValidadorRegistro.validar(nombre, apellidos, correo, "a1234567", "a1234567");
        errores.remove(ValidadorRegistro.CAMPO_CONTRASENA);
        errores.remove(ValidadorRegistro.CAMPO_CONFIRMACION);
        return errores;
    }

    // -----------------------------------------------------------------------
    // actual: Text, nueva: Text, repetida: Text --> validarContrasena() --x
    // Lista<( campo: Text, mensaje: Text )> <--
    // What it does: the current password must be written; the new one must
    //               be safe, different from the current one and repeated the
    //               same. Whether the current one is right is checked by the server.
    // -----------------------------------------------------------------------
    public static Map<String, String> validarContrasena(String actual, String nueva, String repetida) {
        Map<String, String> errores = new LinkedHashMap<>();

        if (ValidadorRegistro.estaVacio(actual)) {
            errores.put(CAMPO_ACTUAL, "Escribe tu contraseña actual.");
        }

        if (ValidadorRegistro.estaVacio(nueva)) {
            errores.put(CAMPO_NUEVA, "Escribe la contraseña nueva.");
        } else if (!ValidadorRegistro.esContrasenaSegura(nueva)) {
            errores.put(CAMPO_NUEVA, "Mínimo " + ValidadorRegistro.LONGITUD_MINIMA_CONTRASENA
                    + " caracteres, con al menos una letra y un número.");
        } else if (nueva.equals(actual)) {
            errores.put(CAMPO_NUEVA, "La contraseña nueva tiene que ser distinta de la actual.");
        }

        if (ValidadorRegistro.estaVacio(repetida)) {
            errores.put(CAMPO_REPETIDA, "Repite la contraseña nueva.");
        } else if (!repetida.equals(nueva)) {
            errores.put(CAMPO_REPETIDA, "Las contraseñas no coinciden.");
        }

        return errores;
    }
}
