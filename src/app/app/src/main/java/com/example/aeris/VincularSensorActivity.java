// ---------------------------------------------------------------------------
// Fichero:     VincularSensorActivity.java
// Descripción: Pantalla «Vincular sensor» (Figma: «vincular sensor»). Se abre
//              tras el registro y desde «Mi sensor» del perfil (si el usuario
//              no tiene sensor). «Escanear código» abre la cámara (escáner de
//              Google, sin pedir el permiso de cámara) y lee el código de la
//              etiqueta del sensor (CodigoSensor). Si la cámara no funciona,
//              «¿No funciona la cámara? Escribe el código» deja escribir el
//              número de serie y la sensibilidad. Después se enseña el sensor
//              con el botón «Vincular». Al pulsarlo se pide la vinculación
//              (LogicaFakeVincular) y el servidor envía un correo a quien
//              compró el sensor: la pantalla espera a que lo confirme
//              («Esperando la confirmación») o enseña si lo ha rechazado.
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
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

import java.time.ZoneId;

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
    private EditText campoCodigo;
    private TextView errorCodigo;
    private TextView textoNumeroSerie;
    private TextView textoDetalleSensor;
    private TextView errorVincular;
    private View botonVincular;
    private TextView textoVincular;
    private View tarjetaEsperando;
    private View tarjetaRechazada;
    private TextView textoEsperando;
    private TextView textoPasoEscaneado;
    private TextView textoPasoCorreo;
    private TextView textoReenviado;
    private final LogicaFakeVincular logica = new LogicaFakeVincular();
    private boolean desdePerfil;
    private CodigoSensor sensorLeido;   // null hasta que se escanea un código válido

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: finds the views and connects «Escanear código», the
    //               link to write the code by hand, «Continuar», «Vincular»,
    //               «Escanear otro código», «Reenviar correo», «Escanear de
    //               nuevo», the «Necesito ayuda» links and the back button,
    //               and asks if there was already a request. After the
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
        campoCodigo = findViewById(R.id.campoCodigo);
        errorCodigo = findViewById(R.id.errorCodigo);
        botonVincular = findViewById(R.id.botonVincular);
        textoVincular = findViewById(R.id.textoVincular);
        tarjetaEsperando = findViewById(R.id.tarjetaEsperando);
        tarjetaRechazada = findViewById(R.id.tarjetaRechazada);
        textoEsperando = findViewById(R.id.textoEsperando);
        textoPasoEscaneado = findViewById(R.id.textoPasoEscaneado);
        textoPasoCorreo = findViewById(R.id.textoPasoCorreo);
        textoReenviado = findViewById(R.id.textoReenviado);
        desdePerfil = getIntent().getBooleanExtra(EXTRA_DESDE_PERFIL, false);

        botonEscanear.setOnClickListener(vista -> escanear());
        findViewById(R.id.enlaceEscanearOtro).setOnClickListener(vista -> escanear());
        findViewById(R.id.enlaceAMano).setOnClickListener(vista -> mostrarSolo(tarjetaAMano));
        findViewById(R.id.enlaceVolverEscanear).setOnClickListener(vista -> mostrarSolo(tarjetaEscanear));
        findViewById(R.id.botonContinuar).setOnClickListener(vista -> pulsarContinuar());
        TeclaEnter.pulsaBoton(campoCodigo, findViewById(R.id.botonContinuar));
        botonVincular.setOnClickListener(vista -> pulsarVincular());
        findViewById(R.id.botonReenviar).setOnClickListener(vista -> reenviarCorreo());
        findViewById(R.id.botonEscanearDeNuevo).setOnClickListener(vista -> escanear());
        findViewById(R.id.enlaceAyudaEsperando).setOnClickListener(vista -> abrirAyuda());
        findViewById(R.id.enlaceAyudaRechazada).setOnClickListener(vista -> abrirAyuda());
        findViewById(R.id.botonVolver).setOnClickListener(vista -> salir());
        // Después del registro se puede seguir sin sensor y vincularlo luego
        // desde Inicio o Perfil (no está en Figma; para probar sin sensor)
        View enlaceMasTarde = findViewById(R.id.enlaceMasTarde);
        enlaceMasTarde.setVisibility(desdePerfil ? View.GONE : View.VISIBLE);
        enlaceMasTarde.setOnClickListener(vista -> salir());

        // Si ya había pedido la vinculación, se enseña en qué estado está
        logica.consultarEstado(Sesion.token(this), respuestaSolicitud(false));
    }

    // -----------------------------------------------------------------------
    // onResume() -->       (lo llama Android al volver a la pantalla)
    // What it does: while «Esperando la confirmación» is shown, asks again
    //               in which state the request is, so that when the user
    //               comes back after the e-mail was confirmed (or rejected)
    //               the screen shows it. (Not in the other cards: the code
    //               scanner also pauses this screen.)
    // -----------------------------------------------------------------------
    @Override
    protected void onResume() {
        super.onResume();
        if (tarjetaEsperando.getVisibility() == View.VISIBLE) {
            logica.consultarEstado(Sesion.token(this), respuestaSolicitud(false));
        }
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
    // What it does: reads the line written by hand like the scanned code
    //               («092021010920 110406 03 2109 -44.75»: serial, model, gas,
    //               date and sensitivity); if it is right, shows the sensor
    //               card; if not, the error below the field.
    // -----------------------------------------------------------------------
    private void pulsarContinuar() {
        CodigoSensor codigo = CodigoSensor.desdeTexto(campoCodigo.getText().toString());
        marcar(campoCodigo, errorCodigo, codigo != null ? null : getString(R.string.vincular_error_codigo_a_mano));
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
    // What it does: shows that card (scan, by hand, sensor, waiting or
    //               rejected) and hides the others. The text below the title
    //               goes back to «Escanea con la cámara…» in the first three.
    // -----------------------------------------------------------------------
    private void mostrarSolo(View tarjeta) {
        tarjetaEscanear.setVisibility(tarjeta == tarjetaEscanear ? View.VISIBLE : View.GONE);
        tarjetaAMano.setVisibility(tarjeta == tarjetaAMano ? View.VISIBLE : View.GONE);
        tarjetaSensor.setVisibility(tarjeta == tarjetaSensor ? View.VISIBLE : View.GONE);
        tarjetaEsperando.setVisibility(tarjeta == tarjetaEsperando ? View.VISIBLE : View.GONE);
        tarjetaRechazada.setVisibility(tarjeta == tarjetaRechazada ? View.VISIBLE : View.GONE);
        if (tarjeta != tarjetaEsperando && tarjeta != tarjetaRechazada) {
            textoVincular.setText(R.string.vincular_texto);
        }
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
    // What it does: asks to link sensorLeido (serial and sensitivity). The
    //               server sends the e-mail to whoever bought the sensor and
    //               the screen shows «Esperando la confirmación». If it fails,
    //               the error is shown below the button.
    // -----------------------------------------------------------------------
    private void pulsarVincular() {
        if (sensorLeido == null) {
            return;
        }
        botonVincular.setEnabled(false);
        errorVincular.setVisibility(View.GONE);
        logica.solicitarVinculacion(Sesion.token(this), sensorLeido, respuestaSolicitud(true));
    }

    // -----------------------------------------------------------------------
    // alPedirla: B --> respuestaSolicitud() --x
    // RespuestaSolicitud <--
    // What it does: what to do with the answer about the request. Errors
    //               are only shown below «Vincular» when the user pressed it
    //               (alPedirla); when asking the state in onResume they are
    //               ignored.
    // -----------------------------------------------------------------------
    private LogicaFakeVincular.RespuestaSolicitud respuestaSolicitud(final boolean alPedirla) {
        return new LogicaFakeVincular.RespuestaSolicitud() {
            @Override
            public void solicitudObtenida(SolicitudVinculacion solicitud) {
                botonVincular.setEnabled(true);
                mostrarSolicitud(solicitud);
            }

            @Override
            public void sinSolicitud() {
                botonVincular.setEnabled(true);
            }

            @Override
            public void sesionCaducada() {
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                botonVincular.setEnabled(true);
                if (alPedirla) {
                    errorVincular.setText(mensaje);
                    errorVincular.setVisibility(View.VISIBLE);
                }
            }
        };
    }

    // -----------------------------------------------------------------------
    // solicitud: SolicitudVinculacion --> mostrarSolicitud() -->
    // What it does: pending -> «Esperando la confirmación» with the hidden
    //               e-mail, the serial and when it was scanned; confirmed ->
    //               «¡Sensor vinculado!» and salir(); rejected -> «Vinculación
    //               rechazada».
    // -----------------------------------------------------------------------
    private void mostrarSolicitud(SolicitudVinculacion solicitud) {
        switch (solicitud.estado) {
            case PENDIENTE:
                textoVincular.setText(R.string.vincular_texto_esperando);
                textoEsperando.setText(getString(R.string.vincular_esperando_texto,
                        solicitud.correoComprador, solicitud.numeroSerie));
                textoPasoEscaneado.setText(getString(R.string.vincular_paso_escaneado_detalle,
                        solicitud.numeroSerie, SolicitudVinculacion.cuando(solicitud.momento,
                                System.currentTimeMillis(), ZoneId.systemDefault())));
                textoPasoCorreo.setText(getString(R.string.vincular_paso_correo_detalle,
                        solicitud.correoComprador));
                mostrarSolo(tarjetaEsperando);
                break;
            case CONFIRMADA:
                Toast.makeText(this, R.string.vincular_confirmada, Toast.LENGTH_SHORT).show();
                salir();
                break;
            case RECHAZADA:
                textoVincular.setText(getString(R.string.vincular_texto_rechazada, solicitud.numeroSerie));
                mostrarSolo(tarjetaRechazada);
                break;
        }
    }

    // -----------------------------------------------------------------------
    // reenviarCorreo() -->
    // What it does: asks to send the confirmation e-mail again and says
    //               below the button whether it worked.
    // -----------------------------------------------------------------------
    private void reenviarCorreo() {
        logica.reenviarCorreo(Sesion.token(this), new LogicaFakeVincular.RespuestaReenvio() {
            @Override
            public void correoReenviado() {
                textoReenviado.setText(R.string.vincular_reenviado);
                textoReenviado.setVisibility(View.VISIBLE);
            }

            @Override
            public void error(String mensaje) {
                textoReenviado.setText(mensaje);
                textoReenviado.setVisibility(View.VISIBLE);
            }
        });
    }

    // -----------------------------------------------------------------------
    // abrirAyuda() -->
    // What it does: opens Ayuda. Until the Ayuda screen exists (T043) it is
    //               the «Próximamente» screen.
    // -----------------------------------------------------------------------
    private void abrirAyuda() {
        startActivity(ProximamenteActivity.intentPara(this, ProximamenteActivity.Seccion.AYUDA));
    }

    private void cerrarSesion() {
        Sesion.cerrar(this);
        Intent intent = new Intent(this, BienvenidaActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
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
