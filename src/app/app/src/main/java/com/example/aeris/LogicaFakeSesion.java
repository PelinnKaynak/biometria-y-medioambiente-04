// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeSesion.java
// Descripción: Lógica fake del teléfono para el inicio de sesión y la
//              recuperación de contraseña. Envía POST /iniciarSesion y
//              POST /solicitarRecuperacion al servidor REST (T016) y avisa a la
//              pantalla con el resultado. Diseño en doc/app_design.md. Tarea T003 · H002.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONException;
import org.json.JSONObject;

// LogicaFakeSesion class: the phone's fake logic for log-in and password recovery.
public class LogicaFakeSesion {

    static final int CODIGO_OK = 200;
    static final int CODIGO_CREDENCIALES_INCORRECTAS = 401;
    static final int CODIGO_SIN_CONEXION = 0;

    static final String MENSAJE_CREDENCIALES_INCORRECTAS = "Correo o contraseña incorrectos";
    static final String MENSAJE_SIN_CONEXION = "No hay conexión con el servidor. Inténtalo de nuevo.";

    // -----------------------------------------------------------------------
    // Callback de iniciarSesion() (se omite en la notación)
    // -----------------------------------------------------------------------
    public interface RespuestaInicioSesion {
        // datos: DatosSesion --> sesionIniciada() -->    (200)
        void sesionIniciada(DatosSesion datos);
        // credencialesIncorrectas() -->                  (401)
        void credencialesIncorrectas();
        // mensaje: Text --> error() -->                  (sin conexión u otro código)
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // Callback de solicitarRecuperacion() (se omite en la notación)
    // -----------------------------------------------------------------------
    public interface RespuestaRecuperacion {
        // enlaceEnviado() -->                            (200)
        void enlaceEnviado();
        // mensaje: Text --> error() -->
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // correo: Text, contrasena: Text --> iniciarSesion() -->
    // (misma firma que iniciarSesion() de la lógica de negocio del servidor)
    // What it does: sends POST /iniciarSesion and calls sesionIniciada(),
    //               credencialesIncorrectas() or error() at the end.
    // -----------------------------------------------------------------------
    public void iniciarSesion(String correo, String contrasena, final RespuestaInicioSesion respuesta) {
        String cuerpo;
        try {
            cuerpo = crearJSONInicioSesion(correo, contrasena);
        } catch (JSONException error) {
            respuesta.error("No se pudo preparar la petición.");
            return;
        }
        new PeticionarioREST().hacerPeticionREST("POST",
                LogicaFakeRegistro.URL_SERVIDOR + "/iniciarSesion", cuerpo,
                (codigo, cuerpoRespuesta) -> notificarInicioSesion(codigo, cuerpoRespuesta, respuesta));
    }

    // -----------------------------------------------------------------------
    // correo: Text --> solicitarRecuperacion() -->
    // (misma firma que solicitarRecuperacion() de la lógica del servidor)
    // What it does: sends POST /solicitarRecuperacion. The server always
    //               answers 200 (it does not say if the email exists).
    // -----------------------------------------------------------------------
    public void solicitarRecuperacion(String correo, final RespuestaRecuperacion respuesta) {
        String cuerpo;
        try {
            cuerpo = new JSONObject().put("correo", LogicaFakeRegistro.normalizarCorreo(correo)).toString();
        } catch (JSONException error) {
            respuesta.error("No se pudo preparar la petición.");
            return;
        }
        new PeticionarioREST().hacerPeticionREST("POST",
                LogicaFakeRegistro.URL_SERVIDOR + "/solicitarRecuperacion", cuerpo,
                (codigo, cuerpoRespuesta) -> notificarRecuperacion(codigo, respuesta));
    }

    // -----------------------------------------------------------------------
    // correo: Text, contrasena: Text --> crearJSONInicioSesion() --x
    // Text <--
    // What it does: builds {"correo", "contrasena"}; the email in lower case.
    // -----------------------------------------------------------------------
    static String crearJSONInicioSesion(String correo, String contrasena) throws JSONException {
        JSONObject json = new JSONObject();
        json.put("correo", LogicaFakeRegistro.normalizarCorreo(correo));
        json.put("contrasena", contrasena);
        return json.toString();
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text --> notificarInicioSesion() --x
    // What it does: 200 with a token -> sesionIniciada(); 401 ->
    //               credencialesIncorrectas(); anything else -> error().
    // -----------------------------------------------------------------------
    static void notificarInicioSesion(int codigo, String cuerpo, RespuestaInicioSesion respuesta) {
        if (codigo == CODIGO_OK) {
            DatosSesion datos = DatosSesion.desdeJSON(cuerpo);
            if (datos != null) {
                respuesta.sesionIniciada(datos);
            } else {
                respuesta.error("Respuesta del servidor no válida.");
            }
        } else if (codigo == CODIGO_CREDENCIALES_INCORRECTAS) {
            respuesta.credencialesIncorrectas();
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se ha podido iniciar sesión (error " + codigo + ").");
        }
    }

    // -----------------------------------------------------------------------
    // codigo: Z --> notificarRecuperacion() --x
    // What it does: 200 -> enlaceEnviado(); anything else -> error().
    // -----------------------------------------------------------------------
    static void notificarRecuperacion(int codigo, RespuestaRecuperacion respuesta) {
        if (codigo == CODIGO_OK) {
            respuesta.enlaceEnviado();
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se ha podido enviar el enlace (error " + codigo + ").");
        }
    }
}
