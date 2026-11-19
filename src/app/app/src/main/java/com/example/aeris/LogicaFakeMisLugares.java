// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeMisLugares.java
// Descripción: Lógica del teléfono para la pantalla «Mis lugares» (T019, H034).
//              Gestiona el almacenamiento de hasta 5 lugares por usuario,
//              la consulta de ozono actual desde el mapa interpolado y la
//              activación/desactivación de avisos de cada lugar.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

// LogicaFakeMisLugares class: manages the user's saved places and their alerts.
public class LogicaFakeMisLugares {

    public static final int MAX_LUGARES = 5;

    public static final int CODIGO_OK = 200;
    public static final int CODIGO_CREADO = 201;
    public static final int CODIGO_LIMITE = 400;
    public static final int CODIGO_SIN_SESION = 401;

    public static final String ERROR_NOMBRE_VACIO = "Escribe un nombre para el lugar";
    public static final String ERROR_DIRECCION_VACIA = "Escribe una dirección para el lugar";
    public static final String ERROR_LIMITE_ALCANZADO = "Has alcanzado el límite máximo de 5 lugares";
    public static final String ERROR_LUGAR_NO_ENCONTRADO = "El lugar no existe";

    // Almacén en memoria indexado por usuario/token para garantizar aislamiento
    private static final Map<String, List<Lugar>> ALMACEN_LUGARES = new HashMap<>();
    private static final AtomicInteger SECUENCIA_IDS = new AtomicInteger(100);

    // -----------------------------------------------------------------------
    // Callbacks para las operaciones asíncronas
    // -----------------------------------------------------------------------
    public interface CallbackLugares {
        void lugaresObtenidos(List<Lugar> lugares);
        void sesionCaducada();
        void error(String mensaje);
    }

    public interface CallbackOperacionLugar {
        void exito(Lugar lugar);
        void limiteAlcanzado(String mensaje);
        void sesionCaducada();
        void error(String mensaje);
    }

    public interface CallbackEliminarLugar {
        void eliminado(int idLugar);
        void sesionCaducada();
        void error(String mensaje);
    }

    // -----------------------------------------------------------------------
    // token: Text --> obtenerLugares() -->
    // What it does: fetches all saved places for the authenticated user.
    // -----------------------------------------------------------------------
    public void obtenerLugares(String token, final CallbackLugares callback) {
        if (!esTokenValido(token)) {
            callback.sesionCaducada();
            return;
        }

        List<Lugar> lista = obtenerOInicializar(token);
        callback.lugaresObtenidos(new ArrayList<>(lista));
    }

    // -----------------------------------------------------------------------
    // token: Text, nombre: Text, direccion: Text --> anadirLugar() -->
    // What it does: validates fields, enforces the 5-places limit, computes
    //               interpolated ozone and saves the place for the user.
    // -----------------------------------------------------------------------
    public void anadirLugar(String token, String nombre, String direccion, final CallbackOperacionLugar callback) {
        if (!esTokenValido(token)) {
            callback.sesionCaducada();
            return;
        }

        if (nombre == null || nombre.trim().isEmpty()) {
            callback.error(ERROR_NOMBRE_VACIO);
            return;
        }

        if (direccion == null || direccion.trim().isEmpty()) {
            callback.error(ERROR_DIRECCION_VACIA);
            return;
        }

        List<Lugar> lista = obtenerOInicializar(token);
        if (lista.size() >= MAX_LUGARES) {
            callback.limiteAlcanzado(ERROR_LIMITE_ALCANZADO);
            return;
        }

        double ozonoInterpolado = interpolarOzonoParaDireccion(direccion.trim());
        int nuevoId = SECUENCIA_IDS.incrementAndGet();
        Lugar nuevoLugar = new Lugar(nuevoId, 0, nombre.trim(), direccion.trim(), 38.967, -0.183, ozonoInterpolado, true);

        lista.add(nuevoLugar);
        callback.exito(nuevoLugar);
    }

