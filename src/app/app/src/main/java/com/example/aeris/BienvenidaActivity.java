// ---------------------------------------------------------------------------
// Fichero:     BienvenidaActivity.java
// Descripción: Pantalla de bienvenida (Figma: «bienvenida»). Tras el splash,
//              muestra bienvenida sin sesión o abre Inicio si hay una sesión
//              guardada. Inicio comprueba la sesión al cargar los datos.
//              Diseño en doc/app_design.md. Tarea T001, T028.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;

// BienvenidaActivity class: the splash destination when nobody is logged in.
public class BienvenidaActivity extends AppCompatActivity {

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la app)
    // What it does: shows the welcome screen without a session. With a saved
    //               session, opens Inicio directly; Inicio checks the session
    //               while loading its data and returns here if it has expired.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        if (Sesion.haySesion(this)) {
            abrirInicio();
            return;
        }

        setContentView(R.layout.activity_bienvenida);

        findViewById(R.id.botonIniciarSesion).setOnClickListener(vista ->
                startActivity(new Intent(this, LoginActivity.class)));
        findViewById(R.id.botonRegistrarte).setOnClickListener(vista ->
                startActivity(new Intent(this, RegistroActivity.class)));
        findViewById(R.id.enlaceMapa).setOnClickListener(vista ->
                startActivity(new Intent(this, MapaSinCuentaActivity.class)));
    }

    private void abrirInicio() {
        startActivity(new Intent(this, InicioActivity.class));
        finish();
    }
}
