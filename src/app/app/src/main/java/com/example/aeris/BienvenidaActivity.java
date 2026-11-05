// ---------------------------------------------------------------------------
// Fichero:     BienvenidaActivity.java
// Descripción: Pantalla de bienvenida (Figma: «bienvenida»). Es la primera
//              pantalla de la app: si hay una sesión guardada, comprueba con el
//              servidor que sigue valiendo y va al inicio; si no, ofrece
//              iniciar sesión, registrarse o ver el mapa sin cuenta. Diseño en doc/app_design.md. Tarea T001.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;

import androidx.appcompat.app.AppCompatActivity;

// BienvenidaActivity class: the first screen when nobody is logged in.
public class BienvenidaActivity extends AppCompatActivity {

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la app)
    // What it does: shows the welcome screen. If there is a saved session,
    //               first asks the server whether it is still valid (it stops
    //               being valid when the password is changed on another
    //               phone): valid -> home screen; not valid -> logs out and
    //               stays here. Without connection, the home screen opens
    //               anyway (nobody is logged out for being offline).
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_bienvenida);

        findViewById(R.id.botonIniciarSesion).setOnClickListener(vista ->
                startActivity(new Intent(this, LoginActivity.class)));
        findViewById(R.id.botonRegistrarte).setOnClickListener(vista ->
                startActivity(new Intent(this, RegistroActivity.class)));
        findViewById(R.id.enlaceMapa).setOnClickListener(vista ->
                startActivity(new Intent(this, MapaSinCuentaActivity.class)));

        if (Sesion.haySesion(this)) {
            comprobarSesion();
        }
    }

    // -----------------------------------------------------------------------
    // comprobarSesion() -->
    // What it does: hides the buttons (only the logo is seen) and asks
    //               GET /usuarioActual with the saved token.
    // -----------------------------------------------------------------------
    private void comprobarSesion() {
        View panel = findViewById(R.id.panelBienvenida);
        panel.setVisibility(View.INVISIBLE);
        new LogicaFakePerfil().obtenerUsuario(Sesion.token(this), new LogicaFakePerfil.RespuestaUsuario() {
            @Override
            public void usuarioObtenido(DatosUsuario datos) {
                abrirInicio();
            }

            @Override
            public void sesionCaducada() {
                // La contraseña ha cambiado en otro dispositivo (o el token ha caducado)
                Sesion.cerrar(BienvenidaActivity.this);
                panel.setVisibility(View.VISIBLE);
            }

            @Override
            public void error(String mensaje) {
                abrirInicio();      // sin conexión: no se cierra la sesión
            }
        });
    }

    private void abrirInicio() {
        startActivity(new Intent(this, InicioActivity.class));
        finish();
    }
}
