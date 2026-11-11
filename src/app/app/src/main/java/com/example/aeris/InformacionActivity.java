// ---------------------------------------------------------------------------
// Fichero:     InformacionActivity.java
// Descripción: Pantalla «Información» (Figma: «informacion · rediseño» e
//              «informacion · leer más abierto»). Se abre con la pestaña «Info»
//              de la barra de navegación. Tiene el «Consejo de hoy», que cambia
//              solo o al tocarlo, y tarjetas que se abren y se cierran
//              tocándolas: el aire (ozono, niveles, sol y temperatura), el
//              sensor del portador (imagen con sus partes señaladas, piezas que
//              se separan al bajar, cómo llevarlo, cómo mide, Bluetooth, sus
//              datos) y la normativa. Diseño en doc/app_design.md.
//              Tarea T009.
// Autores:     Equipo 04 – SenseTech
// Fecha:       11/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.annotation.SuppressLint;
import android.content.res.ColorStateList;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.transition.AutoTransition;
import android.transition.TransitionManager;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.AnimationUtils;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextSwitcher;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.widget.ImageViewCompat;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

// InformacionActivity class: the «Información» screen.
public class InformacionActivity extends AppCompatActivity {

    private static final long CAMBIO_CONSEJO_MS = 7000;      // el consejo cambia solo cada 7 s
    private static final long DURACION_ABRIR_MS = 250;        // abrir / cerrar una tarjeta
    private static final long RETRASO_ENTRADA_MS = 60;        // entre tarjeta y tarjeta al abrir la pantalla

    // Contenido especial de una tarjeta (si no, es un texto)
    private static final int TEXTO = 0, NIVELES = 1, LIMITES = 2;

    private static final double MAXIMO_ESCALA = 300;          // final de la barra de niveles (µg/m³)

    // Cada tarjeta: icono, título, subtítulo, texto (o 0) y tipo de contenido.
    // Los iconos son de línea fina; cada sección tiene su color (verde, violeta, azul).
    private static final int[][] TEMAS_AIRE = {
            {R.drawable.ic_info_ozono,
                    R.string.info_ozono_titulo, R.string.info_ozono_subtitulo, R.string.info_ozono_texto, TEXTO},
            {R.drawable.ic_info_niveles,
                    R.string.info_niveles_titulo, R.string.info_niveles_subtitulo, 0, NIVELES},
            {R.drawable.ic_info_sol,
                    R.string.info_sol_titulo, R.string.info_sol_subtitulo, R.string.info_sol_texto, TEXTO},
    };
    private static final int[][] TEMAS_SENSOR = {
            {R.drawable.ic_info_sensor,
                    R.string.info_sensor_titulo, R.string.info_sensor_subtitulo, R.string.info_sensor_texto, TEXTO},
            {R.drawable.ic_info_bluetooth,
                    R.string.info_bluetooth_titulo, R.string.info_bluetooth_subtitulo, R.string.info_bluetooth_texto, TEXTO},
            {R.drawable.ic_info_candado,
                    R.string.info_datos_titulo, R.string.info_datos_subtitulo, R.string.info_datos_texto, TEXTO},
    };
    private static final int[][] TEMAS_NORMATIVA = {
            {R.drawable.ic_info_balanza,
                    R.string.info_limites_titulo, R.string.info_limites_subtitulo, 0, LIMITES},
    };

    // Niveles de ozono (en el orden de NivelOzono): nombre, rango, consejo, color
    private static final int[][] NIVELES_OZONO = {
            {R.string.info_nivel_bueno, R.string.info_nivel_bueno_rango, R.string.info_nivel_bueno_texto, R.color.nivel_bueno},
            {R.string.info_nivel_moderado, R.string.info_nivel_moderado_rango, R.string.info_nivel_moderado_texto, R.color.nivel_moderado},
            {R.string.info_nivel_malo, R.string.info_nivel_malo_rango, R.string.info_nivel_malo_texto, R.color.nivel_malo},
            {R.string.info_nivel_muy_malo, R.string.info_nivel_muy_malo_rango, R.string.info_nivel_muy_malo_texto, R.color.nivel_muy_malo},
    };

