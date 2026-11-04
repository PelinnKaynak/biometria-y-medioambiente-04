// ---------------------------------------------------------------------------
// Fichero:     MapaSinCuentaActivity.java
// Descripción: Mapa sin cuenta: pantalla PROVISIONAL para que el botón «Ver el
//              mapa sin cuenta» de la bienvenida (T001) abra algo. El mapa real
//              se hace en su propia tarea.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

// MapaSinCuentaActivity class: temporary screen until the map task.
public class MapaSinCuentaActivity extends AppCompatActivity {

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: shows the text; «volver» goes back to the welcome screen.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mapa_sin_cuenta);
        findViewById(R.id.botonVolver).setOnClickListener(vista -> finish());
    }
}
