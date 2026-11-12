// ---------------------------------------------------------------------------
// Fichero:     VincularSensorActivity.java
// Descripción: Pantalla «Vincular sensor» (Figma: «vincular sensor»). Se abre
//              tras el registro y desde «Mi sensor» del perfil (si el usuario
//              no tiene sensor). «Escanear código» abre la cámara (escáner de
//              Google, sin pedir el permiso de cámara) y lee el código de la
//              etiqueta del sensor (CodigoSensor). Si la cámara no funciona,
//              «¿No funciona la cámara? Escribe el código» deja escribir el
//              número de serie y la sensibilidad. Después se enseña el sensor
//              con el botón «Vincular». La petición al servidor es de
//              T005/T017: está marcada con «T005» en pulsarVincular().
//              Diseño en doc/app_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       05/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

// VincularSensorActivity class: the «Vincular sensor» screen.
public class VincularSensorActivity extends AppCompatActivity {

    // Extra del Intent: true si se abre desde el perfil (al acabar se vuelve
    // al perfil en vez de abrir el inicio)
    public static final String EXTRA_DESDE_PERFIL = "desdePerfil";

    private View botonEscanear;
    private TextView errorEscaneo;
    private View tarjetaEscanear;
    private View tarjetaSensor;
    private View tarjetaAMano;
    private EditText campoNumeroSerie, campoSensibilidad;
    private TextView errorNumeroSerie, errorSensibilidad;
    private TextView textoNumeroSerie;
    private TextView textoDetalleSensor;
    private TextView errorVincular;
    private boolean desdePerfil;
    private CodigoSensor sensorLeido;   // null hasta que se escanea un código válido

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: finds the views and connects «Escanear código», the
    //               link to write the code by hand, «Continuar», «Vincular»,
    //               «Escanear otro código» and the back button. After the
    //               sign-up, back opens the home screen; from the profile, it
    //               returns to the profile.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_vincular_sensor);

        botonEscanear = findViewById(R.id.botonEscanear);
        errorEscaneo = findViewById(R.id.errorEscaneo);
        tarjetaEscanear = findViewById(R.id.tarjetaEscanear);
        tarjetaSensor = findViewById(R.id.tarjetaSensor);
        textoNumeroSerie = findViewById(R.id.textoNumeroSerie);
        textoDetalleSensor = findViewById(R.id.textoDetalleSensor);
        errorVincular = findViewById(R.id.errorVincular);
        tarjetaAMano = findViewById(R.id.tarjetaAMano);
        campoNumeroSerie = findViewById(R.id.campoNumeroSerie);
        campoSensibilidad = findViewById(R.id.campoSensibilidad);
        errorNumeroSerie = findViewById(R.id.errorNumeroSerie);
        errorSensibilidad = findViewById(R.id.errorSensibilidad);
        desdePerfil = getIntent().getBooleanExtra(EXTRA_DESDE_PERFIL, false);

