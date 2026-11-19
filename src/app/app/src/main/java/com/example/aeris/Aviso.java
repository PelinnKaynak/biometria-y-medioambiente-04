// ---------------------------------------------------------------------------
// Fichero:     Aviso.java
// Descripción: Un aviso del panel de notificaciones de Inicio (Figma: «inicio ·
//              notificaciones abiertas»): contaminación alta, batería baja o
//              sensor desconectado. calcular() saca de las mediciones los
//              avisos locales (sensor desconectado); los de contaminación
//              vienen del servidor (GET /avisos, T008) con su zona y sus
//              coordenadas: desdeJSON() los lee. Cada aviso tiene una clave
//              para saber si ya se ha leído (AvisosLeidos).
//              Diseño en doc/app_design.md. T006 y T008.
// Autores:     Equipo 04 – SenseTech
// Fecha:       12/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

// Aviso class: one notification of the Inicio screen.
public class Aviso {

    // Tipos de aviso
    public enum Tipo { CONTAMINACION, BATERIA, DESCONECTADO }

    // A partir de aquí el ozono «ha superado el límite» (umbral de información, µg/m³)
    static final double UMBRAL_INFORMACION = 180;

    public final Tipo tipo;
    public final String titulo;
    public final String texto;
    public final long momento;      // milisegundos desde 1970 (UTC)
    public final String clave;      // identifica el aviso para marcarlo como leído
    public final String zona;       // nombre de la zona (null si no se sabe)
    public final Double latitud;    // null si el aviso no tiene coordenadas
    public final Double longitud;

    // -----------------------------------------------------------------------
    // tipo: Tipo, titulo: Text, texto: Text, momento: Z --> constructor()
    // What it does: the key is «TIPO:momento» (the same notification of the
    //               same measurement always has the same key).
    // -----------------------------------------------------------------------
    public Aviso(Tipo tipo, String titulo, String texto, long momento) {
        this(tipo, titulo, texto, momento, tipo.name() + ":" + momento);
    }

    // -----------------------------------------------------------------------
    // tipo: Tipo, titulo: Text, texto: Text, momento: Z, clave: Text --> constructor()
    // -----------------------------------------------------------------------
    public Aviso(Tipo tipo, String titulo, String texto, long momento, String clave) {
        this(tipo, titulo, texto, momento, clave, null, null, null);
    }

    // -----------------------------------------------------------------------
    // tipo: Tipo, titulo: Text, texto: Text, momento: Z, clave: Text,
    // zona: Text | null, latitud: R | null, longitud: R | null --> constructor()
    // What it does: an aviso with a zone. If the coordinates are not both
    //               valid, the aviso keeps no coordinates (tieneZona() false).
    // -----------------------------------------------------------------------
    public Aviso(Tipo tipo, String titulo, String texto, long momento, String clave,
                 String zona, Double latitud, Double longitud) {
        this.tipo = tipo;
        this.titulo = titulo;
        this.texto = texto;
        this.momento = momento;
        this.clave = clave;
        boolean validas = coordenadasValidas(latitud, longitud);
        this.zona = zona;
        this.latitud = validas ? latitud : null;
        this.longitud = validas ? longitud : null;
    }

    // -----------------------------------------------------------------------
    // tieneZona() --x
    // B <--
    // What it does: true if the aviso has coordinates, so the map can be
    //               opened on it.
    // -----------------------------------------------------------------------
    public boolean tieneZona() {
        return latitud != null && longitud != null;
    }

    private static boolean coordenadasValidas(Double latitud, Double longitud) {
        return latitud != null && longitud != null
                && !latitud.isNaN() && !longitud.isNaN()
                && latitud >= -90 && latitud <= 90
                && longitud >= -180 && longitud <= 180;
    }

    // -----------------------------------------------------------------------
    // avisos: [Aviso], leidos: {Text} --> cuantosSinLeer() --x
    // N <--
    // What it does: how many notifications have a key that is not in the
    //               set of the read ones (the number on the bell).
    // -----------------------------------------------------------------------
    public static int cuantosSinLeer(List<Aviso> avisos, Set<String> leidos) {
        int cuantos = 0;
        for (Aviso aviso : avisos) {
            if (!leidos.contains(aviso.clave)) {
                cuantos++;
            }
        }
        return cuantos;
    }

    // -----------------------------------------------------------------------
    // mediciones: [Medicion], tieneSensor: B, ahora: Z --> calcular() --x
    // [Aviso] <--
    // What it does: the notifications that come from the measurements (the
    //               newest first in the list): «Contaminación alta» if the
    //               last value is over 180 µg/m³, and, with a sensor,
    //               «Sensor desconectado» if the last one is older than
    //               1 hour. The battery comes with T017. Since T008 Inicio
    //               only uses the «Sensor desconectado» one: the pollution
    //               ones come from the server, with their zone.
    // -----------------------------------------------------------------------
    public static List<Aviso> calcular(List<Medicion> mediciones, boolean tieneSensor, long ahora) {
        List<Aviso> avisos = new ArrayList<>();
        if (mediciones == null || mediciones.isEmpty()) {
            return avisos;
        }
        Medicion ultima = mediciones.get(0);
        if (ultima.valor > UMBRAL_INFORMACION) {
            avisos.add(new Aviso(Tipo.CONTAMINACION, "Contaminación alta",
                    "El ozono ha superado el límite en tu zona.", ultima.momento));
        }
        if (tieneSensor && TiempoTranscurrido.esAntigua(ultima.momento, ahora)) {
            avisos.add(new Aviso(Tipo.DESCONECTADO, "Sensor desconectado",
                    "No recibimos datos desde " + TiempoTranscurrido.haceCuanto(ultima.momento, ahora) + ".",
                    ultima.momento));
        }
        return avisos;
    }

