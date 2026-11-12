// ---------------------------------------------------------------------------
// Fichero:     MiSensorActivity.java
// Descripción: Pantalla «Mi sensor» (T011). Muestra el estado del sensor
//              vinculado (identificador, conexión, nivel de batería, última
//              sincronización), control de luz LED y opción de desvincular.
//              Diseño en doc/app_design.md. Tarea T011.
// Autores:     Equipo 04 – SenseTech
// Fecha:       11/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.materialswitch.MaterialSwitch;

// MiSensorActivity class: shows sensor status, light toggle and unbinding.
public class MiSensorActivity extends AppCompatActivity {

    private TextView textoIdentificador;
    private TextView textoEstadoConexion;
    private TextView textoBateria;
    private TextView textoUltimaSincronizacion;
    private MaterialSwitch interruptorLuz;
    private TextView errorMiSensor;
    private Button botonDesvincular;

    private LogicaFakeMiSensor logica;

    // -----------------------------------------------------------------------
    // savedInstanceState: Bundle --> onCreate() -->
    // What it does: sets up the view, connects the back button, light switch,
    //               unbind button and loads the sensor state.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mi_sensor);

        logica = new LogicaFakeMiSensor();

        ImageView botonVolver = findViewById(R.id.botonVolver);
        textoIdentificador = findViewById(R.id.textoIdentificador);
        textoEstadoConexion = findViewById(R.id.textoEstadoConexion);
        textoBateria = findViewById(R.id.textoBateria);
        textoUltimaSincronizacion = findViewById(R.id.textoUltimaSincronizacion);
        interruptorLuz = findViewById(R.id.interruptorLuz);
        errorMiSensor = findViewById(R.id.errorMiSensor);
        botonDesvincular = findViewById(R.id.botonDesvincular);

        botonVolver.setOnClickListener(v -> finish());

        interruptorLuz.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (buttonView.isPressed()) {
                cambiarLuz(isChecked);
            }
        });

        botonDesvincular.setOnClickListener(v -> confirmarDesvinculacion());

        cargarEstado();
    }

    // -----------------------------------------------------------------------
    // cargarEstado() -->
    // What it does: fetches the sensor status using the session token and updates
    //               the screen elements.
    // -----------------------------------------------------------------------
    private void cargarEstado() {
        String token = Sesion.token(this);
        logica.obtenerEstadoSensor(token, new LogicaFakeMiSensor.RespuestaSensor() {
            @Override
            public void sensorObtenido(DatosSensor datos) {
                mostrarEstado(datos);
            }

            @Override
            public void sinSensor() {
                mostrarSinSensor();
            }

            @Override
            public void sesionCaducada() {
                abrirBienvenidaSesionCaducada();
            }

            @Override
            public void error(String mensaje) {
                mostrarError(mensaje);
            }
        });
    }

    // -----------------------------------------------------------------------
    // datos: DatosSensor --> mostrarEstado() -->
    // What it does: updates UI fields with the received sensor data.
    // -----------------------------------------------------------------------
    private void mostrarEstado(DatosSensor datos) {
        errorMiSensor.setVisibility(View.GONE);
        textoIdentificador.setText(datos.idSensor);
        textoEstadoConexion.setText(datos.textoConexion());
        textoEstadoConexion.setTextColor(getColor(datos.conectado ? R.color.verde_ok : R.color.texto_secundario));
        textoBateria.setText(datos.textoBateria());
        textoUltimaSincronizacion.setText(datos.textoUltimaSincronizacion());

        interruptorLuz.setChecked(datos.luz);
    }

    // -----------------------------------------------------------------------
    // encendida: B --> cambiarLuz() -->
    // What it does: requests the fake logic / server to turn the LED light on/off.
    // -----------------------------------------------------------------------
    private void cambiarLuz(boolean encendida) {
        String token = Sesion.token(this);
        interruptorLuz.setEnabled(false);
        errorMiSensor.setVisibility(View.GONE);

        logica.cambiarLuz(token, encendida, new LogicaFakeMiSensor.RespuestaLuz() {
            @Override
            public void luzCambiada(boolean encendidaActual) {
                interruptorLuz.setEnabled(true);
                interruptorLuz.setChecked(encendidaActual);
            }

            @Override
            public void sesionCaducada() {
                interruptorLuz.setEnabled(true);
                abrirBienvenidaSesionCaducada();
            }

            @Override
            public void error(String mensaje) {
                interruptorLuz.setEnabled(true);
                interruptorLuz.setChecked(!encendida);
                mostrarError(mensaje);
            }
        });
    }

    // -----------------------------------------------------------------------
    // confirmarDesvinculacion() -->
    // What it does: shows an alert dialog to confirm unlinking the sensor.
    // -----------------------------------------------------------------------
    private void confirmarDesvinculacion() {
        new AlertDialog.Builder(this)
                .setTitle(R.string.mi_sensor_desvincular_dialogo_titulo)
                .setMessage(R.string.mi_sensor_desvincular_dialogo_mensaje)
                .setPositiveButton(R.string.mi_sensor_desvincular_confirmar, (dialog, which) -> desvincular())
                .setNegativeButton(R.string.mi_sensor_cancelar, null)
                .show();
    }

    // -----------------------------------------------------------------------
    // desvincular() -->
    // What it does: requests unlinking the sensor and closes the screen on success.
    // -----------------------------------------------------------------------
    private void desvincular() {
        String token = Sesion.token(this);
        botonDesvincular.setEnabled(false);
        errorMiSensor.setVisibility(View.GONE);

        logica.desvincularSensor(token, new LogicaFakeMiSensor.RespuestaDesvincular() {
            @Override
            public void sensorDesvinculado() {
                botonDesvincular.setEnabled(true);
                finish();
            }

            @Override
            public void sesionCaducada() {
                botonDesvincular.setEnabled(true);
                abrirBienvenidaSesionCaducada();
            }

            @Override
            public void error(String mensaje) {
                botonDesvincular.setEnabled(true);
                mostrarError(mensaje);
            }
        });
    }

    // -----------------------------------------------------------------------
    // mostrarSinSensor() -->
    // What it does: updates UI when no sensor is linked.
    // -----------------------------------------------------------------------
    private void mostrarSinSensor() {
        mostrarError(getString(R.string.mi_sensor_sin_sensor));
        botonDesvincular.setEnabled(false);
        interruptorLuz.setEnabled(false);
    }

    // -----------------------------------------------------------------------
    // mensaje: Text --> mostrarError() -->
    // What it does: shows the error text on the screen.
    // -----------------------------------------------------------------------
    private void mostrarError(String mensaje) {
        errorMiSensor.setText(mensaje);
        errorMiSensor.setVisibility(View.VISIBLE);
    }

    // -----------------------------------------------------------------------
    // abrirBienvenidaSesionCaducada() -->
    // What it does: closes session and returns to BienvenidaActivity.
    // -----------------------------------------------------------------------
    private void abrirBienvenidaSesionCaducada() {
        Sesion.cerrar(this);
        Intent intent = new Intent(this, BienvenidaActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }
}
