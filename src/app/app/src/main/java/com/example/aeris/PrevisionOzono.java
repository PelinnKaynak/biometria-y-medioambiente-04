// ---------------------------------------------------------------------------
// Fichero:     PrevisionOzono.java
// Descripción: Previsión de ozono de las próximas 48 horas que devuelve el
//              servidor (GET /api/prevision/ozono). Lee el JSON, clasifica cada
//              hora con NivelOzono (los niveles de la app, no los de la API) y
//              calcula el mejor momento para salir. Diseño en doc/app_design.md.
//              Tarea T032.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

// PrevisionOzono class: the 48-hour forecast of one zone.
public class PrevisionOzono {

    // Una previsión recibida hace más de 30 minutos no se reutiliza: hay que pedirla de nuevo
    static final long VIGENCIA_MS = 30 * 60 * 1000L;

    // Franja recomendada: de 07:00 a 22:00 (la última hora empieza antes de las 22:00)
    static final int HORA_INICIO_DIA = 7;
    static final int HORA_FIN_DIA = 22;
    static final int HORAS_FRANJA = 2;

    // --------------------------------------------------------------------
    // Hora = ( fecha: LocalDateTime, ozono: R )        // µg/m³
    // --------------------------------------------------------------------
    public static final class Hora {
        public final LocalDateTime fecha;
        public final double ozono;

        Hora(LocalDateTime fecha, double ozono) {
            this.fecha = fecha;
            this.ozono = ozono;
        }

        // -------------------------------------------------------------------
        // --> nivel() --x
        // NivelOzono <--
        // What it does: the level of this hour with the levels of the app.
        // -------------------------------------------------------------------
        public NivelOzono nivel() {
            return NivelOzono.desdeValor(ozono);
        }
    }

    // --------------------------------------------------------------------
    // Franja = ( inicio: LocalDateTime, fin: LocalDateTime, media: R, indice: N )
    // --------------------------------------------------------------------
    public static final class Franja {
        public final LocalDateTime inicio;
        public final LocalDateTime fin;
        public final double media;
        public final int indice;        // posición de la primera hora en la lista
        public final int horas;

        Franja(LocalDateTime inicio, LocalDateTime fin, double media, int indice, int horas) {
            this.inicio = inicio;
            this.fin = fin;
            this.media = media;
            this.indice = indice;
            this.horas = horas;
        }
    }

    public final String zona;
    public final boolean simulados;
    public final String advertencia;
    public final String modelo;
    public final String ultimaObservacion;
    public final List<Hora> horas;
    public final Hora pico;
    public final String json;           // respuesta original del servidor
    public final long recibidaMs;       // cuándo la recibió el teléfono (System.currentTimeMillis)

    PrevisionOzono(String zona, boolean simulados, String advertencia, String modelo,
                   String ultimaObservacion, List<Hora> horas, String json, long recibidaMs) {
        this.json = json;
        this.recibidaMs = recibidaMs;
        this.zona = zona;
        this.simulados = simulados;
        this.advertencia = advertencia;
        this.modelo = modelo;
        this.ultimaObservacion = ultimaObservacion;
        this.horas = Collections.unmodifiableList(horas);
        this.pico = calcularPico(horas);
    }

    // -----------------------------------------------------------------------
    // cuerpo: Text --> desdeJSON() --x
    // PrevisionOzono | null <--
    // What it does: reads the JSON of the server. null if it is not JSON or it
    //               has no valid hourly values. Hours with a wrong date or a
    //               value that is not a number are skipped. The fields "nivel",
    //               "nivel_pico" and "criterios_nivel" are ignored on purpose:
    //               the level is always NivelOzono.desdeValor().
    // -----------------------------------------------------------------------
    public static PrevisionOzono desdeJSON(String cuerpo) {
        return desdeJSON(cuerpo, System.currentTimeMillis());
    }

