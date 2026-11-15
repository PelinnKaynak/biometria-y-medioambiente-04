// ---------------------------------------------------------------------------
// Fichero:     ResumenMisDatos.java
// Descripción: Modelo de datos para la pantalla «Mis datos» (T007).
//              Agrupa la distancia recorrida en el día, la concentración
//              media de ozono, el nivel de calidad del aire y la lista
//              de mediciones tomadas hoy por el sensor del usuario.
// Autores:     Equipo 04 – SenseTech
// Fecha:       15/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

// ResumenMisDatos class: daily stats summary (distance, avg quality, inhaled ozone, measurements).
public class ResumenMisDatos {

    public final double distanciaKm;
    public final double ozonoMedio;
    public final String ozonoRespiradoTexto;
    public final List<Medicion> medicionesHoy;
    public final boolean tieneSensor;

    // -----------------------------------------------------------------------
    // distanciaKm: R, ozonoMedio: R, ozonoRespiradoTexto: Text,
    // medicionesHoy: [Medicion], tieneSensor: B --> constructor()
    // -----------------------------------------------------------------------
    public ResumenMisDatos(double distanciaKm, double ozonoMedio, String ozonoRespiradoTexto,
                           List<Medicion> medicionesHoy, boolean tieneSensor) {
        this.distanciaKm = Math.max(0, distanciaKm);
        this.ozonoMedio = Math.max(0, ozonoMedio);
        this.ozonoRespiradoTexto = ozonoRespiradoTexto != null ? ozonoRespiradoTexto : "";
        this.medicionesHoy = medicionesHoy != null ? Collections.unmodifiableList(new ArrayList<>(medicionesHoy)) : Collections.emptyList();
        this.tieneSensor = tieneSensor;
    }

    // -----------------------------------------------------------------------
    // textoDistancia() --x
    // Text <--
    // What it does: formats the walked/traveled distance (e.g. "4,2 km" or "0 km").
    // -----------------------------------------------------------------------
    public String textoDistancia() {
        if (distanciaKm <= 0.001) {
            return "0 km";
        }
        return String.format(Locale.forLanguageTag("es-ES"), "%.1f km", distanciaKm);
    }

    // -----------------------------------------------------------------------
    // nivelCalidadMedia() --x
    // NivelOzono <--
    // What it does: evaluates the average ozone level with AERIS scale.
    // -----------------------------------------------------------------------
    public NivelOzono nivelCalidadMedia() {
        return NivelOzono.desdeValor(ozonoMedio);
    }

    // -----------------------------------------------------------------------
    // textoCalidadMedia() --x
    // Text <--
    // What it does: returns "Buena", "Moderada", "Mala" or "Muy mala".
    // -----------------------------------------------------------------------
    public String textoCalidadMedia() {
        switch (nivelCalidadMedia()) {
            case BUENO:
                return "Buena";
            case MODERADO:
                return "Moderada";
            case MALO:
                return "Mala";
            case MUY_MALO:
            default:
                return "Muy mala";
        }
    }

    // -----------------------------------------------------------------------
    // textoOzonoRespirado() --x
    // Text <--
    // What it does: returns formatted inhaled ozone text (e.g. "74 µg/m³").
    // -----------------------------------------------------------------------
    public String textoOzonoRespirado() {
        if (!ozonoRespiradoTexto.isEmpty()) {
            return ozonoRespiradoTexto;
        }
        return Math.round(ozonoMedio) + " µg/m³";
    }

    // -----------------------------------------------------------------------
    // tieneMediciones() --x
    // B <--
    // What it does: true if there is at least one measurement for today.
    // -----------------------------------------------------------------------
    public boolean tieneMediciones() {
        return !medicionesHoy.isEmpty();
    }

    // -----------------------------------------------------------------------
    // mediciones: [Medicion], distanciaKm: R, tieneSensor: B
    // --> calcularDesdeMediciones() --x
    // ResumenMisDatos <--
    // What it does: computes the average ozone concentration from the list
    //               and builds a ResumenMisDatos instance.
    // -----------------------------------------------------------------------
    public static ResumenMisDatos calcularDesdeMediciones(List<Medicion> mediciones,
                                                          double distanciaKm,
                                                          boolean tieneSensor) {
        if (mediciones == null || mediciones.isEmpty()) {
            return new ResumenMisDatos(distanciaKm, 0.0, "0 µg/m³", Collections.emptyList(), tieneSensor);
        }

        double suma = 0.0;
        for (Medicion m : mediciones) {
            suma += m.valor;
        }
        double media = suma / mediciones.size();
        String ozonoTexto = Math.round(media) + " µg/m³";

        return new ResumenMisDatos(distanciaKm, media, ozonoTexto, mediciones, tieneSensor);
    }

    // -----------------------------------------------------------------------
    // cuerpo: Text, tieneSensor: B --> desdeJSON() --x
    // ResumenMisDatos | null <--
    // What it does: parses {"distanciaKm": ..., "ozonoMedio": ..., "ozonoRespirado": ...,
    //               "mediciones": [...]} or a JSON array of measurements.
    // -----------------------------------------------------------------------
    public static ResumenMisDatos desdeJSON(String cuerpo, boolean tieneSensor) {
        if (cuerpo == null || cuerpo.trim().isEmpty()) {
            return null;
        }
        try {
            if (cuerpo.trim().startsWith("[")) {
                List<Medicion> lista = Medicion.listaDesdeJSON(cuerpo);
                return calcularDesdeMediciones(lista, 0.0, tieneSensor);
            }

            JSONObject json = new JSONObject(cuerpo);
            double distancia = json.optDouble("distanciaKm", 0.0);
            double ozonoMedio = json.optDouble("ozonoMedio", 0.0);
            String ozonoTexto = json.optString("ozonoRespirado", "");

            List<Medicion> mediciones = new ArrayList<>();
            JSONArray arr = json.optJSONArray("mediciones");
            if (arr != null) {
                List<Medicion> parseadas = Medicion.listaDesdeJSON(arr.toString());
                if (parseadas != null) {
                    mediciones.addAll(parseadas);
                }
            }

            if (ozonoMedio == 0.0 && !mediciones.isEmpty()) {
                return calcularDesdeMediciones(mediciones, distancia, tieneSensor);
            }

            return new ResumenMisDatos(distancia, ozonoMedio, ozonoTexto, mediciones, tieneSensor);
        } catch (JSONException error) {
            return null;
        }
    }
}
