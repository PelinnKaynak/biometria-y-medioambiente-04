// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeRegistro.java
// Descripción: Lógica fake del teléfono para el registro. registrarUsuario()
//              crea un JSON con nombre, apellidos, correo y contraseña y lo
//              envía con POST /registrarUsuario al servidor REST. La pantalla
//              no hace peticiones HTTP: solo llama a esta clase.
//              El servidor (T016) guarda el usuario en la tabla Usuarios de
//              la BD. Diseño en doc/app_design.md. Tarea T002 · H001.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Locale;

// LogicaFakeRegistro class: the phone's fake logic for sign-up. It does not save
// anything itself: it sends the new user to the server with POST /registrarUsuario.
public class LogicaFakeRegistro {

    // Dirección del servidor REST:
    //   emulador       -> http://10.0.2.2:8080 (el ordenador que ejecuta el emulador)
    //   teléfono real  -> http://<IPv4 del ordenador en la misma Wi-Fi>:8080
    static final String URL_SERVIDOR = "http://10.0.2.2:8080";

    static final int CODIGO_CREADO = 201;
    static final int CODIGO_CORREO_YA_REGISTRADO = 409;

    // Resultado de la petición, según el código de respuesta del servidor
    enum ResultadoRegistro { REGISTRADO, CORREO_YA_REGISTRADO, ERROR }

    // -----------------------------------------------------------------------
    // Callback de registrarUsuario() (se omite en la notación)
    // -----------------------------------------------------------------------
    public interface RespuestaRegistro {
        // ------------------------------------------------------------
        // datos: DatosSesion --> registrado() -->
        // What it does: called when the server created the account (201).
        //               The server also opens the session and sends its token.
        // ------------------------------------------------------------
        void registrado(DatosSesion datos);

        // ------------------------------------------------------------
        // correoYaRegistrado() -->
        // What it does: called when the email already has an account (409).
        // ------------------------------------------------------------
        void correoYaRegistrado();

        // ------------------------------------------------------------
        // mensaje: Text --> error() -->
        // What it does: called when the account could not be created, with the reason.
        // ------------------------------------------------------------
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // nombre: Text, apellidos: Text, correo: Text, contrasena: Text --> registrarUsuario() -->
    // (misma firma que registrarUsuario() de la lógica de negocio del servidor)
    //
    // What it does: makes the JSON and sends it with POST /registrarUsuario.
    //               Calls registrado(), correoYaRegistrado() or error() at the end.
    // -----------------------------------------------------------------------
    public void registrarUsuario(String nombre, String apellidos, String correo, String contrasena,
                                 final RespuestaRegistro respuesta) {
        String cuerpo;
        try {
            cuerpo = crearJSON(nombre, apellidos, correo, contrasena);
        } catch (JSONException error) {
            respuesta.error("No se pudo preparar la petición.");
            return;
        }

        new PeticionarioREST().hacerPeticionREST(
                "POST",
                URL_SERVIDOR + "/registrarUsuario",
                cuerpo,
                (codigo, cuerpoRespuesta) -> notificarResultado(codigo, cuerpoRespuesta, respuesta));
    }

    // -----------------------------------------------------------------------
    // nombre: Text, apellidos: Text, correo: Text, contrasena: Text --> crearJSON() --x
    // Text <--
    // What it does: builds {"nombre", "apellidos", "correo", "contrasena"}.
    //               The email is saved in lower case and without spaces.
    //               The password is sent as it is: the server encrypts it (T016).
    // -----------------------------------------------------------------------
    static String crearJSON(String nombre, String apellidos, String correo, String contrasena)
            throws JSONException {
        JSONObject json = new JSONObject();
        json.put("nombre", nombre.trim());
        json.put("apellidos", apellidos.trim());
        json.put("correo", normalizarCorreo(correo));
        json.put("contrasena", contrasena);
        return json.toString();
    }

    // -----------------------------------------------------------------------
    // codigo: Z --> interpretarCodigo() --x
    // ResultadoRegistro <--
    // What it does: 201 -> REGISTRADO, 409 -> CORREO_YA_REGISTRADO, any other -> ERROR.
    // -----------------------------------------------------------------------
    static ResultadoRegistro interpretarCodigo(int codigo) {
        if (codigo == CODIGO_CREADO) {
            return ResultadoRegistro.REGISTRADO;
        }
        if (codigo == CODIGO_CORREO_YA_REGISTRADO) {
            return ResultadoRegistro.CORREO_YA_REGISTRADO;
        }
        return ResultadoRegistro.ERROR;
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text --> notificarResultado() --x
    // (el callback respuesta se omite en la notación)
    // What it does: calls the right method of the callback for that answer code.
    //               With 201 it reads the session data (token) from the body.
    // -----------------------------------------------------------------------
    static void notificarResultado(int codigo, String cuerpo, RespuestaRegistro respuesta) {
        switch (interpretarCodigo(codigo)) {
            case REGISTRADO:
                DatosSesion datos = DatosSesion.desdeJSON(cuerpo);
                if (datos != null) {
                    respuesta.registrado(datos);
                } else {
                    respuesta.error("Respuesta del servidor no válida.");
                }
                break;
            case CORREO_YA_REGISTRADO:
                respuesta.correoYaRegistrado();
                break;
            default:
                respuesta.error(codigo == 0
                        ? "No hay conexión con el servidor. Inténtalo de nuevo."
                        : "No se ha podido crear la cuenta (error " + codigo + ").");
        }
    }

    // -----------------------------------------------------------------------
    // correo: Text --> normalizarCorreo() --x
    // Text <--
    // What it does: removes spaces and puts the email in lower case.
    // -----------------------------------------------------------------------
    static String normalizarCorreo(String correo) {
        return correo.trim().toLowerCase(Locale.ROOT);
    }
}