        botonEscanear.setOnClickListener(vista -> escanear());
        findViewById(R.id.enlaceEscanearOtro).setOnClickListener(vista -> escanear());
        findViewById(R.id.enlaceAMano).setOnClickListener(vista -> mostrarSolo(tarjetaAMano));
        findViewById(R.id.enlaceVolverEscanear).setOnClickListener(vista -> mostrarSolo(tarjetaEscanear));
        findViewById(R.id.botonContinuar).setOnClickListener(vista -> pulsarContinuar());
        TeclaEnter.pulsaBoton(campoSensibilidad, findViewById(R.id.botonContinuar));
        findViewById(R.id.botonVincular).setOnClickListener(vista -> pulsarVincular());
        findViewById(R.id.botonVolver).setOnClickListener(vista -> salir());
        // Después del registro se puede seguir sin sensor y vincularlo luego
        // desde Inicio o Perfil (no está en Figma; para probar sin sensor)
        View enlaceMasTarde = findViewById(R.id.enlaceMasTarde);
        enlaceMasTarde.setVisibility(desdePerfil ? View.GONE : View.VISIBLE);
        enlaceMasTarde.setOnClickListener(vista -> salir());
    }

    // -----------------------------------------------------------------------
    // escanear() -->
    // What it does: opens Google's code scanner (DataMatrix, the code of the
    //               sensor label, or QR). If the user closes it, nothing
    //               happens; if it cannot open, the error is shown below the
    //               button.
    // -----------------------------------------------------------------------
    private void escanear() {
        errorEscaneo.setVisibility(View.GONE);
        GmsBarcodeScannerOptions opciones = new GmsBarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_DATA_MATRIX, Barcode.FORMAT_QR_CODE)
                .build();
        GmsBarcodeScanner escaner = GmsBarcodeScanning.getClient(this, opciones);
        escaner.startScan()
                .addOnSuccessListener(codigo -> codigoLeido(codigo.getRawValue()))
                .addOnFailureListener(error -> mostrarErrorEscaneo(getString(R.string.vincular_error_camara)));
    }

    // -----------------------------------------------------------------------
    // texto: Text --> codigoLeido() -->
    // What it does: if the text is the code of a sensor label, shows the
    //               sensor card; if not, says so below «Escanear código».
    // -----------------------------------------------------------------------
    private void codigoLeido(String texto) {
        CodigoSensor codigo = CodigoSensor.desdeTexto(texto);
        if (codigo == null) {
            mostrarErrorEscaneo(getString(R.string.vincular_error_codigo));
            return;
        }
        mostrarSensor(codigo);
    }

    // -----------------------------------------------------------------------
    // pulsarContinuar() -->
    // What it does: checks the two fields written by hand (12-digit serial,
    //               sensitivity a number); if they are right, shows the sensor
    //               card; if not, the error below each wrong field.
    // -----------------------------------------------------------------------
    private void pulsarContinuar() {
        String serie = campoNumeroSerie.getText().toString();
        String sensibilidad = campoSensibilidad.getText().toString();
        marcar(campoNumeroSerie, errorNumeroSerie, CodigoSensor.esNumeroSerieValido(serie)
                ? null : getString(R.string.vincular_error_numero_serie));
        marcar(campoSensibilidad, errorSensibilidad, CodigoSensor.leerSensibilidad(sensibilidad) != null
                ? null : getString(R.string.vincular_error_sensibilidad));
        CodigoSensor codigo = CodigoSensor.desdeCampos(serie, sensibilidad);
        if (codigo != null) {
            mostrarSensor(codigo);
        }
    }

    // -----------------------------------------------------------------------
    // codigo: CodigoSensor --> mostrarSensor() -->
    // What it does: keeps the sensor and shows only the «Sensor leído» card.
    // -----------------------------------------------------------------------
    private void mostrarSensor(CodigoSensor codigo) {
        sensorLeido = codigo;
        textoNumeroSerie.setText(codigo.numeroSerie);
        textoDetalleSensor.setText(detalle(codigo));
        errorVincular.setVisibility(View.GONE);
        mostrarSolo(tarjetaSensor);
    }

    // -----------------------------------------------------------------------
    // tarjeta: View --> mostrarSolo() -->
    // What it does: shows that card (scan, by hand or sensor) and hides the others.
    // -----------------------------------------------------------------------
    private void mostrarSolo(View tarjeta) {
        tarjetaEscanear.setVisibility(tarjeta == tarjetaEscanear ? View.VISIBLE : View.GONE);
        tarjetaAMano.setVisibility(tarjeta == tarjetaAMano ? View.VISIBLE : View.GONE);
        tarjetaSensor.setVisibility(tarjeta == tarjetaSensor ? View.VISIBLE : View.GONE);
    }

    private void marcar(EditText campo, TextView etiquetaError, String mensaje) {
        campo.setBackgroundResource(mensaje == null ? R.drawable.fondo_campo : R.drawable.fondo_campo_error);
        etiquetaError.setText(mensaje);
        etiquetaError.setVisibility(mensaje == null ? View.GONE : View.VISIBLE);
    }

    // -----------------------------------------------------------------------
    // codigo: CodigoSensor --> detalle() --x
    // Text <--
    // What it does: e.g. "Sensor de ozono (O₃) · fabricado en 09/2021". Written
    //               by hand there is no gas or date: "Sensor de ozono (O₃)".
    // -----------------------------------------------------------------------
    private String detalle(CodigoSensor codigo) {
        if (codigo.fecha.isEmpty()) {
            return getString(R.string.vincular_sensor_ozono);
        }
        String gas = "03".equals(codigo.gas)
                ? getString(R.string.vincular_sensor_ozono)
                : getString(R.string.vincular_sensor_gas, codigo.gas);
        String fecha = codigo.fecha.substring(2) + "/20" + codigo.fecha.substring(0, 2);
        return getString(R.string.vincular_detalle, gas, fecha);
    }

    private void mostrarErrorEscaneo(String mensaje) {
        // Vuelve al paso 1 con el mensaje debajo del botón
        mostrarSolo(tarjetaEscanear);
        errorEscaneo.setText(mensaje);
        errorEscaneo.setVisibility(View.VISIBLE);
    }

    // -----------------------------------------------------------------------
    // pulsarVincular() -->
    // What it does: T005/T017: sends sensorLeido (serial and sensitivity) to
    //               the server to link it to the user's account and, if it
    //               works, calls salir(). The server part does not exist yet.
    // -----------------------------------------------------------------------
    private void pulsarVincular() {
        if (sensorLeido == null) {
            return;
        }
        // T005/T017: petición al servidor (POST /vincularSensor) con
        // sensorLeido.numeroSerie y sensorLeido.sensibilidad; si va bien, salir()
    }

    // -----------------------------------------------------------------------
    // salir() -->
    // What it does: from the profile, closes this screen (the profile is
    //               underneath and reloads its data); after the sign-up,
    //               opens the home screen.
    // -----------------------------------------------------------------------
    private void salir() {
        if (!desdePerfil) {
            startActivity(new Intent(this, InicioActivity.class));
        }
        finish();
    }
}
