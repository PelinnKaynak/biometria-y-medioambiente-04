// ---------------------------------------------------------------------------
// Fichero:     ResumenMisDatos.java
// Descripción: Calcula distancia y concentración media del día para T007.
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class ResumenMisDatos {

    private static final double RADIO_TIERRA_KM = 6371.0088;

    public final List<MedicionDiaria> mediciones;
    public final double distanciaKm;
    public final Double calidadMedia;
    public final NivelOzono nivelMedio;

    private ResumenMisDatos(List<MedicionDiaria> mediciones, double distanciaKm, Double calidadMedia) {
        this.mediciones = Collections.unmodifiableList(mediciones);
        this.distanciaKm = distanciaKm;
        this.calidadMedia = calidadMedia;
        this.nivelMedio = calidadMedia == null ? null : NivelOzono.desdeValor(calidadMedia);
    }

    // Sums the path between consecutive locations and averages the ozone values.
    public static ResumenMisDatos calcular(List<MedicionDiaria> mediciones) {
        if (mediciones == null) {
            throw new IllegalArgumentException("La lista de mediciones no puede ser null");
        }
        List<MedicionDiaria> ordenadas = new ArrayList<>(mediciones);
        Collections.sort(ordenadas, (a, b) -> Long.compare(a.momento, b.momento));
        if (ordenadas.isEmpty()) {
            return new ResumenMisDatos(ordenadas, 0, null);
        }

        double distanciaKm = 0;
        double sumaOzono = 0;
        for (int i = 0; i < ordenadas.size(); i++) {
            MedicionDiaria actual = ordenadas.get(i);
            sumaOzono += actual.valor;
            if (i > 0) {
                distanciaKm += distanciaEntre(ordenadas.get(i - 1), actual);
            }
        }
        return new ResumenMisDatos(ordenadas, distanciaKm, sumaOzono / ordenadas.size());
    }

    // Great-circle distance between two consecutive sensor locations.
    private static double distanciaEntre(MedicionDiaria a, MedicionDiaria b) {
        double latitud1 = Math.toRadians(a.latitud);
        double latitud2 = Math.toRadians(b.latitud);
        double deltaLatitud = latitud2 - latitud1;
        double deltaLongitud = Math.toRadians(b.longitud - a.longitud);
        double senoLatitud = Math.sin(deltaLatitud / 2);
        double senoLongitud = Math.sin(deltaLongitud / 2);
        double haversine = senoLatitud * senoLatitud
                + Math.cos(latitud1) * Math.cos(latitud2) * senoLongitud * senoLongitud;
        return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(Math.min(1, haversine)));
    }
}
