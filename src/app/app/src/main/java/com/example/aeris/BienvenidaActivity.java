// ---------------------------------------------------------------------------
// Fichero:     BienvenidaActivity.java
// Descripción: Pantalla de bienvenida (Figma: «bienvenida»). Es la primera
//              pantalla de la app: si ya hay una sesión guardada va directa al
//              inicio; si no, ofrece iniciar sesión, registrarse o ver el mapa
//              sin cuenta. Diseño en doc/app_design.md. Tarea T001.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

// BienvenidaActivity class: the first screen when nobody is logged in.
public class BienvenidaActivity extends AppCompatActivity {

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la app)
    // What it does: with a saved session, opens the home screen at once and
    //               closes this one; without a session, shows the welcome
    //               screen and connects its three buttons.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Sesion.haySesion(this)) {
            startActivity(new Intent(this, InicioActivity.class));
            finish();
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
}
