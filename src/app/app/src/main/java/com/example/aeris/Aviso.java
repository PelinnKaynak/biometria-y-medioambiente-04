// ---------------------------------------------------------------------------
// Fichero:     Aviso.java
// Descripción: Un aviso del panel de notificaciones de Inicio (Figma: «inicio ·
//              notificaciones abiertas»): contaminación alta, batería baja o
//              sensor desconectado. calcular() saca los avisos de las
//              mediciones; hasta T017 se usan los de ejemplo de
//              LogicaFakeInicio. Cada aviso tiene una clave para saber si ya
//              se ha leído (AvisosLeidos). Diseño en doc/app_design.md. T006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       12/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

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
        this.tipo = tipo;
        this.titulo = titulo;
        this.texto = texto;
        this.momento = momento;
        this.clave = clave;
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
    //               1 hour. The battery comes with T017.
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
}
