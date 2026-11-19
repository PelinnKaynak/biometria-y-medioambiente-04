// ---------------------------------------------------------------------------
// Fichero:     TramaAERIS.java
// Descripción: Lee una trama iBeacon del nodo sensor AERIS (T004). Llega en
//              los datos del fabricante 0x004C (Apple) del anuncio Bluetooth:
//              0x02 0x15, UUID (16 bytes: "AERI" + número de serie de 12
//              cifras), major (tipo * 256 + contador), minor (valor con
//              signo) y txPower. Basado en TramaIBeacon del Sprint 0.
//              No usa Android, así que se puede probar con JUnit.
//              Diseño en doc/app_design.md. T023.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

// TramaAERIS class: one measurement packet sent by an AERIS sensor.
public final class TramaAERIS {

    public static final int ID_FABRICANTE = 0x004C;          // Apple: así es un iBeacon
    // Lo que tienen al principio todas las tramas AERIS: tipo iBeacon (0x02),
    // largo (0x15 = 21) y "AERI". Sirve también de filtro para el escaneo.
    public static final byte[] PREFIJO = {0x02, 0x15, 'A', 'E', 'R', 'I'};
    static final int LARGO = 23;                              // 2 + 16 + 2 + 2 + 1
    static final int LARGO_NUMERO_SERIE = 12;

    // Tipos de medición (byte alto de major), los mismos que en Publicador.h
    public static final int OZONO = 11;           // valor en µg/m³
    public static final int TEMPERATURA = 12;     // valor en décimas de °C

    public final String numeroSerie;
    public final int tipo;
    public final int contador;     // 0..255, cambia con cada medición nueva
    public final int valor;        // con signo (-32768..32767)

    private TramaAERIS(String numeroSerie, int tipo, int contador, int valor) {
        this.numeroSerie = numeroSerie;
        this.tipo = tipo;
        this.contador = contador;
        this.valor = valor;
    }

    // -----------------------------------------------------------------------
    // datos: [N] | null --> leer() --x
    // TramaAERIS | null <--
    // What it does: reads the manufacturer data of an advertisement. Returns
    //               null if it is not an AERIS packet: wrong length, it does
    //               not start with PREFIJO or the serial number is not 12
    //               digits.
    // -----------------------------------------------------------------------
    public static TramaAERIS leer(byte[] datos) {
        if (datos == null || datos.length < LARGO) {
            return null;
        }
        for (int i = 0; i < PREFIJO.length; i++) {
            if (datos[i] != PREFIJO[i]) {
                return null;
            }
        }
        StringBuilder serie = new StringBuilder();
        for (int i = PREFIJO.length; i < PREFIJO.length + LARGO_NUMERO_SERIE; i++) {
            char cifra = (char) (datos[i] & 0xFF);
            if (cifra < '0' || cifra > '9') {
                return null;
            }
            serie.append(cifra);
        }
        int major = ((datos[18] & 0xFF) << 8) | (datos[19] & 0xFF);
        int valor = (short) (((datos[20] & 0xFF) << 8) | (datos[21] & 0xFF));
        return new TramaAERIS(serie.toString(), major >> 8, major & 0xFF, valor);
    }

    // -----------------------------------------------------------------------
    // esOzono() --x
    // B <--
    // -----------------------------------------------------------------------
    public boolean esOzono() {
        return tipo == OZONO;
    }
}
