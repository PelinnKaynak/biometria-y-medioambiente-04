// ---------------------------------------------------------------------------
// Fichero:     PermisoRedLocal.java
// Descripción: Permiso de red local de Android 17 (API 37). Sin él, una app
//              con targetSdk 37 no puede conectar con el servidor en la red
//              local (10.0.2.2 o la IP del ordenador). Diseño en doc/app_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

// PermisoRedLocal class: says whether the app still has to ask for the
// local network permission before talking to the server.
public class PermisoRedLocal {

    public static final String PERMISO = "android.permission.ACCESS_LOCAL_NETWORK";
    static final int API_ANDROID_17 = 37;

    // -----------------------------------------------------------------------
    // contexto: Context --> hayQuePedirlo() --x
    // B <--
    // What it does: true on Android 17 or newer if the permission has not been
    //               given yet. Older Android versions do not need it.
    // -----------------------------------------------------------------------
    public static boolean hayQuePedirlo(Context contexto) {
        return Build.VERSION.SDK_INT >= API_ANDROID_17
                && ContextCompat.checkSelfPermission(contexto, PERMISO) != PackageManager.PERMISSION_GRANTED;
    }
}
