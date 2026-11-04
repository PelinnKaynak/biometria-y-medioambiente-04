// ---------------------------------------------------------------------------
// Fichero:     LoginActivity.java
// Descripción: Pantalla de inicio de sesión (Figma: «login»). Primera pantalla
//              de la app hasta que exista la bienvenida (T001): si ya hay una
//              sesión guardada abre directamente el inicio. Comprueba el
//              formulario con ValidadorLogin y pide a LogicaFakeSesion que
//              inicie la sesión. Diseño en doc/app_design.md. Tarea T003 · H002.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;
import android.text.method.HideReturnsTransformationMethod;
import android.text.method.PasswordTransformationMethod;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import java.util.Map;

// LoginActivity class: the log-in screen. It only shows things and reacts to taps;
// the checks are in ValidadorLogin and the server call in LogicaFakeSesion.
public class LoginActivity extends AppCompatActivity {

    private EditText campoCorreo, campoContrasena;
    private View marcoCorreo, marcoContrasena;
    private TextView errorCorreo, errorContrasena, errorGeneral, botonAcceder;
    private ProgressBar progreso;
    private ImageView botonVerContrasena;
    private boolean contrasenaVisible = false;

    private final LogicaFakeSesion logica = new LogicaFakeSesion();

    // Pregunta el permiso de red local (Android 17) y, si se concede, envía el formulario
    private final ActivityResultLauncher<String> pedirPermisoRedLocal =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), concedido -> {
                if (concedido) {
                    enviarInicioSesion();
                } else {
                    mostrarErrorGeneral(getString(R.string.permiso_red_denegado));
                }
            });

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: if a session is saved, opens the home screen at once;
    //               if not, shows the form and connects the buttons.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Sesion.haySesion(this)) {
            abrirInicio();
            return;
        }
        setContentView(R.layout.activity_login);

        campoCorreo = findViewById(R.id.campoCorreo);
        campoContrasena = findViewById(R.id.campoContrasena);
        marcoCorreo = findViewById(R.id.marcoCorreo);
        marcoContrasena = findViewById(R.id.marcoContrasena);
        errorCorreo = findViewById(R.id.errorCorreo);
        errorContrasena = findViewById(R.id.errorContrasena);
        errorGeneral = findViewById(R.id.errorGeneral);
        botonAcceder = findViewById(R.id.botonAcceder);
        progreso = findViewById(R.id.progreso);

        findViewById(R.id.botonVolver).setOnClickListener(vista -> finish());
        botonVerContrasena = findViewById(R.id.botonVerContrasena);
        botonVerContrasena.setOnClickListener(vista -> cambiarVisibilidadContrasena());
        findViewById(R.id.enlaceRecuperar).setOnClickListener(vista ->
                startActivity(new Intent(this, RecuperarContrasenaActivity.class)));
        findViewById(R.id.enlaceRegistrate).setOnClickListener(vista ->
                startActivity(new Intent(this, RegistroActivity.class)));
        botonAcceder.setOnClickListener(vista -> pulsarAcceder());
    }

    // -----------------------------------------------------------------------
    // pulsarAcceder() -->
    // What it does: checks the form; if it is correct, asks for the local
    //               network permission if needed and sends it to the server.
    // -----------------------------------------------------------------------
    private void pulsarAcceder() {
        Map<String, String> errores = ValidadorLogin.validar(
                campoCorreo.getText().toString(), campoContrasena.getText().toString());
        mostrarErrores(errores);
        if (!errores.isEmpty()) {
            return;
        }
        if (PermisoRedLocal.hayQuePedirlo(this)) {
            pedirPermisoRedLocal.launch(PermisoRedLocal.PERMISO);
        } else {
            enviarInicioSesion();
        }
    }

    // -----------------------------------------------------------------------
    // enviarInicioSesion() -->
    // What it does: sends email and password; if they are right, saves the
    //               session and opens the home screen; if not, shows
    //               «Correo o contraseña incorrectos» and does not let the user in.
    // -----------------------------------------------------------------------
    private void enviarInicioSesion() {
        final String correo = LogicaFakeRegistro.normalizarCorreo(campoCorreo.getText().toString());
        mostrarEnviando(true);
        logica.iniciarSesion(correo, campoContrasena.getText().toString(),
                new LogicaFakeSesion.RespuestaInicioSesion() {
                    @Override
                    public void sesionIniciada(DatosSesion datos) {
                        mostrarEnviando(false);
                        Sesion.iniciar(LoginActivity.this, correo, datos);
                        abrirInicio();
                    }

                    @Override
                    public void credencialesIncorrectas() {
                        mostrarEnviando(false);
                        campoContrasena.setText("");
                        mostrarErrorGeneral(LogicaFakeSesion.MENSAJE_CREDENCIALES_INCORRECTAS);
                    }

                    @Override
                    public void error(String mensaje) {
                        mostrarEnviando(false);
                        mostrarErrorGeneral(mensaje);
                    }
                });
    }

    // -----------------------------------------------------------------------
    // Lista<( campo: Text, mensaje: Text )> --> mostrarErrores() -->
    // What it does: clears the old errors and shows each new one under its field.
    // -----------------------------------------------------------------------
    private void mostrarErrores(Map<String, String> errores) {
        marcarCampo(marcoCorreo, errorCorreo, errores.get(ValidadorLogin.CAMPO_CORREO));
        marcarCampo(marcoContrasena, errorContrasena, errores.get(ValidadorLogin.CAMPO_CONTRASENA));
        errorGeneral.setVisibility(View.GONE);
    }

    // -----------------------------------------------------------------------
    // marco: View, etiquetaError: TextView, mensaje: Text | null --> marcarCampo() -->
    // What it does: red border and message if there is an error; normal if null.
    // -----------------------------------------------------------------------
    private void marcarCampo(View marco, TextView etiquetaError, String mensaje) {
        marco.setBackgroundResource(mensaje == null ? R.drawable.fondo_campo : R.drawable.fondo_campo_error);
        etiquetaError.setText(mensaje);
        etiquetaError.setVisibility(mensaje == null ? View.GONE : View.VISIBLE);
    }

    // -----------------------------------------------------------------------
    // mensaje: Text --> mostrarErrorGeneral() -->
    // What it does: shows a message above the «Acceder» button.
    // -----------------------------------------------------------------------
    private void mostrarErrorGeneral(String mensaje) {
        errorGeneral.setText(mensaje);
        errorGeneral.setVisibility(View.VISIBLE);
    }

    // -----------------------------------------------------------------------
    // cambiarVisibilidadContrasena() -->
    // What it does: the eye icon shows or hides the password. The icon says
    //               how the password is now: crossed-out eye = hidden,
    //               open eye = visible.
    // -----------------------------------------------------------------------
    private void cambiarVisibilidadContrasena() {
        contrasenaVisible = !contrasenaVisible;
        campoContrasena.setTransformationMethod(contrasenaVisible
                ? HideReturnsTransformationMethod.getInstance()
                : PasswordTransformationMethod.getInstance());
        campoContrasena.setSelection(campoContrasena.getText().length());
        botonVerContrasena.setImageResource(contrasenaVisible
                ? R.drawable.ic_ver_contrasena : R.drawable.ic_ocultar_contrasena);
        botonVerContrasena.setContentDescription(getString(contrasenaVisible
                ? R.string.login_ocultar_contrasena : R.string.login_ver_contrasena));
    }

    // -----------------------------------------------------------------------
    // enviando: B --> mostrarEnviando() -->
    // What it does: while the request is running, disables the button and shows the spinner.
    // -----------------------------------------------------------------------
    private void mostrarEnviando(boolean enviando) {
        botonAcceder.setEnabled(!enviando);
        botonAcceder.setAlpha(enviando ? 0.6f : 1f);
        botonAcceder.setText(enviando ? R.string.login_entrando : R.string.login_acceder);
        progreso.setVisibility(enviando ? View.VISIBLE : View.GONE);
    }

    // -----------------------------------------------------------------------
    // abrirInicio() -->
    // What it does: opens the home screen and closes this one.
    // -----------------------------------------------------------------------
    private void abrirInicio() {
        startActivity(new Intent(this, InicioActivity.class));
        finish();
    }
}
