// ---------------------------------------------------------------------------
// Fichero:     PerfilActivity.java
// Descripción: Pantalla «Perfil» (Figma «perfil»): muestra el nombre y el
//              correo del usuario, guarda el interruptor de notificaciones en
//              el servidor, cambia la foto de perfil (cámara o galería), abre «Editar mis datos»
//              y permite cerrar sesión. Sin sensor, «Mi sensor» abre «Vincular
//              sensor». Se abre desde la barra de navegación inferior.
//              Diseño en doc/app_design.md. Tareas T010, T005.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.widget.CompoundButton;
import android.view.View;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;

import com.google.android.material.materialswitch.MaterialSwitch;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// PerfilActivity class: the Perfil screen of the app.
public class PerfilActivity extends AppCompatActivity {

    private final LogicaFakePerfil logica = new LogicaFakePerfil();

    private TextView textoNombre;
    private TextView textoCorreo;
    private MaterialSwitch interruptorNotificaciones;
    private ImageView imagenAvatar;
    private ProgressBar progresoFoto;
    private TextView errorPerfil;
    private TextView valorMiSensor;
    private boolean tieneFoto = false;
    private Boolean tieneSensor = null;     // null: aún no ha respondido el servidor

    // Preparar la foto (recortar y reducir) es lento: se hace fuera del hilo principal
    private static final ExecutorService HILO_FOTO = Executors.newSingleThreadExecutor();

    // Fichero donde la cámara deja la foto (lo comparte FileProvider, ver rutas_fotos.xml)
    private Uri uriFotoCamara;

    // Cámara del teléfono: la app de cámara hace la foto (no hace falta el permiso CAMERA)
    private final ActivityResultLauncher<Uri> hacerFoto =
            registerForActivityResult(new ActivityResultContracts.TakePicture(), hecha -> {
                if (Boolean.TRUE.equals(hecha) && uriFotoCamara != null) {
                    subirFoto(uriFotoCamara);
                }
            });

    // Selector de fotos de Android (galería; no necesita permisos)
    private final ActivityResultLauncher<PickVisualMediaRequest> elegirFoto =
            registerForActivityResult(new ActivityResultContracts.PickVisualMedia(), uri -> {
                if (uri != null) {
                    subirFoto(uri);
                }
            });

    // Al tocar el interruptor se guarda el cambio en el servidor
    private final CompoundButton.OnCheckedChangeListener alCambiarInterruptor =
            (boton, activado) -> cambiarAlertas(activado);

