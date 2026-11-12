// ---------------------------------------------------------------------------
// Fichero:     IndicadorCalidad.java
// Descripción: Indicador en arco de la calidad del aire de la pantalla de
//              inicio (Figma: inicio · «Calidad del aire ahora»). Un arco gris
//              y, encima, la parte que corresponde al valor, del color de su
//              nivel, con un punto blanco en la punta. Al cambiar de valor el
//              arco y su color pasan del valor anterior al nuevo con una
//              animación. Tarea T006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       12/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.animation.ArgbEvaluator;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.View;
import android.view.animation.DecelerateInterpolator;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

// IndicadorCalidad class: arc gauge of the current ozone value.
public class IndicadorCalidad extends View {

    // El arco va de abajo a la izquierda a abajo a la derecha (como en Figma)
    private static final float ANGULO_INICIO = 160f;
    private static final float ANGULO_TOTAL = 220f;

    // Valor que llena el arco entero (µg/m³): más allá de Muy malo (240)
    static final double VALOR_MAXIMO = 300;

    private final Paint pincelFondo = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pincelValor = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pincelPunta = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF rectangulo = new RectF();
    private float fraccion = 0f;    // parte del arco pintada (0..1)
    private int color;
    private ValueAnimator animacion;

    public IndicadorCalidad(Context contexto, @Nullable AttributeSet atributos) {
        super(contexto, atributos);
        float grosor = 14 * getResources().getDisplayMetrics().density;
        pincelFondo.setStyle(Paint.Style.STROKE);
        pincelFondo.setStrokeCap(Paint.Cap.ROUND);
        pincelFondo.setStrokeWidth(grosor);
        pincelFondo.setColor(ContextCompat.getColor(contexto, R.color.borde_campo));
        pincelValor.setStyle(Paint.Style.STROKE);
        pincelValor.setStrokeCap(Paint.Cap.ROUND);
        pincelValor.setStrokeWidth(grosor);
        color = ContextCompat.getColor(contexto, R.color.nivel_bueno);
        pincelValor.setColor(color);
        pincelPunta.setStyle(Paint.Style.FILL);
        pincelPunta.setColor(ContextCompat.getColor(contexto, R.color.blanco));
    }

    // -----------------------------------------------------------------------
    // valor: R --> fraccionDe() --x
    // R <--
    // What it does: the part of the arc for a value, between 0 and 1. Even a
    //               very low value shows a small piece of the arc.
    // -----------------------------------------------------------------------
    static float fraccionDe(double valor) {
        double fraccion = valor / VALOR_MAXIMO;
        return (float) Math.max(0.03, Math.min(1, fraccion));
    }

    // -----------------------------------------------------------------------
    // valor: R, nuevoColor: Z, animar: B --> mostrar() -->
    // What it does: paints the part of the arc of the value with the color of
    //               its level. With animar, the arc and its color go from
    //               what was shown (empty the first time) to the new value
    //               in 0.9 s.
    // -----------------------------------------------------------------------
    public void mostrar(double valor, int nuevoColor, boolean animar) {
        float destino = fraccionDe(valor);
        if (animacion != null) {
            animacion.cancel();
        }
        if (!animar) {
            fraccion = destino;
            color = nuevoColor;
            invalidate();
            return;
        }
        final float desde = fraccion;
        final int colorDesde = fraccion == 0 ? nuevoColor : color;
        final ArgbEvaluator mezcla = new ArgbEvaluator();
        animacion = ValueAnimator.ofFloat(0f, 1f);
        animacion.setDuration(900);
        animacion.setInterpolator(new DecelerateInterpolator(1.6f));
        animacion.addUpdateListener(a -> {
            float t = (float) a.getAnimatedValue();
            fraccion = desde + (destino - desde) * t;
            color = (int) mezcla.evaluate(t, colorDesde, nuevoColor);
            invalidate();
        });
        animacion.start();
    }

    // -----------------------------------------------------------------------
    // vaciar() -->
    // What it does: only the grey arc (no measurement).
    // -----------------------------------------------------------------------
    public void vaciar() {
        if (animacion != null) {
            animacion.cancel();
        }
        fraccion = 0f;
        invalidate();
    }

    @Override
    protected void onDetachedFromWindow() {
        if (animacion != null) {
            animacion.cancel();
        }
        super.onDetachedFromWindow();
    }

    @Override
    protected void onDraw(Canvas lienzo) {
        super.onDraw(lienzo);
        float mitad = pincelFondo.getStrokeWidth() / 2;
        // El arco es un círculo cuyo ancho llena la vista
        float diametro = Math.min(getWidth(), getHeight() * 1.45f) - 2 * mitad;
        float izquierda = (getWidth() - diametro) / 2;
        rectangulo.set(izquierda, mitad, izquierda + diametro, mitad + diametro);
        lienzo.drawArc(rectangulo, ANGULO_INICIO, ANGULO_TOTAL, false, pincelFondo);
        if (fraccion > 0) {
            pincelValor.setColor(color);
            float barrido = ANGULO_TOTAL * fraccion;
            lienzo.drawArc(rectangulo, ANGULO_INICIO, barrido, false, pincelValor);
            // Punto blanco en la punta del arco
            double angulo = Math.toRadians(ANGULO_INICIO + barrido);
            float radio = diametro / 2;
            lienzo.drawCircle(rectangulo.centerX() + (float) (radio * Math.cos(angulo)),
                    rectangulo.centerY() + (float) (radio * Math.sin(angulo)), mitad * 0.42f, pincelPunta);
        }
    }
}
