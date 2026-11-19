// ---------------------------------------------------------------------------
// Fichero:     GraficaPrevision.java
// Descripción: Gráfica de barras de la previsión de ozono de 48 horas: una barra
//              por hora, del color de su NivelOzono; la hora del pico marcada, la
//              franja recomendada sombreada, los límites de los niveles en línea
//              discontinua y los días separados. Al tocar o arrastrar se elige una
//              hora. Diseño en doc/app_design.md. Tarea T032.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.util.TypedValue;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

// GraficaPrevision class: custom view that draws the 48 hourly values.
public class GraficaPrevision extends View {

    // -----------------------------------------------------------------------
    // Callback de la hora elegida con el dedo (se omite en la notación)
    // -----------------------------------------------------------------------
    public interface AlElegirHora {
        // indice: N --> horaElegida() -->        (posición en PrevisionOzono.horas)
        void horaElegida(int indice);
    }

    private static final int ALFA_FRANJA = 0x2E;          // sombreado verde de la franja recomendada
    private static final int ALFA_LIMITE = 0xB0;          // líneas de los límites de nivel
    private static final double MINIMO_ESCALA = 100;      // la escala llega siempre hasta «Bueno»

    private final Paint pincel = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pincelTexto = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF rectangulo = new RectF();
    private final float densidad = getResources().getDisplayMetrics().density;
    private final int deslizamientoMinimo = ViewConfiguration.get(getContext()).getScaledTouchSlop();

    private PrevisionOzono prevision;
    private PrevisionOzono.Franja franja;
    private int seleccionada = -1;
    private AlElegirHora alElegir;
    private float inicioX, inicioY;

    // Zona de dibujo (se calcula en onDraw)
    private float izquierda, derecha, arriba, abajo;

    public GraficaPrevision(Context contexto) {
        super(contexto);
    }

    public GraficaPrevision(Context contexto, @Nullable AttributeSet atributos) {
        super(contexto, atributos);
    }

    // -----------------------------------------------------------------------
    // prevision: PrevisionOzono, franja: Franja | null --> poner() -->
    // What it does: sets the data to draw and the recommended window, and
    //               clears the selected hour.
    // -----------------------------------------------------------------------
    public void poner(PrevisionOzono prevision, PrevisionOzono.Franja franja) {
        this.prevision = prevision;
        this.franja = franja;
        this.seleccionada = -1;
        invalidate();
    }

    public void setAlElegirHora(AlElegirHora alElegir) {
        this.alElegir = alElegir;
    }

    // -----------------------------------------------------------------------
    // valorMaximo: R --> escalaMaxima() --x
    // R <--
    // What it does: top of the vertical axis: at least 100 (so the limit of
    //               «Bueno» is always seen) and, above that, the next multiple
    //               of 50 over the highest value plus a 10 % margin.
    // -----------------------------------------------------------------------
    static double escalaMaxima(double valorMaximo) {
        double necesario = valorMaximo * 1.1;
        if (necesario <= MINIMO_ESCALA) {
            return MINIMO_ESCALA;
        }
        return Math.ceil(necesario / 50) * 50;
    }

    @Override
    protected void onDraw(Canvas lienzo) {
        super.onDraw(lienzo);
        if (prevision == null || prevision.horas.isEmpty()) {
            return;
        }
        List<PrevisionOzono.Hora> horas = prevision.horas;
        int n = horas.size();

        izquierda = dp(34);
        derecha = getWidth() - dp(4);
        arriba = dp(22);                       // sitio para la etiqueta del pico
        abajo = getHeight() - dp(34);          // sitio para las horas y los días
        float alto = abajo - arriba;
        float hueco = (derecha - izquierda) / n;
        double escala = escalaMaxima(prevision.pico.ozono);

        dibujarCuadricula(lienzo, escala);
        dibujarFranja(lienzo, hueco);
        dibujarBarras(lienzo, horas, hueco, alto, escala);
        dibujarLimites(lienzo, escala, alto);
        dibujarDias(lienzo, horas, hueco);
        dibujarSeleccion(lienzo, horas, hueco, alto, escala);
        dibujarPico(lienzo, horas, hueco, alto, escala);
        dibujarHoras(lienzo, horas, hueco);
    }

    // Líneas horizontales y números del eje vertical (0, mitad y máximo)
    private void dibujarCuadricula(Canvas lienzo, double escala) {
        pincel.setStyle(Paint.Style.STROKE);
        pincel.setStrokeWidth(dp(1));
        pincel.setPathEffect(null);
        pincelTexto.setTextSize(sp(10));
        pincelTexto.setColor(color(R.color.texto_secundario));
        pincelTexto.setTextAlign(Paint.Align.RIGHT);
        pincelTexto.setFakeBoldText(false);
        for (int i = 0; i <= 2; i++) {
            double valor = escala * i / 2;
            float y = yDe(valor, escala);
            pincel.setColor(color(i == 0 ? R.color.borde_campo : R.color.linea_suave));
            lienzo.drawLine(izquierda, y, derecha, y, pincel);
            lienzo.drawText(String.valueOf((int) Math.round(valor)), izquierda - dp(6), y + dp(3.5f), pincelTexto);
        }
    }

