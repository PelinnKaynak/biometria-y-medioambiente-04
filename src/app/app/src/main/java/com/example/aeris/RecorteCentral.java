// ---------------------------------------------------------------------------
// Fichero:     RecorteCentral.java
// Descripción: Recorta el centro de una imagen de la cámara (canal Y, la
//              luminancia), justo donde está el marco del escáner. El código
//              de la etiqueta mide unos 4 mm: en el recorte ocupa mucho más
//              sitio y ZXing lo encuentra mejor que en la imagen entera.
//              No usa Android, así que se puede probar con JUnit.
//              Diseño en doc/app_design.md. T039.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

// RecorteCentral class: cuts the centre square out of a camera image.
public final class RecorteCentral {

    private RecorteCentral() {
    }

    // -----------------------------------------------------------------------
    // ancho: N, alto: N, proporcion: R --> lado() --> N
    // What it does: side of the centre square: proporcion of the shorter
    //               side of the image (at least 1, at most the shorter side).
    // -----------------------------------------------------------------------
    public static int lado(int ancho, int alto, double proporcion) {
        int menor = Math.min(ancho, alto);
        return Math.max(1, Math.min(menor, (int) Math.round(menor * proporcion)));
    }

    // -----------------------------------------------------------------------
    // luminancia: [N], ancho: N, alto: N, pasoFila: N, lado: N
    //     --> recortar() --> [N]
    // What it does: reads the Y plane as the camera gives it (each row takes
    //               pasoFila bytes, one byte per pixel) and returns the
    //               lado × lado square from the middle, row after row with
    //               no padding.
    // -----------------------------------------------------------------------
    public static byte[] recortar(byte[] luminancia, int ancho, int alto, int pasoFila, int lado) {
        int izquierda = (ancho - lado) / 2;
        int arriba = (alto - lado) / 2;
        byte[] recorte = new byte[lado * lado];
        for (int fila = 0; fila < lado; fila++) {
            System.arraycopy(luminancia, (arriba + fila) * pasoFila + izquierda, recorte, fila * lado, lado);
        }
        return recorte;
    }
}
