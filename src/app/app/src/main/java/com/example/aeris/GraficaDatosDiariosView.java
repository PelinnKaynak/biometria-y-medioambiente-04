// ---------------------------------------------------------------------------
// Fichero:     GraficaDatosDiariosView.java
// Descripción: Gráfica diaria de concentraciones de ozono (T007).
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.util.AttributeSet;
import android.view.View;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

public class GraficaDatosDiariosView extends View {

    private final Paint pinturaEjes = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pinturaLinea = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pinturaRelleno = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pinturaUmbral = new Paint(Paint.ANTI_ALIAS_FLAG);
    private List<MedicionDiaria> mediciones = Collections.emptyList();
    private long inicioMs;
    private long finMs;

    public GraficaDatosDiariosView(Context context, AttributeSet attrs) {
        super(context, attrs);
        pinturaEjes.setColor(getResources().getColor(R.color.texto_secundario));
        pinturaEjes.setTextSize(dp(11));
        pinturaLinea.setColor(getResources().getColor(R.color.violeta));
        pinturaLinea.setStyle(Paint.Style.STROKE);
        pinturaLinea.setStrokeWidth(dp(2.5f));
        pinturaLinea.setStrokeCap(Paint.Cap.ROUND);
        pinturaLinea.setStrokeJoin(Paint.Join.ROUND);
        pinturaRelleno.setColor(0x337958A7);
        pinturaUmbral.setColor(getResources().getColor(R.color.nivel_moderado));
        pinturaUmbral.setStyle(Paint.Style.STROKE);
        pinturaUmbral.setStrokeWidth(dp(1));
        pinturaUmbral.setPathEffect(new DashPathEffect(new float[]{dp(4), dp(4)}, 0));
    }

    public void mostrar(List<MedicionDiaria> nuevas, long inicio, long fin) {
        mediciones = Collections.unmodifiableList(new ArrayList<>(nuevas));
        inicioMs = inicio;
        finMs = fin;
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if (mediciones.isEmpty() || finMs <= inicioMs) {
            pinturaEjes.setTextAlign(Paint.Align.CENTER);
            canvas.drawText(getContext().getString(R.string.mis_datos_grafica_vacia),
                    getWidth() / 2f, getHeight() / 2f, pinturaEjes);
            return;
        }

        float izquierda = dp(38);
        float derecha = getWidth() - dp(8);
        float arriba = dp(12);
        float abajo = getHeight() - dp(28);
        if (derecha <= izquierda || abajo <= arriba) {
            return;
        }

        double valorMaximo = 120;
        for (MedicionDiaria medicion : mediciones) {
            valorMaximo = Math.max(valorMaximo, medicion.valor);
        }
        valorMaximo = Math.ceil(valorMaximo / 40) * 40;
        float alto = abajo - arriba;
        float ancho = derecha - izquierda;

        pinturaEjes.setTextAlign(Paint.Align.RIGHT);
        for (int i = 0; i <= 3; i++) {
            float proporcion = i / 3f;
            float y = abajo - alto * proporcion;
            canvas.drawLine(izquierda, y, derecha, y, pinturaEjes);
            canvas.drawText(String.format(Locale.getDefault(), "%.0f", valorMaximo * proporcion),
                    izquierda - dp(6), y + dp(4), pinturaEjes);
        }

        if (valorMaximo >= 100) {
            float yUmbral = abajo - (float) (100 / valorMaximo) * alto;
            canvas.drawLine(izquierda, yUmbral, derecha, yUmbral, pinturaUmbral);
            pinturaEjes.setColor(getResources().getColor(R.color.nivel_moderado));
            pinturaEjes.setTextAlign(Paint.Align.RIGHT);
            canvas.drawText(getContext().getString(R.string.mis_datos_limite_moderado),
                    derecha - dp(2), yUmbral - dp(4), pinturaEjes);
            pinturaEjes.setColor(getResources().getColor(R.color.texto_secundario));
        }

        pinturaEjes.setTextAlign(Paint.Align.CENTER);
        for (int hora = 0; hora <= 24; hora += 6) {
            float x = izquierda + ancho * hora / 24f;
            canvas.drawText(hora + "h", x, getHeight() - dp(5), pinturaEjes);
        }

        Path linea = new Path();
        boolean iniciado = false;
        float ultimoX = izquierda;
        float ultimoY = abajo;
        for (MedicionDiaria medicion : mediciones) {
            if (medicion.momento < inicioMs || medicion.momento >= finMs) {
                continue;
            }
            float x = izquierda + ancho * (medicion.momento - inicioMs) / (float) (finMs - inicioMs);
            float y = abajo - (float) (medicion.valor / valorMaximo) * alto;
            if (!iniciado) {
                linea.moveTo(x, y);
                iniciado = true;
            } else {
                linea.lineTo(x, y);
            }
            ultimoX = x;
            ultimoY = y;
        }
        if (!iniciado) {
            return;
        }
        Path relleno = new Path(linea);
        relleno.lineTo(ultimoX, abajo);
        relleno.lineTo(izquierda, abajo);
        relleno.close();
        canvas.drawPath(relleno, pinturaRelleno);
        canvas.drawPath(linea, pinturaLinea);
        pinturaLinea.setStyle(Paint.Style.FILL);
        canvas.drawCircle(ultimoX, ultimoY, dp(4), pinturaLinea);
        pinturaLinea.setStyle(Paint.Style.STROKE);
    }

    private float dp(float valor) {
        return valor * getResources().getDisplayMetrics().density;
    }
}
