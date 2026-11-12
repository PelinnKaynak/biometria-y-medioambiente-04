// ---------------------------------------------------------------------------
// Fichero:     InicioActivity.java
// Descripción: Pantalla de inicio (Figma: «inicio», «inicio (sin sensor)» e
//              «inicio · notificaciones abiertas»). Muestra la calidad del
//              aire ahora (última medición con su valor, nivel y hora, y un
//              aviso si tiene más de 1 hora), las últimas mediciones (al
//              tocar una pasa al arco), la tarjeta «Mi sensor» o, sin sensor,
//              la de vincularlo, los accesos a la previsión y a «Mis lugares»
//              y el panel de notificaciones de la campana. Las mediciones
//              salen de LogicaFakeInicio (de ejemplo hasta T017). Diseño en
//              doc/app_design.md. Tarea T006.
// Autores:     Equipo 04 – SenseTech
// Fecha:       12/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.animation.ObjectAnimator;
import android.animation.PropertyValuesHolder;
import android.animation.ValueAnimator;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

// InicioActivity class: the home screen with the air quality now.
public class InicioActivity extends AppCompatActivity {

    // Dónde se recuerda si el usuario tiene sensor (para enseñar la tarjeta al abrir)
    private static final String PREFERENCIAS = "inicio";
    private static final String CLAVE_SENSOR = "tieneSensor:";

    // Cada minuto se actualiza «hace X min» mientras la pantalla está abierta
    private static final long REFRESCO_TEXTOS = 60_000L;

    private final LogicaFakeInicio logicaInicio = new LogicaFakeInicio();
    private final LogicaFakePerfil logicaPerfil = new LogicaFakePerfil();
    private final Handler temporizador = new Handler(Looper.getMainLooper());
    private final Runnable refrescarTextos = this::refrescarTextos;

    private IndicadorCalidad indicador;
    private TextView tituloCalidad;
    private View botonAhora;
    private TextView textoValor;
    private TextView textoNivel;
    private TextView textoMomento;
    private TextView textoMensaje;
    private View avisoAntigua;
    private TextView textoAvisoAntigua;
    private View progresoCalidad;
    private TextView tituloUltimas;
    private LinearLayout listaUltimas;
    private View tarjetaUltimas;
    private View tarjetaMiSensor;
    private View tarjetaVincular;
    private TextView textoEstadoSensor;
    private View puntoEstadoSensor;
    private View haloEstadoSensor;
    private TextView textoBateria;
    private TextView textoPrevision;
    private TextView textoLugares;
    private LinearLayout listaLugares;
    private TextView insigniaAvisos;
    private View iconoCampana;
    private View capaAvisos;
    private View panelAvisos;
    private LinearLayout listaAvisos;

