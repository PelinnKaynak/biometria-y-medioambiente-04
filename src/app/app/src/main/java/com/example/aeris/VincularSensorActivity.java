// ---------------------------------------------------------------------------
// Fichero:     VincularSensorActivity.java
// Descripción: Pantalla «Vincular sensor» (Figma: «vincular sensor»). Se abre
//              tras el registro. Tiene el diseño completo: botón «Buscar
//              sensores», estado de la búsqueda, lista de sensores encontrados
//              con su botón «Vincular» y «Omitir por ahora».
//              La búsqueda por Bluetooth y la petición al servidor son de la
//              tarea T005 (H019): están marcadas con «T005» en buscarSensores()
//              y pulsarVincular(). Diseño en doc/app_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       05/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import java.util.Collections;
import java.util.List;

// VincularSensorActivity class: the «Vincular sensor» screen.
public class VincularSensorActivity extends AppCompatActivity {

    // Mientras no exista la búsqueda real (T005), cuánto se ve «Buscando…»
    private static final long DURACION_BUSQUEDA_MS = 3000;

    private TextView botonBuscar;
    private View estadoBusqueda;
    private View progresoBusqueda;
    private TextView textoEstadoBusqueda;
    private View tituloEncontrados;
    private LinearLayout listaSensores;

    private final Handler hiloPrincipal = new Handler(Looper.getMainLooper());

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: finds the views and connects «Buscar sensores», the back
    //               button and «Omitir por ahora» (both open the home screen).
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_vincular_sensor);

        botonBuscar = findViewById(R.id.botonBuscar);
        estadoBusqueda = findViewById(R.id.estadoBusqueda);
        progresoBusqueda = findViewById(R.id.progresoBusqueda);
        textoEstadoBusqueda = findViewById(R.id.textoEstadoBusqueda);
        tituloEncontrados = findViewById(R.id.tituloEncontrados);
        listaSensores = findViewById(R.id.listaSensores);

        botonBuscar.setOnClickListener(vista -> buscarSensores());
        findViewById(R.id.botonVolver).setOnClickListener(vista -> abrirInicio());
        findViewById(R.id.enlaceOmitir).setOnClickListener(vista -> abrirInicio());
    }

    // -----------------------------------------------------------------------
    // buscarSensores() -->
    // What it does: shows «Buscando sensores cercanos…» and looks for sensors.
    //               T005: here goes the Bluetooth scan, which must call
    //               mostrarSensores() with what it finds. Until then no sensor
    //               is invented: after a few seconds it shows that none was found.
    // -----------------------------------------------------------------------
    private void buscarSensores() {
        mostrarBuscando();
        // T005: sustituir por el escaneo Bluetooth (iBeacon de los sensores AERIS)
        hiloPrincipal.postDelayed(() -> mostrarSensores(Collections.emptyList()), DURACION_BUSQUEDA_MS);
    }

    // -----------------------------------------------------------------------
    // mostrarBuscando() -->
    // What it does: spinner and «Buscando…», empties the list and disables
    //               the button so the search is not started twice.
    // -----------------------------------------------------------------------
    private void mostrarBuscando() {
        botonBuscar.setEnabled(false);
        botonBuscar.setAlpha(0.6f);
        listaSensores.removeAllViews();
        tituloEncontrados.setVisibility(View.GONE);
        estadoBusqueda.setVisibility(View.VISIBLE);
        progresoBusqueda.setVisibility(View.VISIBLE);
        textoEstadoBusqueda.setText(R.string.vincular_buscando);
    }

    // -----------------------------------------------------------------------
    // sensores: Lista<SensorEncontrado> --> mostrarSensores() -->
    // What it does: ends the search. With sensors, shows «Sensores
    //               encontrados» and one row per sensor (item_sensor.xml);
    //               without sensors, says that none was found.
    // -----------------------------------------------------------------------
    void mostrarSensores(List<SensorEncontrado> sensores) {
        botonBuscar.setEnabled(true);
        botonBuscar.setAlpha(1f);
        progresoBusqueda.setVisibility(View.GONE);
        listaSensores.removeAllViews();

        if (sensores.isEmpty()) {
            estadoBusqueda.setVisibility(View.VISIBLE);
            textoEstadoBusqueda.setText(R.string.vincular_ninguno);
            tituloEncontrados.setVisibility(View.GONE);
            return;
        }
        estadoBusqueda.setVisibility(View.GONE);
        tituloEncontrados.setVisibility(View.VISIBLE);

        LayoutInflater inflador = LayoutInflater.from(this);
        for (SensorEncontrado sensor : sensores) {
            View fila = inflador.inflate(R.layout.item_sensor, listaSensores, false);
            ((TextView) fila.findViewById(R.id.textoNombreSensor)).setText(sensor.nombre);
            ((TextView) fila.findViewById(R.id.textoDetalleSensor)).setText(sensor.detalle());
            fila.findViewById(R.id.botonVincular).setOnClickListener(vista -> pulsarVincular(sensor));
            listaSensores.addView(fila);
        }
    }

    // -----------------------------------------------------------------------
    // sensor: SensorEncontrado --> pulsarVincular() -->
    // What it does: T005: sends the sensor to the server to link it to the
    //               user's account and, if it works, opens the home screen.
    // -----------------------------------------------------------------------
    private void pulsarVincular(SensorEncontrado sensor) {
        // T005: petición al servidor para vincular «sensor» a la cuenta del usuario
    }

    private void abrirInicio() {
        hiloPrincipal.removeCallbacksAndMessages(null);
        startActivity(new Intent(this, InicioActivity.class));
        finish();
    }

    @Override
    protected void onDestroy() {
        hiloPrincipal.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
