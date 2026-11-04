// ---------------------------------------------------------------------------
// Fichero:     RecuperarContrasenaActivity.java
// Descripción: Pantalla «Recuperar contraseña» (Figma). Pide el correo y
//              solicita al servidor que envíe el enlace; después abre «Revisa
//              tu correo». Si el correo no tiene cuenta, lo dice y no envía nada. Diseño en doc/app_design.md. Tarea T003 · H002.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

// RecuperarContrasenaActivity class: asks for the email and sends the recovery request.
public class RecuperarContrasenaActivity extends AppCompatActivity {

    private EditText campoCorreo;
    private TextView errorCorreo, errorGeneral, botonEnviar;
    private ProgressBar progreso;

    private final LogicaFakeSesion logica = new LogicaFakeSesion();

    private final ActivityResultLauncher<String> pedirPermisoRedLocal =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), concedido -> {
                if (concedido) {
                    enviarSolicitud();
                } else {
                    mostrarErrorGeneral(getString(R.string.permiso_red_denegado));
                }
            });

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: shows the layout and connects the buttons.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_recuperar_contrasena);

        campoCorreo = findViewById(R.id.campoCorreo);
        errorCorreo = findViewById(R.id.errorCorreo);
        errorGeneral = findViewById(R.id.errorGeneral);
        botonEnviar = findViewById(R.id.botonEnviar);
        progreso = findViewById(R.id.progreso);

        findViewById(R.id.botonVolver).setOnClickListener(vista -> finish());
        findViewById(R.id.enlaceIniciarSesion).setOnClickListener(vista -> finish());   // vuelve al login
        botonEnviar.setOnClickListener(vista -> pulsarEnviar());
    }

    // -----------------------------------------------------------------------
    // pulsarEnviar() -->
    // What it does: checks the email; if it is right, sends the request.
    // -----------------------------------------------------------------------
    private void pulsarEnviar() {
        String error = ValidadorLogin.validarCorreo(campoCorreo.getText().toString());
        mostrarErrorCorreo(error);
        errorGeneral.setVisibility(View.GONE);
        if (error != null) {
            return;
        }
        if (PermisoRedLocal.hayQuePedirlo(this)) {
            pedirPermisoRedLocal.launch(PermisoRedLocal.PERMISO);
        } else {
            enviarSolicitud();
        }
    }

    // -----------------------------------------------------------------------
    // enviarSolicitud() -->
    // What it does: asks the server to send the link and opens «Revisa tu correo».
    // -----------------------------------------------------------------------
    private void enviarSolicitud() {
        final String correo = LogicaFakeRegistro.normalizarCorreo(campoCorreo.getText().toString());
        mostrarEnviando(true);
        logica.solicitarRecuperacion(correo, new LogicaFakeSesion.RespuestaRecuperacion() {
            @Override
            public void enlaceEnviado() {
                mostrarEnviando(false);
                Intent intent = new Intent(RecuperarContrasenaActivity.this, CorreoEnviadoActivity.class);
                intent.putExtra(CorreoEnviadoActivity.EXTRA_CORREO, correo);
                startActivity(intent);
                finish();
            }

            @Override
            public void correoNoRegistrado() {
                mostrarEnviando(false);
                mostrarErrorCorreo(LogicaFakeSesion.MENSAJE_CORREO_NO_REGISTRADO);
            }

            @Override
            public void error(String mensaje) {
                mostrarEnviando(false);
                mostrarErrorGeneral(mensaje);
            }
        });
    }

    // -----------------------------------------------------------------------
    // mensaje: Text | null --> mostrarErrorCorreo() -->
    // What it does: red border and message under the email (or clears it if null).
    // -----------------------------------------------------------------------
    private void mostrarErrorCorreo(String mensaje) {
        findViewById(R.id.marcoCorreo).setBackgroundResource(
                mensaje == null ? R.drawable.fondo_campo : R.drawable.fondo_campo_error);
        errorCorreo.setText(mensaje);
        errorCorreo.setVisibility(mensaje == null ? View.GONE : View.VISIBLE);
    }

    private void mostrarErrorGeneral(String mensaje) {
        errorGeneral.setText(mensaje);
        errorGeneral.setVisibility(View.VISIBLE);
    }

    private void mostrarEnviando(boolean enviando) {
        botonEnviar.setEnabled(!enviando);
        botonEnviar.setAlpha(enviando ? 0.6f : 1f);
        botonEnviar.setText(enviando ? R.string.recuperar_enviando : R.string.recuperar_enviar);
        progreso.setVisibility(enviando ? View.VISIBLE : View.GONE);
    }
}