    // Sombreado de la franja recomendada, detrás de las barras
    private void dibujarFranja(Canvas lienzo, float hueco) {
        if (franja == null) {
            return;
        }
        pincel.setStyle(Paint.Style.FILL);
        pincel.setPathEffect(null);
        pincel.setColor(color(R.color.verde_ok));
        pincel.setAlpha(ALFA_FRANJA);
        rectangulo.set(izquierda + franja.indice * hueco, arriba,
                izquierda + (franja.indice + franja.horas) * hueco, abajo);
        lienzo.drawRoundRect(rectangulo, dp(3), dp(3), pincel);
        pincel.setAlpha(255);
    }

    // Una barra por hora, del color de su nivel
    private void dibujarBarras(Canvas lienzo, List<PrevisionOzono.Hora> horas, float hueco, float alto, double escala) {
        float ancho = Math.max(dp(2), hueco * 0.72f);
        float radio = Math.min(ancho / 2, dp(2.5f));
        pincel.setStyle(Paint.Style.FILL);
        pincel.setPathEffect(null);
        for (int i = 0; i < horas.size(); i++) {
            PrevisionOzono.Hora hora = horas.get(i);
            float x = izquierda + i * hueco + (hueco - ancho) / 2;
            float y = yDe(Math.max(0, hora.ozono), escala);
            pincel.setColor(color(InformacionActivity.NIVELES_OZONO[hora.nivel().ordinal()][3]));
            pincel.setAlpha(seleccionada >= 0 && seleccionada != i ? 150 : 255);
            rectangulo.set(x, y, x + ancho, abajo);
            lienzo.drawRoundRect(rectangulo, radio, radio, pincel);
        }
        pincel.setAlpha(255);
    }

    // Límites de Moderado, Malo y Muy malo (100, 180 y 240) si caben en la escala
    private void dibujarLimites(Canvas lienzo, double escala, float alto) {
        NivelOzono[] niveles = {NivelOzono.BUENO, NivelOzono.MODERADO, NivelOzono.MALO};
        pincel.setStyle(Paint.Style.STROKE);
        pincel.setStrokeWidth(dp(1.2f));
        pincel.setPathEffect(new DashPathEffect(new float[]{dp(4), dp(3)}, 0));
        for (NivelOzono nivel : niveles) {
            if (nivel.limiteSuperior >= escala) {
                continue;               // en el borde de arriba: ya es la línea del máximo
            }
            NivelOzono siguiente = NivelOzono.values()[nivel.ordinal() + 1];
            pincel.setColor(color(InformacionActivity.NIVELES_OZONO[siguiente.ordinal()][3]));
            pincel.setAlpha(ALFA_LIMITE);
            float y = yDe(nivel.limiteSuperior, escala);
            lienzo.drawLine(izquierda, y, derecha, y, pincel);
        }
        pincel.setAlpha(255);
        pincel.setPathEffect(null);
    }

    // Línea fina entre un día y otro y nombre del día debajo de las horas
    private void dibujarDias(Canvas lienzo, List<PrevisionOzono.Hora> horas, float hueco) {
        String[] nombres = getResources().getStringArray(R.array.prevision_dias_grafica);
        pincel.setStyle(Paint.Style.STROKE);
        pincel.setStrokeWidth(dp(1));
        pincel.setPathEffect(null);
        pincelTexto.setTextSize(sp(11));
        pincelTexto.setFakeBoldText(true);
        pincelTexto.setColor(color(R.color.texto_principal));
        pincelTexto.setTextAlign(Paint.Align.CENTER);

        int inicio = 0;
        for (int i = 1; i <= horas.size(); i++) {
            boolean cambia = i == horas.size()
                    || !horas.get(i).fecha.toLocalDate().equals(horas.get(inicio).fecha.toLocalDate());
            if (!cambia) {
                continue;
            }
            if (i < horas.size()) {
                float x = izquierda + i * hueco;
                pincel.setColor(color(R.color.borde_campo));
                lienzo.drawLine(x, arriba, x, abajo + dp(32), pincel);
            }
            int dias = prevision.diasDesdeHoy(horas.get(inicio).fecha);
            float centro = izquierda + (inicio + i) * hueco / 2;
            String nombre = dias >= 0 && dias < nombres.length ? nombres[dias] : fechaCorta(horas.get(inicio).fecha.toLocalDate());
            // Si el tramo es muy corto para el nombre, no se escribe
            if ((i - inicio) * hueco >= pincelTexto.measureText(nombre) + dp(4)) {
                lienzo.drawText(nombre, centro, getHeight() - dp(6), pincelTexto);
            }
            inicio = i;
        }
        pincelTexto.setFakeBoldText(false);
    }

