// ---------------------------------------------------------------------------
// Fichero:     AyudaActivity.java
// Descripción: Pantalla «Ayuda» (T043): las preguntas frecuentes, el formulario
//              para enviar una incidencia (con el tipo —y el sensor— ya elegidos
//              si se llega desde Vincular sensor o Mi sensor) y la lista «Mis
//              incidencias», con su estado y su conversación (IncidenciaActivity).
//              Usa las rutas de incidencias del servidor con el token de la
//              sesión (LogicaFakeAyuda). Se abre desde Perfil, Mi sensor y
//              Vincular sensor. Diseño en doc/app_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       20/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.transition.AutoTransition;
import android.transition.TransitionManager;
import android.util.TypedValue;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.widget.ImageViewCompat;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;

// AyudaActivity class: the Ayuda screen.
public class AyudaActivity extends AppCompatActivity {

    // Tipo de incidencia que sale elegido, y el sensor del que se habla (Mi sensor)
    static final String EXTRA_TIPO = "ayudaTipo";
    static final String EXTRA_SENSOR_NOMBRE = "ayudaSensorNombre";
    static final String EXTRA_SENSOR_SERIE = "ayudaSensorSerie";

    private static final String ESTADO_TIPO = "tipoElegido";
    private static final long DURACION_ABRIR_MS = 250;      // abrir / cerrar una pregunta

    // Preguntas frecuentes (las de la página Ayuda de la web): icono, pregunta y respuesta
    private static final int[][] PREGUNTAS = {
            {R.drawable.ic_info_sensor, R.string.ayuda_faq_1_pregunta, R.string.ayuda_faq_1_respuesta},
            {R.drawable.ic_info_bluetooth, R.string.ayuda_faq_2_pregunta, R.string.ayuda_faq_2_respuesta},
            {R.drawable.ic_info_ozono, R.string.ayuda_faq_3_pregunta, R.string.ayuda_faq_3_respuesta},
            {R.drawable.ic_info_niveles, R.string.ayuda_faq_4_pregunta, R.string.ayuda_faq_4_respuesta},
            {R.drawable.ic_info_candado, R.string.ayuda_faq_5_pregunta, R.string.ayuda_faq_5_respuesta},
    };

    private final LogicaFakeAyuda logica = new LogicaFakeAyuda();

    private String tipoElegido = Incidencia.TIPO_SENSOR;
    private boolean enviando = false;
    private boolean cargandoLista = false;

    private ScrollView scroll;
    private LinearLayout contenido, listaIncidencias;
    private View tarjetaFormulario, progresoLista, botonEnviar, botonReintentarLista;
    private TextView chipSensor, chipDatos, chipCuenta, chipOtra;
    private TextView lineaSensor, errorTipo, errorAsunto, errorDescripcion, errorFormulario, avisoEnviada;
    private TextView textoLista;
    private EditText campoAsunto, campoDescripcion;

