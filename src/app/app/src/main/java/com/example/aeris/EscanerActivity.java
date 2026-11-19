// ---------------------------------------------------------------------------
// Fichero:     EscanerActivity.java
// Descripción: Pantalla propia para escanear el código de la etiqueta del
//              sensor (un DataMatrix de pocos milímetros). El escáner de
//              Google no lo leía: aquí la cámara (CameraX) va a alta
//              resolución, empieza con zoom ×2, enfoca donde se toca la
//              pantalla, se puede hacer zoom con dos dedos y encender la
//              linterna. Las imágenes se reparten entre dos lectores: una
//              va entera a ML Kit y la siguiente, recortada al marco del
//              centro (RecorteCentral), a ZXing, que encuentra mejor un
//              DataMatrix tan pequeño. Al leer un código devuelve su texto a «Vincular sensor», que
//              comprueba si es el de un sensor (CodigoSensor).
//              Diseño en doc/app_design.md. T039.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.Image;
import android.os.Bundle;
import android.util.Size;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.OptIn;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ExperimentalGetImage;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.MeteringPoint;
import androidx.camera.core.Preview;
import androidx.camera.core.ZoomState;
import androidx.camera.core.resolutionselector.ResolutionSelector;
import androidx.camera.core.resolutionselector.ResolutionStrategy;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.PlanarYUVLuminanceSource;
import com.google.zxing.ReaderException;
import com.google.zxing.common.HybridBinarizer;

import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

// EscanerActivity class: our own camera screen to read the sensor label code.
public class EscanerActivity extends AppCompatActivity {

    // Extra del resultado: el texto del código leído
    public static final String EXTRA_CODIGO = "codigo";
    // Resultados además de RESULT_OK / RESULT_CANCELED (cerrar)
    public static final int RESULTADO_SIN_PERMISO = RESULT_FIRST_USER;
    public static final int RESULTADO_ERROR = RESULT_FIRST_USER + 1;

    static final float ZOOM_INICIAL = 2f;                         // los códigos son muy pequeños
    private static final Size RESOLUCION_ANALISIS = new Size(1920, 1080);
    static final double PROPORCION_RECORTE = 0.6;                 // parte del lado corto que va a ZXing

    private PreviewView vistaCamara;
    private TextView botonLinterna;
    private Camera camara;
    private boolean linternaEncendida = false;
    private volatile boolean leido = false;      // para devolver solo el primer código
    private long imagenesAnalizadas = 0;         // pares a ML Kit, impares a ZXing
    private ExecutorService hiloAnalisis;
    private BarcodeScanner lector;               // ML Kit
    private MultiFormatReader lectorZxing;       // ZXing