    // Horas cada 6 (o cada 12 si no caben), debajo de las barras
    private void dibujarHoras(Canvas lienzo, List<PrevisionOzono.Hora> horas, float hueco) {
        pincelTexto.setTextSize(sp(10));
        pincelTexto.setColor(color(R.color.texto_secundario));
        pincelTexto.setTextAlign(Paint.Align.CENTER);
        pincelTexto.setFakeBoldText(false);
        int paso = 6 * hueco >= pincelTexto.measureText("00:00") + dp(6) ? 6 : 12;
        for (int i = 0; i < horas.size(); i++) {
            int hora = horas.get(i).fecha.getHour();
            if (hora % paso != 0) {
                continue;
            }
            float x = izquierda + i * hueco + hueco / 2;
            float mitad = pincelTexto.measureText("00:00") / 2;
            x = Math.max(izquierda + mitad, Math.min(x, derecha - mitad));
            lienzo.drawText(String.format(Locale.getDefault(), "%02d:00", hora), x, abajo + dp(14), pincelTexto);
        }
    }

    // Marcador del pico: punto violeta sobre su barra y el valor encima
    private void dibujarPico(Canvas lienzo, List<PrevisionOzono.Hora> horas, float hueco, float alto, double escala) {
        int indice = horas.indexOf(prevision.pico);
        if (indice < 0) {
            return;
        }
        float x = izquierda + indice * hueco + hueco / 2;
        float y = yDe(prevision.pico.ozono, escala);
        pincel.setStyle(Paint.Style.FILL);
        pincel.setColor(color(R.color.violeta));
        lienzo.drawCircle(x, y - dp(5), dp(3.5f), pincel);

        pincelTexto.setTextSize(sp(11));
        pincelTexto.setFakeBoldText(true);
        pincelTexto.setColor(color(R.color.violeta));
        pincelTexto.setTextAlign(Paint.Align.CENTER);
        String etiqueta = String.valueOf((int) Math.round(prevision.pico.ozono));
        float mitad = pincelTexto.measureText(etiqueta) / 2;
        float xEtiqueta = Math.max(izquierda + mitad, Math.min(x, derecha - mitad));
        lienzo.drawText(etiqueta, xEtiqueta, y - dp(11), pincelTexto);
        pincelTexto.setFakeBoldText(false);
    }

    // Hora elegida con el dedo: columna resaltada
    private void dibujarSeleccion(Canvas lienzo, List<PrevisionOzono.Hora> horas, float hueco, float alto, double escala) {
        if (seleccionada < 0 || seleccionada >= horas.size()) {
            return;
        }
        float x = izquierda + seleccionada * hueco;
        pincel.setStyle(Paint.Style.FILL);
        pincel.setPathEffect(null);
        pincel.setColor(color(R.color.violeta));
        pincel.setAlpha(0x1F);
        rectangulo.set(x, arriba, x + hueco, abajo);
        lienzo.drawRect(rectangulo, pincel);
        pincel.setAlpha(255);
    }

    // -----------------------------------------------------------------------
    // evento: MotionEvent --> onTouchEvent() -->
    // What it does: touching or dragging picks the hour under the finger and
    //               tells it with horaElegida(). A mostly horizontal drag keeps
    //               the scroll of the screen from taking over.
    // -----------------------------------------------------------------------
    @Override
    public boolean onTouchEvent(MotionEvent evento) {
        if (prevision == null || prevision.horas.isEmpty()) {
            return super.onTouchEvent(evento);
        }
        switch (evento.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                inicioX = evento.getX();
                inicioY = evento.getY();
                elegir(evento.getX());
                return true;
            case MotionEvent.ACTION_MOVE:
                if (Math.abs(evento.getX() - inicioX) > deslizamientoMinimo
                        && Math.abs(evento.getX() - inicioX) > Math.abs(evento.getY() - inicioY)) {
                    getParent().requestDisallowInterceptTouchEvent(true);
                }
                elegir(evento.getX());
                return true;
            case MotionEvent.ACTION_UP:
                performClick();
                return true;
            case MotionEvent.ACTION_CANCEL:
                return true;
            default:
                return super.onTouchEvent(evento);
        }
    }

    @Override
    public boolean performClick() {
        return super.performClick();
    }

    private void elegir(float x) {
        int n = prevision.horas.size();
        float hueco = (derecha - izquierda) / n;
        int indice = (int) Math.floor((x - izquierda) / hueco);
        indice = Math.max(0, Math.min(n - 1, indice));
        if (indice != seleccionada) {
            seleccionada = indice;
            invalidate();
            if (alElegir != null) {
                alElegir.horaElegida(indice);
            }
        }
    }

    private float yDe(double valor, double escala) {
        return (float) (abajo - (Math.min(valor, escala) / escala) * (abajo - arriba));
    }

    private static String fechaCorta(LocalDate fecha) {
        return fecha.getDayOfMonth() + "/" + fecha.getMonthValue();
    }

    private int color(int id) {
        return ContextCompat.getColor(getContext(), id);
    }

    private float dp(float valor) {
        return valor * densidad;
    }

    private float sp(float valor) {
        return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, valor, getResources().getDisplayMetrics());
    }
}
