// ---------------------------------------------------------------------------
// Fichero:     MiSensorActivity.java
// Descripción: Pantalla «Mi sensor» (T011): estado, número de serie,
//              batería y última conexión del sensor vinculado, la luz de
//              aviso y desvincularlo. La luz de aviso (H033) se cambia de
//              verdad en el sensor por Bluetooth (LuzSensor); el interruptor
//              solo se queda en la nueva posición si el sensor lo confirma.
//              Diseño en doc/app_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.materialswitch.MaterialSwitch;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MiSensorActivity extends AppCompatActivity {

    private static final String PREFERENCIAS = "mi_sensor";
    private static final String CLAVE_LUZ = "luz:";

    private final LogicaFakeMiSensor logica = new LogicaFakeMiSensor();

    private ProgressBar progreso;
    private View contenidoSensor;
    private View contenidoSinSensor;
    private TextView error;
    private TextView estadoConexion;
    private TextView valorNumeroSerie;
    private TextView valorBateria;
    private TextView valorUltimaConexion;
    private TextView textoEstadoLuz;
    private MaterialSwitch interruptorLuz;
    private View botonDesvincular;
    private SensorUsuario sensorActual;
    private LuzSensorSimulada luzSimulada;      // estado de la luz que ha confirmado el sensor
    private boolean luzPedida;                   // lo que se quiere poner mientras se pide el permiso

    // Android 12+: conectar con el sensor necesita el permiso BLUETOOTH_CONNECT
    private final ActivityResultLauncher<String> pedirPermisoConectar =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), concedido -> {
                if (concedido) {
                    enviarLuz(luzPedida);
                } else {
                    ponerInterruptor(!luzPedida);
                    Toast.makeText(this, R.string.mi_sensor_luz_sin_permiso, Toast.LENGTH_LONG).show();
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mi_sensor);

        progreso = findViewById(R.id.progresoMiSensor);
        contenidoSensor = findViewById(R.id.contenidoSensor);
        contenidoSinSensor = findViewById(R.id.contenidoSinSensor);
        error = findViewById(R.id.errorMiSensor);
        estadoConexion = findViewById(R.id.estadoConexionSensor);
        valorNumeroSerie = findViewById(R.id.valorNumeroSerie);
        valorBateria = findViewById(R.id.valorBateriaSensor);
        valorUltimaConexion = findViewById(R.id.valorUltimaConexion);
        textoEstadoLuz = findViewById(R.id.textoEstadoLuz);
        interruptorLuz = findViewById(R.id.interruptorLuzSensor);
        botonDesvincular = findViewById(R.id.botonDesvincularSensor);

        ((ImageView) findViewById(R.id.botonVolver)).setOnClickListener(v -> finish());
        botonDesvincular.setOnClickListener(v -> confirmarDesvinculacion());
        // Ayuda (T043): el formulario de incidencias se abre con «Sensor» elegido y este sensor a la vista
        findViewById(R.id.enlaceAyudaSensor).setOnClickListener(v -> startActivity(AyudaActivity.intentPara(this,
                Incidencia.TIPO_SENSOR,
                sensorActual == null ? null : sensorActual.nombre,
                sensorActual == null ? null : sensorActual.numeroSerie)));
        findViewById(R.id.botonVincularDesdeMiSensor).setOnClickListener(v ->
                startActivity(new Intent(this, VincularSensorActivity.class)
                        .putExtra(VincularSensorActivity.EXTRA_DESDE_PERFIL, true)));
        interruptorLuz.setOnCheckedChangeListener((boton, encendida) -> cambiarLuz(encendida));
    }

    @Override
    protected void onResume() {
        super.onResume();
        cargarSensor();
    }

    private void cargarSensor() {
        String token = Sesion.token(this);
        if (token == null) {
            cerrarSesion();
            return;
        }
        progreso.setVisibility(View.VISIBLE);
        contenidoSensor.setVisibility(View.GONE);
        contenidoSinSensor.setVisibility(View.GONE);
        error.setVisibility(View.GONE);
        logica.obtenerMiSensor(token, new LogicaFakeMiSensor.RespuestaSensor() {
            @Override
            public void sensorObtenido(SensorUsuario sensor) {
                progreso.setVisibility(View.GONE);
                sensorActual = sensor;
                mostrarSensor(sensor);
            }

            @Override
            public void sinSensor() {
                progreso.setVisibility(View.GONE);
                sensorActual = null;
                contenidoSensor.setVisibility(View.GONE);
                contenidoSinSensor.setVisibility(View.VISIBLE);
            }

            @Override
            public void sesionCaducada() {
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                progreso.setVisibility(View.GONE);
                mostrarError(mensaje);
            }
        });
    }

    private void mostrarSensor(SensorUsuario sensor) {
        contenidoSensor.setVisibility(View.VISIBLE);
        contenidoSinSensor.setVisibility(View.GONE);

        valorNumeroSerie.setText(sensor.numeroSerie);
        if (sensor.bateria == null) {
            valorBateria.setText(R.string.mi_sensor_bateria_no_disponible);
        } else {
            valorBateria.setText(getString(R.string.mi_sensor_bateria_formato, sensor.bateria));
        }
        if (sensor.ultimaConexionMs == null) {
            valorUltimaConexion.setText(R.string.mi_sensor_sin_sincronizacion);
        } else {
            valorUltimaConexion.setText(new SimpleDateFormat("dd/MM/yyyy · HH:mm", new Locale("es", "ES"))
                    .format(new Date(sensor.ultimaConexionMs)));
        }
        estadoConexion.setText(sensor.estaConectado(System.currentTimeMillis())
                ? R.string.mi_sensor_conectado
                : R.string.mi_sensor_desconectado);

        boolean luzEncendida = getSharedPreferences(PREFERENCIAS, MODE_PRIVATE)
                .getBoolean(CLAVE_LUZ + sensor.numeroSerie, false);
        luzSimulada = new LuzSensorSimulada(luzEncendida);
        interruptorLuz.setOnCheckedChangeListener(null);
        interruptorLuz.setChecked(luzEncendida);
        interruptorLuz.setOnCheckedChangeListener((boton, encendida) -> cambiarLuz(encendida));
        actualizarTextoLuz();
    }

    // -----------------------------------------------------------------------
    // encendida: B --> cambiarLuz() -->
    // What it does: the user moved the switch: asks for the Bluetooth
    //               permission if it is missing (Android 12+) and sends it
    //               to the sensor.
    // -----------------------------------------------------------------------
    private void cambiarLuz(boolean encendida) {
        if (sensorActual == null) {
            return;
        }
        if (Build.VERSION.SDK_INT >= 31 && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
                != PackageManager.PERMISSION_GRANTED) {
            luzPedida = encendida;
            pedirPermisoConectar.launch(Manifest.permission.BLUETOOTH_CONNECT);
            return;
        }
        enviarLuz(encendida);
    }

    // -----------------------------------------------------------------------
    // encendida: B --> enviarLuz() -->
    // What it does: «Cambiando…» while LuzSensor connects to the sensor and
    //               writes it. If it works, it is saved; if not, the switch
    //               goes back and the reason is shown.
    // -----------------------------------------------------------------------
    private void enviarLuz(boolean encendida) {
        interruptorLuz.setEnabled(false);
        textoEstadoLuz.setText(R.string.mi_sensor_luz_cambiando);
        LuzSensor.cambiar(this, encendida, new LuzSensor.Respuesta() {
            @Override
            public void cambiada() {
                if (isFinishing() || sensorActual == null) {
                    return;
                }
                interruptorLuz.setEnabled(true);
                if (luzSimulada == null) {
                    luzSimulada = new LuzSensorSimulada(false);
                }
                luzSimulada.establecer(encendida);
                getSharedPreferences(PREFERENCIAS, MODE_PRIVATE).edit()
                        .putBoolean(CLAVE_LUZ + sensorActual.numeroSerie, encendida).apply();
                actualizarTextoLuz();
            }

            @Override
            public void error(String mensaje) {
                if (isFinishing()) {
                    return;
                }
                interruptorLuz.setEnabled(true);
                ponerInterruptor(!encendida);
                actualizarTextoLuz();
                Toast.makeText(MiSensorActivity.this, mensaje, Toast.LENGTH_LONG).show();
            }
        });
    }

    // encendida: B --> ponerInterruptor() -->   (sin volver a llamar a cambiarLuz)
    private void ponerInterruptor(boolean encendida) {
        interruptorLuz.setOnCheckedChangeListener(null);
        interruptorLuz.setChecked(encendida);
        interruptorLuz.setOnCheckedChangeListener((boton, e) -> cambiarLuz(e));
    }

    private void actualizarTextoLuz() {
        if (luzSimulada != null) {
            textoEstadoLuz.setText(luzSimulada.estaEncendida()
                    ? R.string.mi_sensor_luz_encendida
                    : R.string.mi_sensor_luz_apagada);
        }
    }

    private void confirmarDesvinculacion() {
        new AlertDialog.Builder(this)
                .setTitle(R.string.mi_sensor_desvincular_titulo)
                .setMessage(R.string.mi_sensor_desvincular_confirmacion)
                .setNegativeButton(android.R.string.cancel, null)
                .setPositiveButton(R.string.mi_sensor_desvincular, (dialogo, posicion) ->
                        desvincularSensor())
                .show();
    }

    private void desvincularSensor() {
        botonDesvincular.setEnabled(false);
        logica.desvincularMiSensor(Sesion.token(this), new LogicaFakeMiSensor.RespuestaDesvinculacion() {
            @Override
            public void sensorDesvinculado() {
                if (sensorActual != null) {
                    getSharedPreferences(PREFERENCIAS, MODE_PRIVATE).edit()
                            .remove(CLAVE_LUZ + sensorActual.numeroSerie).apply();
                }
                if (luzSimulada != null) {
                    luzSimulada.desvincular();
                }
                botonDesvincular.setEnabled(true);
                cargarSensor();
            }

            @Override
            public void sesionCaducada() {
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                botonDesvincular.setEnabled(true);
                mostrarError(mensaje);
            }
        });
    }

    private void mostrarError(String mensaje) {
        error.setText(mensaje);
        error.setVisibility(View.VISIBLE);
    }

    private void cerrarSesion() {
        Sesion.cerrar(this);
        Intent intent = new Intent(this, BienvenidaActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }
}
