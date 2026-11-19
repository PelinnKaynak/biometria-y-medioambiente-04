// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeAyuda.java
// Descripción: Lógica fake del teléfono para la pantalla Ayuda (T043). Usa las
//              rutas del servidor REST, siempre con el token de la sesión:
//              GET /misIncidencias y POST /crearIncidencia (T041) y, para la
//              conversación de cada incidencia, GET /mensajesIncidencia y
//              POST /enviarMensajeIncidencia. No guarda nada en el teléfono.
//              Diseño en doc/app_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       20/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.List;

// LogicaFakeAyuda class: the phone's fake logic for the Ayuda screens.
public class LogicaFakeAyuda {

    static final int CODIGO_OK = 200;
    static final int CODIGO_CREADO = 201;
    static final int CODIGO_DATOS_NO_VALIDOS = 400;
    static final int CODIGO_SIN_SESION = 401;
    static final int CODIGO_NO_EXISTE = 404;
    static final int CODIGO_SIN_CONEXION = 0;

    static final String MENSAJE_SIN_CONEXION = "No hay conexión con el servidor. Inténtalo de nuevo.";
    static final String MENSAJE_RESPUESTA_NO_VALIDA = "Respuesta del servidor no válida.";
    static final String MENSAJE_DATOS_NO_VALIDOS = "Revisa lo que has escrito e inténtalo de nuevo.";

    // -----------------------------------------------------------------------
    // Callbacks (se omiten en la notación)
    // -----------------------------------------------------------------------
    public interface RespuestaIncidencias {
        // incidencias: Lista<Incidencia> --> incidenciasObtenidas() -->   (200)
        void incidenciasObtenidas(List<Incidencia> incidencias);
        // sesionCaducada() -->                                            (401)
        void sesionCaducada();
        // mensaje: Text --> error() -->                                   (sin conexión u otro código)
        void error(String mensaje);
    }

    public interface RespuestaCreacion {
        // incidencia: Incidencia --> incidenciaCreada() -->               (201)
        void incidenciaCreada(Incidencia incidencia);
        // mensaje: Text --> datosNoValidos() -->                          (400)
        void datosNoValidos(String mensaje);
        void sesionCaducada();
        void error(String mensaje);
    }

    public interface RespuestaMensajes {
        // mensajes: Lista<MensajeIncidencia> --> mensajesObtenidos() -->  (200)
        void mensajesObtenidos(List<MensajeIncidencia> mensajes);
        // incidenciaNoExiste() -->                                        (404)
        void incidenciaNoExiste();
        void sesionCaducada();
        void error(String mensaje);
    }

    public interface RespuestaEnvio {
        // mensaje: MensajeIncidencia --> mensajeEnviado() -->             (201)
        void mensajeEnviado(MensajeIncidencia mensaje);
        // mensaje: Text --> datosNoValidos() -->                          (400)
        void datosNoValidos(String mensaje);
        void incidenciaNoExiste();
        void sesionCaducada();
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // token: Text --> obtenerIncidencias() -->
    // What it does: sends GET /misIncidencias with the token and calls
    //               incidenciasObtenidas(), sesionCaducada() or error().
    // -----------------------------------------------------------------------
    public void obtenerIncidencias(String token, final RespuestaIncidencias respuesta) {
        new PeticionarioREST().hacerPeticionREST("GET",
                LogicaFakeRegistro.URL_SERVIDOR + "/misIncidencias", null, token,
                (codigo, cuerpo) -> notificarIncidencias(codigo, cuerpo, respuesta));
    }

