// ---------------------------------------------------------------------------
// Fichero:     UuidAERIS.java
// Descripción: Los UUID de los servicios Bluetooth del nodo se forman con un
//              texto de 16 letras (Sprint 0, ServicioEnEmisora.h): los 16
//              bytes del UUID son los códigos de las letras, en orden. Así
//              «AERIS-LUZ-ACTIVA» es 41455249-532d-4c55-5a2d-414354495641.
//              No usa Android, así que se puede probar con JUnit. H033.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

// UuidAERIS class: builds the UUID of a node service from its 16-letter name.
public final class UuidAERIS {

    private UuidAERIS() {
    }

    // -----------------------------------------------------------------------
    // texto: Text --> desdeTexto() --x
    // UUID <--
    // What it does: the UUID whose 16 bytes are the ASCII codes of the text.
    //               The text must have exactly 16 ASCII characters.
    // -----------------------------------------------------------------------
    public static UUID desdeTexto(String texto) {
        byte[] bytes = texto.getBytes(StandardCharsets.US_ASCII);
        if (bytes.length != 16 || texto.length() != 16) {
            throw new IllegalArgumentException("El nombre tiene que tener 16 letras: " + texto);
        }
        ByteBuffer b = ByteBuffer.wrap(bytes);
        return new UUID(b.getLong(), b.getLong());
    }
}
