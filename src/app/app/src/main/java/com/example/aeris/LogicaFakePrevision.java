// ---------------------------------------------------------------------------
// Fichero:     LogicaFakePrevision.java
// Descripción: Lógica fake del teléfono para la previsión de ozono de 48 horas.
//              Pide GET /api/prevision/ozono?zona=... al servidor REST
//              principal (no necesita sesión) y entrega el resultado o el motivo
//              del fallo. Una sola petición en vuelo por zona, compartida por
//              todas las pantallas que la pidan (así girar el móvil o abrir la
//              pantalla mientras Inicio aún carga no repite la petición), y
//              recuerda la última previsión recibida mientras tenga menos de 30
//              minutos. Diseño en doc/app_design.md. Tarea T032.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.json.JSONObject;

// LogicaFakePrevision class: the phone's fake logic for the ozone forecast.
public class LogicaFakePrevision {

    static final int CODIGO_OK = 200;
    static final int CODIGO_ZONA_SIN_MODELO = 400;
    static final int CODIGO_SERVICIO_NO_DISPONIBLE = 503;
    static final int CODIGO_TIEMPO_AGOTADO = 504;
    static final int CODIGO_SIN_CONEXION = 0;

    // Única zona con modelo entrenado
    static final String ZONA = "Gandia";

    // «motivo» que acompaña al 503 del servidor
    static final String MOTIVO_OCUPADO = "ocupado";
    static final String MOTIVO_DESACTIVADA = "desactivada";

    static final String MENSAJE_SIN_CONEXION = "No hay conexión con el servidor. Inténtalo de nuevo.";
    static final String MENSAJE_SERVICIO_NO_DISPONIBLE = "El servicio de previsión no está disponible ahora mismo.";
    static final String MENSAJE_SERVICIO_OCUPADO = "El servicio de previsión está ocupado. Inténtalo en unos segundos.";
    static final String MENSAJE_DESACTIVADA = "La previsión no está activada en el servidor.";
    static final String MENSAJE_TIEMPO_AGOTADO = "La previsión ha tardado demasiado. Inténtalo de nuevo.";

    // -----------------------------------------------------------------------
    // Callback de obtenerPrevision() (se omite en la notación)
    // -----------------------------------------------------------------------
    public interface RespuestaPrevision {
        // prevision: PrevisionOzono --> previsionObtenida() -->   (200)
        void previsionObtenida(PrevisionOzono prevision);
        // zonaDisponible: Text --> zonaSinModelo() -->            (400)
        void zonaSinModelo(String zonaDisponible);
        // sinDatos() -->                                          (200 sin predicciones válidas)
        void sinDatos();
        // mensaje: Text --> error() -->                           (sin conexión, 504, 404, 500…)
        void error(String mensaje);

        // servicioOcupado() -->                                   (503 «ocupado»: reintentar enseguida)
        default void servicioOcupado() {
            error(MENSAJE_SERVICIO_OCUPADO);
        }

        // servicioNoDisponible() -->                              (503: el servicio está caído o desactivado)
        default void servicioNoDisponible() {
            error(MENSAJE_SERVICIO_NO_DISPONIBLE);
        }
    }

    // -----------------------------------------------------------------------
    // Cómo se hace la petición GET (los tests lo sustituyen: PeticionarioREST
    // necesita Android). Se omite en la notación.
    // -----------------------------------------------------------------------
    interface Transporte {
        void get(String url, PeticionarioREST.RespuestaREST respuesta);
    }

    private static final Transporte TRANSPORTE_REAL =
            (url, respuesta) -> new PeticionarioREST().hacerPeticionREST("GET", url, null, respuesta);

    static Transporte transporte = TRANSPORTE_REAL;

    // Estado compartido por todas las pantallas (vive lo que viva el proceso de la app)
    private static final Object BLOQUEO = new Object();
    private static final Map<String, List<RespuestaPrevision>> EN_CURSO = new HashMap<>();
    private static PrevisionOzono ultima;

    // -----------------------------------------------------------------------
    // zona: Text --> obtenerPrevision() -->
    // What it does: sends GET /api/prevision/ozono?zona=<zona> (no token) and
    //               calls previsionObtenida(), zonaSinModelo(), sinDatos() or
    //               error() at the end. If a request for that zone is already
    //               on its way, it does not send another one: the callback joins
    //               the waiting ones and all of them get the same answer.
    // -----------------------------------------------------------------------
    public void obtenerPrevision(String zona, final RespuestaPrevision respuesta) {
        boolean hayQueLanzarla;
        synchronized (BLOQUEO) {
            List<RespuestaPrevision> esperando = EN_CURSO.get(zona);
            hayQueLanzarla = esperando == null;
            if (hayQueLanzarla) {
                esperando = new ArrayList<>();
                EN_CURSO.put(zona, esperando);
            }
            esperando.add(respuesta);
        }
        if (!hayQueLanzarla) {
            return;
        }
        try {
            transporte.get(crearURL(zona), (codigo, cuerpo) -> terminar(zona, codigo, cuerpo));
        } catch (RuntimeException error) {
            terminar(zona, CODIGO_SIN_CONEXION, "(" + error.getClass().getSimpleName() + ")");
        }
    }

