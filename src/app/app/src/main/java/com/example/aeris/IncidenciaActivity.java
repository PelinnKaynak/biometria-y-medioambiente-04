// ---------------------------------------------------------------------------
// Fichero:     IncidenciaActivity.java
// Descripción: La conversación de una incidencia (T043): lo que escribió el
//              usuario (la descripción es el primer mensaje), las respuestas del
//              equipo y una caja para seguir escribiendo. Si la incidencia estaba
//              «Resuelta» y el usuario escribe, el servidor la reabre y aquí pasa
//              a «Abierta». Se abre al tocar una incidencia en «Mis incidencias»
//              (AyudaActivity). Diseño en doc/app_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       20/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import java.util.List;
import java.util.Locale;

// IncidenciaActivity class: the conversation of one incidence.
public class IncidenciaActivity extends AppCompatActivity {

    static final String EXTRA_ID = "incidenciaId";
    static final String EXTRA_TIPO = "incidenciaTipo";
    static final String EXTRA_ASUNTO = "incidenciaAsunto";
    static final String EXTRA_DESCRIPCION = "incidenciaDescripcion";
    static final String EXTRA_ESTADO = "incidenciaEstado";
    static final String EXTRA_FECHA_MS = "incidenciaFechaMs";

    private static final String ESTADO_ESTADO = "estadoIncidencia";
    private static final String ETIQUETA_MENSAJE = "mensaje";          // vistas que se pintan y se borran en cada carga
    private static final String ETIQUETA_DESCRIPCION = "descripcion";  // la descripción: primer mensaje, se pinta una vez

    private final LogicaFakeAyuda logica = new LogicaFakeAyuda();

    private int idIncidencia;
    private String estado;
    private boolean cargando = false;
    private boolean enviando = false;
    private boolean refrescandoEstado = false;
    private boolean sinMostrarNada = true;      // aún no se ha pintado la conversación

    private LinearLayout conversacion;
    private ScrollView scroll;
    private View progreso, botonReintentar, botonEnviarMensaje;
    private TextView textoConversacion, errorMensaje, etiquetaEstado;
    private EditText campoMensaje;