    // -----------------------------------------------------------------------
    // token: Text, tipo: Text, asunto: Text, descripcion: Text --> crearIncidencia() -->
    // What it does: sends POST /crearIncidencia {"tipo","asunto","descripcion"}.
    //               The sensor is not sent: for the types «sensor» and «datos» the
    //               server adds the user's sensor by itself.
    // -----------------------------------------------------------------------
    public void crearIncidencia(String token, String tipo, String asunto, String descripcion,
                                final RespuestaCreacion respuesta) {
        String cuerpo;
        try {
            cuerpo = crearJSONIncidencia(tipo, asunto, descripcion);
        } catch (JSONException error) {
            respuesta.error("No se pudo preparar la petición.");
            return;
        }
        new PeticionarioREST().hacerPeticionREST("POST",
                LogicaFakeRegistro.URL_SERVIDOR + "/crearIncidencia", cuerpo, token,
                (codigo, cuerpoRespuesta) -> notificarCreacion(codigo, cuerpoRespuesta, respuesta));
    }

    // -----------------------------------------------------------------------
    // token: Text, idIncidencia: N --> obtenerMensajes() -->
    // What it does: sends GET /mensajesIncidencia?id=N (the conversation, the
    //               oldest message first).
    // -----------------------------------------------------------------------
    public void obtenerMensajes(String token, int idIncidencia, final RespuestaMensajes respuesta) {
        new PeticionarioREST().hacerPeticionREST("GET",
                LogicaFakeRegistro.URL_SERVIDOR + "/mensajesIncidencia?id=" + idIncidencia, null, token,
                (codigo, cuerpo) -> notificarMensajes(codigo, cuerpo, respuesta));
    }

    // -----------------------------------------------------------------------
    // token: Text, idIncidencia: N, texto: Text --> enviarMensaje() -->
    // What it does: sends POST /enviarMensajeIncidencia {"idIncidencia","texto"}.
    //               If the incidence was «resuelta», the server reopens it.
    // -----------------------------------------------------------------------
    public void enviarMensaje(String token, int idIncidencia, String texto, final RespuestaEnvio respuesta) {
        String cuerpo;
        try {
            cuerpo = crearJSONMensaje(idIncidencia, texto);
        } catch (JSONException error) {
            respuesta.error("No se pudo preparar la petición.");
            return;
        }
        new PeticionarioREST().hacerPeticionREST("POST",
                LogicaFakeRegistro.URL_SERVIDOR + "/enviarMensajeIncidencia", cuerpo, token,
                (codigo, cuerpoRespuesta) -> notificarEnvio(codigo, cuerpoRespuesta, respuesta));
    }

    // -----------------------------------------------------------------------
    // tipo: Text, asunto: Text, descripcion: Text --> crearJSONIncidencia() --x
    // Text <--
    // What it does: builds {"tipo","asunto","descripcion"} (the texts without the
    //               spaces at the ends).
    // -----------------------------------------------------------------------
    static String crearJSONIncidencia(String tipo, String asunto, String descripcion) throws JSONException {
        return new JSONObject()
                .put("tipo", tipo)
                .put("asunto", asunto == null ? "" : asunto.trim())
                .put("descripcion", descripcion == null ? "" : descripcion.trim())
                .toString();
    }

