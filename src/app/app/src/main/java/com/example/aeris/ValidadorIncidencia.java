// ---------------------------------------------------------------------------
// Fichero:     ValidadorIncidencia.java
// Descripción: Comprueba el formulario de «Enviar una incidencia» y la caja de
//              mensajes de la conversación antes de enviarlos, con los mismos
//              límites que el servidor (asunto de hasta 120 caracteres, mensaje
//              de hasta 2000). Diseño en doc/app_design.md. Tarea T043.
// Autores:     Equipo 04 – SenseTech
// Fecha:       20/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.util.LinkedHashMap;
import java.util.Map;

// ValidadorIncidencia class: checks the incidence form and the message box.
public class ValidadorIncidencia {

    public static final String CAMPO_TIPO = "tipo";
    public static final String CAMPO_ASUNTO = "asunto";
    public static final String CAMPO_DESCRIPCION = "descripcion";

    public static final int LARGO_MAXIMO_ASUNTO = 120;
    public static final int LARGO_MAXIMO_TEXTO = 2000;      // descripción y mensajes

    // -----------------------------------------------------------------------
    // tipo: Text, asunto: Text, descripcion: Text --> validarNueva() --x
    // Lista<( campo: Text, mensaje: Text )> <--
    // What it does: one error message per wrong field (an empty map means that
    //               everything is correct): a known tipo, a subject and a
    //               description written (without counting the spaces at the
    //               ends) and not longer than the limit.
    // -----------------------------------------------------------------------
    public static Map<String, String> validarNueva(String tipo, String asunto, String descripcion) {
        Map<String, String> errores = new LinkedHashMap<>();
        if (!Incidencia.TIPO_SENSOR.equals(tipo) && !Incidencia.TIPO_DATOS.equals(tipo)
                && !Incidencia.TIPO_CUENTA.equals(tipo) && !Incidencia.TIPO_OTRA.equals(tipo)) {
            errores.put(CAMPO_TIPO, "Elige de qué trata tu incidencia.");
        }
        String errorAsunto = validarAsunto(asunto);
        if (errorAsunto != null) {
            errores.put(CAMPO_ASUNTO, errorAsunto);
        }
        String errorDescripcion = validarTexto(descripcion, "Cuéntanos qué ocurre.");
        if (errorDescripcion != null) {
            errores.put(CAMPO_DESCRIPCION, errorDescripcion);
        }
        return errores;
    }

    // -----------------------------------------------------------------------
    // texto: Text --> validarMensaje() --x
    // Text | null <--
    // What it does: the error message for a message of the conversation, or
    //               null if it can be sent.
    // -----------------------------------------------------------------------
    public static String validarMensaje(String texto) {
        return validarTexto(texto, "Escribe un mensaje.");
    }

    private static String validarAsunto(String asunto) {
        if (asunto == null || asunto.trim().isEmpty()) {
            return "Escribe un asunto.";
        }
        if (asunto.trim().length() > LARGO_MAXIMO_ASUNTO) {
            return "El asunto puede tener como mucho " + LARGO_MAXIMO_ASUNTO + " caracteres.";
        }
        return null;
    }

    private static String validarTexto(String texto, String mensajeVacio) {
        if (texto == null || texto.trim().isEmpty()) {
            return mensajeVacio;
        }
        if (texto.trim().length() > LARGO_MAXIMO_TEXTO) {
            return "Es demasiado largo: como mucho " + LARGO_MAXIMO_TEXTO + " caracteres.";
        }
        return null;
    }
}