    // Límites legales: nombre y valor
    private static final int[][] LIMITES_LEGALES = {
            {R.string.info_limite_informacion, R.string.info_limite_informacion_valor},
            {R.string.info_limite_alerta, R.string.info_limite_alerta_valor},
            {R.string.info_limite_objetivo, R.string.info_limite_objetivo_valor},
            {R.string.info_limite_oms, R.string.info_limite_oms_valor},
    };

    // Llamadas del sensor: x e y como fracción de la imagen y lado de la
    // etiqueta (1 derecha, -1 izquierda); y su texto
    private static final float[][] LLAMADAS = {
            {0.50f, 0.04f, 1},      // anilla
            {0.26f, 0.60f, -1},     // rejilla
            {0.86f, 0.83f, 1},      // ranuras del lateral
    };
    private static final int[] TEXTOS_LLAMADAS = {
            R.string.info_llamada_anilla, R.string.info_llamada_rejilla, R.string.info_llamada_ventilacion};

    private LinearLayout contenido;
    private ImageView imagenSensor;
    private FrameLayout tarjetaSensorFoto, escenaPiezas;
    private View etiquetasPiezas;
    private View[] piezas;
    private final List<View[]> vistasLlamadas = new ArrayList<>();
    private boolean llamadasVistas = false;
    private TextSwitcher textoConsejo;
    private LinearLayout puntosConsejo;
    private String[] consejos;
    private int consejoActual;
    private final List<View> tarjetas = new ArrayList<>();
    private final Handler hiloPrincipal = new Handler(Looper.getMainLooper());
    private final Runnable cambiarConsejoSolo = new Runnable() {
        @Override
        public void run() {
            mostrarConsejo(ConsejosDelDia.siguiente(consejoActual, consejos.length));
            hiloPrincipal.postDelayed(this, CAMBIO_CONSEJO_MS);
        }
    };

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: connects the bottom bar (Info), prepares the tip of the
    //               day, adds the cards of the three sections and shows them
    //               one after another with a short animation.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_informacion);
        BarraNavegacion.conectar(this, BarraNavegacion.Pestanya.INFO);