    // -----------------------------------------------------------------------
    // cuerpo: Text, recibidaMs: Z --> desdeJSON() --x
    // PrevisionOzono | null <--
    // What it does: the same, saying when the answer was received (the
    //               validity of 30 minutes counts from there).
    // -----------------------------------------------------------------------
    public static PrevisionOzono desdeJSON(String cuerpo, long recibidaMs) {
        if (cuerpo == null) {
            return null;
        }
        try {
            JSONObject json = new JSONObject(cuerpo);
            JSONArray lista = json.optJSONArray("predicciones");
            if (lista == null) {
                return null;
            }
            List<Hora> horas = new ArrayList<>();
            for (int i = 0; i < lista.length(); i++) {
                JSONObject item = lista.optJSONObject(i);
                if (item == null || !item.has("ozono_predicho")) {
                    continue;
                }
                double valor = item.isNull("ozono_predicho") ? Double.NaN : item.optDouble("ozono_predicho", Double.NaN);
                LocalDateTime fecha = leerFecha(texto(item, "fecha_hora"));
                if (fecha == null || Double.isNaN(valor) || Double.isInfinite(valor)) {
                    continue;
                }
                horas.add(new Hora(fecha, valor));
            }
            if (horas.isEmpty()) {
                return null;
            }
            return new PrevisionOzono(
                    texto(json, "zona"),
                    !json.isNull("simulados") && json.optBoolean("simulados", false),
                    texto(json, "advertencia"),
                    texto(json, "modelo"),
                    texto(json, "ultima_observacion_utilizada"),
                    horas, cuerpo, recibidaMs);
        } catch (JSONException noEsJSON) {
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // ahoraMs: Z --> estaCaducada() --x
    // B <--
    // What it does: true if it was received more than 30 minutes ago (or in
    //               the future: the clock of the phone was changed), so it
    //               must not be reused.
    // -----------------------------------------------------------------------
    public boolean estaCaducada(long ahoraMs) {
        long edad = ahoraMs - recibidaMs;
        return edad < 0 || edad > VIGENCIA_MS;
    }

    // -----------------------------------------------------------------------
    // json: JSONObject, clave: Text --> texto() --x                     (privado)
    // Text <--
    // What it does: the text of a field, or "" if it is missing, is JSON null
    //               or says "null". The org.json of Android returns the text
    //               "null" for a JSON null with optString(), and it would end up
    //               on the screen.
    // -----------------------------------------------------------------------
    static String texto(JSONObject json, String clave) {
        if (json.isNull(clave)) {
            return "";
        }
        String valor = json.optString(clave, "");
        return valor == null || valor.trim().equalsIgnoreCase("null") ? "" : valor;
    }

    // -----------------------------------------------------------------------
    // texto: Text --> leerFecha() --x                                   (privado)
    // LocalDateTime | null <--
    // What it does: reads "2026-11-19T15:00:00" (local time, no time zone).
    // -----------------------------------------------------------------------
    static LocalDateTime leerFecha(String texto) {
        try {
            return LocalDateTime.parse(texto);
        } catch (RuntimeException formatoIncorrecto) {
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // fecha: LocalDateTime --> diasDesdeHoy() --x
    // N <--
    // What it does: 0 = hoy, 1 = mañana, 2 = pasado mañana. «Hoy» es el día de
    //               la última observación utilizada (la hora del servidor, que
    //               es la de las fechas de la previsión); si no viene, el de
    //               la primera hora.
    // -----------------------------------------------------------------------
    public int diasDesdeHoy(LocalDateTime fecha) {
        LocalDateTime observacion = leerFecha(ultimaObservacion);
        LocalDate hoy = (observacion != null ? observacion : horas.get(0).fecha).toLocalDate();
        return (int) ChronoUnit.DAYS.between(hoy, fecha.toLocalDate());
    }

    private static Hora calcularPico(List<Hora> horas) {
        Hora mayor = horas.get(0);
        for (Hora hora : horas) {
            if (hora.ozono > mayor.ozono) {
                mayor = hora;
            }
        }
        return mayor;
    }

    // -----------------------------------------------------------------------
    // --> mejorMomento() --x
    // Franja <--
    // What it does: the best moment to go out (orientative): the 2 consecutive
    //               hours with the lowest mean between 07:00 and 22:00. If there
    //               is no such window, the single hour of the day with the lowest
    //               value, and if there is none, the lowest hour of all.
    // -----------------------------------------------------------------------
    public Franja mejorMomento() {
        Franja mejor = null;
        for (int i = 0; i + HORAS_FRANJA <= horas.size(); i++) {
            if (!esFranjaDeDia(i)) {
                continue;
            }
            double suma = 0;
            for (int k = 0; k < HORAS_FRANJA; k++) {
                suma += horas.get(i + k).ozono;
            }
            double media = suma / HORAS_FRANJA;
            if (mejor == null || media < mejor.media) {
                mejor = new Franja(horas.get(i).fecha,
                        horas.get(i + HORAS_FRANJA - 1).fecha.plusHours(1), media, i, HORAS_FRANJA);
            }
        }
        if (mejor != null) {
            return mejor;
        }
        int elegida = -1;
        for (int i = 0; i < horas.size(); i++) {
            boolean deDia = esHoraDeDia(horas.get(i).fecha);
            if (deDia && (elegida < 0 || horas.get(i).ozono < horas.get(elegida).ozono)) {
                elegida = i;
            }
        }
        if (elegida < 0) {
            for (int i = 0; i < horas.size(); i++) {
                if (elegida < 0 || horas.get(i).ozono < horas.get(elegida).ozono) {
                    elegida = i;
                }
            }
        }
        Hora hora = horas.get(elegida);
        return new Franja(hora.fecha, hora.fecha.plusHours(1), hora.ozono, elegida, 1);
    }

    // true if the window that starts at i is made of consecutive hours of the day
    private boolean esFranjaDeDia(int i) {
        for (int k = 0; k < HORAS_FRANJA; k++) {
            Hora actual = horas.get(i + k);
            if (!esHoraDeDia(actual.fecha)) {
                return false;
            }
            if (k > 0 && !Duration.between(horas.get(i + k - 1).fecha, actual.fecha).equals(Duration.ofHours(1))) {
                return false;
            }
        }
        return true;
    }

    static boolean esHoraDeDia(LocalDateTime fecha) {
        return fecha.getHour() >= HORA_INICIO_DIA && fecha.getHour() < HORA_FIN_DIA;
    }
}
