// ---------------------------------------------------------------------------
// Fichero:     ColaMediciones.java
// Descripción: Mediciones esperando a llegar al servidor (cuerpos JSON de
//              POST /guardarMedicion), en orden. Si no hay conexión se
//              quedan aquí y se envían después; el servicio la guarda en el
//              teléfono como texto (una por línea). Como mucho MAXIMO: si se
//              llena, se pierden las más antiguas (el servidor tampoco
//              acepta mediciones de hace más de 7 días).
//              No usa Android, así que se puede probar con JUnit.
//              Diseño en doc/app_design.md. T023.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.util.ArrayDeque;
import java.util.Deque;

// ColaMediciones class: the measurements not sent yet, oldest first.
public class ColaMediciones {

    static final int MAXIMO = 2000;      // ~33 h midiendo una por minuto

    private final Deque<String> cuerpos = new ArrayDeque<>();

    // -----------------------------------------------------------------------
    // cuerpo: Text --> anadir() --x
    // What it does: puts it at the end; if there are more than MAXIMO, the
    //               oldest goes away.
    // -----------------------------------------------------------------------
    public void anadir(String cuerpo) {
        cuerpos.addLast(cuerpo);
        while (cuerpos.size() > MAXIMO) {
            cuerpos.removeFirst();
        }
    }

    // primero() --x  Text | null <--   (la más antigua, sin quitarla)
    public String primero() {
        return cuerpos.peekFirst();
    }

    // quitarPrimero() --x
    public void quitarPrimero() {
        cuerpos.pollFirst();
    }

    public int tamano() {
        return cuerpos.size();
    }

    public boolean vacia() {
        return cuerpos.isEmpty();
    }

    // -----------------------------------------------------------------------
    // aTexto() --x
    // Text <--
    // desdeTexto() <-- texto: Text | null
    // ColaMediciones <--
    // What it does: one body per line (a JSON body has no line breaks), to
    //               save it in the phone and read it back. Empty lines are
    //               skipped.
    // -----------------------------------------------------------------------
    public String aTexto() {
        return String.join("\n", cuerpos);
    }

    public static ColaMediciones desdeTexto(String texto) {
        ColaMediciones cola = new ColaMediciones();
        if (texto != null) {
            for (String linea : texto.split("\n")) {
                if (!linea.trim().isEmpty()) {
                    cola.anadir(linea.trim());
                }
            }
        }
        return cola;
    }
}
