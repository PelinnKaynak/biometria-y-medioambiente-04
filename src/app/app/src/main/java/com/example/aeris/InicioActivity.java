// ---------------------------------------------------------------------------
// Fichero:     InicioActivity.java
// Descripción: Pantalla de inicio PROVISIONAL: saluda al usuario y permite
//              cerrar sesión, para probar T003. La pantalla de inicio real
//              (calidad del aire, últimas mediciones…) es la tarea T006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

// InicioActivity class: temporary home screen until task T006.
public class InicioActivity extends AppCompatActivity {

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: says hello with the user's name and connects «Cerrar sesión».
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_inicio);

        String nombre = Sesion.nombre(this);
        TextView saludo = findViewById(R.id.saludo);
        saludo.setText(getString(R.string.inicio_saludo, nombre == null ? "" : nombre));

        findViewById(R.id.botonCerrarSesion).setOnClickListener(vista -> cerrarSesion());
    }

    // -----------------------------------------------------------------------
    // cerrarSesion() -->
    // What it does: forgets the session and goes back to the welcome screen.
    // -----------------------------------------------------------------------
    private void cerrarSesion() {
        Sesion.cerrar(this);
        Intent intent = new Intent(this, BienvenidaActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }
}