        contenido = findViewById(R.id.contenidoInformacion);
        prepararConsejo();
        anyadirTemas(findViewById(R.id.temasAire), TEMAS_AIRE, R.color.info_verde, R.color.info_verde_icono);
        anyadirTemas(findViewById(R.id.temasSensor), TEMAS_SENSOR, R.color.info_lila_suave, R.color.violeta);
        anyadirTemas(findViewById(R.id.temasNormativa), TEMAS_NORMATIVA, R.color.info_azul, R.color.info_azul_icono);
        prepararSensor();
        animarEntrada();
    }

    @Override
    protected void onResume() {
        super.onResume();
        hiloPrincipal.postDelayed(cambiarConsejoSolo, CAMBIO_CONSEJO_MS);
    }

    @Override
    protected void onPause() {
        hiloPrincipal.removeCallbacks(cambiarConsejoSolo);
        super.onPause();
    }

    // -----------------------------------------------------------------------
    // prepararConsejo() -->
    // What it does: the tip text changes with a fade; today starts with
    //               ConsejosDelDia.deHoy(); touching the card shows the next one.
    // -----------------------------------------------------------------------
    private void prepararConsejo() {
        consejos = getResources().getStringArray(R.array.info_consejos);
        textoConsejo = findViewById(R.id.textoConsejo);
        puntosConsejo = findViewById(R.id.puntosConsejo);
        textoConsejo.setFactory(() -> {
            TextView texto = new TextView(this);
            texto.setTextColor(ContextCompat.getColor(this, R.color.blanco));
            texto.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
            texto.setLineSpacing(0, 1.3f);
            texto.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
            return texto;
        });
        textoConsejo.setInAnimation(AnimationUtils.loadAnimation(this, android.R.anim.fade_in));
        textoConsejo.setOutAnimation(AnimationUtils.loadAnimation(this, android.R.anim.fade_out));

        for (int i = 0; i < consejos.length; i++) {
            View punto = new View(this);
            punto.setBackgroundResource(R.drawable.fondo_punto_consejo);
            LinearLayout.LayoutParams parametros = new LinearLayout.LayoutParams(dp(6), dp(6));
            parametros.setMarginEnd(dp(6));
            puntosConsejo.addView(punto, parametros);
        }
        consejoActual = -1;
        textoConsejo.setCurrentText("");
        mostrarConsejo(ConsejosDelDia.deHoy(Calendar.getInstance().get(Calendar.DAY_OF_YEAR), consejos.length));

        findViewById(R.id.tarjetaConsejo).setOnClickListener(vista -> {
            // Al tocar, el siguiente; y el cambio automático vuelve a esperar 7 s
            hiloPrincipal.removeCallbacks(cambiarConsejoSolo);
            mostrarConsejo(ConsejosDelDia.siguiente(consejoActual, consejos.length));
            hiloPrincipal.postDelayed(cambiarConsejoSolo, CAMBIO_CONSEJO_MS);
        });
    }

    // -----------------------------------------------------------------------
    // indice: N --> mostrarConsejo() -->
    // What it does: shows that tip (fade) and marks its dot: the dot of the
    //               current tip is long and white, the others small.
    // -----------------------------------------------------------------------
    private void mostrarConsejo(int indice) {
        if (consejos.length == 0 || indice == consejoActual) {
            return;
        }
        consejoActual = indice;
        textoConsejo.setText(consejos[indice]);
        for (int i = 0; i < puntosConsejo.getChildCount(); i++) {
            View punto = puntosConsejo.getChildAt(i);
            ViewGroup.LayoutParams parametros = punto.getLayoutParams();
            parametros.width = dp(i == indice ? 18 : 6);
            punto.setLayoutParams(parametros);
            punto.setAlpha(i == indice ? 1f : 0.4f);
        }
    }

    // -----------------------------------------------------------------------
    // seccion: LinearLayout, temas: Lista<Lista<Z>>,
    // colorFondo: Z, colorIcono: Z --> anyadirTemas() -->
    // What it does: adds one card (item_tema_informacion.xml) per topic,
    //               closed, with its body already filled and the icon in the
    //               colour of the section.
    // -----------------------------------------------------------------------
    @SuppressLint("ClickableViewAccessibility")
    private void anyadirTemas(LinearLayout seccion, int[][] temas, int colorFondo, int colorIcono) {
        LayoutInflater inflador = LayoutInflater.from(this);
        for (int[] tema : temas) {
            View tarjeta = inflador.inflate(R.layout.item_tema_informacion, seccion, false);
            ImageView icono = tarjeta.findViewById(R.id.iconoTema);
            icono.setImageResource(tema[0]);
            ImageViewCompat.setImageTintList(icono, ColorStateList.valueOf(color(colorIcono)));
            tarjeta.findViewById(R.id.fondoIconoTema).setBackgroundTintList(ColorStateList.valueOf(color(colorFondo)));
            ((TextView) tarjeta.findViewById(R.id.tituloTema)).setText(tema[1]);
            ((TextView) tarjeta.findViewById(R.id.subtituloTema)).setText(tema[2]);
            rellenarCuerpo(tarjeta.findViewById(R.id.cuerpoTema), tema[3], tema[4]);

            tarjeta.setOnClickListener(vista -> alternar(tarjeta));
            // Al pulsar, la tarjeta se hunde un poco
            tarjeta.setOnTouchListener((vista, evento) -> {
                if (evento.getActionMasked() == MotionEvent.ACTION_DOWN) {
                    vista.animate().scaleX(0.98f).scaleY(0.98f).setDuration(100).start();
                } else if (evento.getActionMasked() == MotionEvent.ACTION_UP
                        || evento.getActionMasked() == MotionEvent.ACTION_CANCEL) {
                    vista.animate().scaleX(1f).scaleY(1f).setDuration(150).start();
                }
                return false;
            });
            seccion.addView(tarjeta);
            tarjetas.add(tarjeta);
        }
    }

    // -----------------------------------------------------------------------
    // cuerpo: LinearLayout, texto: Z, tipo: Z --> rellenarCuerpo() -->
    // What it does: the content shown when the card is opened: a text, the scale of
    //               ozone levels (coloured bar and one row per level), or the
    //               table of legal limits.
    // -----------------------------------------------------------------------
    private void rellenarCuerpo(LinearLayout cuerpo, int texto, int tipo) {
        LayoutInflater inflador = LayoutInflater.from(this);
        if (tipo == TEXTO) {
            cuerpo.addView(textoCuerpo(getString(texto)));
        } else if (tipo == NIVELES) {
            cuerpo.addView(escalaNiveles(inflador, cuerpo));
            for (int i = 0; i < NIVELES_OZONO.length; i++) {
                int[] nivel = NIVELES_OZONO[i];
                View fila = inflador.inflate(R.layout.item_nivel_ozono, cuerpo, false);
                if (i == 0) {
                    fila.setBackground(null);       // la primera fila no lleva línea encima
                }
                fila.findViewById(R.id.puntoNivel)
                        .setBackgroundTintList(ColorStateList.valueOf(ContextCompat.getColor(this, nivel[3])));
                ((TextView) fila.findViewById(R.id.nombreNivel)).setText(nivel[0]);
                ((TextView) fila.findViewById(R.id.rangoNivel)).setText(nivel[1]);
                ((TextView) fila.findViewById(R.id.textoNivel)).setText(nivel[2]);
                cuerpo.addView(fila);
            }
        } else {
            LinearLayout tabla = new LinearLayout(this);
            tabla.setOrientation(LinearLayout.VERTICAL);
            tabla.setBackgroundResource(R.drawable.fondo_tabla_limites);
            tabla.setClipToOutline(true);
            for (int i = 0; i < LIMITES_LEGALES.length; i++) {
                View fila = inflador.inflate(R.layout.item_limite_legal, tabla, false);
                if (i % 2 == 1) {
                    fila.setBackgroundColor(ContextCompat.getColor(this, R.color.blanco));
                }
                ((TextView) fila.findViewById(R.id.nombreLimite)).setText(LIMITES_LEGALES[i][0]);
                ((TextView) fila.findViewById(R.id.valorLimite)).setText(LIMITES_LEGALES[i][1]);
                tabla.addView(fila);
            }
            cuerpo.addView(tabla);
            TextView nota = textoCuerpo(getString(R.string.info_limites_nota));
            nota.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            nota.setTextColor(ContextCompat.getColor(this, R.color.texto_secundario));
            LinearLayout.LayoutParams parametros = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            parametros.topMargin = dp(10);
            cuerpo.addView(nota, parametros);
        }
    }

    // -----------------------------------------------------------------------
    // inflador: LayoutInflater, padre: ViewGroup --> escalaNiveles() --x
    // View <--
    // What it does: the bar from 0 to 300 µg/m³ with the colours of the
    //               levels (green, yellow, red, maroon) and the limits 100,
    //               180 and 240 marked under it (NivelOzono).
    // -----------------------------------------------------------------------
    private View escalaNiveles(LayoutInflater inflador, ViewGroup padre) {
        View escala = inflador.inflate(R.layout.item_escala_niveles, padre, false);
        GradientDrawable degradado = new GradientDrawable();
        degradado.setOrientation(GradientDrawable.Orientation.LEFT_RIGHT);
        degradado.setColors(new int[]{
                color(R.color.nivel_bueno), color(R.color.nivel_bueno),
                color(R.color.nivel_moderado), color(R.color.nivel_moderado),
                color(R.color.nivel_malo), color(R.color.nivel_malo), color(R.color.nivel_muy_malo)},
                new float[]{0f, 0.30f, 0.42f, 0.58f, 0.70f, 0.80f, 1f});
        degradado.setCornerRadius(dp(4));
        escala.findViewById(R.id.barraEscala).setBackground(degradado);

        // Las marcas se colocan cuando se conoce el ancho (al abrir la tarjeta)
        FrameLayout marcas = escala.findViewById(R.id.marcasEscala);
        double[] valores = {0, NivelOzono.BUENO.limiteSuperior, NivelOzono.MODERADO.limiteSuperior,
                NivelOzono.MALO.limiteSuperior, MAXIMO_ESCALA};
        String[] etiquetas = {"0", "100", "180", "240", getString(R.string.info_unidad)};
        for (String etiqueta : etiquetas) {
            TextView texto = new TextView(this);
            texto.setText(etiqueta);
            texto.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
            texto.setTextColor(color(R.color.texto_secundario));
            marcas.addView(texto, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }
        marcas.addOnLayoutChangeListener((vista, izq, arriba, der, abajo, izqAntes, arribaAntes, derAntes, abajoAntes) -> {
            int ancho = der - izq;
            for (int i = 0; i < marcas.getChildCount(); i++) {
                View texto = marcas.getChildAt(i);
                float x = (float) (valores[i] / MAXIMO_ESCALA * ancho) - texto.getWidth() / 2f;
                texto.setTranslationX(Math.max(0, Math.min(x, ancho - texto.getWidth())));
            }
        });
        return escala;
    }

    private int color(int id) {
        return ContextCompat.getColor(this, id);
    }

    private TextView textoCuerpo(String texto) {
        TextView vista = new TextView(this);
        vista.setText(texto);
        vista.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        vista.setTextColor(ContextCompat.getColor(this, R.color.texto_cuerpo));
        vista.setLineSpacing(0, 1.3f);
        vista.setGravity(Gravity.START);
        return vista;
    }

    // -----------------------------------------------------------------------
    // tarjeta: View --> alternar() -->
    // What it does: touching the card opens or closes it with an animation
    //               (the height changes smoothly and the arrow turns 180°).
    // -----------------------------------------------------------------------
    private void alternar(View tarjeta) {
        View cuerpo = tarjeta.findViewById(R.id.cuerpoTema);
        boolean abrir = cuerpo.getVisibility() != View.VISIBLE;

        TransitionManager.beginDelayedTransition(contenido, new AutoTransition().setDuration(DURACION_ABRIR_MS));
        cuerpo.setVisibility(abrir ? View.VISIBLE : View.GONE);
        tarjeta.setBackgroundResource(abrir ? R.drawable.fondo_tarjeta_info_abierta : R.drawable.fondo_tarjeta_info);

        ImageView flecha = tarjeta.findViewById(R.id.flechaTema);
        flecha.animate().rotation(abrir ? 180f : 0f).setDuration(DURACION_ABRIR_MS).start();
        ImageViewCompat.setImageTintList(flecha, ColorStateList.valueOf(
                ContextCompat.getColor(this, abrir ? R.color.violeta : R.color.texto_secundario)));

    }

    // -----------------------------------------------------------------------
    // prepararSensor() -->
    // What it does: «Tu sensor AERIS»: the image of the sensor floats up and
    //               down slowly; its three callouts (ring, grille, vents) and
    //               the parts of «Por dentro» move with the scroll
    //               (actualizarConScroll()).
    // -----------------------------------------------------------------------
    private void prepararSensor() {
        imagenSensor = findViewById(R.id.imagenSensor);
        tarjetaSensorFoto = findViewById(R.id.tarjetaSensorFoto);
        escenaPiezas = findViewById(R.id.escenaPiezas);
        etiquetasPiezas = findViewById(R.id.etiquetasPiezas);
        piezas = new View[]{findViewById(R.id.piezaTapa), findViewById(R.id.piezaFiltro),
                findViewById(R.id.piezaModulo), findViewById(R.id.piezaCarcasa)};

        ObjectAnimator flotar = ObjectAnimator.ofFloat(imagenSensor, View.TRANSLATION_Y, -dp(5), dp(5));
        flotar.setDuration(2400);
        flotar.setRepeatMode(ValueAnimator.REVERSE);
        flotar.setRepeatCount(ValueAnimator.INFINITE);
        flotar.setInterpolator(new AccelerateDecelerateInterpolator());
        flotar.start();
        // La sombra se hace más pequeña y clara cuando el sensor está arriba
        View sombra = findViewById(R.id.sombraSensor);
        ObjectAnimator sombraX = ObjectAnimator.ofFloat(sombra, View.SCALE_X, 0.85f, 1.05f);
        ObjectAnimator sombraAlfa = ObjectAnimator.ofFloat(sombra, View.ALPHA, 0.6f, 1f);
        for (ObjectAnimator animacion : new ObjectAnimator[]{sombraX, sombraAlfa}) {
            animacion.setDuration(2400);
            animacion.setRepeatMode(ValueAnimator.REVERSE);
            animacion.setRepeatCount(ValueAnimator.INFINITE);
            animacion.setInterpolator(new AccelerateDecelerateInterpolator());
            animacion.start();
        }

        for (int texto : TEXTOS_LLAMADAS) {
            crearLlamada(texto);
        }
        ScrollView scroll = findViewById(R.id.scrollInformacion);
        scroll.setOnScrollChangeListener((vista, x, y, xAntes, yAntes) -> actualizarConScroll(scroll));
        tarjetaSensorFoto.addOnLayoutChangeListener((v, i, a, d, b, i2, a2, d2, b2) -> {
            colocarLlamadas();
            actualizarConScroll(scroll);
        });
        escenaPiezas.addOnLayoutChangeListener((v, i, a, d, b, i2, a2, d2, b2) -> actualizarConScroll(scroll));
    }

    // -----------------------------------------------------------------------
    // texto: Z --> crearLlamada() -->
    // What it does: one callout: a violet dot on the part, a thin line and a
    //               white label. Hidden until the card is seen.
    // -----------------------------------------------------------------------
    private void crearLlamada(int texto) {
        View punto = new View(this);
        punto.setBackgroundResource(R.drawable.punto_llamada);
        View linea = new View(this);
        linea.setBackgroundColor(color(R.color.linea_llamada));
        TextView etiqueta = new TextView(this);
        etiqueta.setText(texto);
        etiqueta.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        etiqueta.setTextColor(color(R.color.texto_principal));
        etiqueta.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
        etiqueta.setBackgroundResource(R.drawable.fondo_llamada);
        etiqueta.setPadding(dp(8), dp(4), dp(8), dp(4));
        etiqueta.setElevation(dp(2));

        tarjetaSensorFoto.addView(linea, new FrameLayout.LayoutParams(0, dp(1)));
        tarjetaSensorFoto.addView(punto, new FrameLayout.LayoutParams(dp(10), dp(10)));
        tarjetaSensorFoto.addView(etiqueta, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        for (View vista : new View[]{punto, linea, etiqueta}) {
            vista.setAlpha(0f);
        }
        vistasLlamadas.add(new View[]{punto, linea, etiqueta});
    }

    // -----------------------------------------------------------------------
    // colocarLlamadas() -->
    // What it does: puts each dot on its part of the image (positions in
    //               LLAMADAS, as a fraction of the image) and the label at the
    //               side of the card, joined by the line.
    // -----------------------------------------------------------------------
    private void colocarLlamadas() {
        int anchoTarjeta = tarjetaSensorFoto.getWidth();
        for (int i = 0; i < LLAMADAS.length; i++) {
            float[] llamada = LLAMADAS[i];
            View punto = vistasLlamadas.get(i)[0];
            View linea = vistasLlamadas.get(i)[1];
            View etiqueta = vistasLlamadas.get(i)[2];
            float x = imagenSensor.getLeft() + llamada[0] * imagenSensor.getWidth();
            float y = imagenSensor.getTop() + llamada[1] * imagenSensor.getHeight();
            boolean aLaDerecha = llamada[2] > 0;

            punto.setX(x - dp(5));
            punto.setY(y - dp(5));
            float xEtiqueta = aLaDerecha ? anchoTarjeta - dp(12) - etiqueta.getWidth() : dp(12);
            etiqueta.setX(xEtiqueta);
            etiqueta.setY(y - etiqueta.getHeight() / 2f);
            float inicio = aLaDerecha ? x : xEtiqueta + etiqueta.getWidth();
            float fin = aLaDerecha ? xEtiqueta : x;
            ViewGroup.LayoutParams parametros = linea.getLayoutParams();
            if (parametros.width != Math.max(0, Math.round(fin - inicio))) {
                parametros.width = Math.max(0, Math.round(fin - inicio));
                linea.setLayoutParams(parametros);
            }
            linea.setX(inicio);
            linea.setY(y);
            linea.setPivotX(aLaDerecha ? 0 : parametros.width);
        }
    }

    // -----------------------------------------------------------------------
    // scroll: ScrollView --> actualizarConScroll() -->
    // What it does: the first time the sensor card is seen, its callouts
    //               appear one after another (dot, line, label). The parts of
    //               «Por dentro» start together (closed sensor) and separate
    //               while the card goes up the screen; their names appear.
    // -----------------------------------------------------------------------
    private void actualizarConScroll(ScrollView scroll) {
        int altoVisible = scroll.getHeight();
        if (altoVisible == 0) {
            return;
        }
        if (!llamadasVistas && posicionEnPantalla(tarjetaSensorFoto, scroll) < altoVisible * 0.8f) {
            llamadasVistas = true;
            for (int i = 0; i < vistasLlamadas.size(); i++) {
                long retraso = 200L + i * 180L;
                View[] vistas = vistasLlamadas.get(i);
                vistas[0].setScaleX(0f);
                vistas[0].setScaleY(0f);
                vistas[0].animate().alpha(1f).scaleX(1f).scaleY(1f).setStartDelay(retraso).setDuration(250).start();
                vistas[1].setScaleX(0f);
                vistas[1].animate().alpha(1f).scaleX(1f).setStartDelay(retraso + 150).setDuration(300).start();
                // La etiqueta crece un poco (no se mueve: su posición es la de setY())
                vistas[2].setScaleX(0.85f);
                vistas[2].setScaleY(0.85f);
                vistas[2].animate().alpha(1f).scaleX(1f).scaleY(1f).setStartDelay(retraso + 350).setDuration(300).start();
            }
        }

        // Progreso de «Por dentro»: 0 cuando la escena asoma por abajo, 1 cuando llega a la mitad
        float arriba = posicionEnPantalla(escenaPiezas, scroll);
        float progreso = (altoVisible - arriba) / (altoVisible * 0.5f);
        progreso = Math.max(0f, Math.min(1f, progreso));
        colocarPiezas(progreso);
    }

    // -----------------------------------------------------------------------
    // progreso: R --> colocarPiezas() -->
    // What it does: with 0 the four parts are one over the other in the
    //               middle; with 1 each one is in the centre of its column,
    //               above its name.
    // -----------------------------------------------------------------------
    private void colocarPiezas(float progreso) {
        int ancho = escenaPiezas.getWidth();
        if (ancho == 0) {
            return;
        }
        float columna = ancho / (float) piezas.length;
        for (int i = 0; i < piezas.length; i++) {
            View pieza = piezas[i];
            float centroFinal = columna * i + columna / 2f;
            float centroInicial = ancho / 2f + (i - 1.5f) * dp(6);   // casi juntas, como el sensor cerrado
            float centro = centroInicial + (centroFinal - centroInicial) * progreso;
            pieza.setX(centro - pieza.getWidth() / 2f);
        }
        etiquetasPiezas.setAlpha(progreso);
    }

    private static float posicionEnPantalla(View vista, ScrollView scroll) {
        int[] enVista = new int[2], enScroll = new int[2];
        vista.getLocationInWindow(enVista);
        scroll.getLocationInWindow(enScroll);
        return enVista[1] - enScroll[1];
    }

    // -----------------------------------------------------------------------
    // animarEntrada() -->
    // What it does: the tip card and then each card appear one after another,
    //               fading in and moving up a little.
    // -----------------------------------------------------------------------
    private void animarEntrada() {
        List<View> vistas = new ArrayList<>();
        vistas.add(findViewById(R.id.tarjetaConsejo));
        vistas.addAll(tarjetas.subList(0, TEMAS_AIRE.length));
        for (int i = 0; i < vistas.size(); i++) {
            View vista = vistas.get(i);
            vista.setAlpha(0f);
            vista.setTranslationY(dp(16));
            vista.animate().alpha(1f).translationY(0f)
                    .setStartDelay(i * RETRASO_ENTRADA_MS).setDuration(300)
                    .setInterpolator(new DecelerateInterpolator()).start();
        }
    }

    private int dp(int valor) {
        return Math.round(valor * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        hiloPrincipal.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
