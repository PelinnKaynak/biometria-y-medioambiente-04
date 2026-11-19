// ---------------------------------------------------------------------------
// Fichero:     InicioActivity.java
// Descripción: Pantalla de inicio PROVISIONAL: saluda al usuario y tiene la
//              barra de navegación inferior para ir al perfil (T010), donde
//              se cierra la sesión. Incluye la tarjeta resumen de la previsión
//              de ozono de 48 horas (T032), que abre PrevisionActivity. La
//              pantalla de inicio real (calidad del aire, últimas mediciones…)
//              es la tarea T006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026 (T032: 19/11/2026)
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.content.res.ColorStateList;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

// InicioActivity class: temporary home screen until task T006.
public class InicioActivity extends AppCompatActivity {

    private boolean cargandoPrevision = false;

    private TextView textoPrevision;
    private View puntoPrevision, chipSimulado;

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: says hello with the user's name and connects the bottom bar
    //               and the forecast card.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_inicio);
        BarraNavegacion.conectar(this, BarraNavegacion.Pestanya.INICIO);

        String nombre = Sesion.nombre(this);
        TextView saludo = findViewById(R.id.saludo);
        saludo.setText(getString(R.string.inicio_saludo, nombre == null ? "" : nombre));

        textoPrevision = findViewById(R.id.textoPrevisionInicio);
        puntoPrevision = findViewById(R.id.puntoPrevisionInicio);
        chipSimulado = findViewById(R.id.chipSimulado);
        findViewById(R.id.tarjetaPrevision).setOnClickListener(vista -> abrirPrevision());
    }

    // Cada vez que se ve Inicio: se usa la previsión recibida hace menos de 30
    // minutos y, si no hay ninguna (no se pudo cargar o ha caducado), se pide.
    @Override
    protected void onResume() {
        super.onResume();
        PrevisionOzono vigente = LogicaFakePrevision.vigente();
        if (vigente != null) {
            mostrarPrevision(vigente);
        } else {
            cargarPrevision();
        }
    }

    // -----------------------------------------------------------------------
    // cargarPrevision() -->
    // What it does: asks for the forecast (LogicaFakePrevision shares the
    //               request already on its way, so turning the phone does not
    //               send another one) and writes the peak in the card, or says
    //               that it is not available.
    // -----------------------------------------------------------------------
    private void cargarPrevision() {
        if (cargandoPrevision) {
            return;
        }
        cargandoPrevision = true;
        textoPrevision.setText(R.string.prevision_inicio_cargando);
        new LogicaFakePrevision().obtenerPrevision(LogicaFakePrevision.ZONA,
                new LogicaFakePrevision.RespuestaPrevision() {
                    @Override
                    public void previsionObtenida(PrevisionOzono obtenida) {
                        cargandoPrevision = false;
                        if (!isDestroyed()) {
                            mostrarPrevision(obtenida);
                        }
                    }

                    @Override
                    public void zonaSinModelo(String zonaDisponible) {
                        noDisponible(R.string.prevision_inicio_no_disponible);
                    }

                    @Override
                    public void sinDatos() {
                        noDisponible(R.string.prevision_inicio_no_disponible);
                    }

                    @Override
                    public void servicioOcupado() {
                        noDisponible(R.string.prevision_inicio_ocupado);
                    }

                    @Override
                    public void error(String mensaje) {
                        noDisponible(R.string.prevision_inicio_no_disponible);
                    }
                });
    }

    private void noDisponible(int texto) {
        cargandoPrevision = false;
        if (!isDestroyed()) {
            textoPrevision.setText(texto);
        }
    }

    // pico, con el color de su nivel; el aviso de datos simulados se queda a la vista
    private void mostrarPrevision(PrevisionOzono obtenida) {
        PrevisionOzono.Hora pico = obtenida.pico;
        textoPrevision.setText(getString(R.string.prevision_inicio_pico,
                (int) Math.round(pico.ozono),
                PrevisionActivity.nombreDia(this, obtenida.diasDesdeHoy(pico.fecha)),
                PrevisionActivity.hora(pico.fecha)));
        int colorNivel = InformacionActivity.NIVELES_OZONO[pico.nivel().ordinal()][3];
        puntoPrevision.setBackgroundTintList(ColorStateList.valueOf(ContextCompat.getColor(this, colorNivel)));
        boolean simulados = obtenida.simulados || !obtenida.advertencia.isEmpty();
        chipSimulado.setVisibility(simulados ? View.VISIBLE : View.GONE);
    }

    // -----------------------------------------------------------------------
    // abrirPrevision() -->
    // What it does: opens the forecast screen, which uses the forecast that is
    //               still valid (or asks for it, joining the request already
    //               on its way).
    // -----------------------------------------------------------------------
    private void abrirPrevision() {
        startActivity(new Intent(this, PrevisionActivity.class));
    }
}
