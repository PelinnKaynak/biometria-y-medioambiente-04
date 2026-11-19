// ---------------------------------------------------------------------------
// Fichero:     PermisosMedicion.java
// Descripción: Permisos que necesita la app para recibir las mediciones del
//              sensor (T023): ubicación (cada medición va con dónde se tomó;
//              en Android 10 y 11 también hace falta para buscar por
//              Bluetooth), buscar dispositivos Bluetooth (Android 12+) y
//              notificaciones (Android 13+, la del servicio; si se niega, se
//              mide igual). Diseño en doc/app_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

// PermisosMedicion class: which runtime permissions measuring needs.
public final class PermisosMedicion {

    static final String UBICACION_PRECISA = "android.permission.ACCESS_FINE_LOCATION";
    static final String UBICACION_APROXIMADA = "android.permission.ACCESS_COARSE_LOCATION";
    static final String BUSCAR_BLUETOOTH = "android.permission.BLUETOOTH_SCAN";       // Android 12 (31)
    static final String NOTIFICACIONES = "android.permission.POST_NOTIFICATIONS";     // Android 13 (33)

    private PermisosMedicion() {
    }

    // -----------------------------------------------------------------------
    // sdk: N --> obligatorios() --x       [Text] <--
    // sdk: N --> aPedir() --x             [Text] <--
    // What it does: the permissions without which it cannot measure, and
    //               those plus notifications (what is asked to the user).
    // -----------------------------------------------------------------------
    static String[] obligatorios(int sdk) {
        List<String> lista = new ArrayList<>();
        lista.add(UBICACION_PRECISA);
        lista.add(UBICACION_APROXIMADA);
        if (sdk >= 31) {
            lista.add(BUSCAR_BLUETOOTH);
        }
        return lista.toArray(new String[0]);
    }

    static String[] aPedir(int sdk) {
        List<String> lista = new ArrayList<>(Arrays.asList(obligatorios(sdk)));
        if (sdk >= 33) {
            lista.add(NOTIFICACIONES);
        }
        return lista.toArray(new String[0]);
    }

    // -----------------------------------------------------------------------
    // contexto: Context --> concedidos() --x
    // B <--
    // What it does: true if the user has given all the obligatory ones.
    // -----------------------------------------------------------------------
    static boolean concedidos(Context contexto) {
        for (String permiso : obligatorios(Build.VERSION.SDK_INT)) {
            if (ContextCompat.checkSelfPermission(contexto, permiso) != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return true;
    }
}