    // -----------------------------------------------------------------------
    // token: Text, idLugar: Z, avisosActivos: B --> cambiarAvisos() -->
    // What it does: toggles alerts on/off for a specific place of the user.
    // -----------------------------------------------------------------------
    public void cambiarAvisos(String token, int idLugar, boolean avisosActivos, final CallbackOperacionLugar callback) {
        if (!esTokenValido(token)) {
            callback.sesionCaducada();
            return;
        }

        List<Lugar> lista = obtenerOInicializar(token);
        for (int i = 0; i < lista.size(); i++) {
            Lugar actual = lista.get(i);
            if (actual.id == idLugar) {
                Lugar actualizado = new Lugar(actual.id, actual.idUsuario, actual.nombre,
                        actual.direccion, actual.latitud, actual.longitud, actual.ozonoActual, avisosActivos);
                lista.set(i, actualizado);
                callback.exito(actualizado);
                return;
            }
        }
        callback.error(ERROR_LUGAR_NO_ENCONTRADO);
    }

    // -----------------------------------------------------------------------
    // token: Text, idLugar: Z --> eliminarLugar() -->
    // What it does: removes a place from the user's account.
    // -----------------------------------------------------------------------
    public void eliminarLugar(String token, int idLugar, final CallbackEliminarLugar callback) {
        if (!esTokenValido(token)) {
            callback.sesionCaducada();
            return;
        }

        List<Lugar> lista = obtenerOInicializar(token);
        for (int i = 0; i < lista.size(); i++) {
            if (lista.get(i).id == idLugar) {
                lista.remove(i);
                callback.eliminado(idLugar);
                return;
            }
        }
        callback.error(ERROR_LUGAR_NO_ENCONTRADO);
    }

    // -----------------------------------------------------------------------
    // token: Text --> esTokenValido() --x
    // B <--
    // What it does: checks if the session token is present and valid.
    // -----------------------------------------------------------------------
    public static boolean esTokenValido(String token) {
        return token != null && !token.trim().isEmpty() && !token.equals("token_invalido");
    }

    // -----------------------------------------------------------------------
    // direccion: Text --> interpolarOzonoParaDireccion() --x
    // R <--
    // What it does: estimates current ozone concentration (µg/m³) from the
    //               interpolated map model based on location.
    // -----------------------------------------------------------------------
    public static double interpolarOzonoParaDireccion(String direccion) {
        if (direccion == null || direccion.trim().isEmpty()) {
            return 80.0;
        }
        String texto = direccion.toLowerCase();
        if (texto.contains("playa") || texto.contains("grao") || texto.contains("mar")) {
            return 65.0; // zona costera / ventilada: ozono moderado-bajo
        } else if (texto.contains("centro") || texto.contains("mayor") || texto.contains("ciudad")) {
            return 85.0; // zona urbana con tráfico
        } else if (texto.contains("montaña") || texto.contains("parque") || texto.contains("rural")) {
            return 110.0; // zonas rurales/periféricas con mayor formación fotoquímica
        } else if (texto.contains("industrial") || texto.contains("poligono")) {
            return 150.0; // zona con mayores picos
        }
        // Cálculo pseudo-aleatorio determinista según el texto
        int hash = Math.abs(direccion.hashCode());
        return 60.0 + (hash % 90); // valores entre 60 y 150 µg/m³
    }

    // -----------------------------------------------------------------------
    // token: Text --> obtenerOInicializar() --x (privado)
    // List<Lugar> <--
    // What it does: returns user places list or initializes with default demo places.
    // -----------------------------------------------------------------------
    private synchronized List<Lugar> obtenerOInicializar(String token) {
        List<Lugar> lista = ALMACEN_LUGARES.get(token);
        if (lista == null) {
            lista = new ArrayList<>();
            // Lugares de ejemplo por defecto para usuarios con sesión (coincidentes con Inicio)
            lista.add(new Lugar(SECUENCIA_IDS.incrementAndGet(), 0, "Casa", "Carrer Major, 12, Gandia", 38.967, -0.183, 84.0, true));
            lista.add(new Lugar(SECUENCIA_IDS.incrementAndGet(), 0, "Trabajo", "Av. de la Pau, 45, Gandia", 38.971, -0.179, 150.0, true));
            ALMACEN_LUGARES.put(token, lista);
        }
        return lista;
    }

    // -----------------------------------------------------------------------
    // reiniciarParaPruebas() --x
    // What it does: clears in-memory storage for isolated unit tests.
    // -----------------------------------------------------------------------
    public static synchronized void reiniciarParaPruebas() {
        ALMACEN_LUGARES.clear();
        SECUENCIA_IDS.set(100);
    }
}
