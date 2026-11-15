// ---------------------------------------------------------------------------
// Fichero:     MisDatosActivity.java
// Descripción: Pantalla «Mis datos» (T007). Muestra las métricas diarias del
//              usuario con sesión iniciada: distancia recorrida, calidad media
//              del aire y ozono respirado durante el día, junto con la lista
//              de mediciones tomadas hoy. Si no tiene sensor vinculado,
//              enseña la tarjeta de aviso para vincularlo.
//              Diseño en doc/app_design.md. Tarea T007.
// Autores:     Equipo 04 – SenseTech
// Fecha:       15/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

// MisDatosActivity class: displays daily air quality and physical activity stats.
public class MisDatosActivity extends AppCompatActivity {

    private View tarjetaAvisoSinSensor;
    private View bloqueDatosHoy;
    private TextView textoDistancia;
    private TextView textoCalidadMedia;
    private TextView textoDetalleCalidad;
    private TextView textoOzonoRespirado;
    private LinearLayout contenedorMedicionesHoy;
    private TextView textoSinMedicionesHoy;
    private TextView errorMisDatos;

    private LogicaFakeMisDatos logicaMisDatos;
    private LogicaFakePerfil logicaPerfil;

    // -----------------------------------------------------------------------
    // savedInstanceState: Bundle --> onCreate() -->
    // What it does: prepares the UI, connects the bottom navigation bar and
    //               initializes listeners and logic components.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mis_datos);

        BarraNavegacion.conectar(this, BarraNavegacion.Pestanya.MIS_DATOS);

        logicaMisDatos = new LogicaFakeMisDatos();
        logicaPerfil = new LogicaFakePerfil();

        tarjetaAvisoSinSensor = findViewById(R.id.tarjetaAvisoSinSensor);
        bloqueDatosHoy = findViewById(R.id.bloqueDatosHoy);
        textoDistancia = findViewById(R.id.textoDistancia);
        textoCalidadMedia = findViewById(R.id.textoCalidadMedia);
        textoDetalleCalidad = findViewById(R.id.textoDetalleCalidad);
        textoOzonoRespirado = findViewById(R.id.textoOzonoRespirado);
        contenedorMedicionesHoy = findViewById(R.id.contenedorMedicionesHoy);
        textoSinMedicionesHoy = findViewById(R.id.textoSinMedicionesHoy);
        errorMisDatos = findViewById(R.id.errorMisDatos);