    // -----------------------------------------------------------------------
    // contexto: Context, tipo: Text | null, sensorNombre: Text | null,
    // sensorSerie: Text | null --> intentPara() --x
    // Intent <--
    // What it does: the Intent that opens Ayuda. With a tipo, that tipo comes
    //               chosen and the screen goes down to the form; with the sensor
    //               (Mi sensor), its name and serial number are shown in the form
    //               for the types «sensor» and «datos» (the server adds the sensor
    //               to these incidences by itself).
    // -----------------------------------------------------------------------
    static Intent intentPara(Context contexto, String tipo, String sensorNombre, String sensorSerie) {
        Intent intent = new Intent(contexto, AyudaActivity.class);
        if (tipo != null) {
            intent.putExtra(EXTRA_TIPO, tipo);
        }
        if (sensorSerie != null && !sensorSerie.trim().isEmpty()) {
            intent.putExtra(EXTRA_SENSOR_NOMBRE, sensorNombre == null ? "" : sensorNombre);
            intent.putExtra(EXTRA_SENSOR_SERIE, sensorSerie);
        }
        return intent;
    }

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: adds the questions, connects the form and chooses the tipo.
    //               The list of incidences is loaded in onResume().
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_ayuda);

        scroll = findViewById(R.id.scrollAyuda);
        contenido = findViewById(R.id.contenidoAyuda);
        tarjetaFormulario = findViewById(R.id.tarjetaFormulario);
        listaIncidencias = findViewById(R.id.listaIncidencias);
        progresoLista = findViewById(R.id.progresoIncidencias);
        textoLista = findViewById(R.id.textoListaIncidencias);
        botonReintentarLista = findViewById(R.id.botonReintentarLista);
        chipSensor = findViewById(R.id.chipSensor);
        chipDatos = findViewById(R.id.chipDatos);
        chipCuenta = findViewById(R.id.chipCuenta);
        chipOtra = findViewById(R.id.chipOtra);
        lineaSensor = findViewById(R.id.lineaSensor);
        errorTipo = findViewById(R.id.errorTipo);
        errorAsunto = findViewById(R.id.errorAsunto);
        errorDescripcion = findViewById(R.id.errorDescripcion);
        errorFormulario = findViewById(R.id.errorFormulario);
        avisoEnviada = findViewById(R.id.avisoEnviada);
        campoAsunto = findViewById(R.id.campoAsunto);
        campoDescripcion = findViewById(R.id.campoDescripcion);
        botonEnviar = findViewById(R.id.botonEnviar);

        findViewById(R.id.botonVolver).setOnClickListener(vista -> finish());
        botonEnviar.setOnClickListener(vista -> pulsarEnviar());
        botonReintentarLista.setOnClickListener(vista -> cargarIncidencias());

        // Al escribir en un campo desaparece su error (y el aviso de «enviada» del envío anterior)
        campoAsunto.addTextChangedListener(alEscribir(errorAsunto));
        campoDescripcion.addTextChangedListener(alEscribir(errorDescripcion));

        anyadirPreguntas();
        conectarChips();

        String tipoPedido = getIntent().getStringExtra(EXTRA_TIPO);
        if (savedInstanceState != null) {
            tipoElegido = Incidencia.normalizarTipo(savedInstanceState.getString(ESTADO_TIPO));
        } else if (tipoPedido != null) {
            tipoElegido = Incidencia.normalizarTipo(tipoPedido);
        }
        seleccionarTipo(tipoElegido);

        // Si se llega con un tipo elegido (Vincular sensor, Mi sensor), se baja directamente al formulario
        if (savedInstanceState == null && tipoPedido != null) {
            scroll.post(() -> scroll.smoothScrollTo(0, Math.max(0, tarjetaFormulario.getTop() - dp(24))));
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        estado.putString(ESTADO_TIPO, tipoElegido);
    }

    // Cada vez que se ve la pantalla se actualiza la lista (al volver de una conversación puede haber
    // cambiado el estado de una incidencia)
    @Override
    protected void onResume() {
        super.onResume();
        cargarIncidencias();
    }

    // -----------------------------------------------------------------------
    // anyadirPreguntas() -->
    // What it does: one card per frequent question, closed; touching it opens
    //               or closes the answer.
    // -----------------------------------------------------------------------
    private void anyadirPreguntas() {
        LinearLayout temas = findViewById(R.id.temasFaq);
        LayoutInflater inflador = LayoutInflater.from(this);
        for (int[] pregunta : PREGUNTAS) {
            View tarjeta = inflador.inflate(R.layout.item_tema_informacion, temas, false);
            ((ImageView) tarjeta.findViewById(R.id.iconoTema)).setImageResource(pregunta[0]);
            ((TextView) tarjeta.findViewById(R.id.tituloTema)).setText(pregunta[1]);
            tarjeta.findViewById(R.id.subtituloTema).setVisibility(View.GONE);

            TextView respuesta = new TextView(this);
            respuesta.setText(pregunta[2]);
            respuesta.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
            respuesta.setTextColor(ContextCompat.getColor(this, R.color.texto_cuerpo));
            respuesta.setLineSpacing(0, 1.3f);
            ((LinearLayout) tarjeta.findViewById(R.id.cuerpoTema)).addView(respuesta);

            tarjeta.setOnClickListener(vista -> alternar(tarjeta));
            temas.addView(tarjeta);
        }
    }

    // tarjeta: View --> alternar() --> abre o cierra la respuesta (altura animada y flecha que gira)
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

    // ---- Formulario ---------------------------------------------------------

    private void conectarChips() {
        chipSensor.setOnClickListener(vista -> seleccionarTipo(Incidencia.TIPO_SENSOR));
        chipDatos.setOnClickListener(vista -> seleccionarTipo(Incidencia.TIPO_DATOS));
        chipCuenta.setOnClickListener(vista -> seleccionarTipo(Incidencia.TIPO_CUENTA));
        chipOtra.setOnClickListener(vista -> seleccionarTipo(Incidencia.TIPO_OTRA));
    }

    // -----------------------------------------------------------------------
    // tipo: Text --> seleccionarTipo() -->
    // What it does: marks that option (the chosen one in violet) and shows the
    //               sensor line if it is a «sensor» or «datos» incidence and we
    //               come from Mi sensor.
    // -----------------------------------------------------------------------
    private void seleccionarTipo(String tipo) {
        tipoElegido = tipo;
        marcarChip(chipSensor, Incidencia.TIPO_SENSOR.equals(tipo));
        marcarChip(chipDatos, Incidencia.TIPO_DATOS.equals(tipo));
        marcarChip(chipCuenta, Incidencia.TIPO_CUENTA.equals(tipo));
        marcarChip(chipOtra, Incidencia.TIPO_OTRA.equals(tipo));
        errorTipo.setVisibility(View.GONE);

        String serie = getIntent().getStringExtra(EXTRA_SENSOR_SERIE);
        boolean conSensor = serie != null && !serie.isEmpty()
                && (Incidencia.TIPO_SENSOR.equals(tipo) || Incidencia.TIPO_DATOS.equals(tipo));
        lineaSensor.setVisibility(conSensor ? View.VISIBLE : View.GONE);
        if (conSensor) {
            String nombre = getIntent().getStringExtra(EXTRA_SENSOR_NOMBRE);
            lineaSensor.setText(getString(R.string.ayuda_sensor_preseleccionado,
                    nombre == null || nombre.isEmpty() ? "AERIS" : nombre, serie));
        }
    }

    private void marcarChip(TextView chip, boolean elegido) {
        chip.setSelected(elegido);
        chip.setTextColor(ContextCompat.getColor(this, elegido ? R.color.violeta : R.color.texto_principal));
    }

    // -----------------------------------------------------------------------
    // pulsarEnviar() -->
    // What it does: checks the form (ValidadorIncidencia) and sends the
    //               incidence. If it goes well, it empties the form, says it and
    //               updates the list; if not, it says why and keeps what was written.
    // -----------------------------------------------------------------------
    private void pulsarEnviar() {
        if (enviando) {
            return;
        }
        limpiarErrores();
        String asunto = campoAsunto.getText().toString();
        String descripcion = campoDescripcion.getText().toString();
        Map<String, String> errores = ValidadorIncidencia.validarNueva(tipoElegido, asunto, descripcion);
        if (!errores.isEmpty()) {
            mostrarErrores(errores);
            return;
        }
        String token = Sesion.token(this);
        if (token == null) {
            cerrarSesion();
            return;
        }
        mostrarEnviando(true);
        logica.crearIncidencia(token, tipoElegido, asunto, descripcion, new LogicaFakeAyuda.RespuestaCreacion() {
            @Override
            public void incidenciaCreada(Incidencia incidencia) {
                mostrarEnviando(false);
                if (isDestroyed()) {
                    return;
                }
                campoAsunto.setText("");
                campoDescripcion.setText("");
                avisoEnviada.setVisibility(View.VISIBLE);
                cargarIncidencias();
            }

            @Override
            public void datosNoValidos(String mensaje) {
                mostrarEnviando(false);
                mostrarErrorFormulario(mensaje);
            }

            @Override
            public void sesionCaducada() {
                mostrarEnviando(false);
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                mostrarEnviando(false);
                mostrarErrorFormulario(mensaje);
            }
        });
    }

    private void mostrarEnviando(boolean valor) {
        enviando = valor;
        if (isDestroyed()) {
            return;
        }
        ((TextView) botonEnviar).setText(valor ? R.string.ayuda_enviando : R.string.ayuda_enviar);
        botonEnviar.setAlpha(valor ? 0.6f : 1f);
    }

    // -----------------------------------------------------------------------
    // errorPropio: TextView --> alEscribir() --x
    // TextWatcher <--
    // What it does: when the user writes in a field, hides the error of that field,
    //               the general one and the «incidencia enviada» notice.
    // -----------------------------------------------------------------------
    private TextWatcher alEscribir(TextView errorPropio) {
        return new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence texto, int inicio, int cuenta, int despues) {
            }

            @Override
            public void onTextChanged(CharSequence texto, int inicio, int antes, int cuenta) {
            }

            @Override
            public void afterTextChanged(Editable texto) {
                errorPropio.setVisibility(View.GONE);
                errorFormulario.setVisibility(View.GONE);
                avisoEnviada.setVisibility(View.GONE);
            }
        };
    }

    private void limpiarErrores() {
        errorTipo.setVisibility(View.GONE);
        errorAsunto.setVisibility(View.GONE);
        errorDescripcion.setVisibility(View.GONE);
        errorFormulario.setVisibility(View.GONE);
        avisoEnviada.setVisibility(View.GONE);
    }

    private void mostrarErrores(Map<String, String> errores) {
        ponerError(errorTipo, errores.get(ValidadorIncidencia.CAMPO_TIPO));
        ponerError(errorAsunto, errores.get(ValidadorIncidencia.CAMPO_ASUNTO));
        ponerError(errorDescripcion, errores.get(ValidadorIncidencia.CAMPO_DESCRIPCION));
    }

    private void mostrarErrorFormulario(String mensaje) {
        if (!isDestroyed()) {
            ponerError(errorFormulario, mensaje);
        }
    }

    private void ponerError(TextView etiqueta, String mensaje) {
        if (mensaje == null) {
            return;
        }
        etiqueta.setText(mensaje);
        etiqueta.setVisibility(View.VISIBLE);
    }

    // ---- Mis incidencias ----------------------------------------------------

    // -----------------------------------------------------------------------
    // cargarIncidencias() -->
    // What it does: asks for the incidences of the user (one request at a time)
    //               and paints them, or says that there are none or why it failed.
    // -----------------------------------------------------------------------
    private void cargarIncidencias() {
        if (cargandoLista) {
            return;
        }
        String token = Sesion.token(this);
        if (token == null) {
            cerrarSesion();
            return;
        }
        cargandoLista = true;
        boolean primeraVez = listaIncidencias.getChildCount() == 0;
        progresoLista.setVisibility(primeraVez ? View.VISIBLE : View.GONE);
        textoLista.setVisibility(View.GONE);
        botonReintentarLista.setVisibility(View.GONE);
        logica.obtenerIncidencias(token, new LogicaFakeAyuda.RespuestaIncidencias() {
            @Override
            public void incidenciasObtenidas(List<Incidencia> incidencias) {
                cargandoLista = false;
                if (!isDestroyed()) {
                    pintarIncidencias(incidencias);
                }
            }

            @Override
            public void sesionCaducada() {
                cargandoLista = false;
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                cargandoLista = false;
                if (!isDestroyed()) {
                    listaIncidencias.removeAllViews();
                    progresoLista.setVisibility(View.GONE);
                    textoLista.setText(mensaje);
                    textoLista.setVisibility(View.VISIBLE);
                    botonReintentarLista.setVisibility(View.VISIBLE);
                }
            }
        });
    }

    private void pintarIncidencias(List<Incidencia> incidencias) {
        progresoLista.setVisibility(View.GONE);
        botonReintentarLista.setVisibility(View.GONE);
        listaIncidencias.removeAllViews();
        if (incidencias.isEmpty()) {
            textoLista.setText(R.string.ayuda_sin_incidencias);
            textoLista.setVisibility(View.VISIBLE);
            return;
        }
        textoLista.setVisibility(View.GONE);
        LayoutInflater inflador = LayoutInflater.from(this);
        for (Incidencia incidencia : incidencias) {
            View tarjeta = inflador.inflate(R.layout.item_incidencia, listaIncidencias, false);
            ((TextView) tarjeta.findViewById(R.id.tipoIncidencia))
                    .setText(getString(textoTipo(incidencia.tipo)).toUpperCase(Locale.getDefault()));
            aplicarEstado(this, tarjeta.findViewById(R.id.estadoIncidencia), incidencia.estado);
            ((TextView) tarjeta.findViewById(R.id.asuntoIncidencia)).setText(incidencia.asunto);
            ((TextView) tarjeta.findViewById(R.id.descripcionIncidencia)).setText(incidencia.descripcion);
            ((TextView) tarjeta.findViewById(R.id.fechaIncidencia)).setText(formatearFecha(incidencia.fechaCreacionMs));
            tarjeta.findViewById(R.id.conRespuestaIncidencia)
                    .setVisibility(incidencia.tieneRespuesta ? View.VISIBLE : View.GONE);
            tarjeta.setOnClickListener(vista -> startActivity(IncidenciaActivity.intentPara(this, incidencia)));
            listaIncidencias.addView(tarjeta);
        }
    }

    // ---- Ayudas compartidas con IncidenciaActivity ----------------------------

    // tipo: Text --> textoTipo() --x   Z <--   (el texto de «Sensor», «Mediciones»…)
    static int textoTipo(String tipo) {
        switch (tipo) {
            case Incidencia.TIPO_SENSOR:
                return R.string.ayuda_tipo_sensor;
            case Incidencia.TIPO_DATOS:
                return R.string.ayuda_tipo_datos;
            case Incidencia.TIPO_CUENTA:
                return R.string.ayuda_tipo_cuenta;
            default:
                return R.string.ayuda_tipo_otra;
        }
    }

    // -----------------------------------------------------------------------
    // contexto: Context, etiqueta: TextView, estado: Text --> aplicarEstado() -->
    // What it does: writes «Abierta», «En curso» or «Resuelta» in its colours
    //               (red, yellow and green, like the web).
    // -----------------------------------------------------------------------
    static void aplicarEstado(Context contexto, TextView etiqueta, String estado) {
        int texto;
        int color;
        int fondo;
        if (Incidencia.ESTADO_RESUELTA.equals(estado)) {
            texto = R.string.ayuda_estado_resuelta;
            color = R.color.verde_ok;
            fondo = R.color.verde_ok_fondo;
        } else if (Incidencia.ESTADO_EN_CURSO.equals(estado)) {
            texto = R.string.ayuda_estado_en_curso;
            color = R.color.espera_texto;
            fondo = R.color.espera_fondo;
        } else {
            texto = R.string.ayuda_estado_abierta;
            color = R.color.rechazo_texto;
            fondo = R.color.rechazo_fondo;
        }
        etiqueta.setText(texto);
        etiqueta.setTextColor(ContextCompat.getColor(contexto, color));
        etiqueta.setBackgroundTintList(ColorStateList.valueOf(ContextCompat.getColor(contexto, fondo)));
    }

    // ms: Z --> formatearFecha() --x   Text <--   («19 nov 2026 · 10:00», o "" si no hay fecha)
    static String formatearFecha(long ms) {
        if (ms <= 0) {
            return "";
        }
        return new SimpleDateFormat("d MMM yyyy · HH:mm", Locale.getDefault()).format(new Date(ms));
    }

    private void cerrarSesion() {
        Sesion.cerrar(this);
        Intent intent = new Intent(this, BienvenidaActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }

    private int dp(int valor) {
        return Math.round(valor * getResources().getDisplayMetrics().density);
    }
}
