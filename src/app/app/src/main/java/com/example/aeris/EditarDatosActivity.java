// ---------------------------------------------------------------------------
// Fichero:     EditarDatosActivity.java
// Descripción: Pantalla «Editar mis datos» (Figma: «editar mis datos»).
//              Arriba cambia el nombre, los apellidos y el correo; abajo
//              cambia la contraseña. Se abre desde el perfil.
//              Diseño en doc/app_design.md. Tarea T010.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import java.util.Map;

// EditarDatosActivity class: the «Editar mis datos» screen.
public class EditarDatosActivity extends AppCompatActivity {

    private final LogicaFakeEditarDatos logica = new LogicaFakeEditarDatos();

    private EditText campoNombre, campoApellidos, campoCorreo;
    private TextView errorNombre, errorApellidos, errorCorreo, errorDatos;
    private EditText campoActual, campoNueva, campoRepetida;
    private TextView errorActual, errorNueva, errorRepetida, errorContrasena, avisoContrasena;
    private TextView botonGuardar, botonCambiarContrasena;

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: finds the views, connects the buttons and fills the form
    //               with the user's current data.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_editar_datos);

        campoNombre = findViewById(R.id.campoNombre);
        campoApellidos = findViewById(R.id.campoApellidos);
        campoCorreo = findViewById(R.id.campoCorreo);
        errorNombre = findViewById(R.id.errorNombre);
        errorApellidos = findViewById(R.id.errorApellidos);
        errorCorreo = findViewById(R.id.errorCorreo);
        errorDatos = findViewById(R.id.errorDatos);
        campoActual = findViewById(R.id.campoContrasenaActual);
        campoNueva = findViewById(R.id.campoContrasenaNueva);
        campoRepetida = findViewById(R.id.campoContrasenaRepetida);
        errorActual = findViewById(R.id.errorContrasenaActual);
        errorNueva = findViewById(R.id.errorContrasenaNueva);
        errorRepetida = findViewById(R.id.errorContrasenaRepetida);
        errorContrasena = findViewById(R.id.errorContrasena);
        avisoContrasena = findViewById(R.id.avisoContrasena);
        botonGuardar = findViewById(R.id.botonGuardar);
        botonCambiarContrasena = findViewById(R.id.botonCambiarContrasena);

        findViewById(R.id.botonVolver).setOnClickListener(vista -> finish());
        botonGuardar.setOnClickListener(vista -> pulsarGuardar());
        botonCambiarContrasena.setOnClickListener(vista -> pulsarCambiarContrasena());