        findViewById(R.id.botonVincularSensor).setOnClickListener(v -> abrirVincular());
    }

    // -----------------------------------------------------------------------
    // onResume() -->
    // What it does: checks for an active session and refreshes daily metrics.
    // -----------------------------------------------------------------------
    @Override
    protected void onResume() {
        super.onResume();
        comprobarSesionYCargar();
    }

    // -----------------------------------------------------------------------
    // comprobarSesionYCargar() -->
    // What it does: ensures the user is logged in (redirects if not), then asks
    //               for user sensor status and fetches today's measurements.
    // -----------------------------------------------------------------------
    private void comprobarSesionYCargar() {
        String token = Sesion.token(this);
        if (token == null || token.trim().isEmpty()) {
            cerrarSesion();
            return;
        }

        errorMisDatos.setVisibility(View.GONE);

        // Comprueba si el usuario tiene sensor vinculado en su perfil
        logicaPerfil.obtenerUsuario(token, new LogicaFakePerfil.RespuestaUsuario() {
            @Override
            public void usuarioObtenido(DatosUsuario usuario) {
                boolean tieneSensor = usuario.tieneSensor() || LogicaFakeInicio.SENSOR_DE_EJEMPLO;
                cargarDatosHoy(token, tieneSensor);
            }

            @Override
            public void sesionCaducada() {
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                // Si falla la red, intenta cargar con el sensor de ejemplo
                cargarDatosHoy(token, LogicaFakeInicio.SENSOR_DE_EJEMPLO);
            }
        });
    }

    // -----------------------------------------------------------------------
    // token: Text, tieneSensor: B --> cargarDatosHoy() -->
    // What it does: fetches daily summary and measurements through the logic layer.
    // -----------------------------------------------------------------------
    private void cargarDatosHoy(String token, boolean tieneSensor) {
        logicaMisDatos.obtenerDatosHoy(token, tieneSensor, new LogicaFakeMisDatos.RespuestaMisDatos() {
            @Override
            public void datosObtenidos(ResumenMisDatos datos) {
                mostrarDatos(datos);
            }

            @Override
            public void sesionCaducada() {
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                errorMisDatos.setText(mensaje);
                errorMisDatos.setVisibility(View.VISIBLE);
            }
        });
    }

    // -----------------------------------------------------------------------
    // datos: ResumenMisDatos --> mostrarDatos() -->
    // What it does: binds the fetched daily summary to the layout cards.
    // -----------------------------------------------------------------------
    private void mostrarDatos(ResumenMisDatos datos) {
        errorMisDatos.setVisibility(View.GONE);

        if (!datos.tieneSensor) {
            tarjetaAvisoSinSensor.setVisibility(View.VISIBLE);
            bloqueDatosHoy.setVisibility(View.GONE);
            return;
        }

        tarjetaAvisoSinSensor.setVisibility(View.GONE);
        bloqueDatosHoy.setVisibility(View.VISIBLE);

        textoDistancia.setText(datos.textoDistancia());
        textoCalidadMedia.setText(datos.textoCalidadMedia());
        textoCalidadMedia.setTextColor(ContextCompat.getColor(this, colorDeNivel(datos.nivelCalidadMedia())));
        textoDetalleCalidad.setText(String.format(Locale.forLanguageTag("es-ES"),
                getString(R.string.mis_datos_calidad_subtitulo_fmt), datos.ozonoMedio));
        textoOzonoRespirado.setText(datos.textoOzonoRespirado());

        mostrarListaMediciones(datos);
    }

    // -----------------------------------------------------------------------
    // datos: ResumenMisDatos --> mostrarListaMediciones() -->
    // What it does: populates the measurement history view with today's readings.
    // -----------------------------------------------------------------------
    private void mostrarListaMediciones(ResumenMisDatos datos) {
        contenedorMedicionesHoy.removeAllViews();

        if (datos.medicionesHoy.isEmpty()) {
            textoSinMedicionesHoy.setVisibility(View.VISIBLE);
            return;
        }

        textoSinMedicionesHoy.setVisibility(View.GONE);
        LayoutInflater inflater = LayoutInflater.from(this);
        SimpleDateFormat formatoHora = new SimpleDateFormat("HH:mm", Locale.forLanguageTag("es-ES"));

        for (int i = 0; i < datos.medicionesHoy.size(); i++) {
            Medicion m = datos.medicionesHoy.get(i);
            View fila = inflater.inflate(R.layout.item_fila_medicion, contenedorMedicionesHoy, false);

            View punto = fila.findViewById(R.id.puntoNivelMedicion);
            TextView hora = fila.findViewById(R.id.horaMedicionFila);
            TextView valor = fila.findViewById(R.id.valorMedicionFila);
            TextView etiqueta = fila.findViewById(R.id.etiquetaNivelFila);

            int colorNivel = ContextCompat.getColor(this, colorDeNivel(m.nivel()));
            punto.getBackground().setTint(colorNivel);
            hora.setText(formatoHora.format(new Date(m.momento)));
            valor.setText(m.valorRedondeado() + " µg/m³");
            etiqueta.setText(etiquetaDeNivel(m.nivel()));
            etiqueta.setTextColor(colorNivel);

            contenedorMedicionesHoy.addView(fila);

            if (i < datos.medicionesHoy.size() - 1) {
                View separador = new View(this);
                separador.setLayoutParams(new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, 1));
                separador.setBackgroundColor(ContextCompat.getColor(this, R.color.linea_suave));
                contenedorMedicionesHoy.addView(separador);
            }
        }
    }

    // -----------------------------------------------------------------------
    // nivel: NivelOzono --> colorDeNivel() --x
    // Z <--
    // What it does: maps ozone level to its corresponding color resource.
    // -----------------------------------------------------------------------
    private int colorDeNivel(NivelOzono nivel) {
        switch (nivel) {
            case BUENO:
                return R.color.nivel_bueno;
            case MODERADO:
                return R.color.nivel_moderado;
            case MALO:
                return R.color.nivel_malo;
            case MUY_MALO:
            default:
                return R.color.nivel_muy_malo;
        }
    }

    // -----------------------------------------------------------------------
    // nivel: NivelOzono --> etiquetaDeNivel() --x
    // Text <--
    // What it does: translates ozone level to a short human-readable string.
    // -----------------------------------------------------------------------
    private String etiquetaDeNivel(NivelOzono nivel) {
        switch (nivel) {
            case BUENO:
                return "Buena";
            case MODERADO:
                return "Moderada";
            case MALO:
                return "Mala";
            case MUY_MALO:
            default:
                return "Muy mala";
        }
    }

    // -----------------------------------------------------------------------
    // abrirVincular() -->
    // What it does: opens the VincularSensorActivity to link a new sensor.
    // -----------------------------------------------------------------------
    private void abrirVincular() {
        Intent intent = new Intent(this, VincularSensorActivity.class);
        intent.putExtra(VincularSensorActivity.EXTRA_DESDE_PERFIL, true);
        startActivity(intent);
    }

    // -----------------------------------------------------------------------
    // cerrarSesion() -->
    // What it does: cleans stored session data and navigates to BienvenidaActivity.
    // -----------------------------------------------------------------------
    private void cerrarSesion() {
        Sesion.cerrar(this);
        Intent intent = new Intent(this, BienvenidaActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }
}
