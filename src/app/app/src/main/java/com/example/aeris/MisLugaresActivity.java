// ---------------------------------------------------------------------------
// Fichero:     MisLugaresActivity.java
// Descripción: Pantalla «Mis lugares» (T019 · H034). Permite al usuario guardar
//              hasta 5 ubicaciones habituales (casa, trabajo, colegio...),
//              consultar su concentración y nivel de ozono actual desde el mapa
//              interpolado y activar o desactivar los avisos de cada lugar.
//              Diseño en doc/app_design.md. Tarea T019.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.google.android.material.materialswitch.MaterialSwitch;

import java.util.List;

// MisLugaresActivity class: handles the user's saved places and their notifications.
public class MisLugaresActivity extends AppCompatActivity {

    private final LogicaFakeMisLugares logica = new LogicaFakeMisLugares();

    private TextView textoContadorLugares;
    private TextView textoAvisoLimite;
    private View tarjetaAnadirLugar;
    private EditText campoNombreLugar;
    private EditText campoDireccionLugar;
    private View botonSeleccionarUbicacion;
    private TextView textoUbicacionSeleccionada;
    private Spinner campoTipoLugar;
    private TextView errorAnadirLugar;
    private View botonGuardarLugar;
    private ActivityResultLauncher<Intent> selectorUbicacion;
    private Double latitudSeleccionada;
    private Double longitudSeleccionada;

    private LinearLayout listaLugares;
    private View tarjetaSinLugares;
    private TextView errorMisLugares;

    // -----------------------------------------------------------------------
    // savedInstanceState: Bundle --> onCreate() -->
    // What it does: initialises views, connects listeners and loads places.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mis_lugares);

        ImageView botonVolver = findViewById(R.id.botonVolver);
        textoContadorLugares = findViewById(R.id.textoContadorLugares);
        textoAvisoLimite = findViewById(R.id.textoAvisoLimite);
        tarjetaAnadirLugar = findViewById(R.id.tarjetaAnadirLugar);
        campoNombreLugar = findViewById(R.id.campoNombreLugar);
        campoDireccionLugar = findViewById(R.id.campoDireccionLugar);
        botonSeleccionarUbicacion = findViewById(R.id.botonSeleccionarUbicacion);
        textoUbicacionSeleccionada = findViewById(R.id.textoUbicacionSeleccionada);
        campoTipoLugar = findViewById(R.id.campoTipoLugar);
        errorAnadirLugar = findViewById(R.id.errorAnadirLugar);
        botonGuardarLugar = findViewById(R.id.botonGuardarLugar);

