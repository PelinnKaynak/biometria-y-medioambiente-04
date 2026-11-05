// ---------------------------------------------------------------------------
// Fichero:     RegistroActivity.java
// Descripción: Pantalla de registro (Figma: «registrarte»). Lee el formulario,
//              lo comprueba con ValidadorRegistro, muestra los errores debajo
//              de cada campo y pide a LogicaFakeRegistro que cree la cuenta.
//              Si se crea, guarda la sesión y abre Vincular sensor.
//              Diseño en doc/app_design.md. Tarea T002 · historia H001.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
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

import java.util.Map;

// RegistroActivity class: the sign-up screen. It only shows things and reacts to taps;
// the checks are in ValidadorRegistro and the server call in LogicaFakeRegistro.
public class RegistroActivity extends AppCompatActivity {

    private EditText campoNombre, campoApellidos, campoCorreo, campoContrasena, campoConfirmacion;
    private TextView errorNombre, errorApellidos, errorCorreo, errorContrasena, errorConfirmacion, errorGeneral;
    private TextView botonContinuar;
    private ProgressBar progreso;

    private final LogicaFakeRegistro logica = new LogicaFakeRegistro();

    // Android 17 pide permiso para conectar con la red local (ver PermisoRedLocal).
    // Pregunta el permiso y, si se concede, envía el registro
    private final ActivityResultLauncher<String> pedirPermisoRedLocal =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), concedido -> {
                if (concedido) {
                    enviarRegistro();
                } else {
                    errorGeneral.setText(R.string.permiso_red_denegado);
                    errorGeneral.setVisibility(View.VISIBLE);
                }
            });

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: shows the layout, finds the views and connects the buttons.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_registro);

        campoNombre = findViewById(R.id.campoNombre);
        campoApellidos = findViewById(R.id.campoApellidos);
        campoCorreo = findViewById(R.id.campoCorreo);
        campoContrasena = findViewById(R.id.campoContrasena);
        campoConfirmacion = findViewById(R.id.campoConfirmacion);

        errorNombre = findViewById(R.id.errorNombre);
        errorApellidos = findViewById(R.id.errorApellidos);
        errorCorreo = findViewById(R.id.errorCorreo);
        errorContrasena = findViewById(R.id.errorContrasena);
        errorConfirmacion = findViewById(R.id.errorConfirmacion);
        errorGeneral = findViewById(R.id.errorGeneral);

        botonContinuar = findViewById(R.id.botonContinuar);
        progreso = findViewById(R.id.progreso);

        findViewById(R.id.botonVolver).setOnClickListener(vista -> finish());
        // «Inicia sesión»: cambia el registro por el login (si el login ya estaba
        // abierto debajo, vuelve a ese mismo)
        findViewById(R.id.enlaceIniciarSesion).setOnClickListener(vista -> {
            Intent intent = new Intent(this, LoginActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(intent);
            finish();
        });
        botonContinuar.setOnClickListener(vista -> pulsarContinuar());
        TeclaEnter.pulsaBoton(campoConfirmacion, botonContinuar);   // Enter en el último campo = «Continuar»
    }

    // -----------------------------------------------------------------------
    // pulsarContinuar() -->
    // What it does: checks the form; if it is correct, sends it to the server
    //               (asking first for the local network permission on Android 17),
    //               and if not, shows the errors and does not create the account.
    // -----------------------------------------------------------------------
    private void pulsarContinuar() {
        Map<String, String> errores = ValidadorRegistro.validar(
                texto(campoNombre), texto(campoApellidos), texto(campoCorreo),
                campoContrasena.getText().toString(), campoConfirmacion.getText().toString());
        mostrarErrores(errores);
        if (!errores.isEmpty()) {
            return;
        }

        if (PermisoRedLocal.hayQuePedirlo(this)) {
            pedirPermisoRedLocal.launch(PermisoRedLocal.PERMISO);
        } else {
            enviarRegistro();
        }
    }

    // -----------------------------------------------------------------------
    // enviarRegistro() -->
    // What it does: sends the (already checked) form to the server and reacts
    //               to the answer: opens Vincular sensor, or shows the error.
    // -----------------------------------------------------------------------
    private void enviarRegistro() {
        String nombre = texto(campoNombre);
        String apellidos = texto(campoApellidos);
        String correo = texto(campoCorreo);
        String contrasena = campoContrasena.getText().toString();

        mostrarEnviando(true);
        logica.registrarUsuario(nombre, apellidos, correo, contrasena,
                new LogicaFakeRegistro.RespuestaRegistro() {
                    @Override
                    public void registrado(DatosSesion datos) {
                        mostrarEnviando(false);
                        Sesion.iniciar(RegistroActivity.this, LogicaFakeRegistro.normalizarCorreo(correo), datos);
                        abrirVincularSensor();
                    }

                    @Override
                    public void correoYaRegistrado() {
                        mostrarEnviando(false);
                        mostrarError(campoCorreo, errorCorreo, "Este correo ya tiene una cuenta.");
                    }

                    @Override
                    public void error(String mensaje) {
                        mostrarEnviando(false);
                        errorGeneral.setText(mensaje);
                        errorGeneral.setVisibility(View.VISIBLE);
                    }
                });
    }

    // -----------------------------------------------------------------------
    // Lista<( campo: Text, mensaje: Text )> --> mostrarErrores() -->
    // What it does: clears the old errors and shows each new one under its field.
    // -----------------------------------------------------------------------
    private void mostrarErrores(Map<String, String> errores) {
        limpiarError(campoNombre, errorNombre);
        limpiarError(campoApellidos, errorApellidos);
        limpiarError(campoCorreo, errorCorreo);
        limpiarError(campoContrasena, errorContrasena);
        limpiarError(campoConfirmacion, errorConfirmacion);
        errorGeneral.setVisibility(View.GONE);

        for (Map.Entry<String, String> error : errores.entrySet()) {
            switch (error.getKey()) {
                case ValidadorRegistro.CAMPO_NOMBRE:
                    mostrarError(campoNombre, errorNombre, error.getValue());
                    break;
                case ValidadorRegistro.CAMPO_APELLIDOS:
                    mostrarError(campoApellidos, errorApellidos, error.getValue());
                    break;
                case ValidadorRegistro.CAMPO_CORREO:
                    mostrarError(campoCorreo, errorCorreo, error.getValue());
                    break;
                case ValidadorRegistro.CAMPO_CONTRASENA:
                    mostrarError(campoContrasena, errorContrasena, error.getValue());
                    break;
                case ValidadorRegistro.CAMPO_CONFIRMACION:
                    mostrarError(campoConfirmacion, errorConfirmacion, error.getValue());
                    break;
            }
        }
    }

    // -----------------------------------------------------------------------
    // campo: EditText, etiquetaError: TextView, mensaje: Text --> mostrarError() -->
    // What it does: puts a red border on the field and shows the message under it.
    // -----------------------------------------------------------------------
    private void mostrarError(EditText campo, TextView etiquetaError, String mensaje) {
        campo.setBackgroundResource(R.drawable.fondo_campo_error);
        etiquetaError.setText(mensaje);
        etiquetaError.setVisibility(View.VISIBLE);
    }

    // -----------------------------------------------------------------------
    // campo: EditText, etiquetaError: TextView --> limpiarError() -->
    // What it does: gives the field its normal border and hides the message.
    // -----------------------------------------------------------------------
    private void limpiarError(EditText campo, TextView etiquetaError) {
        campo.setBackgroundResource(R.drawable.fondo_campo);
        etiquetaError.setVisibility(View.GONE);
    }

    // -----------------------------------------------------------------------
    // enviando: B --> mostrarEnviando() -->
    // What it does: while the request is running, disables the button and shows the spinner.
    // -----------------------------------------------------------------------
    private void mostrarEnviando(boolean enviando) {
        botonContinuar.setEnabled(!enviando);
        botonContinuar.setAlpha(enviando ? 0.6f : 1f);
        botonContinuar.setText(enviando ? R.string.registro_enviando : R.string.registro_continuar);
        progreso.setVisibility(enviando ? View.VISIBLE : View.GONE);
    }

    // -----------------------------------------------------------------------
    // abrirVincularSensor() -->
    // What it does: opens the Vincular sensor screen and closes the others
    //               (registro and login), so that "back" does not return to them.
    // -----------------------------------------------------------------------
    private void abrirVincularSensor() {
        Intent intent = new Intent(this, VincularSensorActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }

    // -----------------------------------------------------------------------
    // campo: EditText --> texto() --x
    // Text <--
    // What it does: returns the text of the field without spaces at the ends.
    // -----------------------------------------------------------------------
    private static String texto(EditText campo) {
        return campo.getText().toString().trim();
    }
}
