// ---------------------------------------------------------------------------
// Fichero:     MapaAvisoActivity.java
// Descripción: Mapa mínimo de un aviso de contaminación (T008): OpenStreetMap
//              (osmdroid) centrado en las coordenadas del aviso, con un
//              marcador que lleva el nombre de la zona. Se abre al pulsar un
//              aviso del panel de notificaciones de Inicio. No es el mapa
//              completo de la app (pestaña «Mapa», otra tarea).
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import org.osmdroid.config.Configuration;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;

// MapaAvisoActivity class: the map centered on the zone of one aviso.
public class MapaAvisoActivity extends AppCompatActivity {

    public static final String EXTRA_LATITUD = "latitud";
    public static final String EXTRA_LONGITUD = "longitud";
    public static final String EXTRA_ZONA = "zona";
    public static final String EXTRA_TEXTO = "texto";

    private static final double ZOOM = 15.0;

    private MapView mapa;

    // -----------------------------------------------------------------------
    // contexto: Context, aviso: Aviso --> intentPara() --x
    // Intent <--
    // What it does: the intent that opens the map on the zone of the aviso.
    // -----------------------------------------------------------------------
    public static Intent intentPara(Context contexto, Aviso aviso) {
        return new Intent(contexto, MapaAvisoActivity.class)
                .putExtra(EXTRA_LATITUD, aviso.latitud)
                .putExtra(EXTRA_LONGITUD, aviso.longitud)
                .putExtra(EXTRA_ZONA, aviso.zona)
                .putExtra(EXTRA_TEXTO, aviso.texto);
    }

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: centers the map on the coordinates of the extras and puts
    //               a marker with the zone. Without coordinates it closes.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent intent = getIntent();
        if (!intent.hasExtra(EXTRA_LATITUD) || !intent.hasExtra(EXTRA_LONGITUD)) {
            finish();
            return;
        }
        double latitud = intent.getDoubleExtra(EXTRA_LATITUD, Double.NaN);
        double longitud = intent.getDoubleExtra(EXTRA_LONGITUD, Double.NaN);
        if (Double.isNaN(latitud) || Double.isNaN(longitud)) {
            finish();
            return;
        }
        // OpenStreetMap bloquea (403) las apps sin un User-Agent que las identifique
        Configuration.getInstance().setUserAgentValue(userAgent());
        setContentView(R.layout.activity_mapa_aviso);

        findViewById(R.id.botonVolverMapaAviso).setOnClickListener(vista -> finish());
        String zona = intent.getStringExtra(EXTRA_ZONA);
        String nombreZona = zona == null || zona.isEmpty() ? getString(R.string.aviso_mapa_zona_sin_nombre) : zona;
        ((TextView) findViewById(R.id.textoZonaMapaAviso)).setText(nombreZona);
        String texto = intent.getStringExtra(EXTRA_TEXTO);
        TextView textoAviso = findViewById(R.id.textoAvisoMapaAviso);
        textoAviso.setText(texto == null ? "" : texto);

        GeoPoint punto = new GeoPoint(latitud, longitud);
        mapa = findViewById(R.id.mapaAviso);
        mapa.setTileSource(TileSourceFactory.MAPNIK);
        mapa.setMultiTouchControls(true);
        mapa.setBuiltInZoomControls(true);
        mapa.getController().setZoom(ZOOM);
        mapa.getController().setCenter(punto);

        Marker marcador = new Marker(mapa);
        marcador.setPosition(punto);
        marcador.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
        marcador.setTitle(nombreZona);
        mapa.getOverlays().add(marcador);
        marcador.showInfoWindow();
    }

    // -----------------------------------------------------------------------
    // userAgent() --x
    // Text <--
    // What it does: «AERIS/<versión> (<applicationId>)»: the text that
    //               identifies the app to the tile servers of OpenStreetMap
    //               (its usage policy blocks the default one).
    // -----------------------------------------------------------------------
    private String userAgent() {
        String version = "1.0";
        try {
            String nombre = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            if (nombre != null && !nombre.isEmpty()) {
                version = nombre;
            }
        } catch (PackageManager.NameNotFoundException error) {
            // se queda la versión por defecto
        }
        return getString(R.string.app_name) + "/" + version + " (" + getPackageName() + ")";
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mapa != null) mapa.onResume();
    }

    @Override
    protected void onPause() {
        if (mapa != null) mapa.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (mapa != null) mapa.onDetach();
        super.onDestroy();
    }
}
