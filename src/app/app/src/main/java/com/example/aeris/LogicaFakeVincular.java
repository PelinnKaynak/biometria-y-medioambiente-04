// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeVincular.java
// Descripción: Lógica falsa del teléfono para vincular el sensor. Pide la
//              vinculación (el servidor envía el correo de confirmación a
//              quien compró el sensor), consulta en qué estado está y reenvía
//              el correo. Hasta que el servidor tenga estas rutas (T037) usa
//              datos de ejemplo, como LogicaFakeInicio. Diseño en
//              doc/app_design.md. T005.
// Autores:     Equipo 04 – SenseTech
// Fecha:       13/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONException;
import org.json.JSONObject;

// LogicaFakeVincular class: the phone's fake logic for linking the sensor.
public class LogicaFakeVincular {

    // false: usa el servidor (POST /solicitarVinculacion, GET /estadoVinculacion,
    // POST /reenviarCorreoVinculacion) y el correo se envía de verdad.
    // true: solicitud de ejemplo, para ver las pantallas sin servidor
    static final boolean USAR_DATOS_DE_EJEMPLO = false;
    // Estado que devuelve la consulta con datos de ejemplo: cambiar a
    // CONFIRMADA o RECHAZADA para ver esas pantallas
    static final SolicitudVinculacion.Estado ESTADO_DE_EJEMPLO = SolicitudVinculacion.Estado.PENDIENTE;
    static final String CORREO_COMPRADOR_EJEMPLO = "pkaynak@upv.edu.es";   // correo fijo del comprador en la demo

    static final int CODIGO_OK = 200;
    static final int CODIGO_CREADO = 201;
    static final int CODIGO_SIN_SESION = 401;
    static final int CODIGO_NO_EXISTE = 404;
    static final int CODIGO_YA_VINCULADO = 409;
    static final int CODIGO_SIN_CONEXION = 0;

    static final String MENSAJE_NO_REGISTRADO = "Este sensor no está registrado. Revisa el código o escríbenos desde Ayuda.";
    static final String MENSAJE_YA_VINCULADO = "Este sensor ya está vinculado a otra cuenta.";

    // Solicitud de ejemplo de esta sesión de la app (sin servidor)
    private static SolicitudVinculacion solicitudDeEjemplo = null;

    // -----------------------------------------------------------------------
    // Callbacks (se omiten en la notación)
    // -----------------------------------------------------------------------
    public interface RespuestaSolicitud {
        // solicitud: SolicitudVinculacion --> solicitudObtenida() -->
        void solicitudObtenida(SolicitudVinculacion solicitud);
        // sinSolicitud() -->        (el usuario no ha pedido ninguna vinculación)
        void sinSolicitud();
        // sesionCaducada() -->      (401)
        void sesionCaducada();
        // mensaje: Text --> error() -->
        void error(String mensaje);
    }

    public interface RespuestaReenvio {
        // correoReenviado() -->
        void correoReenviado();
        // mensaje: Text --> error() -->
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // token: Text, codigo: CodigoSensor --> solicitarVinculacion() -->
    // What it does: asks the server to link the sensor; the server sends
    //               the e-mail to whoever bought it and answers with the
    //               pending request. With USAR_DATOS_DE_EJEMPLO it answers at
    //               once with an example request.
    // -----------------------------------------------------------------------
    public void solicitarVinculacion(String token, CodigoSensor codigo, final RespuestaSolicitud respuesta) {
        if (USAR_DATOS_DE_EJEMPLO) {
            solicitudDeEjemplo = new SolicitudVinculacion(codigo.numeroSerie,
                    SolicitudVinculacion.ocultarCorreo(CORREO_COMPRADOR_EJEMPLO),
                    SolicitudVinculacion.Estado.PENDIENTE, System.currentTimeMillis());
            respuesta.solicitudObtenida(solicitudDeEjemplo);
            return;
        }
        new PeticionarioREST().hacerPeticionREST("POST",
                LogicaFakeRegistro.URL_SERVIDOR + "/solicitarVinculacion", cuerpoSolicitud(codigo), token,
                (codigoHTTP, cuerpo) -> notificarSolicitud(codigoHTTP, cuerpo, false, respuesta));
    }

