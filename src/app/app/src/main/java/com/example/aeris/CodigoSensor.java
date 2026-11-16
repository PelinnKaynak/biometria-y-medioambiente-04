// ---------------------------------------------------------------------------
// Fichero:     CodigoSensor.java
// Descripción: Lee el código (DataMatrix) de la etiqueta del sensor de ozono,
//              p. ej. «092021010920 110406 03 2109 -44.75»: número de serie,
//              modelo, gas, fecha de fabricación (AAMM) y sensibilidad
//              (nA/ppm). Lo usa «Vincular sensor». Si la cámara no funciona,
//              el número de serie y la sensibilidad se escriben a mano (desdeCampos).
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
    public final String gas;            // 2 cifras («03» en los sensores de ozono); "" si se escribe a mano
    public final String fecha;          // AAMM, p. ej. «2109» = septiembre de 2021; "" si se escribe a mano
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
    //               If not, it is not the label of a sensor: returns null.
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
        try {
            double sensibilidad = Double.parseDouble(partes[4]);
            return new CodigoSensor(partes[0], partes[1], partes[2], partes[3], sensibilidad);
        } catch (NumberFormatException error) {
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // numeroSerie: Text --> esNumeroSerieValido() --x
    // B <--
    // What it does: true if it has exactly 12 digits (spaces around are ignored).
    // -----------------------------------------------------------------------
    public static boolean esNumeroSerieValido(String numeroSerie) {
        return numeroSerie != null && numeroSerie.trim().matches("\\d{12}");
    }

    // -----------------------------------------------------------------------
    // texto: Text --> leerSensibilidad() --x
    // R | null <--
    // What it does: reads the sensitivity written by the user; accepts a
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

    // -----------------------------------------------------------------------
    // numeroSerie: Text, sensibilidad: Text --> desdeCampos() --x
    // CodigoSensor | null <--
    // What it does: builds the sensor from the two fields written by hand
    //               (when the camera does not work). Model, gas and date are
    //               not known: they stay "". null if a field is not valid.
    // -----------------------------------------------------------------------
    public static CodigoSensor desdeCampos(String numeroSerie, String sensibilidad) {
        Double valor = leerSensibilidad(sensibilidad);
        if (!esNumeroSerieValido(numeroSerie) || valor == null) {
            return null;
        }
        return new CodigoSensor(numeroSerie.trim(), "", "", "", valor);
    }
}
