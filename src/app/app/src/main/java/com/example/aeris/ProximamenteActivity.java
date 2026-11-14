// ---------------------------------------------------------------------------
// Fichero:     ProximamenteActivity.java
// Descripción: Pantalla PROVISIONAL para las secciones que aún no están hechas
//              (Mapa, Mis datos, Previsión, Mis lugares y Mi sensor), para que la barra de
//              navegación y los accesos de Inicio abran algo. Cada sección se
//              hace en su propia tarea; entonces BarraNavegacion.pantallaDe()
//              o InicioActivity abrirán su pantalla real. Tarea T006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       12/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

// ProximamenteActivity class: temporary screen of a section not done yet.
public class ProximamenteActivity extends AppCompatActivity {

    // Pestaña de la barra que se marca (nombre del enum); sin ella, ninguna
    static final String EXTRA_PESTANYA = "pestanya";
    // Sección que se muestra (nombre del enum Seccion)
    static final String EXTRA_SECCION = "seccion";

    // Secciones aún no hechas: título, texto e icono
    public enum Seccion {
        MAPA(R.string.proximamente_mapa, R.string.proximamente_mapa_texto, R.drawable.ic_mapa),
        MIS_DATOS(R.string.proximamente_mis_datos, R.string.proximamente_mis_datos_texto, R.drawable.ic_mis_datos),
        PREVISION(R.string.proximamente_prevision, R.string.proximamente_prevision_texto, R.drawable.ic_reloj),
        MIS_LUGARES(R.string.proximamente_lugares, R.string.proximamente_lugares_texto, R.drawable.ic_lugar),
        MI_SENSOR(R.string.proximamente_mi_sensor, R.string.proximamente_mi_sensor_texto, R.drawable.ic_sensor),
        // T043: hasta que esté la pantalla Ayuda (se abre desde Vincular sensor)
        AYUDA(R.string.proximamente_ayuda, R.string.proximamente_ayuda_texto, R.drawable.ic_info);

        final int titulo;
        final int texto;
        final int icono;

        Seccion(int titulo, int texto, int icono) {
            this.titulo = titulo;
            this.texto = texto;
            this.icono = icono;
        }
    }

    // -----------------------------------------------------------------------
    // contexto: Context, seccion: Seccion --> intentPara() --x
    // Intent <--
    // What it does: the Intent that opens the screen of a section from a
    //               shortcut (no tab marked, «volver» goes back).
    // -----------------------------------------------------------------------
    static Intent intentPara(Context contexto, Seccion seccion) {
        return new Intent(contexto, ProximamenteActivity.class).putExtra(EXTRA_SECCION, seccion.name());
    }

    // -----------------------------------------------------------------------
    // pestanya: Pestanya --> seccionDe() --x
    // Seccion | null <--
    // What it does: the section of a tab of the bar, or null if the tab has
    //               its own screen.
    // -----------------------------------------------------------------------
    static Seccion seccionDe(BarraNavegacion.Pestanya pestanya) {
        switch (pestanya) {
            case MAPA:
                return Seccion.MAPA;
            case MIS_DATOS:
                return Seccion.MIS_DATOS;
            default:
                return null;
        }
    }

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: shows the title, icon and text of the section and
    //               connects the bottom bar (with the tab marked if it was
    //               opened from the bar).
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_proximamente);

        Seccion seccion = enumDe(Seccion.class, getIntent().getStringExtra(EXTRA_SECCION), Seccion.MAPA);
        BarraNavegacion.Pestanya pestanya = enumDe(BarraNavegacion.Pestanya.class,
                getIntent().getStringExtra(EXTRA_PESTANYA), null);
        BarraNavegacion.conectar(this, pestanya);

        ((TextView) findViewById(R.id.tituloSeccion)).setText(seccion.titulo);
        ((TextView) findViewById(R.id.textoSeccion)).setText(seccion.texto);
        ((ImageView) findViewById(R.id.iconoSeccion)).setImageResource(seccion.icono);

        // Abierta desde un acceso de Inicio: flecha para volver
        findViewById(R.id.botonVolver).setVisibility(pestanya == null ? View.VISIBLE : View.GONE);
        findViewById(R.id.botonVolver).setOnClickListener(vista -> finish());
    }

    // nombre de un enum -> su valor, o porDefecto si no hay nombre o no existe
    private static <E extends Enum<E>> E enumDe(Class<E> tipo, String nombre, E porDefecto) {
        if (nombre == null) {
            return porDefecto;
        }
        try {
            return Enum.valueOf(tipo, nombre);
        } catch (IllegalArgumentException error) {
            return porDefecto;
        }
    }
}