    private final ActivityResultLauncher<String> pedirPermiso =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), concedido -> {
                if (concedido) {
                    iniciarCamara();
                } else {
                    setResult(RESULTADO_SIN_PERMISO);
                    finish();
                }
            });

    // -----------------------------------------------------------------------
    // estado: Bundle --> onCreate() -->
    // What it does: shows the camera (asking for the permission the first
    //               time), the close and torch buttons, tap to focus and
    //               pinch to zoom.
    // -----------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        setContentView(R.layout.activity_escaner);
        vistaCamara = findViewById(R.id.vistaCamara);
        botonLinterna = findViewById(R.id.botonLinterna);
        findViewById(R.id.botonCerrarEscaner).setOnClickListener(vista -> {
            setResult(RESULT_CANCELED);
            finish();
        });
        botonLinterna.setOnClickListener(vista -> cambiarLinterna());
        prepararGestos();

        hiloAnalisis = Executors.newSingleThreadExecutor();
        lector = BarcodeScanning.getClient(new BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_DATA_MATRIX, Barcode.FORMAT_QR_CODE)
                .build());
        Map<DecodeHintType, Object> pistas = new EnumMap<>(DecodeHintType.class);
        pistas.put(DecodeHintType.POSSIBLE_FORMATS, Arrays.asList(BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE));
        pistas.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        lectorZxing = new MultiFormatReader();
        lectorZxing.setHints(pistas);

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            iniciarCamara();
        } else {
            pedirPermiso.launch(Manifest.permission.CAMERA);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        hiloAnalisis.shutdown();
        lector.close();
    }

    // -----------------------------------------------------------------------
    // iniciarCamara() -->
    // What it does: binds the back camera to this screen: the preview and
    //               the analysis of each image (high resolution, only the
    //               latest image). Starts with ZOOM_INICIAL. If the camera
    //               cannot start, goes back with RESULTADO_ERROR.
    // -----------------------------------------------------------------------
    private void iniciarCamara() {
        var futuro = ProcessCameraProvider.getInstance(this);
        futuro.addListener(() -> {
            try {
                ProcessCameraProvider proveedor = futuro.get();
                Preview vistaPrevia = new Preview.Builder().build();
                vistaPrevia.setSurfaceProvider(vistaCamara.getSurfaceProvider());
                ImageAnalysis analisis = new ImageAnalysis.Builder()
                        .setResolutionSelector(new ResolutionSelector.Builder()
                                .setResolutionStrategy(new ResolutionStrategy(RESOLUCION_ANALISIS,
                                        ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER))
                                .build())
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build();
                analisis.setAnalyzer(hiloAnalisis, this::analizar);
                proveedor.unbindAll();
                camara = proveedor.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, vistaPrevia, analisis);
                camara.getCameraControl().setZoomRatio(zoomPermitido(ZOOM_INICIAL));
                botonLinterna.setVisibility(camara.getCameraInfo().hasFlashUnit() ? View.VISIBLE : View.GONE);
            } catch (Exception error) {
                setResult(RESULTADO_ERROR);
                finish();
            }
        }, ContextCompat.getMainExecutor(this));
    }

    // -----------------------------------------------------------------------
    // imagen: ImageProxy --> analizar() -->        (en el hilo de análisis)
    // What it does: looks for a DataMatrix or QR in the image; the first one
    //               with text is returned to «Vincular sensor». Even images
    //               go whole to ML Kit; odd ones are cut to the centre frame
    //               and go to ZXing, which finds very small codes better.
    // -----------------------------------------------------------------------
    @OptIn(markerClass = ExperimentalGetImage.class)
    private void analizar(ImageProxy imagen) {
        Image foto = imagen.getImage();
        if (foto == null || leido) {
            imagen.close();
            return;
        }
        if (imagenesAnalizadas++ % 2 == 1) {
            try {
                String texto = leerConZxing(imagen);
                if (texto != null) {
                    devolver(texto);
                }
            } finally {
                imagen.close();
            }
            return;
        }
        InputImage entrada = InputImage.fromMediaImage(foto, imagen.getImageInfo().getRotationDegrees());
        lector.process(entrada)
                .addOnSuccessListener(codigos -> {
                    for (Barcode codigo : codigos) {
                        String texto = codigo.getRawValue();
                        if (texto != null && !texto.trim().isEmpty()) {
                            devolver(texto);
                            break;
                        }
                    }
                })
                .addOnCompleteListener(tarea -> imagen.close());
    }

    // -----------------------------------------------------------------------
    // imagen: ImageProxy --> leerConZxing() --> Texto | null
    // What it does: cuts the centre square (PROPORCION_RECORTE of the shorter
    //               side) out of the luminance and asks ZXing for a
    //               DataMatrix or QR in it. null if there is none.
    // -----------------------------------------------------------------------
    private String leerConZxing(ImageProxy imagen) {
        ImageProxy.PlaneProxy planoY = imagen.getPlanes()[0];
        ByteBuffer datos = planoY.getBuffer();
        byte[] luminancia = new byte[datos.remaining()];
        datos.get(luminancia);
        int lado = RecorteCentral.lado(imagen.getWidth(), imagen.getHeight(), PROPORCION_RECORTE);
        byte[] recorte = RecorteCentral.recortar(luminancia, imagen.getWidth(), imagen.getHeight(),
                planoY.getRowStride(), lado);
        try {
            String texto = lectorZxing.decodeWithState(new BinaryBitmap(new HybridBinarizer(
                    new PlanarYUVLuminanceSource(recorte, lado, lado, 0, 0, lado, lado, false)))).getText();
            return texto == null || texto.trim().isEmpty() ? null : texto;
        } catch (ReaderException sinCodigo) {
            return null;
        } finally {
            lectorZxing.reset();
        }
    }

    // -----------------------------------------------------------------------
    // texto: Text --> devolver() -->
    // What it does: only once: closes the screen with RESULT_OK and the text.
    // -----------------------------------------------------------------------
    private void devolver(String texto) {
        if (leido) {
            return;
        }
        leido = true;
        runOnUiThread(() -> {
            setResult(RESULT_OK, new Intent().putExtra(EXTRA_CODIGO, texto));
            finish();
        });
    }

    // -----------------------------------------------------------------------
    // prepararGestos() -->
    // What it does: one finger: focuses where the screen is touched; two
    //               fingers: zoom.
    // -----------------------------------------------------------------------
    private void prepararGestos() {
        ScaleGestureDetector pellizco = new ScaleGestureDetector(this,
                new ScaleGestureDetector.SimpleOnScaleGestureListener() {
                    @Override
                    public boolean onScale(ScaleGestureDetector detector) {
                        ZoomState zoom = camara == null ? null : camara.getCameraInfo().getZoomState().getValue();
                        if (zoom == null) {
                            return false;
                        }
                        camara.getCameraControl().setZoomRatio(zoomPermitido(zoom.getZoomRatio() * detector.getScaleFactor()));
                        return true;
                    }
                });
        vistaCamara.setOnTouchListener((vista, evento) -> {
            pellizco.onTouchEvent(evento);
            if (evento.getAction() == MotionEvent.ACTION_UP && !pellizco.isInProgress() && camara != null) {
                MeteringPoint punto = vistaCamara.getMeteringPointFactory().createPoint(evento.getX(), evento.getY());
                camara.getCameraControl().startFocusAndMetering(new FocusMeteringAction.Builder(punto)
                        .setAutoCancelDuration(3, TimeUnit.SECONDS)
                        .build());
                vista.performClick();
            }
            return true;
        });
    }

    // -----------------------------------------------------------------------
    // deseado: R --> zoomPermitido() --> R
    // What it does: keeps the zoom between the camera's minimum and maximum.
    // -----------------------------------------------------------------------
    private float zoomPermitido(float deseado) {
        ZoomState zoom = camara == null ? null : camara.getCameraInfo().getZoomState().getValue();
        if (zoom == null) {
            return deseado;
        }
        return Math.max(zoom.getMinZoomRatio(), Math.min(deseado, zoom.getMaxZoomRatio()));
    }

    // -----------------------------------------------------------------------
    // cambiarLinterna() -->
    // What it does: turns the torch on or off (it helps the camera focus on
    //               the small code).
    // -----------------------------------------------------------------------
    private void cambiarLinterna() {
        if (camara == null) {
            return;
        }
        linternaEncendida = !linternaEncendida;
        camara.getCameraControl().enableTorch(linternaEncendida);
        botonLinterna.setText(linternaEncendida ? R.string.escaner_linterna_apagar : R.string.escaner_linterna);
    }
}
