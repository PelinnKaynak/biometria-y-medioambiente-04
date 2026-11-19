// ---------------------------------------------------------------------------
// Fichero:     ServicioMediciones.java
// Descripción: Servicio en primer plano (con su notificación) que recibe las
//              mediciones del sensor del usuario por Bluetooth y las envía al
//              servidor (POST /guardarMedicion, T017) con la ubicación y la
//              hora. Busca tramas iBeacon AERIS (TramaAERIS) del número de
//              serie vinculado (Sesion.numeroSerie), guarda una de ozono por
//              minuto (ReceptorMediciones) y, si no hay conexión, las deja en
//              ColaMediciones para enviarlas después. Sigue midiendo con la
//              app en segundo plano o la pantalla apagada. Al guardar una
//              medición avisa a Inicio (ACCION_MEDICION_GUARDADA).
//              Basado en MainActivity (MedicionIBeacon) del Sprint 0.
//              Diseño en doc/app_design.md. T023.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import java.time.ZoneId;
import java.util.Collections;

// ServicioMediciones class: listens to the user's sensor and sends what it measures.
public class ServicioMediciones extends Service {

    static final String ACCION_MEDICION_GUARDADA = "com.example.aeris.MEDICION_GUARDADA";

    private static final String ETIQUETA_LOG = "ServicioMediciones";
    private static final String CANAL = "medicion";
    private static final int ID_NOTIFICACION = 23;
    private static final String PREFERENCIAS = "mediciones_pendientes";
    private static final String CLAVE_COLA = "cola";
    private static final long REINTENTO = 60_000L;               // reenviar / volver a buscar (ms)
    private static final long INTERVALO_UBICACION = 30_000L;     // ms entre ubicaciones

    private final Handler principal = new Handler(Looper.getMainLooper());
    private final ReceptorMediciones receptor = new ReceptorMediciones();
    private ColaMediciones cola;
    private String numeroSerie;
    private BluetoothLeScanner escaner;
    private boolean escaneando = false;
    private boolean enviando = false;
    private LocationManager gestorUbicacion;
    private Location ultimaUbicacion;

    // -----------------------------------------------------------------------
    // contexto: Context --> iniciar() --x
    // contexto: Context --> parar() --x
    // What it does: starts the service if the permissions are given (if it
    //               is already running nothing changes) / stops it.
    // -----------------------------------------------------------------------
    static void iniciar(Context contexto) {
        if (!PermisosMedicion.concedidos(contexto)) {
            return;
        }
        try {
            ContextCompat.startForegroundService(contexto, new Intent(contexto, ServicioMediciones.class));
        } catch (RuntimeException noSePuede) {
            // p. ej. Android no deja empezarlo con la app en segundo plano
            Log.w(ETIQUETA_LOG, "no se puede iniciar: " + noSePuede.getMessage());
        }
    }

    static void parar(Context contexto) {
        contexto.stopService(new Intent(contexto, ServicioMediciones.class));
    }

