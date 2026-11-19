// ---------------------------------------------------------------------------
// Fichero:     MisDatosActivity.java
// Descripción: Pantalla diaria de distancia, calidad media y ozono (T007).
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

public class MisDatosActivity extends AppCompatActivity {

    private final LogicaFakeMisDatos logica = new LogicaFakeMisDatos();

    private ProgressBar progreso;
    private View contenido;
    private View sinSensor;
    private View errorPanel;
    private TextView fecha;
    private TextView distancia;
    private TextView calidadMedia;
    private TextView avisoSinMediciones;
    private TextView error;
    private GraficaDatosDiariosView grafica;
    private long inicioDiaMs;
    private long finDiaMs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mis_datos);
        BarraNavegacion.conectar(this, BarraNavegacion.Pestanya.MIS_DATOS);

        progreso = findViewById(R.id.progresoMisDatos);
        contenido = findViewById(R.id.contenidoMisDatos);
        sinSensor = findViewById(R.id.sinSensorMisDatos);
        errorPanel = findViewById(R.id.errorPanelMisDatos);
        fecha = findViewById(R.id.fechaMisDatos);
        distancia = findViewById(R.id.valorDistanciaMisDatos);
        calidadMedia = findViewById(R.id.valorCalidadMediaMisDatos);
        avisoSinMediciones = findViewById(R.id.avisoSinMedicionesMisDatos);
        error = findViewById(R.id.errorMisDatos);
        grafica = findViewById(R.id.graficaMisDatos);

        findViewById(R.id.botonReintentarMisDatos).setOnClickListener(v -> cargarDatos());
        findViewById(R.id.botonVincularMisDatos).setOnClickListener(v ->
                startActivity(new Intent(this, VincularSensorActivity.class)
                        .putExtra(VincularSensorActivity.EXTRA_DESDE_PERFIL, true)));
    }

    @Override
    protected void onResume() {
        super.onResume();
        cargarDatos();
    }

    private void cargarDatos() {
        String token = Sesion.token(this);
        if (token == null) {
            cerrarSesion();
            return;
        }

        ZoneId zona = ZoneId.systemDefault();
        LocalDate hoy = LocalDate.now(zona);
        inicioDiaMs = hoy.atStartOfDay(zona).toInstant().toEpochMilli();
        finDiaMs = hoy.plusDays(1).atStartOfDay(zona).toInstant().toEpochMilli();
        fecha.setText(getString(R.string.mis_datos_fecha,
                hoy.format(DateTimeFormatter.ofPattern("EEEE d 'de' MMMM", new Locale("es", "ES")))));
        progreso.setVisibility(View.VISIBLE);
        contenido.setVisibility(View.GONE);
        sinSensor.setVisibility(View.GONE);
        errorPanel.setVisibility(View.GONE);

        logica.obtenerDatos(token, inicioDiaMs, finDiaMs, new LogicaFakeMisDatos.Respuesta() {
            @Override
            public void datosObtenidos(List<MedicionDiaria> mediciones) {
                runOnUiThread(() -> mostrarDatos(mediciones));
            }

            @Override
            public void sinSensor() {
                runOnUiThread(() -> {
                    progreso.setVisibility(View.GONE);
                    sinSensor.setVisibility(View.VISIBLE);
                });
            }

            @Override
            public void sesionCaducada() {
                runOnUiThread(MisDatosActivity.this::cerrarSesion);
            }

            @Override
            public void error(String mensaje) {
                runOnUiThread(() -> {
                    progreso.setVisibility(View.GONE);
                    error.setText(mensaje);
                    errorPanel.setVisibility(View.VISIBLE);
                });
            }
        });
    }

    private void mostrarDatos(List<MedicionDiaria> mediciones) {
        progreso.setVisibility(View.GONE);
        contenido.setVisibility(View.VISIBLE);
        ResumenMisDatos resumen = ResumenMisDatos.calcular(mediciones);
        boolean hayMediciones = !resumen.mediciones.isEmpty();

        distancia.setText(hayMediciones
                ? String.format(new Locale("es", "ES"), "%.1f km", resumen.distanciaKm)
                : getString(R.string.mis_datos_sin_datos));
        if (resumen.nivelMedio == null) {
            calidadMedia.setText(R.string.mis_datos_sin_datos);
            calidadMedia.setTextColor(getColor(R.color.texto_secundario));
        } else {
            calidadMedia.setText(nombreNivel(resumen.nivelMedio));
            calidadMedia.setTextColor(getColor(colorNivel(resumen.nivelMedio)));
        }
        avisoSinMediciones.setVisibility(hayMediciones ? View.GONE : View.VISIBLE);
        grafica.mostrar(resumen.mediciones, inicioDiaMs, finDiaMs);
    }

    private static int nombreNivel(NivelOzono nivel) {
        switch (nivel) {
            case BUENO:
                return R.string.inicio_calidad_buena;
            case MODERADO:
                return R.string.inicio_calidad_moderada;
            case MALO:
                return R.string.inicio_calidad_mala;
            case MUY_MALO:
                return R.string.inicio_calidad_muy_mala;
            default:
                throw new IllegalArgumentException("Nivel de ozono desconocido");
        }
    }

    private static int colorNivel(NivelOzono nivel) {
        switch (nivel) {
            case BUENO:
                return R.color.nivel_bueno;
            case MODERADO:
                return R.color.nivel_moderado;
            case MALO:
                return R.color.nivel_malo;
            case MUY_MALO:
                return R.color.nivel_muy_malo;
            default:
                throw new IllegalArgumentException("Nivel de ozono desconocido");
        }
    }

    private void cerrarSesion() {
        Sesion.cerrar(this);
        Intent intent = new Intent(this, BienvenidaActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }
}
