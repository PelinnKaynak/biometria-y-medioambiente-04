// ---------------------------------------------------------------------------
// Fichero:     InicioActivity.java
// Descripción: Pantalla de inicio PROVISIONAL: saluda al usuario y tiene la
//              barra de navegación inferior para ir al perfil (T010), donde
//              se cierra la sesión. La pantalla de inicio real (calidad del
//              aire, últimas mediciones…) es la tarea T006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.os.Bundle;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

// InicioActivity class: temporary home screen until task T006.
public class InicioActivity extends AppCompatActivity {

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: says hello with the user's name and connects the bottom bar.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_inicio);
        BarraNavegacion.conectar(this, BarraNavegacion.Pestanya.INICIO);

        String nombre = Sesion.nombre(this);
        TextView saludo = findViewById(R.id.saludo);
        saludo.setText(getString(R.string.inicio_saludo, nombre == null ? "" : nombre));
    }
}
