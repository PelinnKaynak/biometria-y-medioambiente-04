// ---------------------------------------------------------------------------
// Fichero:     ValidadorRegistro.java
// Descripción: Comprueba los datos del formulario de registro antes de
//              enviarlos al servidor (campos vacíos, formato del correo,
//              contraseña segura y confirmación). No usa clases de Android,
//              así se puede probar con JUnit sin teléfono.
//              Diseño en doc/app_design.md. Tarea T002 · historia H001.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

// ValidadorRegistro class: checks the registration form and returns one error
// message per wrong field (an empty map means that everything is correct).
public class ValidadorRegistro {

    // Nombres de los campos del formulario (claves del mapa de errores)
    public static final String CAMPO_NOMBRE = "nombre";
    public static final String CAMPO_APELLIDOS = "apellidos";
    public static final String CAMPO_CORREO = "correo";
    public static final String CAMPO_CONTRASENA = "contrasena";
    public static final String CAMPO_CONFIRMACION = "confirmacion";

    public static final int LONGITUD_MINIMA_CONTRASENA = 8;

    private static final Pattern FORMATO_CORREO =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern TIENE_LETRA = Pattern.compile(".*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ].*");
    private static final Pattern TIENE_NUMERO = Pattern.compile(".*[0-9].*");

    // -----------------------------------------------------------------------
    // nombre: Text, apellidos: Text, correo: Text,
    // contrasena: Text, confirmacion: Text --> validar() --x
    // Lista<( campo: Text, mensaje: Text )> <--
    //
    // What it does: checks every field and returns the errors, in the order of
    //               the form. An empty result means the data can be sent.
    // -----------------------------------------------------------------------
    public static Map<String, String> validar(String nombre, String apellidos, String correo,
                                              String contrasena, String confirmacion) {
        Map<String, String> errores = new LinkedHashMap<>();

        if (estaVacio(nombre)) {
            errores.put(CAMPO_NOMBRE, "Escribe tu nombre.");
        }
        if (estaVacio(apellidos)) {
            errores.put(CAMPO_APELLIDOS, "Escribe tus apellidos.");
        }

        if (estaVacio(correo)) {
            errores.put(CAMPO_CORREO, "Escribe tu correo electrónico.");
        } else if (!esCorreoValido(correo)) {
            errores.put(CAMPO_CORREO, "El correo no tiene un formato válido.");
        }

        if (estaVacio(contrasena)) {
            errores.put(CAMPO_CONTRASENA, "Escribe una contraseña.");
        } else if (!esContrasenaSegura(contrasena)) {
            errores.put(CAMPO_CONTRASENA,
                    "Mínimo " + LONGITUD_MINIMA_CONTRASENA + " caracteres, con al menos una letra y un número.");
        }

        if (estaVacio(confirmacion)) {
            errores.put(CAMPO_CONFIRMACION, "Repite la contraseña.");
        } else if (!confirmacion.equals(contrasena)) {
            errores.put(CAMPO_CONFIRMACION, "Las contraseñas no coinciden.");
        }

        return errores;
    }

    // -----------------------------------------------------------------------
    // texto: Text --> estaVacio() --x
    // B <--
    // What it does: true if the text is null or only has spaces.
    // -----------------------------------------------------------------------
    static boolean estaVacio(String texto) {
        return texto == null || texto.trim().isEmpty();
    }

    // -----------------------------------------------------------------------
    // correo: Text --> esCorreoValido() --x
    // B <--
    // What it does: true if the email looks like nombre@dominio.ext.
    // -----------------------------------------------------------------------
    static boolean esCorreoValido(String correo) {
        return correo != null && FORMATO_CORREO.matcher(correo.trim()).matches();
    }

    // -----------------------------------------------------------------------
    // contrasena: Text --> esContrasenaSegura() --x
    // B <--
    // What it does: true if the password has at least 8 characters,
    //               one letter and one number.
    // -----------------------------------------------------------------------
    static boolean esContrasenaSegura(String contrasena) {
        return contrasena != null
                && contrasena.length() >= LONGITUD_MINIMA_CONTRASENA
                && TIENE_LETRA.matcher(contrasena).matches()
                && TIENE_NUMERO.matcher(contrasena).matches();
    }
}
