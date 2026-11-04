// ---------------------------------------------------------------------------
// Fichero:     ValidadorLogin.java
// Descripción: Comprueba el formulario de inicio de sesión y el de recuperar
//              contraseña antes de enviarlos (campos vacíos y formato del
//              correo). Diseño en doc/app_design.md. Tarea T003 · H002.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.util.LinkedHashMap;
import java.util.Map;

// ValidadorLogin class: checks the log-in form and returns one error message
// per wrong field (an empty map means that everything is correct).
public class ValidadorLogin {

    public static final String CAMPO_CORREO = "correo";
    public static final String CAMPO_CONTRASENA = "contrasena";

    // -----------------------------------------------------------------------
    // correo: Text, contrasena: Text --> validar() --x
    // Lista<( campo: Text, mensaje: Text )> <--
    // What it does: the email must be written and have a valid format, and the
    //               password must be written. The password rules are not
    //               checked here: the server says if it is right or wrong.
    // -----------------------------------------------------------------------
    public static Map<String, String> validar(String correo, String contrasena) {
        Map<String, String> errores = new LinkedHashMap<>();
        String errorCorreo = validarCorreo(correo);
        if (errorCorreo != null) {
            errores.put(CAMPO_CORREO, errorCorreo);
        }
        if (contrasena == null || contrasena.isEmpty()) {
            errores.put(CAMPO_CONTRASENA, "Escribe tu contraseña.");
        }
        return errores;
    }

    // -----------------------------------------------------------------------
    // correo: Text --> validarCorreo() --x
    // Text | null <--
    // What it does: the error message for the email, or null if it is right.
    //               Also used by the «Recuperar contraseña» screen.
    // -----------------------------------------------------------------------
    public static String validarCorreo(String correo) {
        if (ValidadorRegistro.estaVacio(correo)) {
            return "Escribe tu correo electrónico.";
        }
        if (!ValidadorRegistro.esCorreoValido(correo)) {
            return "El correo no tiene un formato válido.";
        }
        return null;
    }
}