    // -----------------------------------------------------------------------
    // token: Text --> consultarEstado() -->
    // What it does: asks in which state the user's request is. With
    //               USAR_DATOS_DE_EJEMPLO: the request of this session (with
    //               ESTADO_DE_EJEMPLO) or sinSolicitud() if there is none.
    // -----------------------------------------------------------------------
    public void consultarEstado(String token, final RespuestaSolicitud respuesta) {
        if (USAR_DATOS_DE_EJEMPLO) {
            if (solicitudDeEjemplo == null) {
                respuesta.sinSolicitud();
            } else {
                respuesta.solicitudObtenida(new SolicitudVinculacion(solicitudDeEjemplo.numeroSerie,
                        solicitudDeEjemplo.correoComprador, ESTADO_DE_EJEMPLO, solicitudDeEjemplo.momento));
            }
            return;
        }
        new PeticionarioREST().hacerPeticionREST("GET",
                LogicaFakeRegistro.URL_SERVIDOR + "/estadoVinculacion", null, token,
                (codigoHTTP, cuerpo) -> notificarSolicitud(codigoHTTP, cuerpo, true, respuesta));
    }

    // -----------------------------------------------------------------------
    // token: Text --> reenviarCorreo() -->
    // What it does: asks the server to send the confirmation e-mail again.
    // -----------------------------------------------------------------------
    public void reenviarCorreo(String token, final RespuestaReenvio respuesta) {
        if (USAR_DATOS_DE_EJEMPLO) {
            respuesta.correoReenviado();
            return;
        }
        new PeticionarioREST().hacerPeticionREST("POST",
                LogicaFakeRegistro.URL_SERVIDOR + "/reenviarCorreoVinculacion", "{}", token,
                (codigoHTTP, cuerpo) -> {
                    if (codigoHTTP == CODIGO_OK) {
                        respuesta.correoReenviado();
                    } else if (codigoHTTP == CODIGO_SIN_CONEXION) {
                        respuesta.error(LogicaFakePerfil.MENSAJE_SIN_CONEXION);
                    } else {
                        respuesta.error("No se ha podido reenviar el correo (error " + codigoHTTP + ").");
                    }
                });
    }

    // -----------------------------------------------------------------------
    // codigo: CodigoSensor --> cuerpoSolicitud() --x
    // Text <--
    // What it does: {"numeroSerie": "092021010920", "sensibilidad": -44.75}
    // -----------------------------------------------------------------------
    static String cuerpoSolicitud(CodigoSensor codigo) {
        try {
            return new JSONObject()
                    .put("numeroSerie", codigo.numeroSerie)
                    .put("sensibilidad", codigo.sensibilidad)
                    .toString();
        } catch (JSONException error) {
            return "{}";
        }
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text, alConsultar: B --> notificarSolicitud() --x
    // What it does: 200/201 with a valid request -> solicitudObtenida();
    //               401 -> sesionCaducada(); 404 -> sinSolicitud() when asking
    //               the state, «not registered» when requesting; 409 ->
    //               «already linked»; anything else -> error().
    // -----------------------------------------------------------------------
    static void notificarSolicitud(int codigo, String cuerpo, boolean alConsultar, RespuestaSolicitud respuesta) {
        if (codigo == CODIGO_OK || codigo == CODIGO_CREADO) {
            SolicitudVinculacion solicitud = SolicitudVinculacion.desdeJSON(cuerpo);
            if (solicitud == null) {
                respuesta.error("Respuesta del servidor no válida.");
            } else {
                respuesta.solicitudObtenida(solicitud);
            }
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_NO_EXISTE) {
            if (alConsultar) {
                respuesta.sinSolicitud();
            } else {
                respuesta.error(MENSAJE_NO_REGISTRADO);
            }
        } else if (codigo == CODIGO_YA_VINCULADO) {
            respuesta.error(MENSAJE_YA_VINCULADO);
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(LogicaFakePerfil.MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se ha podido vincular el sensor (error " + codigo + ").");
        }
    }

    // Solo para los tests: olvida la solicitud de ejemplo
    static void olvidarSolicitudDeEjemplo() {
        solicitudDeEjemplo = null;
    }
}