    // -----------------------------------------------------------------------
    // zona: Text, codigo: Z, cuerpo: Text --> terminar() --x           (privado)
    // What it does: gives the answer to everybody waiting for that zone. If a
    //               callback fails, the others still get the answer and the
    //               first failure is thrown at the end.
    // -----------------------------------------------------------------------
    private static void terminar(String zona, int codigo, String cuerpo) {
        List<RespuestaPrevision> esperando;
        synchronized (BLOQUEO) {
            esperando = EN_CURSO.remove(zona);
        }
        if (esperando == null) {
            return;
        }
        RuntimeException primerFallo = null;
        for (RespuestaPrevision respuesta : esperando) {
            try {
                notificarPrevision(codigo, cuerpo, respuesta);
            } catch (RuntimeException fallo) {
                if (primerFallo == null) {
                    primerFallo = fallo;
                }
            }
        }
        if (primerFallo != null) {
            throw primerFallo;
        }
    }

    // -----------------------------------------------------------------------
    // ahoraMs: Z --> vigente() --x
    // PrevisionOzono | null <--
    // What it does: the last forecast received, if it has less than 30
    //               minutes (PrevisionOzono.estaCaducada()); null if there is
    //               none or it is too old. The screens use it before asking
    //               the server, so turning the phone does not ask again.
    // -----------------------------------------------------------------------
    static PrevisionOzono vigente(long ahoraMs) {
        synchronized (BLOQUEO) {
            return ultima != null && !ultima.estaCaducada(ahoraMs) ? ultima : null;
        }
    }

    public static PrevisionOzono vigente() {
        return vigente(System.currentTimeMillis());
    }

    // -----------------------------------------------------------------------
    // --> reiniciarEstado() --x
    // What it does: forgets the request on its way, the last forecast and the
    //               fake transport. Only for the tests.
    // -----------------------------------------------------------------------
    static void reiniciarEstado() {
        synchronized (BLOQUEO) {
            EN_CURSO.clear();
            ultima = null;
        }
        transporte = TRANSPORTE_REAL;
    }

    // -----------------------------------------------------------------------
    // zona: Text --> crearURL() --x
    // Text <--
    // What it does: builds the URL of the request with the zone encoded.
    // -----------------------------------------------------------------------
    static String crearURL(String zona) {
        String codificada;
        try {
            codificada = URLEncoder.encode(zona, "UTF-8");
        } catch (UnsupportedEncodingException imposible) {
            codificada = zona;
        }
        return LogicaFakeRegistro.URL_SERVIDOR + "/api/prevision/ozono?zona=" + codificada;
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text --> notificarPrevision() --x
    // What it does: 200 with values -> previsionObtenida() (and it is
    //               remembered); 200 without values or not JSON -> sinDatos();
    //               400 -> zonaSinModelo(); 503 -> servicioOcupado() if the
    //               server says «ocupado», error() if it is deactivated, and
    //               servicioNoDisponible() otherwise; 504 and 0 -> error() with
    //               its own message.
    // -----------------------------------------------------------------------
    static void notificarPrevision(int codigo, String cuerpo, RespuestaPrevision respuesta) {
        if (codigo == CODIGO_OK) {
            PrevisionOzono prevision = PrevisionOzono.desdeJSON(cuerpo);
            if (prevision != null) {
                synchronized (BLOQUEO) {
                    ultima = prevision;
                }
                respuesta.previsionObtenida(prevision);
            } else {
                respuesta.sinDatos();
            }
        } else if (codigo == CODIGO_ZONA_SIN_MODELO) {
            respuesta.zonaSinModelo(zonaDisponible(cuerpo));
        } else if (codigo == CODIGO_SERVICIO_NO_DISPONIBLE) {
            notificarServicio503(cuerpo, respuesta);
        } else if (codigo == CODIGO_TIEMPO_AGOTADO) {
            respuesta.error(MENSAJE_TIEMPO_AGOTADO);
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se ha podido cargar la previsión (error " + codigo + ").");
        }
    }

    // El 503 puede ser «ocupado» (reintentar enseguida), «desactivada» o «caído».
    // Los servidores anteriores a T032 no mandan «motivo»: solo decían «ocupado» en el texto.
    private static void notificarServicio503(String cuerpo, RespuestaPrevision respuesta) {
        JSONObject json = leerJSON(cuerpo);
        String motivo = json == null ? "" : PrevisionOzono.texto(json, "motivo");
        String texto = json == null ? "" : PrevisionOzono.texto(json, "error");
        boolean ocupado = MOTIVO_OCUPADO.equals(motivo)
                || (motivo.isEmpty() && texto.toLowerCase(Locale.ROOT).contains(MOTIVO_OCUPADO));
        if (ocupado) {
            respuesta.servicioOcupado();
        } else if (MOTIVO_DESACTIVADA.equals(motivo)) {
            respuesta.error(MENSAJE_DESACTIVADA);
        } else {
            respuesta.servicioNoDisponible();
        }
    }

    // zona_disponible del cuerpo del 400, o la única zona conocida si no viene
    private static String zonaDisponible(String cuerpo) {
        JSONObject json = leerJSON(cuerpo);
        String zona = json == null ? "" : PrevisionOzono.texto(json, "zona_disponible");
        return zona.isEmpty() ? ZONA : zona;
    }

    private static JSONObject leerJSON(String cuerpo) {
        try {
            return new JSONObject(cuerpo);
        } catch (Exception noEsJSON) {
            return null;
        }
    }
}
