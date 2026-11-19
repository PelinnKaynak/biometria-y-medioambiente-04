// ---------------------------------------------------------------------------
// Fichero:     SeleccionarUbicacionActivity.java
// Descripción: Selector de coordenadas para «Mis lugares» mediante un punto
//              elegido por el usuario sobre OpenStreetMap.
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import org.osmdroid.config.Configuration;
import org.osmdroid.events.MapEventsReceiver;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.MapEventsOverlay;
import org.osmdroid.views.overlay.Marker;

public class SeleccionarUbicacionActivity extends AppCompatActivity {

    public static final String EXTRA_LATITUD = "latitud";
    public static final String EXTRA_LONGITUD = "longitud";

    private static final String ESTADO_LATITUD = "estado_latitud";
    private static final String ESTADO_LONGITUD = "estado_longitud";
    private static final GeoPoint CENTRO_INICIAL = new GeoPoint(38.967, -0.183);

    private MapView mapa;
    private TextView textoPosicion;
    private TextView botonConfirmar;
    private GeoPoint posicionSeleccionada;
    private Marker marcador;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Configuration.getInstance().setUserAgentValue(getPackageName());
        setContentView(R.layout.activity_seleccionar_ubicacion);

        ImageView botonVolver = findViewById(R.id.botonVolverMapaLugar);
        TextView textoTitulo = findViewById(R.id.textoTituloMapaLugar);
        textoPosicion = findViewById(R.id.textoPosicionMapaLugar);
        TextView atribucion = findViewById(R.id.atribucionMapaLugar);
        botonConfirmar = findViewById(R.id.botonConfirmarUbicacion);
        mapa = findViewById(R.id.mapaSeleccionUbicacion);

        textoTitulo.setText(R.string.mis_lugares_mapa_titulo);
        atribucion.setText(R.string.mis_lugares_mapa_atribucion);
        botonVolver.setOnClickListener(v -> finish());
        botonConfirmar.setOnClickListener(this::confirmarSeleccion);
        botonConfirmar.setEnabled(false);
        botonConfirmar.setAlpha(0.5f);

        mapa.setTileSource(TileSourceFactory.MAPNIK);
        mapa.setMultiTouchControls(true);
        mapa.setBuiltInZoomControls(true);
        mapa.getController().setZoom(14.0);
        mapa.getOverlays().add(new MapEventsOverlay(new MapEventsReceiver() {
            @Override
            public boolean singleTapConfirmedHelper(GeoPoint punto) {
                seleccionarPunto(punto);
                return true;
            }

            @Override
            public boolean longPressHelper(GeoPoint punto) {
                seleccionarPunto(punto);
                return true;
            }
        }));

        if (savedInstanceState != null
                && savedInstanceState.containsKey(ESTADO_LATITUD)
                && savedInstanceState.containsKey(ESTADO_LONGITUD)) {
            seleccionarPunto(new GeoPoint(
                    savedInstanceState.getDouble(ESTADO_LATITUD),
                    savedInstanceState.getDouble(ESTADO_LONGITUD)));
        } else {
            mapa.getController().setCenter(CENTRO_INICIAL);
            textoPosicion.setText(R.string.mis_lugares_mapa_sin_seleccion);
        }
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

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        if (posicionSeleccionada != null) {
            estado.putDouble(ESTADO_LATITUD, posicionSeleccionada.getLatitude());
            estado.putDouble(ESTADO_LONGITUD, posicionSeleccionada.getLongitude());
        }
        super.onSaveInstanceState(estado);
    }

    private void seleccionarPunto(GeoPoint punto) {
        posicionSeleccionada = punto;
        if (marcador != null) mapa.getOverlays().remove(marcador);

        marcador = new Marker(mapa);
        marcador.setPosition(punto);
        marcador.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
        marcador.setTitle(getString(R.string.mis_lugares_mapa_titulo));
        mapa.getOverlays().add(marcador);

        textoPosicion.setText(getString(R.string.mis_lugares_ubicacion_formato,
                punto.getLatitude(), punto.getLongitude()));
        botonConfirmar.setEnabled(true);
        botonConfirmar.setAlpha(1.0f);
        mapa.invalidate();
    }

    private void confirmarSeleccion(View vista) {
        if (posicionSeleccionada == null) return;
        Intent resultado = new Intent()
                .putExtra(EXTRA_LATITUD, posicionSeleccionada.getLatitude())
                .putExtra(EXTRA_LONGITUD, posicionSeleccionada.getLongitude());
        setResult(RESULT_OK, resultado);
        finish();
    }
}
