// ---------------------------------------------------------------------------
// Fichero:     LuzSensor.java
// Descripción: Activa o desactiva la luz de aviso del nodo (H033: el LED
//              parpadea más rápido cuanto peor está el aire). Se conecta por
//              Bluetooth al sensor (su dirección la guarda ServicioMediciones
//              al recibir sus tramas), escribe 1 o 0 en la característica
//              «AERIS-LUZ-ACTIVA» del servicio «AERIS-SERVICIO-1» y se
//              desconecta. La respuesta llega en el hilo principal.
//              Lado del nodo: ServicioLuz.h y LuzAviso.h.
//              Diseño en doc/app_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.util.UUID;

// LuzSensor class: turns the sensor's warning light on or off over Bluetooth.
public final class LuzSensor {

    static final UUID SERVICIO = UuidAERIS.desdeTexto("AERIS-SERVICIO-1");
    static final UUID CARACTERISTICA = UuidAERIS.desdeTexto("AERIS-LUZ-ACTIVA");
    static final long TIEMPO_MAXIMO = 15_000;          // ms para conectar y escribir

    private static final String ETIQUETA_LOG = "LuzSensor";
    private static final String PREFERENCIAS = "sensor_bluetooth";
    private static final String CLAVE_DIRECCION = "direccion";

    // Lo que se responde a quien la cambia (en el hilo principal)
    public interface Respuesta {
        void cambiada();

        void error(String mensaje);
    }

    private LuzSensor() {
    }

    // -----------------------------------------------------------------------
    // contexto: Context, direccion: Text --> guardarDireccion() --x
    // contexto: Context --> direccion() --x       Text | null <--
    // What it does: remembers the Bluetooth address of the user's sensor
    //               (only writes when it changes).
    // -----------------------------------------------------------------------
    static void guardarDireccion(Context contexto, String direccion) {
        if (direccion != null && !direccion.equals(direccion(contexto))) {
            contexto.getSharedPreferences(PREFERENCIAS, Context.MODE_PRIVATE).edit()
                    .putString(CLAVE_DIRECCION, direccion).apply();
        }
    }

    static String direccion(Context contexto) {
        return contexto.getSharedPreferences(PREFERENCIAS, Context.MODE_PRIVATE)
                .getString(CLAVE_DIRECCION, null);
    }

    // -----------------------------------------------------------------------
    // contexto: Context, activa: B, respuesta: Respuesta --> cambiar() --x
    // What it does: connects to the sensor, writes 1 (on) or 0 (off) and
    //               disconnects. Errors: no address yet (the sensor has not
    //               been seen), Bluetooth off, or it could not connect or
    //               write in TIEMPO_MAXIMO.
    // -----------------------------------------------------------------------
    @SuppressLint("MissingPermission")      // MiSensorActivity pide BLUETOOTH_CONNECT antes
    static void cambiar(Context contexto, boolean activa, Respuesta respuesta) {
        Context app = contexto.getApplicationContext();
        String direccion = direccion(app);
        if (direccion == null) {
            respuesta.error(app.getString(R.string.mi_sensor_luz_sin_direccion));
            return;
        }
        BluetoothManager gestor = app.getSystemService(BluetoothManager.class);
        BluetoothAdapter adaptador = gestor == null ? null : gestor.getAdapter();
        if (adaptador == null || !adaptador.isEnabled()) {
            respuesta.error(app.getString(R.string.mi_sensor_luz_bluetooth));
            return;
        }
        new Operacion(app, activa, respuesta).empezar(adaptador.getRemoteDevice(direccion));
    }

    // Una conexión: conectar -> buscar el servicio -> escribir -> desconectar
    private static final class Operacion extends BluetoothGattCallback {

        private final Context contexto;
        private final byte valor;
        private final Respuesta respuesta;
        private final Handler principal = new Handler(Looper.getMainLooper());
        private BluetoothGatt gatt;
        private boolean terminada = false;

        Operacion(Context contexto, boolean activa, Respuesta respuesta) {
            this.contexto = contexto;
            this.valor = (byte) (activa ? 1 : 0);
            this.respuesta = respuesta;
        }

        @SuppressLint("MissingPermission")
        void empezar(BluetoothDevice dispositivo) {
            principal.postDelayed(() -> acabar(false), TIEMPO_MAXIMO);
            try {
                gatt = dispositivo.connectGatt(contexto, false, this, BluetoothDevice.TRANSPORT_LE);
            } catch (SecurityException sinPermiso) {
                acabar(false);
            }
        }

        @SuppressLint("MissingPermission")
        @Override
        public void onConnectionStateChange(BluetoothGatt g, int estado, int nuevoEstado) {
            if (nuevoEstado == BluetoothProfile.STATE_CONNECTED && estado == BluetoothGatt.GATT_SUCCESS) {
                g.discoverServices();
            } else if (nuevoEstado == BluetoothProfile.STATE_DISCONNECTED) {
                principal.post(() -> acabar(false));
            }
        }

        @SuppressLint("MissingPermission")
        @Override
        public void onServicesDiscovered(BluetoothGatt g, int estado) {
            BluetoothGattService servicio = g.getService(SERVICIO);
            BluetoothGattCharacteristic caracteristica = servicio == null ? null : servicio.getCharacteristic(CARACTERISTICA);
            if (estado != BluetoothGatt.GATT_SUCCESS || caracteristica == null) {
                Log.w(ETIQUETA_LOG, "el sensor no tiene el servicio de la luz (¿programa antiguo?)");
                principal.post(() -> acabar(false));
                return;
            }
            caracteristica.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
            caracteristica.setValue(new byte[]{valor});
            if (!g.writeCharacteristic(caracteristica)) {
                principal.post(() -> acabar(false));
            }
        }

        @Override
        public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic c, int estado) {
            final boolean bien = estado == BluetoothGatt.GATT_SUCCESS;
            principal.post(() -> acabar(bien));
        }

        // -------------------------------------------------------------------
        // bien: B --> acabar() -->        (en el hilo principal, una sola vez)
        // What it does: disconnects and answers.
        // -------------------------------------------------------------------
        @SuppressLint("MissingPermission")
        private void acabar(boolean bien) {
            if (terminada) {
                return;
            }
            terminada = true;
            principal.removeCallbacksAndMessages(null);
            if (gatt != null) {
                try {
                    gatt.disconnect();
                    gatt.close();
                } catch (SecurityException ignorada) {
                    // sin permiso ya no hay conexión que cerrar
                }
            }
            if (bien) {
                respuesta.cambiada();
            } else {
                respuesta.error(contexto.getString(R.string.mi_sensor_luz_error));
            }
        }
    }
}