    // -----------------------------------------------------------------------
    // onCreate() -->
    // What it does: shows the notification (it must be at once), reads the
    //               pending measurements and starts the location, the
    //               Bluetooth search and the sending.
    // -----------------------------------------------------------------------
    @Override
    public void onCreate() {
        super.onCreate();
        crearCanal();
        try {
            startForeground(ID_NOTIFICACION, notificacion(getString(R.string.medicion_buscando)),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } catch (RuntimeException sinPermiso) {
            Log.w(ETIQUETA_LOG, "no puede ir en primer plano: " + sinPermiso.getMessage());
            stopSelf();
            return;
        }
        cola = ColaMediciones.desdeTexto(preferencias().getString(CLAVE_COLA, null));
        ContextCompat.registerReceiver(this, cambioBluetooth,
                new IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED);
        empezarUbicacion();
        empezarBusqueda();
        enviarPendientes();
    }

    // -----------------------------------------------------------------------
    // intent: Intent, flags: N, id: N --> onStartCommand() --> N
    // What it does: takes the serial number of the linked sensor; without a
    //               session or a sensor, stops.
    // -----------------------------------------------------------------------
    @Override
    public int onStartCommand(Intent intent, int flags, int id) {
        numeroSerie = Sesion.numeroSerie(this);
        if (!Sesion.haySesion(this) || numeroSerie == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        principal.removeCallbacksAndMessages(null);
        pararBusqueda();
        if (gestorUbicacion != null) {
            gestorUbicacion.removeUpdates(oyenteUbicacion);
        }
        try {
            unregisterReceiver(cambioBluetooth);
        } catch (IllegalArgumentException noEstaba) {
            // onCreate terminó antes de registrarlo
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // --- Bluetooth -------------------------------------------------------------

    // -----------------------------------------------------------------------
    // empezarBusqueda() -->
    // What it does: searches only AERIS packets (filter on the manufacturer
    //               data, so it also works with the screen off). If Bluetooth
    //               is off it says so in the notification and waits.
    // -----------------------------------------------------------------------
    @SuppressLint("MissingPermission")      // PermisosMedicion se comprueba antes de iniciar
    private void empezarBusqueda() {
        if (escaneando) {
            return;
        }
        BluetoothManager gestor = getSystemService(BluetoothManager.class);
        BluetoothAdapter adaptador = gestor == null ? null : gestor.getAdapter();
        if (adaptador == null) {
            cambiarNotificacion(getString(R.string.medicion_sin_bluetooth));
            return;
        }
        if (!adaptador.isEnabled()) {
            cambiarNotificacion(getString(R.string.medicion_bluetooth_apagado));
            return;
        }
        escaner = adaptador.getBluetoothLeScanner();
        if (escaner == null) {
            return;
        }
        byte[] mascara = new byte[TramaAERIS.PREFIJO.length];
        java.util.Arrays.fill(mascara, (byte) 0xFF);
        ScanFilter filtro = new ScanFilter.Builder()
                .setManufacturerData(TramaAERIS.ID_FABRICANTE, TramaAERIS.PREFIJO, mascara)
                .build();
        ScanSettings ajustes = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_BALANCED)
                .build();
        try {
            escaner.startScan(Collections.singletonList(filtro), ajustes, alEncontrar);
            escaneando = true;
            Log.d(ETIQUETA_LOG, "buscando el sensor " + numeroSerie);
            cambiarNotificacion(getString(R.string.medicion_buscando));
        } catch (RuntimeException sinPermiso) {
            Log.w(ETIQUETA_LOG, "no se puede buscar: " + sinPermiso.getMessage());
        }
    }

    @SuppressLint("MissingPermission")
    private void pararBusqueda() {
        if (escaneando && escaner != null) {
            try {
                escaner.stopScan(alEncontrar);
            } catch (RuntimeException yaParado) {
                // Bluetooth apagado: la búsqueda ya no existe
            }
        }
        escaneando = false;
    }

    private final ScanCallback alEncontrar = new ScanCallback() {
        @Override
        public void onScanResult(int tipoCallback, ScanResult resultado) {
            ScanRecord registro = resultado.getScanRecord();
            if (registro == null) {
                return;
            }
            TramaAERIS trama = TramaAERIS.leer(registro.getManufacturerSpecificData(TramaAERIS.ID_FABRICANTE));
            if (trama != null) {
                String direccion = resultado.getDevice() == null ? null : resultado.getDevice().getAddress();
                principal.post(() -> recibir(trama, direccion));
            }
        }

        @Override
        public void onScanFailed(int codigo) {
            Log.w(ETIQUETA_LOG, "la búsqueda ha fallado: " + codigo);
            escaneando = false;
            principal.postDelayed(ServicioMediciones.this::empezarBusqueda, REINTENTO);
        }
    };

    // Bluetooth encendido -> buscar; apagado -> avisar en la notificación
    private final BroadcastReceiver cambioBluetooth = new BroadcastReceiver() {
        @Override
        public void onReceive(Context contexto, Intent intent) {
            int estado = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR);
            if (estado == BluetoothAdapter.STATE_ON) {
                empezarBusqueda();
            } else if (estado == BluetoothAdapter.STATE_OFF) {
                escaneando = false;
                cambiarNotificacion(getString(R.string.medicion_bluetooth_apagado));
            }
        }
    };

    // -----------------------------------------------------------------------
    // trama: TramaAERIS, direccion: Text --> recibir() -->   (en el hilo principal)
    // What it does: keeps the packets of the user's sensor that
    //               ReceptorMediciones takes as new, with the place and the
    //               hour, in the queue, and sends them. It also remembers the
    //               sensor's Bluetooth address (LuzSensor connects to it).
    // -----------------------------------------------------------------------
    private void recibir(TramaAERIS trama, String direccion) {
        if (numeroSerie == null || !numeroSerie.equals(trama.numeroSerie)) {
            return;         // es de otro sensor AERIS
        }
        LuzSensor.guardarDireccion(this, direccion);
        long ahora = System.currentTimeMillis();
        if (!receptor.esNueva(trama, ahora)) {
            return;
        }
        Log.d(ETIQUETA_LOG, "medición nueva: " + trama.valor + " µg/m³ (contador " + trama.contador + ")");
        String hora = TiempoTranscurrido.hora(ahora, ZoneId.systemDefault());
        if (ultimaUbicacion == null) {
            cambiarNotificacion(getString(R.string.medicion_sin_ubicacion, trama.valor));
            return;
        }
        cola.anadir(ReceptorMediciones.cuerpo(numeroSerie, trama.valor,
                ultimaUbicacion.getLatitude(), ultimaUbicacion.getLongitude(), ahora));
        guardarCola();
        cambiarNotificacion(getString(R.string.medicion_ultima,
                ReceptorMediciones.valorParaServidor(trama.valor), hora));
        enviarPendientes();
    }

    // --- Envío al servidor ---------------------------------------------------------

    // -----------------------------------------------------------------------
    // enviarPendientes() -->
    // What it does: sends the oldest pending measurement and, when the server
    //               answers, the next one. Without connection it tries again
    //               in a minute; 401 stops the service (no session).
    // -----------------------------------------------------------------------
    private void enviarPendientes() {
        if (enviando || cola == null || cola.vacia()) {
            return;
        }
        String token = Sesion.token(this);
        if (token == null) {
            stopSelf();
            return;
        }
        enviando = true;
        String cuerpo = cola.primero();
        new PeticionarioREST().hacerPeticionREST("POST", LogicaFakeRegistro.URL_SERVIDOR + "/guardarMedicion",
                cuerpo, token, (codigo, respuesta) -> {
                    enviando = false;
                    switch (ReceptorMediciones.queHacer(codigo)) {
                        case ENVIADA:
                            cola.quitarPrimero();
                            guardarCola();
                            sendBroadcast(new Intent(ACCION_MEDICION_GUARDADA).setPackage(getPackageName()));
                            enviarPendientes();
                            break;
                        case DESCARTAR:
                            Log.w(ETIQUETA_LOG, "el servidor no la acepta (" + codigo + "): " + respuesta);
                            cola.quitarPrimero();
                            guardarCola();
                            enviarPendientes();
                            break;
                        case REINTENTAR:
                            Log.d(ETIQUETA_LOG, "sin conexión (" + codigo + "), " + cola.tamano() + " pendientes");
                            principal.removeCallbacks(reintentarEnvio);
                            principal.postDelayed(reintentarEnvio, REINTENTO);
                            break;
                        case SIN_SESION:
                            stopSelf();
                            break;
                    }
                });
    }

    private final Runnable reintentarEnvio = this::enviarPendientes;

    private void guardarCola() {
        preferencias().edit().putString(CLAVE_COLA, cola.aTexto()).apply();
    }

    private SharedPreferences preferencias() {
        return getSharedPreferences(PREFERENCIAS, MODE_PRIVATE);
    }

    // --- Ubicación -----------------------------------------------------------------

    // -----------------------------------------------------------------------
    // empezarUbicacion() -->
    // What it does: starts with the last known location and asks a new one
    //               every INTERVALO_UBICACION from the GPS and the network.
    // -----------------------------------------------------------------------
    @SuppressLint("MissingPermission")
    private void empezarUbicacion() {
        gestorUbicacion = getSystemService(LocationManager.class);
        if (gestorUbicacion == null) {
            return;
        }
        for (String proveedor : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
            try {
                if (!gestorUbicacion.getAllProviders().contains(proveedor)) {
                    continue;
                }
                nuevaUbicacion(gestorUbicacion.getLastKnownLocation(proveedor));
                gestorUbicacion.requestLocationUpdates(proveedor, INTERVALO_UBICACION, 0f,
                        oyenteUbicacion, Looper.getMainLooper());
            } catch (RuntimeException sinPermiso) {
                Log.w(ETIQUETA_LOG, "sin ubicación de " + proveedor + ": " + sinPermiso.getMessage());
            }
        }
    }

    // se queda con la más nueva
    private void nuevaUbicacion(Location ubicacion) {
        if (ubicacion != null && (ultimaUbicacion == null || ubicacion.getTime() >= ultimaUbicacion.getTime())) {
            ultimaUbicacion = ubicacion;
        }
    }

    // Clase anónima con todos los métodos: en Android 10 (API 29) no tienen
    // implementación por defecto y una lambda fallaría
    private final LocationListener oyenteUbicacion = new LocationListener() {
        @Override
        public void onLocationChanged(Location ubicacion) {
            nuevaUbicacion(ubicacion);
        }

        @Override
        public void onStatusChanged(String proveedor, int estado, Bundle extras) {
        }

        @Override
        public void onProviderEnabled(String proveedor) {
        }

        @Override
        public void onProviderDisabled(String proveedor) {
        }
    };

    // --- Notificación ----------------------------------------------------------------

    private void crearCanal() {
        NotificationChannel canal = new NotificationChannel(CANAL,
                getString(R.string.medicion_canal), NotificationManager.IMPORTANCE_LOW);
        canal.setDescription(getString(R.string.medicion_canal_descripcion));
        getSystemService(NotificationManager.class).createNotificationChannel(canal);
    }

    // texto: Text --> notificacion() --> Notification   (al tocarla abre Inicio)
    private Notification notificacion(String texto) {
        PendingIntent abrirInicio = PendingIntent.getActivity(this, 0,
                new Intent(this, InicioActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CANAL)
                .setSmallIcon(R.drawable.ic_sensor)
                .setContentTitle(getString(R.string.medicion_titulo))
                .setContentText(texto)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(abrirInicio)
                .build();
    }

    private void cambiarNotificacion(String texto) {
        try {
            getSystemService(NotificationManager.class).notify(ID_NOTIFICACION, notificacion(texto));
        } catch (SecurityException sinPermiso) {
            // sin permiso de notificaciones: se mide igual
        }
    }
}