        selectorUbicacion = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(), this::recibirUbicacion);
        botonSeleccionarUbicacion.setOnClickListener(v -> {
            errorAnadirLugar.setVisibility(View.GONE);
            selectorUbicacion.launch(new Intent(this, SeleccionarUbicacionActivity.class));
        });
        if (savedInstanceState != null
                && savedInstanceState.containsKey(SeleccionarUbicacionActivity.EXTRA_LATITUD)
                && savedInstanceState.containsKey(SeleccionarUbicacionActivity.EXTRA_LONGITUD)) {
            latitudSeleccionada = savedInstanceState.getDouble(SeleccionarUbicacionActivity.EXTRA_LATITUD);
            longitudSeleccionada = savedInstanceState.getDouble(SeleccionarUbicacionActivity.EXTRA_LONGITUD);
            mostrarUbicacionSeleccionada();
        }

        listaLugares = findViewById(R.id.listaLugares);
        tarjetaSinLugares = findViewById(R.id.tarjetaSinLugares);
        errorMisLugares = findViewById(R.id.errorMisLugares);

        botonVolver.setOnClickListener(v -> finish());
        botonGuardarLugar.setOnClickListener(v -> guardarNuevoLugar());

        cargarLugares();
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        if (latitudSeleccionada != null && longitudSeleccionada != null) {
            estado.putDouble(SeleccionarUbicacionActivity.EXTRA_LATITUD, latitudSeleccionada);
            estado.putDouble(SeleccionarUbicacionActivity.EXTRA_LONGITUD, longitudSeleccionada);
        }
        super.onSaveInstanceState(estado);
    }

    private void recibirUbicacion(ActivityResult resultado) {
        if (resultado.getResultCode() != Activity.RESULT_OK || resultado.getData() == null) return;
        double latitud = resultado.getData().getDoubleExtra(
                SeleccionarUbicacionActivity.EXTRA_LATITUD, Double.NaN);
        double longitud = resultado.getData().getDoubleExtra(
                SeleccionarUbicacionActivity.EXTRA_LONGITUD, Double.NaN);
        if (!Double.isFinite(latitud) || latitud < -90 || latitud > 90
                || !Double.isFinite(longitud) || longitud < -180 || longitud > 180) {
            errorAnadirLugar.setText(R.string.mis_lugares_error_ubicacion);
            errorAnadirLugar.setVisibility(View.VISIBLE);
            return;
        }
        latitudSeleccionada = latitud;
        longitudSeleccionada = longitud;
        mostrarUbicacionSeleccionada();
        errorAnadirLugar.setVisibility(View.GONE);
    }

    private void mostrarUbicacionSeleccionada() {
        if (latitudSeleccionada == null || longitudSeleccionada == null) {
            textoUbicacionSeleccionada.setText(R.string.mis_lugares_ubicacion_pendiente);
            return;
        }
        textoUbicacionSeleccionada.setText(getString(
                R.string.mis_lugares_ubicacion_formato, latitudSeleccionada, longitudSeleccionada));
    }

    // -----------------------------------------------------------------------
    // onResume() -->
    // What it does: refreshes places list when coming back to the screen.
    // -----------------------------------------------------------------------
    @Override
    protected void onResume() {
        super.onResume();
        cargarLugares();
    }

    // -----------------------------------------------------------------------
    // cargarLugares() -->
    // What it does: fetches the saved places for the logged-in user.
    // -----------------------------------------------------------------------
    private void cargarLugares() {
        String token = Sesion.token(this);
        if (token == null) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        logica.obtenerLugares(token, new LogicaFakeMisLugares.CallbackLugares() {
            @Override
            public void lugaresObtenidos(List<Lugar> lugares) {
                runOnUiThread(() -> mostrarLugares(lugares));
            }

            @Override
            public void sesionCaducada() {
                runOnUiThread(() -> {
                    startActivity(new Intent(MisLugaresActivity.this, LoginActivity.class));
                    finish();
                });
            }

            @Override
            public void error(String mensaje) {
                runOnUiThread(() -> {
                    errorMisLugares.setText(mensaje);
                    errorMisLugares.setVisibility(View.VISIBLE);
                });
            }
        });
    }

    // -----------------------------------------------------------------------
    // lugares: List<Lugar> --> mostrarLugares() --x
    // What it does: populates the place cards, updates the limit counter, and
    //               toggles the add-form availability when 5 places are reached.
    // -----------------------------------------------------------------------
    private void mostrarLugares(List<Lugar> lugares) {
        errorMisLugares.setVisibility(View.GONE);
        int total = lugares.size();

        textoContadorLugares.setText(getString(R.string.mis_lugares_contador, total, LogicaFakeMisLugares.MAX_LUGARES));

        boolean limiteAlcanzado = total >= LogicaFakeMisLugares.MAX_LUGARES;
        textoAvisoLimite.setVisibility(limiteAlcanzado ? View.VISIBLE : View.GONE);
        botonGuardarLugar.setEnabled(!limiteAlcanzado);
        botonGuardarLugar.setAlpha(limiteAlcanzado ? 0.5f : 1.0f);

        if (total == 0) {
            tarjetaSinLugares.setVisibility(View.VISIBLE);
            listaLugares.setVisibility(View.GONE);
            listaLugares.removeAllViews();
            return;
        }

        tarjetaSinLugares.setVisibility(View.GONE);
        listaLugares.setVisibility(View.VISIBLE);
        listaLugares.removeAllViews();

        LayoutInflater inflater = LayoutInflater.from(this);
        String token = Sesion.token(this);

        for (Lugar lugar : lugares) {
            View vista = inflater.inflate(R.layout.item_tarjeta_lugar, listaLugares, false);

            TextView textoNombre = vista.findViewById(R.id.textoNombreLugar);
            TextView textoDireccion = vista.findViewById(R.id.textoDireccionLugar);
            View puntoNivel = vista.findViewById(R.id.puntoNivelOzono);
            TextView textoNivel = vista.findViewById(R.id.textoNivelOzono);
            TextView textoEstadoAvisos = vista.findViewById(R.id.textoEstadoAvisos);
            MaterialSwitch interruptor = vista.findViewById(R.id.interruptorAvisosLugar);
            ImageView botonEliminar = vista.findViewById(R.id.botonEliminarLugar);

            textoNombre.setText(lugar.nombre);
            textoDireccion.setText(lugar.direccion);

            if (lugar.ozonoActual == null) {
                puntoNivel.setVisibility(View.INVISIBLE);
                textoNivel.setText(R.string.mis_lugares_sin_datos_recientes);
            } else {
                NivelOzono nivel = lugar.nivelOzono();
                puntoNivel.setVisibility(View.VISIBLE);
                puntoNivel.setBackgroundTintList(ColorStateList.valueOf(
                        ContextCompat.getColor(this, colorDe(nivel))));
                textoNivel.setText(getString(R.string.mis_lugares_nivel_formato,
                        lugar.ozonoActual, getString(nombreDe(nivel))));
            }

            interruptor.setChecked(lugar.avisosActivos);
            textoEstadoAvisos.setText(lugar.avisosActivos
                    ? R.string.mis_lugares_avisos_activos
                    : R.string.mis_lugares_avisos_inactivos);

            interruptor.setOnCheckedChangeListener((btn, isChecked) -> {
                if (btn.isPressed()) {
                    logica.cambiarAvisos(token, lugar.id, isChecked, new LogicaFakeMisLugares.CallbackOperacionLugar() {
                        @Override
                        public void exito(Lugar actualizado) {
                            runOnUiThread(() -> textoEstadoAvisos.setText(actualizado.avisosActivos
                                    ? R.string.mis_lugares_avisos_activos
                                    : R.string.mis_lugares_avisos_inactivos));
                        }

                        @Override
                        public void limiteAlcanzado(String mensaje) {}

                        @Override
                        public void sesionCaducada() {
                            runOnUiThread(MisLugaresActivity.this::cargarLugares);
                        }

                        @Override
                        public void error(String mensaje) {
                            runOnUiThread(() -> interruptor.setChecked(!isChecked));
                        }
                    });
                }
            });

            botonEliminar.setOnClickListener(v -> confirmarEliminarLugar(lugar));

            listaLugares.addView(vista);
        }
    }

    // -----------------------------------------------------------------------
    // guardarNuevoLugar() -->
    // What it does: reads input fields, invokes logic to add place and handles
    //               validation or limit errors.
    // -----------------------------------------------------------------------
    private void guardarNuevoLugar() {
        errorAnadirLugar.setVisibility(View.GONE);
        String nombre = campoNombreLugar.getText().toString().trim();
        String direccion = campoDireccionLugar.getText().toString().trim();
        String token = Sesion.token(this);
        String tipo = getResources().getStringArray(R.array.mis_lugares_tipos_valores)
                [campoTipoLugar.getSelectedItemPosition()];
        Double latitud = latitudSeleccionada;
        Double longitud = longitudSeleccionada;
        if (latitud == null || longitud == null) {
            errorAnadirLugar.setText(R.string.mis_lugares_error_ubicacion);
            errorAnadirLugar.setVisibility(View.VISIBLE);
            return;
        }

        logica.anadirLugar(token, nombre, tipo, direccion, latitud, longitud,
                new LogicaFakeMisLugares.CallbackOperacionLugar() {
            @Override
            public void exito(Lugar nuevoLugar) {
                runOnUiThread(() -> {
                    campoNombreLugar.setText("");
                    campoDireccionLugar.setText("");
                    latitudSeleccionada = null;
                    longitudSeleccionada = null;
                    mostrarUbicacionSeleccionada();
                    campoNombreLugar.clearFocus();
                    campoDireccionLugar.clearFocus();
                    errorAnadirLugar.setVisibility(View.GONE);
                    cargarLugares();
                });
            }

            @Override
            public void limiteAlcanzado(String mensaje) {
                runOnUiThread(() -> {
                    errorAnadirLugar.setText(mensaje);
                    errorAnadirLugar.setVisibility(View.VISIBLE);
                });
            }

            @Override
            public void sesionCaducada() {
                runOnUiThread(() -> {
                    startActivity(new Intent(MisLugaresActivity.this, LoginActivity.class));
                    finish();
                });
            }

            @Override
            public void error(String mensaje) {
                runOnUiThread(() -> {
                    errorAnadirLugar.setText(mensaje);
                    errorAnadirLugar.setVisibility(View.VISIBLE);
                });
            }
        });
    }

    // -----------------------------------------------------------------------
    // lugar: Lugar --> confirmarEliminarLugar() --x
    // What it does: shows confirmation dialog before deleting a place.
    // -----------------------------------------------------------------------
    private void confirmarEliminarLugar(Lugar lugar) {
        new AlertDialog.Builder(this)
                .setTitle(R.string.mis_lugares_eliminar_titulo)
                .setMessage(getString(R.string.mis_lugares_eliminar_mensaje, lugar.nombre))
                .setPositiveButton(R.string.mis_lugares_eliminar_confirmar, (dialog, which) -> {
                    String token = Sesion.token(this);
                    logica.eliminarLugar(token, lugar.id, new LogicaFakeMisLugares.CallbackEliminarLugar() {
                        @Override
                        public void eliminado(int idLugar) {
                            runOnUiThread(MisLugaresActivity.this::cargarLugares);
                        }

                        @Override
                        public void sesionCaducada() {
                            runOnUiThread(MisLugaresActivity.this::cargarLugares);
                        }

                        @Override
                        public void error(String mensaje) {
                            runOnUiThread(() -> {
                                errorMisLugares.setText(mensaje);
                                errorMisLugares.setVisibility(View.VISIBLE);
                            });
                        }
                    });
                })
                .setNegativeButton(R.string.mis_lugares_eliminar_cancelar, null)
                .show();
    }

    // -----------------------------------------------------------------------
    // nivel: NivelOzono --> colorDe() --x
    // Z <--
    // What it does: maps ozone level to corresponding color resource.
    // -----------------------------------------------------------------------
    static int colorDe(NivelOzono nivel) {
        switch (nivel) {
            case BUENO: return R.color.nivel_bueno;
            case MODERADO: return R.color.nivel_moderado;
            case MALO: return R.color.nivel_malo;
            case MUY_MALO: return R.color.nivel_muy_malo;
            default: return R.color.nivel_bueno;
        }
    }

    // -----------------------------------------------------------------------
    // nivel: NivelOzono --> nombreDe() --x
    // Z <--
    // What it does: maps ozone level to corresponding string resource.
    // -----------------------------------------------------------------------
    static int nombreDe(NivelOzono nivel) {
        switch (nivel) {
            case BUENO: return R.string.info_nivel_bueno;
            case MODERADO: return R.string.info_nivel_moderado;
            case MALO: return R.string.info_nivel_malo;
            case MUY_MALO: return R.string.info_nivel_muy_malo;
            default: return R.string.info_nivel_bueno;
        }
    }
}