    // -----------------------------------------------------------------------
    // contexto: Context, incidencia: Incidencia --> intentPara() --x
    // Intent <--
    // What it does: the Intent that opens the conversation of that incidence.
    //               The data of the header travel with it; the messages are asked
    //               to the server.
    // -----------------------------------------------------------------------
    static Intent intentPara(Context contexto, Incidencia incidencia) {
        return new Intent(contexto, IncidenciaActivity.class)
                .putExtra(EXTRA_ID, incidencia.idIncidencia)
                .putExtra(EXTRA_TIPO, incidencia.tipo)
                .putExtra(EXTRA_ASUNTO, incidencia.asunto)
                .putExtra(EXTRA_DESCRIPCION, incidencia.descripcion)
                .putExtra(EXTRA_ESTADO, incidencia.estado)
                .putExtra(EXTRA_FECHA_MS, incidencia.fechaCreacionMs);
    }

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: fills the header and the first message (the description).
    //               The rest of the conversation is loaded in onResume().
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_incidencia);

        idIncidencia = getIntent().getIntExtra(EXTRA_ID, 0);
        estado = Incidencia.normalizarEstado(savedInstanceState != null
                ? savedInstanceState.getString(ESTADO_ESTADO) : getIntent().getStringExtra(EXTRA_ESTADO));
        if (idIncidencia <= 0) {
            finish();       // sin incidencia no hay conversación
            return;
        }

        conversacion = findViewById(R.id.conversacion);
        scroll = findViewById(R.id.scrollConversacion);
        progreso = findViewById(R.id.progresoConversacion);
        textoConversacion = findViewById(R.id.textoConversacion);
        botonReintentar = findViewById(R.id.botonReintentarConversacion);
        errorMensaje = findViewById(R.id.errorMensaje);
        etiquetaEstado = findViewById(R.id.estadoIncidencia);
        campoMensaje = findViewById(R.id.campoMensaje);
        botonEnviarMensaje = findViewById(R.id.botonEnviarMensaje);

        String tipo = Incidencia.normalizarTipo(getIntent().getStringExtra(EXTRA_TIPO));
        ((TextView) findViewById(R.id.asuntoIncidencia)).setText(getIntent().getStringExtra(EXTRA_ASUNTO));
        ((TextView) findViewById(R.id.tipoIncidencia))
                .setText(getString(AyudaActivity.textoTipo(tipo)).toUpperCase(Locale.getDefault()));
        long fechaMs = getIntent().getLongExtra(EXTRA_FECHA_MS, 0);
        ((TextView) findViewById(R.id.fechaIncidencia)).setText(AyudaActivity.formatearFecha(fechaMs));
        AyudaActivity.aplicarEstado(this, etiquetaEstado, estado);

        findViewById(R.id.botonVolver).setOnClickListener(vista -> finish());
        botonReintentar.setOnClickListener(vista -> cargarMensajes());
        botonEnviarMensaje.setOnClickListener(vista -> pulsarEnviar());

        // La descripción es el primer mensaje del usuario
        String descripcion = getIntent().getStringExtra(EXTRA_DESCRIPCION);
        if (descripcion != null && !descripcion.isEmpty()) {
            anyadirBurbuja(ETIQUETA_DESCRIPCION, true, getString(R.string.conversacion_tu_mensaje), descripcion, fechaMs);
        }
        // El indicador de carga, el aviso y «Reintentar» van debajo de la descripción (y delante de los mensajes)
        for (View vista : new View[]{progreso, textoConversacion, botonReintentar}) {
            conversacion.removeView(vista);
            conversacion.addView(vista);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle salida) {
        super.onSaveInstanceState(salida);
        salida.putString(ESTADO_ESTADO, estado);
    }

    // Al volver a la pantalla se actualiza la conversación (puede haber una respuesta nueva)
    @Override
    protected void onResume() {
        super.onResume();
        if (idIncidencia > 0) {
            cargarMensajes();
        }
    }

    // -----------------------------------------------------------------------
    // cargarMensajes() -->
    // What it does: asks for the conversation (one request at a time). The first
    //               time it shows a spinner, and if it fails, the reason and
    //               «Reintentar»; later ones refresh without moving anything and,
    //               if they fail, keep what is on the screen.
    // -----------------------------------------------------------------------
    private void cargarMensajes() {
        if (cargando) {
            return;
        }
        String token = Sesion.token(this);
        if (token == null) {
            cerrarSesion();
            return;
        }
        cargando = true;
        if (sinMostrarNada) {
            progreso.setVisibility(View.VISIBLE);
            textoConversacion.setVisibility(View.GONE);
            botonReintentar.setVisibility(View.GONE);
        }
        logica.obtenerMensajes(token, idIncidencia, new LogicaFakeAyuda.RespuestaMensajes() {
            @Override
            public void mensajesObtenidos(List<MensajeIncidencia> mensajes) {
                cargando = false;
                if (!isDestroyed()) {
                    pintarMensajes(mensajes);
                    refrescarEstado(token);
                }
            }

            @Override
            public void incidenciaNoExiste() {
                cargando = false;
                if (!isDestroyed()) {
                    progreso.setVisibility(View.GONE);
                    mostrarAviso(getString(R.string.conversacion_no_existe), false);
                    campoMensaje.setEnabled(false);
                    botonEnviarMensaje.setEnabled(false);
                    botonEnviarMensaje.setAlpha(0.5f);
                }
            }

            @Override
            public void sesionCaducada() {
                cargando = false;
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                cargando = false;
                if (!isDestroyed() && sinMostrarNada) {
                    progreso.setVisibility(View.GONE);
                    mostrarAviso(mensaje, true);
                }
            }
        });
    }

    // -----------------------------------------------------------------------
    // token: Text --> refrescarEstado() -->
    // What it does: asks again for the list of incidences and updates the label
    //               of the estado (the team may have changed it while the screen
    //               was open: «Resuelta», «En curso»). If it fails, the estado
    //               that was on the screen stays.
    // -----------------------------------------------------------------------
    private void refrescarEstado(String token) {
        if (refrescandoEstado) {
            return;
        }
        refrescandoEstado = true;
        logica.obtenerIncidencias(token, new LogicaFakeAyuda.RespuestaIncidencias() {
            @Override
            public void incidenciasObtenidas(List<Incidencia> incidencias) {
                refrescandoEstado = false;
                if (isDestroyed()) {
                    return;
                }
                for (Incidencia incidencia : incidencias) {
                    if (incidencia.idIncidencia == idIncidencia) {
                        estado = incidencia.estado;
                        AyudaActivity.aplicarEstado(IncidenciaActivity.this, etiquetaEstado, estado);
                    }
                }
            }

            @Override
            public void sesionCaducada() {
                refrescandoEstado = false;
            }

            @Override
            public void error(String mensaje) {
                refrescandoEstado = false;
            }
        });
    }

    // texto: Text, conReintentar: B --> mostrarAviso() --> el texto de debajo de la descripción
    private void mostrarAviso(String texto, boolean conReintentar) {
        textoConversacion.setText(texto);
        textoConversacion.setVisibility(View.VISIBLE);
        botonReintentar.setVisibility(conReintentar ? View.VISIBLE : View.GONE);
    }

    // -----------------------------------------------------------------------
    // mensajes: Lista<MensajeIncidencia> --> pintarMensajes() -->
    // What it does: paints the messages after the description (the user's on the
    //               right, the team's on the left) and, if nobody from the team
    //               has answered yet, a note saying that it is being reviewed.
    //               It goes down to the end the first time and when the number of
    //               messages grows.
    // -----------------------------------------------------------------------
    private void pintarMensajes(List<MensajeIncidencia> mensajes) {
        int antes = contarMensajes();
        quitarMensajes();
        progreso.setVisibility(View.GONE);
        textoConversacion.setVisibility(View.GONE);
        botonReintentar.setVisibility(View.GONE);

        boolean respondioElEquipo = false;
        for (MensajeIncidencia mensaje : mensajes) {
            boolean delUsuario = MensajeIncidencia.QUIEN_USUARIO.equals(mensaje.quienEs());
            anyadirBurbuja(ETIQUETA_MENSAJE, delUsuario, etiquetaAutor(mensaje), mensaje.texto, mensaje.fechaMs);
            if (!delUsuario) {
                respondioElEquipo = true;
            }
        }
        if (!respondioElEquipo) {
            anyadirNota(getString(R.string.conversacion_en_revision));
        }
        boolean primeraVez = sinMostrarNada;
        sinMostrarNada = false;
        if (primeraVez || contarMensajes() > antes) {
            bajarAlFinal();
        }
    }

    // mensaje: MensajeIncidencia --> etiquetaAutor() --> «Tú», «Marc (técnico)», «Alba (administrador)» o el nombre
    private String etiquetaAutor(MensajeIncidencia mensaje) {
        String quien = mensaje.quienEs();
        if (MensajeIncidencia.QUIEN_USUARIO.equals(quien)) {
            return getString(R.string.conversacion_tu_mensaje);
        }
        String nombre = mensaje.autorNombre.isEmpty() ? getString(R.string.conversacion_equipo) : mensaje.autorNombre;
        if (MensajeIncidencia.QUIEN_TECNICO.equals(quien)) {
            return getString(R.string.conversacion_autor_con_rol, nombre, getString(R.string.conversacion_rol_tecnico));
        }
        if (MensajeIncidencia.QUIEN_ADMINISTRADOR.equals(quien)) {
            return getString(R.string.conversacion_autor_con_rol, nombre, getString(R.string.conversacion_rol_administrador));
        }
        return nombre;
    }

    // -----------------------------------------------------------------------
    // etiqueta: Text, delUsuario: B, autor: Text, texto: Text, fechaMs: Z --> anyadirBurbuja() -->
    // What it does: adds a message at the end: violet and on the right if it is
    //               the user's, white and on the left if it is the team's.
    // -----------------------------------------------------------------------
    private void anyadirBurbuja(String etiqueta, boolean delUsuario, String autor, String texto, long fechaMs) {
        View burbuja = LayoutInflater.from(this).inflate(R.layout.item_mensaje, conversacion, false);
        burbuja.setTag(etiqueta);
        burbuja.setBackgroundResource(delUsuario ? R.drawable.fondo_burbuja_usuario : R.drawable.fondo_burbuja_equipo);

        TextView textoAutor = burbuja.findViewById(R.id.autorMensaje);
        TextView textoMensaje = burbuja.findViewById(R.id.textoMensaje);
        TextView textoFecha = burbuja.findViewById(R.id.fechaMensaje);
        int colorTitulo = ContextCompat.getColor(this, delUsuario ? R.color.consejo_etiqueta : R.color.violeta);
        int colorTexto = ContextCompat.getColor(this, delUsuario ? R.color.blanco : R.color.texto_principal);
        int colorFecha = ContextCompat.getColor(this, delUsuario ? R.color.consejo_etiqueta : R.color.texto_secundario);
        textoAutor.setText(autor);
        textoAutor.setTextColor(colorTitulo);
        textoMensaje.setText(texto);
        textoMensaje.setTextColor(colorTexto);
        String fecha = AyudaActivity.formatearFecha(fechaMs);
        textoFecha.setText(fecha);
        textoFecha.setTextColor(colorFecha);
        textoFecha.setVisibility(fecha.isEmpty() ? View.GONE : View.VISIBLE);

        LinearLayout.LayoutParams parametros = (LinearLayout.LayoutParams) burbuja.getLayoutParams();
        parametros.gravity = delUsuario ? Gravity.END : Gravity.START;
        if (delUsuario) {
            parametros.setMarginStart(dp(48));
        } else {
            parametros.setMarginEnd(dp(48));
        }
        burbuja.setLayoutParams(parametros);
        conversacion.addView(burbuja);
    }

    // texto: Text --> anyadirNota() --> una nota centrada, con letra pequeña, al final
    private void anyadirNota(String texto) {
        TextView nota = new TextView(this);
        nota.setTag(ETIQUETA_MENSAJE);
        nota.setText(texto);
        nota.setGravity(Gravity.CENTER);
        nota.setTextSize(13);
        nota.setLineSpacing(0, 1.2f);
        nota.setTextColor(ContextCompat.getColor(this, R.color.texto_secundario));
        LinearLayout.LayoutParams parametros = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        parametros.topMargin = dp(18);
        conversacion.addView(nota, parametros);
    }

    // borra los mensajes y la nota pintados (la descripción lleva otra etiqueta y se queda: se pinta una vez)
    private void quitarMensajes() {
        for (int i = conversacion.getChildCount() - 1; i >= 0; i--) {
            if (ETIQUETA_MENSAJE.equals(conversacion.getChildAt(i).getTag())) {
                conversacion.removeViewAt(i);
            }
        }
    }

    // cuántos mensajes (y notas) hay pintados, sin contar la descripción
    private int contarMensajes() {
        int cuenta = 0;
        for (int i = 0; i < conversacion.getChildCount(); i++) {
            if (ETIQUETA_MENSAJE.equals(conversacion.getChildAt(i).getTag())) {
                cuenta++;
            }
        }
        return cuenta;
    }

    private void bajarAlFinal() {
        scroll.post(() -> scroll.fullScroll(View.FOCUS_DOWN));
    }

    // -----------------------------------------------------------------------
    // pulsarEnviar() -->
    // What it does: checks the message (ValidadorIncidencia) and sends it. If it
    //               goes well, it empties the box, marks the incidence «Abierta»
    //               if it was «Resuelta» (the server reopens it) and loads the
    //               conversation again; if not, it says why and keeps what was written.
    // -----------------------------------------------------------------------
    private void pulsarEnviar() {
        if (enviando) {
            return;
        }
        errorMensaje.setVisibility(View.GONE);
        String texto = campoMensaje.getText().toString();
        String error = ValidadorIncidencia.validarMensaje(texto);
        if (error != null) {
            ponerErrorMensaje(error);
            return;
        }
        String token = Sesion.token(this);
        if (token == null) {
            cerrarSesion();
            return;
        }
        mostrarEnviando(true);
        logica.enviarMensaje(token, idIncidencia, texto, new LogicaFakeAyuda.RespuestaEnvio() {
            @Override
            public void mensajeEnviado(MensajeIncidencia mensaje) {
                mostrarEnviando(false);
                if (isDestroyed()) {
                    return;
                }
                campoMensaje.setText("");
                if (Incidencia.ESTADO_RESUELTA.equals(estado)) {
                    estado = Incidencia.ESTADO_ABIERTA;
                    AyudaActivity.aplicarEstado(IncidenciaActivity.this, etiquetaEstado, estado);
                }
                cargarMensajes();
            }

            @Override
            public void datosNoValidos(String mensaje) {
                mostrarEnviando(false);
                ponerErrorMensaje(mensaje);
            }

            @Override
            public void incidenciaNoExiste() {
                mostrarEnviando(false);
                ponerErrorMensaje(getString(R.string.conversacion_no_existe));
            }

            @Override
            public void sesionCaducada() {
                mostrarEnviando(false);
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                mostrarEnviando(false);
                ponerErrorMensaje(mensaje);
            }
        });
    }

    private void mostrarEnviando(boolean valor) {
        enviando = valor;
        if (!isDestroyed()) {
            botonEnviarMensaje.setAlpha(valor ? 0.6f : 1f);
        }
    }

    private void ponerErrorMensaje(String mensaje) {
        if (!isDestroyed()) {
            errorMensaje.setText(mensaje);
            errorMensaje.setVisibility(View.VISIBLE);
        }
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
