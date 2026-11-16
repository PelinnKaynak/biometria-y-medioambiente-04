// ---------------------------------------------------------------------------
// Fichero:     CodigoSensor.java
// Descripción: Lee el código (DataMatrix) de la etiqueta del sensor de ozono,
//              p. ej. «092021010920 110406 03 2109 -44.75»: número de serie,
//              modelo, gas, fecha de fabricación (AAMM) y sensibilidad
//              (nA/ppm). Lo usa «Vincular sensor», tanto con la cámara como
//              cuando la línea de números se escribe a mano.
//              Diseño en doc/app_design.md. T005.
// Autores:     Equipo 04 – SenseTech
// Fecha:       11/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

// CodigoSensor class: the data written in the label code of a sensor.
public class CodigoSensor {

    public final String numeroSerie;    // 12 cifras, distinto en cada sensor
    public final String modelo;         // 6 cifras
    public final String gas;            // 2 cifras («03» en los sensores de ozono)
    public final String fecha;          // AAMM, p. ej. «2109» = septiembre de 2021
    public final double sensibilidad;   // nA/ppm, sirve para calcular el ozono

    // -----------------------------------------------------------------------
    // numeroSerie: Text, modelo: Text, gas: Text, fecha: Text, sensibilidad: R
    // --> constructor()
    // -----------------------------------------------------------------------
    public CodigoSensor(String numeroSerie, String modelo, String gas, String fecha, double sensibilidad) {
        this.numeroSerie = numeroSerie;
        this.modelo = modelo;
        this.gas = gas;
        this.fecha = fecha;
        this.sensibilidad = sensibilidad;
    }

    // -----------------------------------------------------------------------
    // texto: Text --> desdeTexto() --x
    // CodigoSensor | null <--
    // What it does: splits the text read from the code by spaces. It must
    //               have 5 parts: serial (12 digits), model (6 digits), gas
    //               (2 digits), date (4 digits) and sensitivity (a number).
    //               The sensitivity can have a comma or a dot (written by
    //               hand). If not, it is not the label of a sensor: null.
    // -----------------------------------------------------------------------
    public static CodigoSensor desdeTexto(String texto) {
        if (texto == null) {
            return null;
        }
        String[] partes = texto.trim().split("\\s+");
        if (partes.length != 5
                || !partes[0].matches("\\d{12}")
                || !partes[1].matches("\\d{6}")
                || !partes[2].matches("\\d{2}")
                || !partes[3].matches("\\d{4}")) {
            return null;
        }
        Double sensibilidad = leerSensibilidad(partes[4]);
        return sensibilidad == null ? null
                : new CodigoSensor(partes[0], partes[1], partes[2], partes[3], sensibilidad);
    }

    // -----------------------------------------------------------------------
    // texto: Text --> leerSensibilidad() --x
    // R | null <--
    // What it does: reads the sensitivity; accepts a
    //               comma or a dot ("-44,75" or "-44.75"). null if it is not
    //               a number.
    // -----------------------------------------------------------------------
    public static Double leerSensibilidad(String texto) {
        if (texto == null || texto.trim().isEmpty()) {
            return null;
        }
        try {
            return Double.parseDouble(texto.trim().replace(',', '.'));
        } catch (NumberFormatException error) {
            return null;
        }
    }
}