    // -----------------------------------------------------------------------
    // cuerpo: Text --> listaDesdeJSON() --x
    // [Aviso] | null <--
    // What it does: reads the answer of GET /avisos, [{"idAviso", "tipo",
    //               "contaminante", "valor", "unidad", "zona", "latitud",
    //               "longitud", "fechaCreacion"}, ...]. Skips the rows
    //               without the essential data (see desdeJSON()). Returns
    //               null if the text is not a JSON array.
    // -----------------------------------------------------------------------
    static List<Aviso> listaDesdeJSON(String cuerpo) {
        if (cuerpo == null || cuerpo.isEmpty()) {
            return null;
        }
        try {
            JSONArray array = new JSONArray(cuerpo);
            List<Aviso> lista = new ArrayList<>();
            for (int i = 0; i < array.length(); i++) {
                JSONObject json = array.optJSONObject(i);
                Aviso aviso = json == null ? null : desdeJSON(json);
                if (aviso != null) {
                    lista.add(aviso);
                }
            }
            return lista;
        } catch (JSONException error) {
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // json: JSONObject --> desdeJSON() --x
    // Aviso | null <--
    // What it does: one row of GET /avisos as a CONTAMINACION aviso. The
    //               essential data are idAviso (whole number > 0), valor
    //               (number >= 0) and fechaCreacion (ISO text or ms); without
    //               them it returns null. The coordinates and the zone are
    //               optional: without valid coordinates the aviso is shown but
    //               cannot open the map. The key is «AVISO:idAviso».
    //               The title comes from the level of the value and the text
    //               from the value and the zone (personal: «cerca de tu
    //               sensor»; the server gives its coordinates as zone).
    // -----------------------------------------------------------------------
    static Aviso desdeJSON(JSONObject json) {
        long id = idDe(json);
        double valor = numero(json, "valor");
        Long momento = momentoDe(json.opt("fechaCreacion"));
        if (id <= 0 || Double.isNaN(valor) || valor < 0 || momento == null) {
            return null;
        }
        boolean personal = "personal".equals(texto(json, "tipo"));
        String zona = personal ? "Cerca de tu sensor" : texto(json, "zona");
        String unidad = texto(json, "unidad");
        String contaminante = texto(json, "contaminante");
        String sustancia = contaminante == null || "O3".equals(contaminante) ? "ozono" : contaminante;
        String lugar = zona == null ? "" : (personal ? " cerca de tu sensor" : " en " + zona);
        String cuerpo = Math.round(valor) + " " + (unidad == null ? "µg/m³" : unidad)
                + " de " + sustancia + lugar + ".";
        double latitud = numero(json, "latitud");
        double longitud = numero(json, "longitud");
        return new Aviso(Tipo.CONTAMINACION, tituloDe(valor), cuerpo, momento, "AVISO:" + id, zona,
                Double.isNaN(latitud) ? null : latitud, Double.isNaN(longitud) ? null : longitud);
    }

    // el título según el nivel del valor: «Contaminación alta»…
    private static String tituloDe(double valor) {
        switch (NivelOzono.desdeValor(valor)) {
            case BUENO:
                return "Contaminación baja";
            case MODERADO:
                return "Contaminación moderada";
            case MALO:
                return "Contaminación alta";
            default:
                return "Contaminación muy alta";
        }
    }

    // -----------------------------------------------------------------------
    // json: JSONObject --> idDe() --x
    // Z <--
    // What it does: the idAviso of a row, or 0 if it is not a positive whole
    //               number (used also to move the page cursor).
    // -----------------------------------------------------------------------
    static long idDe(JSONObject json) {
        double id = numero(json, "idAviso");
        return Double.isNaN(id) || id != Math.rint(id) || id <= 0 ? 0 : (long) id;
    }

    private static double numero(JSONObject json, String campo) {
        Object valor = json.opt(campo);
        return valor instanceof Number ? ((Number) valor).doubleValue() : Double.NaN;
    }

    private static String texto(JSONObject json, String campo) {
        Object valor = json.opt(campo);
        if (valor instanceof String && !((String) valor).trim().isEmpty()) {
            return ((String) valor).trim();
        }
        return null;
    }

    private static Long momentoDe(Object fecha) {
        if (fecha instanceof Number) {
            return ((Number) fecha).longValue();
        }
        if (fecha instanceof String) {
            try {
                return Instant.parse((String) fecha).toEpochMilli();
            } catch (DateTimeParseException error) {
                return null;
            }
        }
        return null;
    }
}
