// ---------------------------------------------------------------------------
// Fichero:     LogicaFakePerfil.java
// Descripción: Lógica fake del teléfono para la pantalla de perfil. Pide los
//              datos del usuario (GET /usuarioActual) y guarda el interruptor
//              de notificaciones (POST /cambiarAlertas) y la foto
//              (POST /cambiarFoto) en el servidor REST,
//              enviando el token de la sesión. Diseño en doc/app_design.md.
//              Tarea T010.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONException;
import org.json.JSONObject;

// LogicaFakePerfil class: the phone's fake logic for the Perfil screen.
public class LogicaFakePerfil {

    static final int CODIGO_OK = 200;
    static final int CODIGO_GUARDADO = 204;
    static final int CODIGO_SIN_SESION = 401;
    static final int CODIGO_SIN_CONEXION = 0;

    static final String MENSAJE_SIN_CONEXION = "No hay conexión con el servidor. Inténtalo de nuevo.";

    // -----------------------------------------------------------------------
    // Callback de obtenerUsuario() (se omite en la notación)
    // -----------------------------------------------------------------------
    public interface RespuestaUsuario {
        // datos: DatosUsuario --> usuarioObtenido() -->   (200)
        void usuarioObtenido(DatosUsuario datos);
        // sesionCaducada() -->                            (401: el token ya no vale)
        void sesionCaducada();
        // mensaje: Text --> error() -->                   (sin conexión u otro código)
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // Callback de cambiarAlertas() (se omite en la notación)
    // -----------------------------------------------------------------------
    public interface RespuestaCambio {
        // cambioGuardado() -->                            (204)
        void cambioGuardado();
        // sesionCaducada() -->                            (401)
        void sesionCaducada();
        // mensaje: Text --> error() -->
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // token: Text --> obtenerUsuario() -->
    // What it does: sends GET /usuarioActual with the session token and calls
    //               usuarioObtenido(), sesionCaducada() or error() at the end.
    // -----------------------------------------------------------------------
    public void obtenerUsuario(String token, final RespuestaUsuario respuesta) {
        new PeticionarioREST().hacerPeticionREST("GET",
                LogicaFakeRegistro.URL_SERVIDOR + "/usuarioActual", null, token,
                (codigo, cuerpo) -> notificarUsuario(codigo, cuerpo, respuesta));
    }

    // -----------------------------------------------------------------------
    // token: Text, alertas: B --> cambiarAlertas() -->
    // (misma firma que cambiarAlertas() de la lógica del servidor, con el
    //  token en lugar de idUsuario)
    // What it does: sends POST /cambiarAlertas {"alertas"} with the session
    //               token and calls cambioGuardado(), sesionCaducada() or error().
    // -----------------------------------------------------------------------
    public void cambiarAlertas(String token, boolean alertas, final RespuestaCambio respuesta) {
        String cuerpo;
        try {
            cuerpo = crearJSONAlertas(alertas);
        } catch (JSONException error) {
            respuesta.error("No se pudo preparar la petición.");
            return;
        }
        new PeticionarioREST().hacerPeticionREST("POST",
                LogicaFakeRegistro.URL_SERVIDOR + "/cambiarAlertas", cuerpo, token,
                (codigo, cuerpoRespuesta) -> notificarCambio(codigo, respuesta));
    }

    // -----------------------------------------------------------------------
    // token: Text, foto: Text | null --> cambiarFoto() -->
    // What it does: sends POST /cambiarFoto {"foto"} (JPEG in base64, or null
    //               to delete it) and calls cambioGuardado(), sesionCaducada()
    //               or error().
    // -----------------------------------------------------------------------
    public void cambiarFoto(String token, String foto, final RespuestaCambio respuesta) {
        String cuerpo;
        try {
            cuerpo = crearJSONFoto(foto);
        } catch (JSONException error) {
            respuesta.error("No se pudo preparar la petición.");
            return;
        }
        new PeticionarioREST().hacerPeticionREST("POST",
                LogicaFakeRegistro.URL_SERVIDOR + "/cambiarFoto", cuerpo, token,
                (codigo, cuerpoRespuesta) -> notificarCambio(codigo, respuesta));
    }

    // -----------------------------------------------------------------------
    // foto: Text | null --> crearJSONFoto() --x
    // Text <--
    // What it does: builds {"foto": "<base64>"} or {"foto": null}.
    // -----------------------------------------------------------------------
    static String crearJSONFoto(String foto) throws JSONException {
        return new JSONObject().put("foto", foto == null ? JSONObject.NULL : foto).toString();
    }

    // -----------------------------------------------------------------------
    // alertas: B --> crearJSONAlertas() --x
    // Text <--
    // What it does: builds {"alertas": true | false}.
    // -----------------------------------------------------------------------
    static String crearJSONAlertas(boolean alertas) throws JSONException {
        return new JSONObject().put("alertas", alertas).toString();
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text --> notificarUsuario() --x
    // What it does: 200 with valid data -> usuarioObtenido(); 401 ->
    //               sesionCaducada(); anything else -> error().
    // -----------------------------------------------------------------------
    static void notificarUsuario(int codigo, String cuerpo, RespuestaUsuario respuesta) {
        if (codigo == CODIGO_OK) {
            DatosUsuario datos = DatosUsuario.desdeJSON(cuerpo);
            if (datos != null) {
                respuesta.usuarioObtenido(datos);
            } else {
                respuesta.error("Respuesta del servidor no válida.");
            }
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se han podido cargar tus datos (error " + codigo + ").");
        }
    }

    // -----------------------------------------------------------------------
    // codigo: Z --> notificarCambio() --x
    // What it does: 204 -> cambioGuardado(); 401 -> sesionCaducada();
    //               anything else -> error().
    // -----------------------------------------------------------------------
    static void notificarCambio(int codigo, RespuestaCambio respuesta) {
        if (codigo == CODIGO_GUARDADO) {
            respuesta.cambioGuardado();
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se ha podido guardar el cambio (error " + codigo + ").");
        }
    }
}