    // -----------------------------------------------------------------------
    // onCreate() -->       (lo llama Android al abrir la pantalla)
    // What it does: shows the saved name and email at once and connects the
    //               options, the photo, the bottom bar and «Cerrar sesión».
    //               The up-to-date data is asked in onResume().
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_perfil);
        BarraNavegacion.conectar(this, BarraNavegacion.Pestanya.PERFIL);

        textoNombre = findViewById(R.id.textoNombre);
        textoCorreo = findViewById(R.id.textoCorreo);
        interruptorNotificaciones = findViewById(R.id.interruptorNotificaciones);
        imagenAvatar = findViewById(R.id.imagenAvatar);
        progresoFoto = findViewById(R.id.progresoFoto);
        errorPerfil = findViewById(R.id.errorPerfil);
        valorMiSensor = findViewById(R.id.valorMiSensor);

        // Mientras llegan los datos del servidor se ve lo guardado al iniciar sesión
        textoNombre.setText(textoONada(Sesion.nombre(this)));
        textoCorreo.setText(textoONada(Sesion.correoActual(this)));
        // El interruptor sale ya en su posición guardada, sin animación
        ponerInterruptor(Sesion.alertas(this));

        // Opciones de otras tareas (T019 Mis lugares…): aún no
        int[] opcionesProximamente = {
                R.id.opcionUmbral,
                R.id.opcionPuntos, R.id.opcionMisLugares, R.id.opcionPremium
        };
        for (int id : opcionesProximamente) {
            findViewById(id).setClickable(false);   // aún no hacen nada
        }
        findViewById(R.id.opcionNotificaciones).setOnClickListener(vista -> {
            if (interruptorNotificaciones.isClickable()) {
                interruptorNotificaciones.toggle();     // aquí sí se anima: lo ha tocado el usuario
            }
        });
        findViewById(R.id.opcionMiSensor).setOnClickListener(vista -> pulsarMiSensor());
        findViewById(R.id.opcionEditarDatos).setOnClickListener(vista ->
                startActivity(new Intent(this, EditarDatosActivity.class)));
        findViewById(R.id.botonEditarFoto).setOnClickListener(vista -> pulsarFoto());
        imagenAvatar.setOnClickListener(vista -> pulsarFoto());
        findViewById(R.id.botonCerrarSesion).setOnClickListener(vista -> cerrarSesion());
    }

    // -----------------------------------------------------------------------
    // onResume() -->       (lo llama Android al abrir la pantalla y al volver a ella)
    // What it does: loads the data again, so changes made in «Editar mis
    //               datos» are shown when coming back.
    // -----------------------------------------------------------------------
    @Override
    protected void onResume() {
        super.onResume();
        cargarUsuario();
    }

    // -----------------------------------------------------------------------
    // pulsarFoto() -->
    // What it does: asks where the photo comes from: «Hacer una foto»
    //               (camera) or «Elegir de la galería»; if there is already a
    //               photo, also «Quitar la foto».
    // -----------------------------------------------------------------------
    private void pulsarFoto() {
        List<String> opciones = new ArrayList<>();
        opciones.add(getString(R.string.perfil_foto_camara));
        opciones.add(getString(R.string.perfil_foto_galeria));
        if (tieneFoto) {
            opciones.add(getString(R.string.perfil_foto_quitar));
        }
        new AlertDialog.Builder(this)
                .setTitle(R.string.perfil_foto_titulo)
                .setItems(opciones.toArray(new String[0]), (dialogo, posicion) -> {
                    if (posicion == 0) {
                        abrirCamara();
                    } else if (posicion == 1) {
                        abrirSelectorFotos();
                    } else {
                        enviarFoto(null);
                    }
                })
                .show();
    }

    // -----------------------------------------------------------------------
    // abrirCamara() -->
    // What it does: opens the camera app, which saves the photo in a file of
    //               the app's cache (shared with FileProvider).
    // -----------------------------------------------------------------------
    private void abrirCamara() {
        File carpeta = new File(getCacheDir(), "fotos");
        if (!carpeta.exists() && !carpeta.mkdirs()) {
            mostrarError(getString(R.string.perfil_foto_no_valida));
            return;
        }
        uriFotoCamara = FileProvider.getUriForFile(this, getPackageName() + ".fotos",
                new File(carpeta, "camara.jpg"));
        try {
            hacerFoto.launch(uriFotoCamara);
        } catch (android.content.ActivityNotFoundException sinCamara) {
            mostrarError(getString(R.string.perfil_foto_sin_camara));
        }
    }

    private void abrirSelectorFotos() {
        elegirFoto.launch(new PickVisualMediaRequest.Builder()
                .setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE)
                .build());
    }

    // -----------------------------------------------------------------------
    // uri: Uri --> subirFoto() -->
    // What it does: prepares the chosen photo (256x256 JPEG in base64) in the
    //               background and then sends it. Meanwhile a spinner turns
    //               on the avatar (no message at the bottom).
    // -----------------------------------------------------------------------
    private void subirFoto(Uri uri) {
        progresoFoto.setVisibility(View.VISIBLE);
        HILO_FOTO.execute(() -> {
            String foto;
            try {
                foto = FotoPerfil.prepararFoto(getContentResolver(), uri);
            } catch (Exception error) {
                runOnUiThread(() -> {
                    progresoFoto.setVisibility(View.GONE);
                    mostrarError(getString(R.string.perfil_foto_no_valida));
                });
                return;
            }
            runOnUiThread(() -> enviarFoto(foto));
        });
    }

    // -----------------------------------------------------------------------
    // foto: Text | null --> enviarFoto() -->
    // What it does: saves the photo with POST /cambiarFoto (null deletes it)
    //               and, if it works, shows it.
    // -----------------------------------------------------------------------
    private void enviarFoto(String foto) {
        progresoFoto.setVisibility(View.VISIBLE);
        logica.cambiarFoto(Sesion.token(this), foto, new LogicaFakePerfil.RespuestaCambio() {
            @Override
            public void cambioGuardado() {
                progresoFoto.setVisibility(View.GONE);
                errorPerfil.setVisibility(View.GONE);
                mostrarFoto(foto);
            }

            @Override
            public void sesionCaducada() {
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                progresoFoto.setVisibility(View.GONE);
                mostrarError(mensaje);
            }
        });
    }

    // -----------------------------------------------------------------------
    // foto: Text | null --> mostrarFoto() -->
    // What it does: shows the photo in the circle, or the default avatar.
    // -----------------------------------------------------------------------
    private void mostrarFoto(String foto) {
        Bitmap imagen = FotoPerfil.aImagen(foto);
        tieneFoto = imagen != null;
        if (imagen != null) {
            imagenAvatar.setImageBitmap(imagen);
        } else {
            imagenAvatar.setImageResource(R.drawable.avatar_usuario);
        }
    }

    // -----------------------------------------------------------------------
    // cargarUsuario() -->
    // What it does: asks GET /usuarioActual and shows the answer. If the
    //               session is no longer valid, it closes it.
    // -----------------------------------------------------------------------
    private void cargarUsuario() {
        logica.obtenerUsuario(Sesion.token(this), new LogicaFakePerfil.RespuestaUsuario() {
            @Override
            public void usuarioObtenido(DatosUsuario datos) {
                mostrarUsuario(datos);
            }

            @Override
            public void sesionCaducada() {
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                mostrarError(mensaje);
            }
        });
    }

    // -----------------------------------------------------------------------
    // datos: DatosUsuario --> mostrarUsuario() -->
    // What it does: writes the name and email, shows the photo and puts the switch in its
    //               saved position (without sending it again to the server).
    // -----------------------------------------------------------------------
    private void mostrarUsuario(DatosUsuario datos) {
        textoNombre.setText(datos.nombreCompleto());
        textoCorreo.setText(datos.correo);
        errorPerfil.setVisibility(View.GONE);
        mostrarFoto(datos.foto);
        mostrarSensor(datos);
        Sesion.guardarAlertas(this, datos.alertas);
        ponerInterruptor(datos.alertas);
    }

    // -----------------------------------------------------------------------
    // datos: DatosUsuario --> mostrarSensor() -->
    // What it does: in the «Mi sensor» row, the name of the linked sensor or,
    //               without sensor, «Vincular  >» in violet.
    // -----------------------------------------------------------------------
    private void mostrarSensor(DatosUsuario datos) {
        tieneSensor = datos.tieneSensor();
        if (datos.tieneSensor()) {
            valorMiSensor.setText(getString(R.string.perfil_sensor_nombre, datos.sensor));
            valorMiSensor.setTextColor(getColor(R.color.texto_secundario));
            valorMiSensor.setTypeface(Tipografia.inter(this, Tipografia.NORMAL));
        } else {
            valorMiSensor.setText(R.string.perfil_sensor_vincular);
            valorMiSensor.setTextColor(getColor(R.color.violeta));
            valorMiSensor.setTypeface(Tipografia.inter(this, Tipografia.SEMINEGRITA));
        }
        valorMiSensor.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
    }

    // -----------------------------------------------------------------------
    // pulsarMiSensor() -->
    // What it does: without sensor, opens «Vincular sensor» (when it ends, it
    //               comes back here). With sensor, the «Mi sensor» screen is
    //               task T011 and does not exist yet: nothing happens. Until
    //               the server answers it is not known, so nothing happens either.
    // -----------------------------------------------------------------------
    private void pulsarMiSensor() {
        if (Boolean.FALSE.equals(tieneSensor)) {
            startActivity(new Intent(this, VincularSensorActivity.class)
                    .putExtra(VincularSensorActivity.EXTRA_DESDE_PERFIL, true));
        }
    }

    // -----------------------------------------------------------------------
    // activado: B --> cambiarAlertas() -->
    // What it does: saves the new value with POST /cambiarAlertas. While it
    //               is saving the switch cannot be touched; if it fails, the
    //               switch goes back and the error is shown.
    // -----------------------------------------------------------------------
    private void cambiarAlertas(boolean activado) {
        interruptorNotificaciones.setClickable(false);   // sin cambiar su aspecto
        logica.cambiarAlertas(Sesion.token(this), activado, new LogicaFakePerfil.RespuestaCambio() {
            @Override
            public void cambioGuardado() {
                Sesion.guardarAlertas(PerfilActivity.this, activado);
                interruptorNotificaciones.setClickable(true);
            }

            @Override
            public void sesionCaducada() {
                cerrarSesion();
            }

            @Override
            public void error(String mensaje) {
                ponerInterruptor(!activado);
                interruptorNotificaciones.setClickable(true);
                mostrarError(mensaje);
            }
        });
    }

    // -----------------------------------------------------------------------
    // activado: B --> ponerInterruptor() -->
    // What it does: puts the switch in its place at once (no slide animation)
    //               and without calling cambiarAlertas().
    // -----------------------------------------------------------------------
    private void ponerInterruptor(boolean activado) {
        interruptorNotificaciones.setOnCheckedChangeListener(null);
        interruptorNotificaciones.setChecked(activado);
        interruptorNotificaciones.jumpDrawablesToCurrentState();
        interruptorNotificaciones.setOnCheckedChangeListener(alCambiarInterruptor);
    }

    // -----------------------------------------------------------------------
    // cerrarSesion() -->
    // What it does: forgets the session and goes back to the welcome screen,
    //               closing every other screen.
    // -----------------------------------------------------------------------
    private void cerrarSesion() {
        Sesion.cerrar(this);
        Intent intent = new Intent(this, BienvenidaActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }

    // -----------------------------------------------------------------------
    // mensaje: Text --> mostrarError() -->
    // What it does: shows the error in red under the email, in the screen
    //               itself (no pop-up messages).
    // -----------------------------------------------------------------------
    private void mostrarError(String mensaje) {
        errorPerfil.setText(mensaje);
        errorPerfil.setVisibility(View.VISIBLE);
    }

    private static String textoONada(String texto) {
        return texto == null ? "" : texto;
    }
}
