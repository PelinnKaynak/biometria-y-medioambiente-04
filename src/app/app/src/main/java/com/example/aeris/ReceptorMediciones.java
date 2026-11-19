// ---------------------------------------------------------------------------
// Fichero:     ReceptorMediciones.java
// Descripción: Decide qué tramas del sensor se guardan y prepara lo que se
//              envía a POST /guardarMedicion (T017). El sensor repite la
//              misma medición muchas veces durante 6 s y hace una nueva cada
//              ~9 s: se guarda como mucho una de ozono por minuto
//              (INTERVALO_MINIMO). También dice qué hacer con la respuesta
//              del servidor. No usa Android, así que se puede probar con
//              JUnit. Diseño en doc/app_design.md. T023.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.time.Instant;
import java.util.Locale;

// ReceptorMediciones class: filters the sensor packets and builds the request body.
public class ReceptorMediciones {

    static final long INTERVALO_MINIMO = 60_000L;     // ms entre dos mediciones guardadas
    static final int VALOR_MAXIMO = 2000;             // el servidor no acepta más (µg/m³)

    // Qué hacer con una medición después de enviarla
    public enum Resultado {
        ENVIADA,        // 200 / 201: guardada (o ya estaba)
        DESCARTAR,      // 400, 403, 404...: el servidor nunca la aceptará
        REINTENTAR,     // sin conexión o fallo del servidor: más tarde
        SIN_SESION      // 401: hay que volver a iniciar sesión
    }

    private int ultimoContador = -1;
    private long ultimoMomento = 0;
    private boolean hayUltima = false;

    // -----------------------------------------------------------------------
    // trama: TramaAERIS, ahora: Z --> esNueva() --x
    // B <--
    // What it does: true for an ozone packet with a new counter that comes at
    //               least INTERVALO_MINIMO after the last one kept (then it
    //               becomes the last one kept). Temperature packets: false.
    // -----------------------------------------------------------------------
    public boolean esNueva(TramaAERIS trama, long ahora) {
        if (!trama.esOzono()) {
            return false;
        }
        if (hayUltima && (trama.contador == ultimoContador || ahora - ultimoMomento < INTERVALO_MINIMO)) {
            return false;
        }
        hayUltima = true;
        ultimoContador = trama.contador;
        ultimoMomento = ahora;
        return true;
    }

    // -----------------------------------------------------------------------
    // valor: Z --> valorParaServidor() --x
    // N <--
    // What it does: keeps the value between 0 and VALOR_MAXIMO. The sensor
    //               can give a little below 0 when there is almost no ozone.
    // -----------------------------------------------------------------------
    static int valorParaServidor(int valor) {
        return Math.max(0, Math.min(VALOR_MAXIMO, valor));
    }

    // -----------------------------------------------------------------------
    // numeroSerie: Text, valor: Z, latitud: R, longitud: R, momento: Z
    //     --> cuerpo() --x
    // Text <--
    // What it does: the JSON of POST /guardarMedicion: {"numeroSerie",
    //               "contaminante": "O3", "valor", "latitud", "longitud",
    //               "fecha" (ISO, without milliseconds)}.
    // -----------------------------------------------------------------------
    static String cuerpo(String numeroSerie, int valor, double latitud, double longitud, long momento) {
        String fecha = Instant.ofEpochMilli(momento - Math.floorMod(momento, 1000L)).toString();
        return String.format(Locale.ROOT,
                "{\"numeroSerie\":\"%s\",\"contaminante\":\"O3\",\"valor\":%d,"
                        + "\"latitud\":%.6f,\"longitud\":%.6f,\"fecha\":\"%s\"}",
                numeroSerie, valorParaServidor(valor), latitud, longitud, fecha);
    }

    // -----------------------------------------------------------------------
    // codigo: Z --> queHacer() --x
    // Resultado <--
    // What it does: 200/201 ENVIADA; 401 SIN_SESION; 0 (no connection),
    //               408, 429 and 5xx REINTENTAR; any other code DESCARTAR.
    // -----------------------------------------------------------------------
    static Resultado queHacer(int codigo) {
        if (codigo == 200 || codigo == 201) {
            return Resultado.ENVIADA;
        }
        if (codigo == 401) {
            return Resultado.SIN_SESION;
        }
        if (codigo == 0 || codigo == 408 || codigo == 429 || codigo >= 500) {
            return Resultado.REINTENTAR;
        }
        return Resultado.DESCARTAR;
    }
}
