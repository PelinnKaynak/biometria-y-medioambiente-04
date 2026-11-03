// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeRegistro.java
// Descripción: Lógica fake del teléfono para el registro. registrarUsuario()
//              crea un JSON con nombre, apellidos, correo y contraseña y lo
//              envía con POST /registrarUsuario al servidor REST. La pantalla
//              no hace peticiones HTTP: solo llama a esta clase.
//              Mientras el servidor no exista (tarea T016) se puede usar el
//              modo simulado. Diseño en doc/app_design.md. Tarea T002 · H001.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.sensetech.aeris;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

// LogicaFakeRegistro class: the phone's fake logic for sign-up. It does not save
// anything itself: it sends the new user to the server with POST /registrarUsuario.
public class LogicaFakeRegistro {

    // Dirección del servidor REST:
    //   emulador       -> http://10.0.2.2:8080 (el ordenador que ejecuta el emulador)
    //   teléfono real  -> http://<IPv4 del ordenador en la misma Wi-Fi>:8080
    private static final String URL_SERVIDOR = "http://10.0.2.2:8080";

    // true mientras no exista el servidor (T016): la respuesta se simula en el teléfono.
    // Cuando el servidor esté listo, se cambia a false.
    static final boolean MODO_SIMULADO = true;

    static final int CODIGO_CREADO = 201;
    static final int CODIGO_CORREO_YA_REGISTRADO = 409;

    // Resultado de la petición, según el código de respuesta del servidor
    enum ResultadoRegistro { REGISTRADO, CORREO_YA_REGISTRADO, ERROR }

    // Correos que el modo simulado considera ya registrados (para probar el error 409)
    private static final Set<String> CORREOS_SIMULADOS = new HashSet<>();
    static {
        CORREOS_SIMULADOS.add("ana@aeris.es");
    }

    // -----------------------------------------------------------------------
    // Callback de registrarUsuario() (se omite en la notación)
    // -----------------------------------------------------------------------
    public interface RespuestaRegistro {
        // ------------------------------------------------------------
        // registrado() -->
        // What it does: called when the server created the account (201).
        // ------------------------------------------------------------
        void registrado();

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
        if (MODO_SIMULADO) {
            simularRegistro(correo, respuesta);
            return;
        }

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
                (codigo, cuerpoRespuesta) -> notificarResultado(codigo, respuesta));
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
    // codigo: Z --> notificarResultado() --x
    // (el callback respuesta se omite en la notación)
    // What it does: calls the right method of the callback for that answer code.
    // -----------------------------------------------------------------------
    static void notificarResultado(int codigo, RespuestaRegistro respuesta) {
        switch (interpretarCodigo(codigo)) {
            case REGISTRADO:
                respuesta.registrado();
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

    // -----------------------------------------------------------------------
    // correo: Text --> simularRegistro() --x       (solo en MODO_SIMULADO)
    // What it does: answers like the server would after a short wait:
    //               409 if the email is already in the list, 201 if not.
    // -----------------------------------------------------------------------
    private static void simularRegistro(String correo, RespuestaRegistro respuesta) {
        String correoNormalizado = normalizarCorreo(correo);
        int codigo = CORREOS_SIMULADOS.contains(correoNormalizado)
                ? CODIGO_CORREO_YA_REGISTRADO
                : CODIGO_CREADO;
        if (codigo == CODIGO_CREADO) {
            CORREOS_SIMULADOS.add(correoNormalizado);
        }
        new Handler(Looper.getMainLooper()).postDelayed(
                () -> notificarResultado(codigo, respuesta), 600);
    }
}