    // -----------------------------------------------------------------------
    // idIncidencia: N, texto: Text --> crearJSONMensaje() --x
    // Text <--
    // What it does: builds {"idIncidencia","texto"}.
    // -----------------------------------------------------------------------
    static String crearJSONMensaje(int idIncidencia, String texto) throws JSONException {
        return new JSONObject()
                .put("idIncidencia", idIncidencia)
                .put("texto", texto == null ? "" : texto.trim())
                .toString();
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text --> notificarIncidencias() --x
    // What it does: 200 with a list -> incidenciasObtenidas(); 401 ->
    //               sesionCaducada(); anything else -> error().
    // -----------------------------------------------------------------------
    static void notificarIncidencias(int codigo, String cuerpo, RespuestaIncidencias respuesta) {
        if (codigo == CODIGO_OK) {
            List<Incidencia> incidencias = Incidencia.listaDesdeJSON(cuerpo);
            if (incidencias != null) {
                respuesta.incidenciasObtenidas(incidencias);
            } else {
                respuesta.error(MENSAJE_RESPUESTA_NO_VALIDA);
            }
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else {
            respuesta.error(mensajeDeError(codigo, "No se han podido cargar tus incidencias"));
        }
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text --> notificarCreacion() --x
    // What it does: 201 -> incidenciaCreada(); 400 -> datosNoValidos(); 401 ->
    //               sesionCaducada(); anything else -> error().
    // -----------------------------------------------------------------------
    static void notificarCreacion(int codigo, String cuerpo, RespuestaCreacion respuesta) {
        if (codigo == CODIGO_CREADO) {
            Incidencia incidencia = Incidencia.desdeJSON(cuerpo);
            if (incidencia != null) {
                respuesta.incidenciaCreada(incidencia);
            } else {
                respuesta.error(MENSAJE_RESPUESTA_NO_VALIDA);
            }
        } else if (codigo == CODIGO_DATOS_NO_VALIDOS) {
            respuesta.datosNoValidos(mensajeDelServidor(cuerpo));
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else {
            respuesta.error(mensajeDeError(codigo, "No se ha podido enviar la incidencia"));
        }
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text --> notificarMensajes() --x
    // What it does: 200 with a list -> mensajesObtenidos(); 404 ->
    //               incidenciaNoExiste(); 401 -> sesionCaducada(); anything else -> error().
    // -----------------------------------------------------------------------
    static void notificarMensajes(int codigo, String cuerpo, RespuestaMensajes respuesta) {
        if (codigo == CODIGO_OK) {
            List<MensajeIncidencia> mensajes = MensajeIncidencia.listaDesdeJSON(cuerpo);
            if (mensajes != null) {
                respuesta.mensajesObtenidos(mensajes);
            } else {
                respuesta.error(MENSAJE_RESPUESTA_NO_VALIDA);
            }
        } else if (codigo == CODIGO_NO_EXISTE) {
            respuesta.incidenciaNoExiste();
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else {
            respuesta.error(mensajeDeError(codigo, "No se ha podido cargar la conversación"));
        }
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text --> notificarEnvio() --x
    // What it does: 201 -> mensajeEnviado(); 400 -> datosNoValidos(); 404 ->
    //               incidenciaNoExiste(); 401 -> sesionCaducada(); anything else -> error().
    // -----------------------------------------------------------------------
    static void notificarEnvio(int codigo, String cuerpo, RespuestaEnvio respuesta) {
        if (codigo == CODIGO_CREADO) {
            MensajeIncidencia mensaje = MensajeIncidencia.desdeJSON(cuerpo);
            if (mensaje != null) {
                respuesta.mensajeEnviado(mensaje);
            } else {
                respuesta.error(MENSAJE_RESPUESTA_NO_VALIDA);
            }
        } else if (codigo == CODIGO_DATOS_NO_VALIDOS) {
            respuesta.datosNoValidos(mensajeDelServidor(cuerpo));
        } else if (codigo == CODIGO_NO_EXISTE) {
            respuesta.incidenciaNoExiste();
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else {
            respuesta.error(mensajeDeError(codigo, "No se ha podido enviar el mensaje"));
        }
    }

    // sin conexión (código 0) o «<texto> (error N).»
    private static String mensajeDeError(int codigo, String texto) {
        return codigo == CODIGO_SIN_CONEXION ? MENSAJE_SIN_CONEXION : texto + " (error " + codigo + ").";
    }

    // el «error» del cuerpo de un 400, o un texto general si no viene
    private static String mensajeDelServidor(String cuerpo) {
        try {
            String texto = LectorJSON.texto(new JSONObject(cuerpo), "error");
            return texto.isEmpty() ? MENSAJE_DATOS_NO_VALIDOS : texto;
        } catch (Exception noEsJSON) {
            return MENSAJE_DATOS_NO_VALIDOS;
        }
    }
}