        cargarDatos();
    }

    // -----------------------------------------------------------------------
    // cargarDatos() -->
    // What it does: asks GET /usuarioActual and writes the data in the fields.
    //               Until then, «Guardar cambios» is disabled.
    // -----------------------------------------------------------------------
    private void cargarDatos() {
        botonGuardar.setEnabled(false);
        new LogicaFakePerfil().obtenerUsuario(Sesion.token(this), new LogicaFakePerfil.RespuestaUsuario() {
            @Override
            public void usuarioObtenido(DatosUsuario datos) {
                campoNombre.setText(datos.nombre);
                campoApellidos.setText(datos.apellidos);
                campoCorreo.setText(datos.correo);
                botonGuardar.setEnabled(true);
            }

            @Override
            public void sesionCaducada() {
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                mostrarMensaje(errorDatos, mensaje);
            }
        });
    }

    // -----------------------------------------------------------------------
    // pulsarGuardar() -->
    // What it does: checks the name, surname and email; if they are right,
    //               sends them with POST /actualizarDatos.
    // -----------------------------------------------------------------------
    private void pulsarGuardar() {
        Map<String, String> errores = ValidadorEditarDatos.validarDatos(
                texto(campoNombre), texto(campoApellidos), texto(campoCorreo));
        marcar(campoNombre, errorNombre, errores.get(ValidadorRegistro.CAMPO_NOMBRE));
        marcar(campoApellidos, errorApellidos, errores.get(ValidadorRegistro.CAMPO_APELLIDOS));
        marcar(campoCorreo, errorCorreo, errores.get(ValidadorRegistro.CAMPO_CORREO));
        errorDatos.setVisibility(View.GONE);
        if (!errores.isEmpty()) {
            return;
        }

        botonGuardar.setEnabled(false);
        logica.actualizarDatos(Sesion.token(this), texto(campoNombre), texto(campoApellidos), texto(campoCorreo),
                new LogicaFakeEditarDatos.RespuestaDatos() {
                    @Override
                    public void datosGuardados(DatosUsuario datos) {
                        // Se vuelve al perfil, que ya enseña los datos nuevos
                        Sesion.cambiarDatos(EditarDatosActivity.this, datos.nombre, datos.correo);
                        finish();
                    }

                    @Override
                    public void correoYaRegistrado() {
                        botonGuardar.setEnabled(true);
                        marcar(campoCorreo, errorCorreo, LogicaFakeEditarDatos.MENSAJE_CORREO_YA_REGISTRADO);
                    }

                    @Override
                    public void sesionCaducada() {
                        cerrarSesion();
                    }

                    @Override
                    public void error(String mensaje) {
                        botonGuardar.setEnabled(true);
                        mostrarMensaje(errorDatos, mensaje);
                    }
                });
    }

    // -----------------------------------------------------------------------
    // pulsarCambiarContrasena() -->
    // What it does: checks the three password fields; if they are right, sends
    //               POST /cambiarContrasenya. The server gives a new session
    //               (the old one stops working), which is saved.
    // -----------------------------------------------------------------------
    private void pulsarCambiarContrasena() {
        String actual = campoActual.getText().toString();
        String nueva = campoNueva.getText().toString();
        Map<String, String> errores = ValidadorEditarDatos.validarContrasena(
                actual, nueva, campoRepetida.getText().toString());
        marcar(campoActual, errorActual, errores.get(ValidadorEditarDatos.CAMPO_ACTUAL));
        marcar(campoNueva, errorNueva, errores.get(ValidadorEditarDatos.CAMPO_NUEVA));
        marcar(campoRepetida, errorRepetida, errores.get(ValidadorEditarDatos.CAMPO_REPETIDA));
        errorContrasena.setVisibility(View.GONE);
        avisoContrasena.setVisibility(View.GONE);
        if (!errores.isEmpty()) {
            return;
        }

        botonCambiarContrasena.setEnabled(false);
        logica.cambiarContrasena(Sesion.token(this), actual, nueva,
                new LogicaFakeEditarDatos.RespuestaContrasena() {
                    @Override
                    public void contrasenaCambiada(DatosSesion datos) {
                        Sesion.iniciar(EditarDatosActivity.this, Sesion.correoActual(EditarDatosActivity.this), datos);
                        campoActual.setText("");
                        campoNueva.setText("");
                        campoRepetida.setText("");
                        botonCambiarContrasena.setEnabled(true);
                        avisoContrasena.setVisibility(View.VISIBLE);
                    }

                    @Override
                    public void contrasenaActualIncorrecta() {
                        botonCambiarContrasena.setEnabled(true);
                        campoActual.setText("");
                        marcar(campoActual, errorActual, LogicaFakeEditarDatos.MENSAJE_CONTRASENA_INCORRECTA);
                    }

                    @Override
                    public void sesionCaducada() {
                        cerrarSesion();
                    }

                    @Override
                    public void error(String mensaje) {
                        botonCambiarContrasena.setEnabled(true);
                        mostrarMensaje(errorContrasena, mensaje);
                    }
                });
    }

    // -----------------------------------------------------------------------
    // campo: EditText, etiquetaError: TextView, mensaje: Text | null --> marcar() -->
    // What it does: with a message, red border and the message under the
    //               field; with null, normal border and no message.
    // -----------------------------------------------------------------------
    private void marcar(EditText campo, TextView etiquetaError, String mensaje) {
        if (mensaje == null) {
            campo.setBackgroundResource(R.drawable.fondo_campo);
            etiquetaError.setVisibility(View.GONE);
        } else {
            campo.setBackgroundResource(R.drawable.fondo_campo_error);
            mostrarMensaje(etiquetaError, mensaje);
        }
    }

    private static void mostrarMensaje(TextView etiqueta, String mensaje) {
        etiqueta.setText(mensaje);
        etiqueta.setVisibility(View.VISIBLE);
    }

    // -----------------------------------------------------------------------
    // cerrarSesion() -->
    // What it does: the session is no longer valid: forgets it and goes back
    //               to the welcome screen.
    // -----------------------------------------------------------------------
    private void cerrarSesion() {
        Sesion.cerrar(this);
        Intent intent = new Intent(this, BienvenidaActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }

    private static String texto(EditText campo) {
        return campo.getText().toString();
    }
}
