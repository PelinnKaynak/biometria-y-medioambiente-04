// ---------------------------------------------------------------------------
// Fichero:     VincularSensorActivity.java
// Descripción: Pantalla PROVISIONAL de vincular sensor. Solo existe para que
//              el registro (T002) pueda abrirla. La búsqueda por Bluetooth y
//              la vinculación se programan en la tarea T005 (H019).
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

// VincularSensorActivity class: temporary screen until task T005.
public class VincularSensorActivity extends AppCompatActivity {

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: shows the screen; "Omitir por ahora" opens the home screen
    //               (until T005 adds the Bluetooth search).
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_vincular_sensor);
        findViewById(R.id.enlaceOmitir).setOnClickListener(vista -> {
            startActivity(new Intent(this, InicioActivity.class));
            finish();
        });
    }
}
