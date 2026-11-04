// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeEditarDatos.java
// Descripción: Lógica fake del teléfono para «Editar mis datos». Envía
//              POST /actualizarDatos y POST /cambiarContrasenya al servidor
//              REST con el token de la sesión y avisa a la pantalla con el
//              resultado. Diseño en doc/app_design.md. Tarea T010.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONException;
import org.json.JSONObject;

// LogicaFakeEditarDatos class: the phone's fake logic for «Editar mis datos».
public class LogicaFakeEditarDatos {

    static final int CODIGO_OK = 200;
    static final int CODIGO_DATOS_NO_VALIDOS = 400;
    static final int CODIGO_SIN_SESION = 401;
    static final int CODIGO_CONTRASENA_INCORRECTA = 403;
    static final int CODIGO_CORREO_YA_REGISTRADO = 409;
    static final int CODIGO_SIN_CONEXION = 0;

    static final String MENSAJE_CORREO_YA_REGISTRADO = "Este correo ya tiene una cuenta.";
    static final String MENSAJE_CONTRASENA_INCORRECTA = "La contraseña actual no es correcta.";
    static final String MENSAJE_SIN_CONEXION = "No hay conexión con el servidor. Inténtalo de nuevo.";

    // -----------------------------------------------------------------------
    // Callback de actualizarDatos() (se omite en la notación)
    // -----------------------------------------------------------------------
    public interface RespuestaDatos {
        // datos: DatosUsuario --> datosGuardados() -->   (200: solo nombre, apellidos y correo)
        void datosGuardados(DatosUsuario datos);
        // correoYaRegistrado() -->                       (409)
        void correoYaRegistrado();
        // sesionCaducada() -->                           (401)
        void sesionCaducada();
        // mensaje: Text --> error() -->                  (400, sin conexión u otro código)
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // Callback de cambiarContrasena() (se omite en la notación)
    // -----------------------------------------------------------------------
    public interface RespuestaContrasena {
        // datos: DatosSesion --> contrasenaCambiada() -->  (200: sesión nueva)
        void contrasenaCambiada(DatosSesion datos);
        // contrasenaActualIncorrecta() -->                 (403)
        void contrasenaActualIncorrecta();
        // sesionCaducada() -->                             (401)
        void sesionCaducada();
        // mensaje: Text --> error() -->
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // token: Text, nombre: Text, apellidos: Text, correo: Text --> actualizarDatos() -->
    // What it does: sends POST /actualizarDatos and calls datosGuardados(),
    //               correoYaRegistrado(), sesionCaducada() or error().
    // -----------------------------------------------------------------------
    public void actualizarDatos(String token, String nombre, String apellidos, String correo,
                                final RespuestaDatos respuesta) {
        String cuerpo;
        try {
            cuerpo = crearJSONDatos(nombre, apellidos, correo);
        } catch (JSONException error) {
            respuesta.error("No se pudo preparar la petición.");
            return;
        }
        new PeticionarioREST().hacerPeticionREST("POST",
                LogicaFakeRegistro.URL_SERVIDOR + "/actualizarDatos", cuerpo, token,
                (codigo, cuerpoRespuesta) -> notificarDatos(codigo, cuerpoRespuesta, respuesta));
    }

    // -----------------------------------------------------------------------
    // token: Text, actual: Text, nueva: Text --> cambiarContrasena() -->
    // What it does: sends POST /cambiarContrasenya and calls contrasenaCambiada()
    //               with the new session, contrasenaActualIncorrecta(),
    //               sesionCaducada() or error().
    // -----------------------------------------------------------------------
    public void cambiarContrasena(String token, String actual, String nueva,
                                  final RespuestaContrasena respuesta) {
        String cuerpo;
        try {
            cuerpo = crearJSONContrasena(actual, nueva);
        } catch (JSONException error) {
            respuesta.error("No se pudo preparar la petición.");
            return;
        }
        new PeticionarioREST().hacerPeticionREST("POST",
                LogicaFakeRegistro.URL_SERVIDOR + "/cambiarContrasenya", cuerpo, token,
                (codigo, cuerpoRespuesta) -> notificarContrasena(codigo, cuerpoRespuesta, respuesta));
    }

    // -----------------------------------------------------------------------
    // nombre: Text, apellidos: Text, correo: Text --> crearJSONDatos() --x
    // Text <--
    // What it does: builds {"nombre", "apellidos", "correo"}: without spaces at
    //               the ends and the email in lower case.
    // -----------------------------------------------------------------------
    static String crearJSONDatos(String nombre, String apellidos, String correo) throws JSONException {
        JSONObject json = new JSONObject();
        json.put("nombre", nombre.trim());
        json.put("apellidos", apellidos.trim());
        json.put("correo", LogicaFakeRegistro.normalizarCorreo(correo));
        return json.toString();
    }

    // -----------------------------------------------------------------------
    // actual: Text, nueva: Text --> crearJSONContrasena() --x
    // Text <--
    // What it does: builds {"contrasenaActual", "contrasenaNueva"}.
    // -----------------------------------------------------------------------
    static String crearJSONContrasena(String actual, String nueva) throws JSONException {
        JSONObject json = new JSONObject();
        json.put("contrasenaActual", actual);
        json.put("contrasenaNueva", nueva);
        return json.toString();
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text --> notificarDatos() --x
    // What it does: 200 -> datosGuardados(); 409 -> correoYaRegistrado();
    //               401 -> sesionCaducada(); anything else -> error().
    // -----------------------------------------------------------------------
    static void notificarDatos(int codigo, String cuerpo, RespuestaDatos respuesta) {
        if (codigo == CODIGO_OK) {
            DatosUsuario datos = DatosUsuario.desdeJSON(cuerpo);
            if (datos != null) {
                respuesta.datosGuardados(datos);
            } else {
                respuesta.error("Respuesta del servidor no válida.");
            }
        } else if (codigo == CODIGO_CORREO_YA_REGISTRADO) {
            respuesta.correoYaRegistrado();
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_DATOS_NO_VALIDOS) {
            respuesta.error("Revisa los datos: alguno no es válido.");
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se han podido guardar los datos (error " + codigo + ").");
        }
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text --> notificarContrasena() --x
    // What it does: 200 with a token -> contrasenaCambiada(); 403 ->
    //               contrasenaActualIncorrecta(); 401 -> sesionCaducada();
    //               anything else -> error().
    // -----------------------------------------------------------------------
    static void notificarContrasena(int codigo, String cuerpo, RespuestaContrasena respuesta) {
        if (codigo == CODIGO_OK) {
            DatosSesion datos = DatosSesion.desdeJSON(cuerpo);
            if (datos != null) {
                respuesta.contrasenaCambiada(datos);
            } else {
                respuesta.error("Respuesta del servidor no válida.");
            }
        } else if (codigo == CODIGO_CONTRASENA_INCORRECTA) {
            respuesta.contrasenaActualIncorrecta();
        } else if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_DATOS_NO_VALIDOS) {
            respuesta.error("La contraseña nueva no es válida.");
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se ha podido cambiar la contraseña (error " + codigo + ").");
        }
    }
}
