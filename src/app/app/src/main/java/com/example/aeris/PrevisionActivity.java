// ---------------------------------------------------------------------------
// Fichero:     PrevisionActivity.java
// Descripción: Pantalla «Previsión de ozono»: la previsión de las próximas 48
//              horas con pico, mejor momento para salir, gráfica hora a hora,
//              leyenda de niveles y el aviso de datos simulados. Se abre desde
//              la tarjeta de Inicio. Usa la última previsión recibida si tiene
//              menos de 30 minutos y, si no, la pide al servidor (compartiendo
//              la petición que ya esté en marcha). Diseño en doc/app_design.md.
//              Tarea T032.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Context;
import android.content.res.ColorStateList;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

// PrevisionActivity class: the 48-hour ozone forecast screen.
public class PrevisionActivity extends AppCompatActivity {

    private static final int ANCHO_MAXIMO_DP = 600;     // en tabletas el contenido no pasa de aquí
    private static final int ANCHO_APILAR_DP = 360;     // por debajo, pico y mejor momento van uno bajo otro

    private PrevisionOzono prevision;
    private boolean cargando = false;

    private View tarjetaEstado, progreso, botonReintentar, contenido, avisoSimulado;
    private TextView textoEstado, subtitulo, seleccionGrafica;
    private GraficaPrevision grafica;

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: shows the forecast that is still valid, or asks for it.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_prevision);

        tarjetaEstado = findViewById(R.id.tarjetaEstado);
        progreso = findViewById(R.id.progresoPrevision);
        botonReintentar = findViewById(R.id.botonReintentar);
        textoEstado = findViewById(R.id.textoEstado);
        contenido = findViewById(R.id.contenidoPrevision);
        avisoSimulado = findViewById(R.id.avisoSimulado);
        subtitulo = findViewById(R.id.subtituloPrevision);
        seleccionGrafica = findViewById(R.id.seleccionGrafica);
        grafica = findViewById(R.id.grafica);

        subtitulo.setText(getString(R.string.prevision_subtitulo, LogicaFakePrevision.ZONA));
        findViewById(R.id.botonVolver).setOnClickListener(vista -> finish());
        botonReintentar.setOnClickListener(vista -> cargar());
        grafica.setAlElegirHora(this::mostrarHora);
        adaptarAncho();

        mostrarVigenteOCargar();
    }

    // Si la pantalla se queda abierta (o en segundo plano) y la previsión que muestra
    // pasa de 30 minutos, al volver se actualiza.
    @Override
    protected void onResume() {
        super.onResume();
        if (prevision != null && prevision.estaCaducada(System.currentTimeMillis())) {
            mostrarVigenteOCargar();
        }
    }

    // -----------------------------------------------------------------------
    // mostrarVigenteOCargar() -->
    // What it does: shows the last forecast if it was received less than 30
    //               minutes ago (so turning the phone or coming from Inicio does
    //               not ask the server again); if not, asks for it. If a request
    //               is already on its way (for example the one of Inicio),
    //               cargar() joins it instead of sending another.
    // -----------------------------------------------------------------------
    private void mostrarVigenteOCargar() {
        PrevisionOzono vigente = LogicaFakePrevision.vigente();
        if (vigente != null) {
            mostrar(vigente);
        } else {
            cargar();
        }
    }

    // -----------------------------------------------------------------------
    // adaptarAncho() -->
    // What it does: on wide screens the content is centred at 600 dp; on
    //               narrow ones (under 360 dp) the peak and best-moment cards
    //               are stacked instead of side by side.
    // -----------------------------------------------------------------------
    private void adaptarAncho() {
        int anchoDp = getResources().getConfiguration().screenWidthDp;
        if (anchoDp > ANCHO_MAXIMO_DP) {
            View columna = findViewById(R.id.columnaPrevision);
            FrameLayout.LayoutParams parametros = (FrameLayout.LayoutParams) columna.getLayoutParams();
            parametros.width = dp(ANCHO_MAXIMO_DP);
            parametros.gravity = Gravity.CENTER_HORIZONTAL;
            columna.setLayoutParams(parametros);
        }
        if (anchoDp < ANCHO_APILAR_DP) {
            LinearLayout fila = findViewById(R.id.filaResumen);
            fila.setOrientation(LinearLayout.VERTICAL);
            for (int id : new int[]{R.id.tarjetaPico, R.id.tarjetaMejor}) {
                LinearLayout.LayoutParams parametros = (LinearLayout.LayoutParams) findViewById(id).getLayoutParams();
                parametros.width = ViewGroup.LayoutParams.MATCH_PARENT;
                parametros.weight = 0;
                parametros.setMarginStart(0);
                parametros.topMargin = id == R.id.tarjetaMejor ? dp(12) : 0;
                findViewById(id).setLayoutParams(parametros);
            }
        }
    }

    // -----------------------------------------------------------------------
    // cargar() -->
    // What it does: asks the server for the forecast (only one request at a
    //               time) and shows the data, or the message of what went wrong
    //               with the «Reintentar» button.
    // -----------------------------------------------------------------------
    private void cargar() {
        if (cargando) {
            return;
        }
        cargando = true;
        mostrarCargando();
        new LogicaFakePrevision().obtenerPrevision(LogicaFakePrevision.ZONA,
                new LogicaFakePrevision.RespuestaPrevision() {
                    @Override
                    public void previsionObtenida(PrevisionOzono obtenida) {
                        cargando = false;
                        if (!isDestroyed()) {
                            mostrar(obtenida);
                        }
                    }

                    @Override
                    public void zonaSinModelo(String zonaDisponible) {
                        cargando = false;
                        if (!isDestroyed()) {
                            mostrarMensaje(getString(R.string.prevision_zona_sin_modelo, zonaDisponible));
                        }
                    }

                    @Override
                    public void sinDatos() {
                        cargando = false;
                        if (!isDestroyed()) {
                            mostrarMensaje(getString(R.string.prevision_sin_datos));
                        }
                    }

                    @Override
                    public void error(String mensaje) {
                        cargando = false;
                        if (!isDestroyed()) {
                            mostrarMensaje(mensaje);
                        }
                    }
                });
    }

    private void mostrarCargando() {
        contenido.setVisibility(View.GONE);
        tarjetaEstado.setVisibility(View.VISIBLE);
        progreso.setVisibility(View.VISIBLE);
        botonReintentar.setVisibility(View.GONE);
        textoEstado.setText(R.string.prevision_cargando);
    }

    private void mostrarMensaje(String mensaje) {
        contenido.setVisibility(View.GONE);
        tarjetaEstado.setVisibility(View.VISIBLE);
        progreso.setVisibility(View.GONE);
        botonReintentar.setVisibility(View.VISIBLE);
        textoEstado.setText(mensaje);
    }

    // -----------------------------------------------------------------------
    // prevision: PrevisionOzono --> mostrar() -->
    // What it does: fills the screen: warning of simulated data, peak, best
    //               moment, chart, legend and footer.
    // -----------------------------------------------------------------------
    private void mostrar(PrevisionOzono nueva) {
        prevision = nueva;
        tarjetaEstado.setVisibility(View.GONE);
        contenido.setVisibility(View.VISIBLE);

        String zona = nueva.zona.isEmpty() ? LogicaFakePrevision.ZONA : nueva.zona;
        subtitulo.setText(getString(R.string.prevision_subtitulo, zona));

        mostrarAviso(nueva);
        mostrarPico(nueva);
        PrevisionOzono.Franja mejor = nueva.mejorMomento();
        mostrarMejorMomento(nueva, mejor);

        grafica.poner(nueva, mejor);
        seleccionGrafica.setText(R.string.prevision_grafica_ayuda);
        grafica.setContentDescription(getString(R.string.prevision_grafica_descripcion, zona,
                Math.round(nueva.pico.ozono), nombreDia(this, nueva.diasDesdeHoy(nueva.pico.fecha)),
                hora(nueva.pico.fecha), textoFranja(nueva, mejor)));

        rellenarLeyenda();

        String pie = getString(R.string.prevision_pie_modelo, nueva.modelo.isEmpty() ? "-" : nueva.modelo);
        LocalDateTime observacion = PrevisionOzono.leerFecha(nueva.ultimaObservacion);
        if (observacion != null) {
            pie += "\n" + getString(R.string.prevision_pie_observacion,
                    observacion.format(DateTimeFormatter.ofPattern("d/M HH:mm", Locale.getDefault())));
        }
        ((TextView) findViewById(R.id.pieModelo)).setText(pie);
    }

    // The warning is shown whenever the server says the data are simulated (or sends a warning);
    // it is never hidden by the app.
    private void mostrarAviso(PrevisionOzono p) {
        boolean hayAviso = p.simulados || !p.advertencia.isEmpty();
        avisoSimulado.setVisibility(hayAviso ? View.VISIBLE : View.GONE);
        String texto = p.advertencia.isEmpty() ? getString(R.string.prevision_aviso_defecto) : p.advertencia;
        if (p.simulados) {
            texto += " " + getString(R.string.prevision_aviso_no_real);
        }
        ((TextView) findViewById(R.id.textoAviso)).setText(texto);
    }

    private void mostrarPico(PrevisionOzono p) {
        ((TextView) findViewById(R.id.valorPico)).setText(
                getString(R.string.prevision_valor, (int) Math.round(p.pico.ozono)));
        ((TextView) findViewById(R.id.horaPico)).setText(getString(R.string.prevision_pico_hora,
                capitalizar(nombreDia(this, p.diasDesdeHoy(p.pico.fecha))), hora(p.pico.fecha)));
        int[] nivel = InformacionActivity.NIVELES_OZONO[p.pico.nivel().ordinal()];
        ((TextView) findViewById(R.id.nivelPico)).setText(nivel[0]);
        findViewById(R.id.puntoPico).setBackgroundTintList(
                ColorStateList.valueOf(ContextCompat.getColor(this, nivel[3])));
    }

    private void mostrarMejorMomento(PrevisionOzono p, PrevisionOzono.Franja mejor) {
        ((TextView) findViewById(R.id.franjaMejor)).setText(textoFranja(p, mejor));
        NivelOzono nivel = NivelOzono.desdeValor(mejor.media);
        String nombre = getString(InformacionActivity.NIVELES_OZONO[nivel.ordinal()][0]);
        int media = (int) Math.round(mejor.media);
        ((TextView) findViewById(R.id.mediaMejor)).setText(mejor.horas > 1
                ? getString(R.string.prevision_franja_media, media, nombre)
                : getString(R.string.prevision_franja_hora_media, media, nombre));
    }

    // «Mañana 07:00–09:00» o, si solo hay una hora, «Mañana a las 07:00»
    private String textoFranja(PrevisionOzono p, PrevisionOzono.Franja franja) {
        String dia = capitalizar(nombreDia(this, p.diasDesdeHoy(franja.inicio)));
        return franja.horas > 1
                ? getString(R.string.prevision_franja, dia, hora(franja.inicio), hora(franja.fin))
                : getString(R.string.prevision_franja_hora, dia, hora(franja.inicio));
    }

    // Hora elegida con el dedo en la gráfica: día, hora, valor y nivel
    private void mostrarHora(int indice) {
        PrevisionOzono.Hora h = prevision.horas.get(indice);
        String nivel = getString(InformacionActivity.NIVELES_OZONO[h.nivel().ordinal()][0]);
        seleccionGrafica.setText(getString(R.string.prevision_grafica_seleccion,
                capitalizar(nombreDia(this, prevision.diasDesdeHoy(h.fecha))), hora(h.fecha),
                (int) Math.round(h.ozono), nivel));
    }

    // Una fila por nivel, las mismas de «Los niveles de AERIS» en Información
    private void rellenarLeyenda() {
        LinearLayout leyenda = findViewById(R.id.leyendaNiveles);
        leyenda.removeAllViews();
        LayoutInflater inflador = LayoutInflater.from(this);
        int[][] niveles = InformacionActivity.NIVELES_OZONO;
        for (int i = 0; i < niveles.length; i++) {
            View fila = inflador.inflate(R.layout.item_nivel_ozono, leyenda, false);
            if (i == 0) {
                fila.setBackground(null);       // la primera fila no lleva línea encima
            }
            fila.findViewById(R.id.puntoNivel).setBackgroundTintList(
                    ColorStateList.valueOf(ContextCompat.getColor(this, niveles[i][3])));
            ((TextView) fila.findViewById(R.id.nombreNivel)).setText(niveles[i][0]);
            ((TextView) fila.findViewById(R.id.rangoNivel)).setText(niveles[i][1]);
            ((TextView) fila.findViewById(R.id.textoNivel)).setText(niveles[i][2]);
            leyenda.addView(fila);
        }
    }

    // -----------------------------------------------------------------------
    // contexto: Context, dias: N --> nombreDia() --x
    // Text <--
    // What it does: «hoy», «mañana» or «pasado mañana» (0, 1, 2 days from
    //               today); any other day as d/M.
    // -----------------------------------------------------------------------
    static String nombreDia(Context contexto, int dias) {
        switch (dias) {
            case 0:
                return contexto.getString(R.string.prevision_dia_hoy);
            case 1:
                return contexto.getString(R.string.prevision_dia_manyana);
            case 2:
                return contexto.getString(R.string.prevision_dia_pasado);
            default:
                return "+" + dias + " d";
        }
    }

    // -----------------------------------------------------------------------
    // fecha: LocalDateTime --> hora() --x
    // Text <--
    // What it does: «07:00».
    // -----------------------------------------------------------------------
    static String hora(LocalDateTime fecha) {
        return String.format(Locale.getDefault(), "%02d:%02d", fecha.getHour(), fecha.getMinute());
    }

    static String capitalizar(String texto) {
        return texto.isEmpty() ? texto : texto.substring(0, 1).toUpperCase(Locale.getDefault()) + texto.substring(1);
    }

    private int dp(int valor) {
        return Math.round(valor * getResources().getDisplayMetrics().density);
    }
}