    private List<Medicion> mediciones = null;    // null: aún no han llegado
    private boolean deEjemplo = false;
    private Boolean tieneSensor = null;          // null: aún no ha respondido el servidor
    private int elegida = 0;                     // medición que enseña el arco (0 = la última)
    private long valorMostrado = 0;              // número que se ve ahora en el arco
    private boolean animado = false;             // la entrada se anima solo la primera vez
    private List<Aviso> avisos = new ArrayList<>();
    private Set<String> leidos = new HashSet<>();   // claves de los avisos ya leídos
    private int sinLeer = 0;
    private ObjectAnimator latido;               // halo del punto «Conectado»
    private OnBackPressedCallback cerrarAvisosAlVolver;

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: connects the bottom bar, the buttons and the press
    //               effects. The data is asked in onResume().
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_inicio);
        BarraNavegacion.conectar(this, BarraNavegacion.Pestanya.INICIO);

        indicador = findViewById(R.id.indicadorCalidad);
        tituloCalidad = findViewById(R.id.tituloCalidad);
        botonAhora = findViewById(R.id.botonAhora);
        textoValor = findViewById(R.id.textoValor);
        textoNivel = findViewById(R.id.textoNivel);
        textoMomento = findViewById(R.id.textoMomento);
        textoMensaje = findViewById(R.id.textoMensaje);
        avisoAntigua = findViewById(R.id.avisoAntigua);
        textoAvisoAntigua = findViewById(R.id.textoAvisoAntigua);
        progresoCalidad = findViewById(R.id.progresoCalidad);
        tituloUltimas = findViewById(R.id.tituloUltimas);
        listaUltimas = findViewById(R.id.listaUltimas);
        tarjetaUltimas = findViewById(R.id.tarjetaUltimas);
        tarjetaMiSensor = findViewById(R.id.tarjetaMiSensor);
        tarjetaVincular = findViewById(R.id.tarjetaVincular);
        textoEstadoSensor = findViewById(R.id.textoEstadoSensor);
        puntoEstadoSensor = findViewById(R.id.puntoEstadoSensor);
        haloEstadoSensor = findViewById(R.id.haloEstadoSensor);
        textoBateria = findViewById(R.id.textoBateria);
        textoPrevision = findViewById(R.id.textoPrevision);
        textoLugares = findViewById(R.id.textoLugares);
        listaLugares = findViewById(R.id.listaLugares);
        insigniaAvisos = findViewById(R.id.insigniaAvisos);
        iconoCampana = findViewById(R.id.iconoCampana);
        capaAvisos = findViewById(R.id.capaAvisos);
        panelAvisos = findViewById(R.id.panelAvisos);
        listaAvisos = findViewById(R.id.listaAvisos);

        // Vincular: como desde el perfil, al terminar vuelve aquí (onResume recarga)
        findViewById(R.id.botonVincular).setOnClickListener(vista ->
                startActivity(new Intent(this, VincularSensorActivity.class)
                        .putExtra(VincularSensorActivity.EXTRA_DESDE_PERFIL, true)));
        // «Mi sensor», «Mis datos», la previsión y «Mis lugares» son otras tareas
        findViewById(R.id.botonVerSensor).setOnClickListener(vista -> abrir(ProximamenteActivity.Seccion.MI_SENSOR));
        findViewById(R.id.botonVerMas).setOnClickListener(vista -> abrir(ProximamenteActivity.Seccion.MIS_DATOS));
        findViewById(R.id.filaPrevision).setOnClickListener(vista -> abrir(ProximamenteActivity.Seccion.PREVISION));
        findViewById(R.id.filaLugares).setOnClickListener(vista -> abrir(ProximamenteActivity.Seccion.MIS_LUGARES));
        findViewById(R.id.botonReintentar).setOnClickListener(vista -> cargarMediciones());
        findViewById(R.id.botonCampana).setOnClickListener(vista -> abrirAvisos());
        botonAhora.setOnClickListener(vista -> elegir(0, true));
        capaAvisos.setOnClickListener(vista -> cerrarAvisos());

        EfectoPulsar.aplicar(findViewById(R.id.filaPrevision), findViewById(R.id.filaLugares),
                findViewById(R.id.botonVerSensor), findViewById(R.id.botonVincular),
                findViewById(R.id.botonReintentar), botonAhora);

        // «Atrás» con las notificaciones abiertas las cierra
        cerrarAvisosAlVolver = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                cerrarAvisos();
            }
        };
        getOnBackPressedDispatcher().addCallback(this, cerrarAvisosAlVolver);

        // La tarjeta del sensor sale ya, con lo que se sabía, para que entre a
        // la vez que las demás; luego el servidor la confirma o la cambia
        tieneSensor = sensorRecordado();
        if (tieneSensor != null) {
            mostrarSensor(false);
        }
    }

    // -----------------------------------------------------------------------
    // sensorRecordado() --x
    // B | null <--
    // What it does: if the user had a sensor the last time the server
    //               answered (saved on the phone), or true with the example
    //               sensor (until T017). null if it is not known yet.
    // -----------------------------------------------------------------------
    private Boolean sensorRecordado() {
        if (LogicaFakeInicio.SENSOR_DE_EJEMPLO) {
            return true;
        }
        SharedPreferences preferencias = getSharedPreferences(PREFERENCIAS, MODE_PRIVATE);
        String clave = CLAVE_SENSOR + Sesion.correoActual(this);
        return preferencias.contains(clave) ? preferencias.getBoolean(clave, false) : null;
    }

    private void recordarSensor(boolean tiene) {
        getSharedPreferences(PREFERENCIAS, MODE_PRIVATE).edit()
                .putBoolean(CLAVE_SENSOR + Sesion.correoActual(this), tiene).apply();
    }

    // -----------------------------------------------------------------------
    // onResume() -->       (lo llama Android al abrir la pantalla y al volver a ella)
    // What it does: asks the measurements and the user's data again (after
    //               linking a sensor the card changes) and starts updating
    //               «hace X min» every minute.
    // -----------------------------------------------------------------------
    @Override
    protected void onResume() {
        super.onResume();
        cargarMediciones();
        cargarSensor();
        temporizador.postDelayed(refrescarTextos, REFRESCO_TEXTOS);
    }

    @Override
    protected void onPause() {
        super.onPause();
        temporizador.removeCallbacks(refrescarTextos);
        pararLatido();
    }

    private void abrir(ProximamenteActivity.Seccion seccion) {
        startActivity(ProximamenteActivity.intentPara(this, seccion));
    }

    // -----------------------------------------------------------------------
    // cargarMediciones() -->
    // What it does: asks the last measurements to LogicaFakeInicio and shows
    //               them, or the error with «Reintentar».
    // -----------------------------------------------------------------------
    private void cargarMediciones() {
        if (mediciones == null) {
            progresoCalidad.setVisibility(View.VISIBLE);
        }
        findViewById(R.id.bloqueError).setVisibility(View.GONE);
        logicaInicio.obtenerUltimasMediciones(Sesion.token(this), new LogicaFakeInicio.RespuestaMediciones() {
            @Override
            public void medicionesObtenidas(List<Medicion> lista, boolean ejemplo) {
                progresoCalidad.setVisibility(View.GONE);
                mediciones = lista;
                deEjemplo = ejemplo;
                mostrarMediciones();
                mostrarAccesos();
                actualizarAvisos();
            }

            @Override
            public void sesionCaducada() {
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                progresoCalidad.setVisibility(View.GONE);
                if (mediciones == null) {
                    mostrarError(mensaje);
                }
            }
        });
    }

    // -----------------------------------------------------------------------
    // cargarSensor() -->
    // What it does: asks GET /usuarioActual to know if the user has a linked
    //               sensor, and shows «Mi sensor» or the card to link one.
    //               Without connection, it keeps what it showed (or nothing).
    // -----------------------------------------------------------------------
    private void cargarSensor() {
        logicaPerfil.obtenerUsuario(Sesion.token(this), new LogicaFakePerfil.RespuestaUsuario() {
            @Override
            public void usuarioObtenido(DatosUsuario datos) {
                boolean primeraRespuesta = tieneSensor == null;
                recordarSensor(datos.tieneSensor());
                tieneSensor = LogicaFakeInicio.tieneSensor(datos.tieneSensor());
                mostrarSensor(primeraRespuesta);
                actualizarAvisos();
            }

            @Override
            public void sesionCaducada() {
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                // sin conexión: con el sensor de ejemplo (hasta T017) se enseña igual
                if (tieneSensor == null && LogicaFakeInicio.SENSOR_DE_EJEMPLO) {
                    tieneSensor = true;
                    mostrarSensor(true);
                    actualizarAvisos();
                }
            }
        });
    }

    // -----------------------------------------------------------------------
    // mostrarMediciones() -->
    // What it does: one box per measurement (value and hour) and the newest
    //               in the arc. The first time, the boxes come in one after
    //               another. Without measurements, an empty arc and a text.
    // -----------------------------------------------------------------------
    private void mostrarMediciones() {
        boolean animar = !animado;
        animado = true;
        if (mediciones.isEmpty()) {
            indicador.vaciar();
            valorMostrado = 0;
            textoValor.setText(R.string.inicio_sin_valor);
            textoNivel.setText("");
            textoMomento.setText("");
            textoMensaje.setText(Boolean.TRUE.equals(tieneSensor)
                    ? R.string.inicio_sin_mediciones_sensor : R.string.inicio_sin_mediciones);
            avisoAntigua.setVisibility(View.GONE);
            tarjetaUltimas.setVisibility(View.GONE);
            if (animar) {
                animarEntrada();
            }
            return;
        }

        // La primera es la de ahora (en el arco); las cajas son las anteriores
        tarjetaUltimas.setVisibility(mediciones.size() > 1 ? View.VISIBLE : View.GONE);
        listaUltimas.removeAllViews();
        LayoutInflater inflador = LayoutInflater.from(this);
        ZoneId zona = ZoneId.systemDefault();
        for (int i = 1; i < mediciones.size(); i++) {
            Medicion medicion = mediciones.get(i);
            View caja = inflador.inflate(R.layout.item_medicion_reciente, listaUltimas, false);
            ((TextView) caja.findViewById(R.id.valorMedicion)).setText(String.valueOf(medicion.valorRedondeado()));
            ((TextView) caja.findViewById(R.id.horaMedicion)).setText(TiempoTranscurrido.hora(medicion.momento, zona));
            final int indice = i;
            caja.setOnClickListener(vista -> elegir(indice == elegida ? 0 : indice, true));
            EfectoPulsar.aplicar(caja);
            LinearLayout.LayoutParams parametros = (LinearLayout.LayoutParams) caja.getLayoutParams();
            parametros.width = 0;
            parametros.weight = 1;
            if (i > 1) {
                parametros.setMarginStart(getResources().getDimensionPixelSize(R.dimen.inicio_separacion_cajas));
            }
            listaUltimas.addView(caja, parametros);
            if (animar) {
                caja.setAlpha(0f);
                caja.setScaleX(0.85f);
                caja.setScaleY(0.85f);
                caja.animate().alpha(1f).scaleX(1f).scaleY(1f).setStartDelay(310 + 70L * i)
                        .setDuration(320).setInterpolator(new OvershootInterpolator(1.6f)).start();
            }
        }

        elegida = Math.min(elegida, mediciones.size() - 1);
        elegir(elegida, true);
        if (animar) {
            animarEntrada();
        }
    }

    // -----------------------------------------------------------------------
    // indice: N, animar: B --> elegir() -->
    // What it does: shows the measurement number indice in the arc (value,
    //               level, advice and «Medido hace…») and marks its box with
    //               a violet border and a line of its level color. The arc
    //               and the number go from what was shown to the new value.
    //               The title says «ahora» for the last one and «a las
    //               15:19» for an older one (it changes with a fade); then
    //               the «Ahora» button appears to go back to the last one.
    // -----------------------------------------------------------------------
    private void elegir(int indice, boolean animar) {
        elegida = indice;
        Medicion medicion = mediciones.get(indice);
        NivelOzono nivel = medicion.nivel();
        int color = ContextCompat.getColor(this, colorDe(nivel));

        String titulo = indice == 0 ? getString(R.string.inicio_calidad_titulo)
                : getString(R.string.inicio_calidad_titulo_hora,
                        TiempoTranscurrido.hora(medicion.momento, ZoneId.systemDefault()));
        if (!titulo.contentEquals(tituloCalidad.getText())) {
            tituloCalidad.animate().cancel();
            tituloCalidad.animate().alpha(0f).setDuration(120).withEndAction(() -> {
                tituloCalidad.setText(titulo);
                tituloCalidad.animate().alpha(1f).setDuration(180).start();
            }).start();
        }
        mostrarBotonAhora(indice != 0);
        indicador.mostrar(medicion.valor, color, animar);
        contarHasta(medicion.valorRedondeado(), animar);
        textoNivel.setText(nombreDe(nivel));
        textoNivel.setTextColor(color);
        textoMensaje.setText(mensajeDe(nivel));

        // la caja i es la medición i + 1 (la 0 es la de ahora)
        for (int i = 0; i < listaUltimas.getChildCount(); i++) {
            View caja = listaUltimas.getChildAt(i);
            boolean marcada = i + 1 == indice;
            caja.setSelected(marcada);
            View marca = caja.findViewById(R.id.marcaMedicion);
            marca.setBackgroundTintList(ColorStateList.valueOf(
                    ContextCompat.getColor(this, colorDe(mediciones.get(i + 1).nivel()))));
            marca.animate().scaleX(marcada ? 1f : 0f).setDuration(220).start();
        }
        refrescarTextos();
    }

    // el botón «Ahora» aparece (con rebote) o se va
    private void mostrarBotonAhora(boolean visible) {
        if (visible == (botonAhora.getVisibility() == View.VISIBLE)) {
            return;
        }
        botonAhora.animate().cancel();
        if (visible) {
            botonAhora.setVisibility(View.VISIBLE);
            botonAhora.setAlpha(0f);
            botonAhora.setScaleX(0.6f);
            botonAhora.setScaleY(0.6f);
            botonAhora.animate().alpha(1f).scaleX(1f).scaleY(1f).setStartDelay(0).setDuration(260)
                    .setInterpolator(new OvershootInterpolator(2f)).start();
        } else {
            botonAhora.animate().alpha(0f).scaleX(0.6f).scaleY(0.6f).setStartDelay(0).setDuration(160)
                    .withEndAction(() -> botonAhora.setVisibility(View.GONE)).start();
        }
    }

    // -----------------------------------------------------------------------
    // refrescarTextos() -->
    // What it does: updates the texts that depend on the time («Medido hace
    //               X min» of the chosen measurement, the warning if the last
    //               one is older than 1 hour and the state of the sensor) and
    //               programs the next update.
    // -----------------------------------------------------------------------
    private void refrescarTextos() {
        temporizador.removeCallbacks(refrescarTextos);
        if (mediciones != null && !mediciones.isEmpty()) {
            long ahora = System.currentTimeMillis();
            Medicion medicion = mediciones.get(elegida);
            textoMomento.setText(getString(R.string.inicio_momento,
                    TiempoTranscurrido.haceCuanto(medicion.momento, ahora),
                    TiempoTranscurrido.hora(medicion.momento, ZoneId.systemDefault())));
            Medicion ultima = mediciones.get(0);
            boolean antigua = TiempoTranscurrido.esAntigua(ultima.momento, ahora);
            avisoAntigua.setVisibility(antigua ? View.VISIBLE : View.GONE);
            if (antigua) {
                textoAvisoAntigua.setText(getString(R.string.inicio_aviso_antigua,
                        TiempoTranscurrido.haceCuanto(ultima.momento, ahora)));
            }
        }
        if (Boolean.TRUE.equals(tieneSensor)) {
            mostrarSensor(false);
        }
        if (!isFinishing()) {
            temporizador.postDelayed(refrescarTextos, REFRESCO_TEXTOS);
        }
    }

    // -----------------------------------------------------------------------
    // aparecer: B --> mostrarSensor() -->
    // What it does: with sensor, the card «Mi sensor» with «Conectado» (green
    //               dot with a beating halo) or «Desconectado» (grey, last
    //               measurement older than 1 hour) and the battery (only with
    //               the example data until T017); without sensor, the card to
    //               link one. With aparecer, the card comes in with a fade.
    // -----------------------------------------------------------------------
    private void mostrarSensor(boolean aparecer) {
        View visible = Boolean.TRUE.equals(tieneSensor) ? tarjetaMiSensor : tarjetaVincular;
        View oculta = visible == tarjetaMiSensor ? tarjetaVincular : tarjetaMiSensor;
        oculta.setVisibility(View.GONE);
        if (visible.getVisibility() != View.VISIBLE) {
            visible.setVisibility(View.VISIBLE);
            if (aparecer) {
                visible.setAlpha(0f);
                visible.setTranslationY(dp(14));
                visible.animate().alpha(1f).translationY(0f).setDuration(380)
                        .setInterpolator(new DecelerateInterpolator()).start();
            }
        }

        if (visible == tarjetaMiSensor && mediciones == null) {
            // aún sin mediciones: sin estado hasta saber si llegan datos
            textoEstadoSensor.setText("");
            pararLatido();
        } else if (visible == tarjetaMiSensor) {
            boolean conectado = mediciones != null && !mediciones.isEmpty()
                    && !TiempoTranscurrido.esAntigua(mediciones.get(0).momento, System.currentTimeMillis());
            textoEstadoSensor.setText(conectado ? R.string.inicio_sensor_conectado : R.string.inicio_sensor_desconectado);
            ColorStateList color = ColorStateList.valueOf(ContextCompat.getColor(this,
                    conectado ? R.color.nivel_bueno : R.color.texto_terciario));
            puntoEstadoSensor.setBackgroundTintList(color);
            haloEstadoSensor.setBackgroundTintList(color);
            if (conectado) {
                empezarLatido();
            } else {
                pararLatido();
            }
            textoBateria.setVisibility(deEjemplo ? View.VISIBLE : View.GONE);
            textoBateria.setText(getString(R.string.inicio_bateria, LogicaFakeInicio.BATERIA_EJEMPLO));
        } else {
            pararLatido();
        }
        // El título cambia: con sensor son sus mediciones; sin él, las de la zona
        tituloUltimas.setText(Boolean.TRUE.equals(tieneSensor)
                ? R.string.inicio_ultimas_mediciones : R.string.inicio_ultimas_zona);
    }

    // halo del punto verde: crece y se desvanece cada 1,6 s
    private void empezarLatido() {
        if (latido != null && latido.isRunning()) {
            return;
        }
        latido = ObjectAnimator.ofPropertyValuesHolder(haloEstadoSensor,
                PropertyValuesHolder.ofFloat(View.SCALE_X, 0.8f, 2.1f),
                PropertyValuesHolder.ofFloat(View.SCALE_Y, 0.8f, 2.1f),
                PropertyValuesHolder.ofFloat(View.ALPHA, 0.55f, 0f));
        latido.setDuration(1600);
        latido.setRepeatCount(ValueAnimator.INFINITE);
        latido.setInterpolator(new DecelerateInterpolator());
        latido.start();
    }

    private void pararLatido() {
        if (latido != null) {
            latido.cancel();
            latido = null;
        }
        haloEstadoSensor.setAlpha(0f);
    }

    // -----------------------------------------------------------------------
    // mostrarAccesos() -->
    // What it does: with the example data, «Mejor hora para salir» and «Mis
    //               lugares» show the Figma example (hours and a colored dot
    //               per place); without it, a short text of the section.
    // -----------------------------------------------------------------------
    private void mostrarAccesos() {
        textoPrevision.setText(deEjemplo ? LogicaFakeInicio.MEJOR_HORA_EJEMPLO
                : getString(R.string.inicio_prevision_texto));
        listaLugares.removeAllViews();
        listaLugares.setVisibility(deEjemplo ? View.VISIBLE : View.GONE);
        textoLugares.setVisibility(deEjemplo ? View.GONE : View.VISIBLE);
        if (!deEjemplo) {
            return;
        }
        for (int i = 0; i < LogicaFakeInicio.LUGARES_EJEMPLO.length; i++) {
            NivelOzono nivel = NivelOzono.desdeValor(LogicaFakeInicio.VALORES_LUGARES_EJEMPLO[i]);
            View lugar = LayoutInflater.from(this).inflate(R.layout.item_lugar_inicio, listaLugares, false);
            lugar.findViewById(R.id.puntoLugar).setBackgroundTintList(
                    ColorStateList.valueOf(ContextCompat.getColor(this, colorDe(nivel))));
            ((TextView) lugar.findViewById(R.id.textoLugar)).setText(getString(R.string.inicio_lugar_nivel,
                    LogicaFakeInicio.LUGARES_EJEMPLO[i], getString(nombreDe(nivel))));
            listaLugares.addView(lugar);
        }
    }

    // -----------------------------------------------------------------------
    // actualizarAvisos() -->
    // What it does: the notifications (the Figma examples, or the ones that
    //               come from the measurements) and, on the bell, the number
    //               of the ones not read yet. When it grows, the bell rings.
    // -----------------------------------------------------------------------
    private void actualizarAvisos() {
        long ahora = System.currentTimeMillis();
        avisos = deEjemplo ? LogicaFakeInicio.avisosDeEjemplo(ahora)
                : Aviso.calcular(mediciones, Boolean.TRUE.equals(tieneSensor), ahora);
        // Los de ejemplo (hasta T017) no se guardan como leídos: cada vez que se
        // abre la app vuelven a salir con su punto
        if (!deEjemplo) {
            leidos = AvisosLeidos.leer(this);
        }
        int antes = sinLeer;
        mostrarInsignia(Aviso.cuantosSinLeer(avisos, leidos));
        if (sinLeer > antes) {
            sonarCampana();
        }
    }

    // el número de la campana: aparece con rebote, cambia o se va encogiéndose
    private void mostrarInsignia(int cuantos) {
        boolean estaba = sinLeer > 0;
        sinLeer = cuantos;
        insigniaAvisos.animate().cancel();
        if (cuantos == 0) {
            if (estaba) {
                insigniaAvisos.animate().scaleX(0f).scaleY(0f).setStartDelay(0).setDuration(200)
                        .withEndAction(() -> insigniaAvisos.setVisibility(View.GONE)).start();
            } else {
                insigniaAvisos.setVisibility(View.GONE);
            }
            return;
        }
        insigniaAvisos.setText(String.valueOf(cuantos));
        if (estaba) {
            insigniaAvisos.setScaleX(1f);
            insigniaAvisos.setScaleY(1f);
        } else {
            insigniaAvisos.setVisibility(View.VISIBLE);
            insigniaAvisos.setScaleX(0f);
            insigniaAvisos.setScaleY(0f);
            insigniaAvisos.animate().scaleX(1f).scaleY(1f).setStartDelay(700).setDuration(300)
                    .setInterpolator(new OvershootInterpolator(3f)).start();
        }
    }

    // la campana se balancea desde arriba, como al sonar
    private void sonarCampana() {
        iconoCampana.post(() -> {
            iconoCampana.setPivotX(iconoCampana.getWidth() / 2f);
            iconoCampana.setPivotY(0f);
            ObjectAnimator balanceo = ObjectAnimator.ofFloat(iconoCampana, View.ROTATION,
                    0f, -16f, 13f, -9f, 6f, -3f, 0f);
            balanceo.setStartDelay(750);
            balanceo.setDuration(900);
            balanceo.start();
        });
    }

    // -----------------------------------------------------------------------
    // abrirAvisos() -->      cerrarAvisos() -->
    // What it does: the dark veil fades in and the white panel grows from
    //               the bell; the notifications come in one after another,
    //               the new ones with a violet dot. Touching one marks it as
    //               read (its dot goes away). Closing the panel (outside or
    //               «atrás») marks all of them as read.
    // -----------------------------------------------------------------------
    private void abrirAvisos() {
        if (capaAvisos.getVisibility() == View.VISIBLE) {
            return;
        }
        rellenarAvisos();
        capaAvisos.setVisibility(View.VISIBLE);
        capaAvisos.setAlpha(0f);
        capaAvisos.animate().alpha(1f).setDuration(200).start();
        panelAvisos.post(() -> {
            panelAvisos.setPivotX(panelAvisos.getWidth() - dp(16));
            panelAvisos.setPivotY(0f);
            panelAvisos.setScaleX(0.6f);
            panelAvisos.setScaleY(0.6f);
            panelAvisos.setAlpha(0f);
            panelAvisos.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(280)
                    .setInterpolator(new OvershootInterpolator(1.1f)).start();
        });
        for (int i = 0; i < listaAvisos.getChildCount(); i++) {
            View item = listaAvisos.getChildAt(i);
            item.setAlpha(0f);
            item.setTranslationY(dp(10));
            item.animate().alpha(1f).translationY(0f).setStartDelay(140 + 70L * i).setDuration(260)
                    .setInterpolator(new DecelerateInterpolator()).start();
        }
        cerrarAvisosAlVolver.setEnabled(true);
    }

    private void cerrarAvisos() {
        cerrarAvisosAlVolver.setEnabled(false);
        List<String> claves = new ArrayList<>();
        for (Aviso aviso : avisos) {
            claves.add(aviso.clave);
        }
        marcarLeidos(claves);
        panelAvisos.animate().scaleX(0.85f).scaleY(0.85f).alpha(0f).setDuration(170).start();
        capaAvisos.animate().alpha(0f).setDuration(200)
                .withEndAction(() -> capaAvisos.setVisibility(View.GONE)).start();
    }

    // una tarjeta por aviso: punto si no se ha leído, título, texto y hora
    private void rellenarAvisos() {
        listaAvisos.removeAllViews();
        findViewById(R.id.textoSinAvisos).setVisibility(avisos.isEmpty() ? View.VISIBLE : View.GONE);
        long ahora = System.currentTimeMillis();
        LayoutInflater inflador = LayoutInflater.from(this);
        for (Aviso aviso : avisos) {
            View item = inflador.inflate(R.layout.item_aviso, listaAvisos, false);
            View punto = item.findViewById(R.id.puntoAviso);
            boolean nuevo = !leidos.contains(aviso.clave);
            punto.setVisibility(nuevo ? View.VISIBLE : View.INVISIBLE);
            ((TextView) item.findViewById(R.id.tituloAviso)).setText(aviso.titulo);
            ((TextView) item.findViewById(R.id.textoAviso)).setText(aviso.texto);
            ((TextView) item.findViewById(R.id.horaAviso)).setText(
                    TiempoTranscurrido.horaODia(aviso.momento, ahora, ZoneId.systemDefault()));
            item.setOnClickListener(vista -> {
                if (punto.getVisibility() == View.VISIBLE) {
                    punto.animate().scaleX(0f).scaleY(0f).setDuration(220)
                            .withEndAction(() -> punto.setVisibility(View.INVISIBLE)).start();
                    marcarLeidos(java.util.Collections.singletonList(aviso.clave));
                }
            });
            EfectoPulsar.aplicar(item);
            listaAvisos.addView(item);
        }
    }

    // guarda las claves como leídas y actualiza el número de la campana
    private void marcarLeidos(List<String> claves) {
        if (!deEjemplo) {
            AvisosLeidos.marcar(this, claves);
        }
        leidos.addAll(claves);
        mostrarInsignia(Aviso.cuantosSinLeer(avisos, leidos));
    }

    // -----------------------------------------------------------------------
    // mensaje: Text --> mostrarError() -->
    // What it does: without measurements, the arc shows the error and the
    //               «Reintentar» button.
    // -----------------------------------------------------------------------
    private void mostrarError(String mensaje) {
        indicador.vaciar();
        valorMostrado = 0;
        textoValor.setText(R.string.inicio_sin_valor);
        textoNivel.setText("");
        textoMomento.setText("");
        textoMensaje.setText("");
        tarjetaUltimas.setVisibility(View.GONE);
        ((TextView) findViewById(R.id.textoError)).setText(mensaje);
        findViewById(R.id.bloqueError).setVisibility(View.VISIBLE);
    }

    // -----------------------------------------------------------------------
    // valor: Z, animar: B --> contarHasta() -->
    // What it does: the number goes from the one shown to the new value while
    //               the arc moves (0.9 s).
    // -----------------------------------------------------------------------
    private void contarHasta(long valor, boolean animar) {
        if (!animar || valor == valorMostrado) {
            valorMostrado = valor;
            textoValor.setText(getString(R.string.inicio_valor, valor));
            return;
        }
        ValueAnimator contador = ValueAnimator.ofInt((int) valorMostrado, (int) valor);
        contador.setDuration(900);
        contador.setInterpolator(new DecelerateInterpolator(1.6f));
        contador.addUpdateListener(a ->
                textoValor.setText(getString(R.string.inicio_valor, (long) (int) a.getAnimatedValue())));
        contador.start();
        valorMostrado = valor;
    }

    // -----------------------------------------------------------------------
    // animarEntrada() -->
    // What it does: the cards come in one after another from below.
    // -----------------------------------------------------------------------
    private void animarEntrada() {
        ViewGroup contenido = findViewById(R.id.contenidoInicio);
        int orden = 0;
        for (int i = 0; i < contenido.getChildCount(); i++) {
            View hijo = contenido.getChildAt(i);
            if (hijo.getVisibility() != View.VISIBLE) {
                continue;
            }
            hijo.setAlpha(0f);
            hijo.setTranslationY(dp(18));
            hijo.animate().alpha(1f).translationY(0f)
                    .setStartDelay(70L * orden++).setDuration(450)
                    .setInterpolator(new DecelerateInterpolator()).start();
        }
    }

    // -----------------------------------------------------------------------
    // nivel: NivelOzono --> colorDe() --x      nombreDe() --x      mensajeDe() --x
    // Z <--
    // What it does: the color (the same as «Información» and the web map),
    //               the name of the air quality («Buena»…) and the advice of
    //               each level.
    // -----------------------------------------------------------------------
    static int colorDe(NivelOzono nivel) {
        switch (nivel) {
            case BUENO:
                return R.color.nivel_bueno;
            case MODERADO:
                return R.color.nivel_moderado;
            case MALO:
                return R.color.nivel_malo;
            default:
                return R.color.nivel_muy_malo;
        }
    }

    static int nombreDe(NivelOzono nivel) {
        switch (nivel) {
            case BUENO:
                return R.string.inicio_calidad_buena;
            case MODERADO:
                return R.string.inicio_calidad_moderada;
            case MALO:
                return R.string.inicio_calidad_mala;
            default:
                return R.string.inicio_calidad_muy_mala;
        }
    }

    static int mensajeDe(NivelOzono nivel) {
        switch (nivel) {
            case BUENO:
                return R.string.inicio_mensaje_bueno;
            case MODERADO:
                return R.string.inicio_mensaje_moderado;
            case MALO:
                return R.string.inicio_mensaje_malo;
            default:
                return R.string.inicio_mensaje_muy_malo;
        }
    }

    private float dp(int valor) {
        return valor * getResources().getDisplayMetrics().density;
    }

    // -----------------------------------------------------------------------
    // cerrarSesion() -->
    // What it does: the token is no longer valid: forgets the session and
    //               goes back to the welcome screen (like the Perfil screen).
    // -----------------------------------------------------------------------
    private void cerrarSesion() {
        Sesion.cerrar(this);
        Intent intent = new Intent(this, BienvenidaActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }
}
