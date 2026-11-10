// ---------------------------------------------------------------------------
// Fichero:     CorreoEnviadoActivity.java
// Descripción: Pantalla «Revisa tu correo» (Figma: «correo enviado»). Dice a
//              qué correo se ha enviado el enlace, permite reenviarlo y volver
//              al inicio de sesión. Diseño en doc/app_design.md. Tarea T003 · H002.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

// CorreoEnviadoActivity class: confirmation after asking for the recovery link.
public class CorreoEnviadoActivity extends AppCompatActivity {

    static final String EXTRA_CORREO = "correo";

    private final LogicaFakeSesion logica = new LogicaFakeSesion();
    private String correo;

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: shows the email the link was sent to and connects the buttons.
    //               «Volver a iniciar sesión» and «volver» close this screen
    //               (the login is below it).
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_correo_enviado);

        correo = getIntent().getStringExtra(EXTRA_CORREO);
        TextView texto = findViewById(R.id.textoEnviado);
        texto.setText(getString(R.string.enviado_texto, correo));

        findViewById(R.id.botonVolver).setOnClickListener(vista -> finish());
        findViewById(R.id.botonVolverLogin).setOnClickListener(vista -> finish());
        findViewById(R.id.enlaceReenviar).setOnClickListener(vista -> reenviar());
    }

    // -----------------------------------------------------------------------
    // reenviar() -->
    // What it does: asks the server for a new link for the same email.
    // -----------------------------------------------------------------------
    private void reenviar() {
        logica.solicitarRecuperacion(correo, new LogicaFakeSesion.RespuestaRecuperacion() {
            @Override
            public void enlaceEnviado() {
                mostrarMensaje(getString(R.string.enviado_reenviado), R.color.violeta);
            }

            @Override
            public void correoNoRegistrado() {
                mostrarMensaje(LogicaFakeSesion.MENSAJE_CORREO_NO_REGISTRADO, R.color.error);
            }

            @Override
            public void error(String mensaje) {
                mostrarMensaje(mensaje, R.color.error);
            }
        });
    }

    // -----------------------------------------------------------------------
    // mensaje: Text, color: Z --> mostrarMensaje() -->
    // What it does: writes the result of «Reenviar» under the link, in the
    //               screen itself (violet if it went well, red if not).
    // -----------------------------------------------------------------------
    private void mostrarMensaje(String mensaje, int color) {
        TextView texto = findViewById(R.id.mensajeReenvio);
        texto.setText(mensaje);
        texto.setTextColor(getColor(color));
        texto.setVisibility(View.VISIBLE);
    }
}
