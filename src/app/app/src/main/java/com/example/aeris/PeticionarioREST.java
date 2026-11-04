// ---------------------------------------------------------------------------
// Fichero:     PeticionarioREST.java
// Descripción: Realiza una petición HTTP (REST) en segundo plano y entrega
//              el código y el cuerpo de la respuesta mediante un callback en
//              el hilo principal. Diseño en doc/app_design.md.
// Autor:       Jordi Bataller i Mascarell (código original proporcionado)
// Aportación:  Equipo 04 – se sustituye AsyncTask (obsoleta desde Android 11)
//              por un hilo de fondo con Executor; la interfaz no cambia.
// Copyright:   (c) Jordi Bataller i Mascarell - EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// PeticionarioREST class: the 'postman'. Sends one HTTP request in the background
// and gives back the answer (code and body) through a callback on the main thread.
public class PeticionarioREST {

    private static final String ETIQUETA_LOG = "PeticionarioREST";
    // Conectar con el servidor: 5 s. Esperar la respuesta: 20 s, porque algunas
    // peticiones tardan más (por ejemplo, /solicitarRecuperacion envía un correo con Gmail).
    private static final int TIEMPO_CONEXION_MS = 5000;
    private static final int TIEMPO_RESPUESTA_MS = 20000;

    private static final ExecutorService HILO_DE_FONDO = Executors.newSingleThreadExecutor();
    private static final Handler HILO_PRINCIPAL = new Handler(Looper.getMainLooper());

    // --------------------------------------------------------------------
    // RespuestaREST = ( codigo: Z, cuerpo: Text ): respuesta del servidor que
    // se entrega con este callback (el callback se omite en la notación)
    // --------------------------------------------------------------------
    public interface RespuestaREST {
        // ------------------------------------------------------------
        // codigo: Z, cuerpo: Text --> callback() -->
        // What it does: receives the answer code and body when the request ends.
        // ------------------------------------------------------------
        void callback(int codigo, String cuerpo);
    }

    // --------------------------------------------------------------------
    // metodo: Text, urlDestino: Text, cuerpo: Text --> hacerPeticionREST() -->
    // RespuestaREST <--
    // What it does: sends the request in a background thread and calls the
    //               callback on the main thread with the code and the body.
    //               If there is no connection, the code is 0 and the body says why.
    // --------------------------------------------------------------------
    public void hacerPeticionREST(String metodo, String urlDestino, String cuerpo,
                                  RespuestaREST laRespuesta) {
        HILO_DE_FONDO.execute(() -> {
            int codigo = 0;
            String cuerpoRespuesta;
            try {
                HttpURLConnection conexion = (HttpURLConnection) new URL(urlDestino).openConnection();
                conexion.setConnectTimeout(TIEMPO_CONEXION_MS);
                conexion.setReadTimeout(TIEMPO_RESPUESTA_MS);
                conexion.setRequestMethod(metodo);
                conexion.setRequestProperty("Content-Type", "application/json; charset=utf-8");

                if (!metodo.equals("GET") && cuerpo != null) {
                    conexion.setDoOutput(true);
                    try (OutputStream salida = conexion.getOutputStream()) {
                        salida.write(cuerpo.getBytes(StandardCharsets.UTF_8));
                    }
                }

                codigo = conexion.getResponseCode();
                cuerpoRespuesta = leerCuerpo(conexion, codigo);
                conexion.disconnect();
            } catch (Exception error) {
                Log.d(ETIQUETA_LOG, "error en la petición: " + error.getMessage());
                cuerpoRespuesta = "(" + error.getClass().getSimpleName() + ": " + error.getMessage() + ")";
            }

            final int codigoFinal = codigo;
            final String cuerpoFinal = cuerpoRespuesta;
            HILO_PRINCIPAL.post(() -> laRespuesta.callback(codigoFinal, cuerpoFinal));
        });
    }

    // --------------------------------------------------------------------
    // conexion: HttpURLConnection, codigo: Z --> leerCuerpo() --x       (privado)
    // Text <--
    // What it does: reads the body of the answer (or of the error), or "" if there is none.
    // --------------------------------------------------------------------
    private static String leerCuerpo(HttpURLConnection conexion, int codigo) {
        try {
            InputStream entrada = codigo >= 400 ? conexion.getErrorStream() : conexion.getInputStream();
            if (entrada == null) {
                return "";
            }
            StringBuilder acumulador = new StringBuilder();
            try (BufferedReader lector = new BufferedReader(
                    new InputStreamReader(entrada, StandardCharsets.UTF_8))) {
                String linea;
                while ((linea = lector.readLine()) != null) {
                    acumulador.append(linea);
                }
            }
            return acumulador.toString();
        } catch (IOException sinCuerpo) {
            return "";
        }
    }
}
