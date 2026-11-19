// -*- mode: c++ -*-

// ---------------------------------------------------------------------------
// Fichero:     Publicador.h
// Descripción: Publica las mediciones del nodo en tramas iBeacon:
//              UUID = "AERI" + número de serie del sensor (12 cifras), para
//              que la app sepa de qué sensor es y descarte los demás;
//              major = tipo * 256 + contador; minor = valor.
//              Basado en el Publicador del Sprint 0 (Jordi Bataller i
//              Mascarell): antes el UUID era "EPSG-GTI-PELIN" + IdSensor y se
//              publicaba CO2; ahora ozono y temperatura.
//              Diseño en doc/arduino_design.md. Tarea T004.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------

#ifndef PUBLICADOR_H_INCLUIDO
#define PUBLICADOR_H_INCLUIDO

#include "Configuracion.h"

// ----------------------------------------------------------
// Publicador class: puts each measurement in an iBeacon packet and asks
// EmisoraBLE to broadcast it.
// ----------------------------------------------------------
class Publicador {

public:

  // Primeros 4 bytes del UUID: identifican los nodos AERIS
  static constexpr const char * PREFIJO_UUID = "AERI";
  static const int LARGO_PREFIJO = 4;
  static const int LARGO_NUMERO_SERIE = 12;

  // Tipos de medición (byte alto de major). El 12 es el mismo que en el Sprint 0.
  enum TipoMedicion {
    OZONO = 11,          // minor = µg/m³
    TEMPERATURA = 12     // minor = décimas de °C (215 = 21,5 °C)
  };

  static_assert(sizeof(Configuracion::NUMERO_SERIE) == LARGO_NUMERO_SERIE + 1,
                "El número de serie tiene que tener 12 cifras");

  EmisoraBLE laEmisora {
    "AERIS",    // nombre que se ve al buscar dispositivos (antes "PelinIBeacon")
    0x004c,     // fabricanteID (Apple): así la trama es un iBeacon
    4           // txPower
  };

  const int RSSI = -53;     // RSSI a 1 m que va en la trama (no se usa para medir)

private:

  uint8_t beaconUUID[16];

public:

  // ------------------------------------------------------------
  // Publicador() -->
  // What it does: builds the UUID: "AERI" + the 12 digits of the serial number.
  // ------------------------------------------------------------
  Publicador() {
    for (int i = 0; i < LARGO_PREFIJO; i++) {
      beaconUUID[i] = (uint8_t) PREFIJO_UUID[i];
    }
    for (int i = 0; i < LARGO_NUMERO_SERIE; i++) {
      beaconUUID[LARGO_PREFIJO + i] = (uint8_t) Configuracion::NUMERO_SERIE[i];
    }
  } // ()

  // ------------------------------------------------------------
  // getUUID() --> [N]_16
  // What it does: the 16 bytes of the UUID (for the tests and the serial port).
  // ------------------------------------------------------------
  const uint8_t * getUUID() const { return beaconUUID; }

  // ------------------------------------------------------------
  // encenderEmisora() -->
  // What it does: turns on Bluetooth through EmisoraBLE.
  // ------------------------------------------------------------
  void encenderEmisora() {
    laEmisora.encenderEmisora();
  } // ()

  // ------------------------------------------------------------
  // tipo: TipoMedicion, valor: Z, contador: N, tiempoEspera: Z --> publicar() -->
  // What it does: broadcasts the packet (major = tipo << 8 + contador,
  //               minor = valor) for 'tiempoEspera' ms and then stops.
  //               The counter changes with each new measurement, so the app
  //               knows if a packet is new or repeated.
  // ------------------------------------------------------------
  void publicar(TipoMedicion tipo, int16_t valor, uint8_t contador, long tiempoEspera) {
    const uint16_t major = ((uint16_t) tipo << 8) + contador;
    laEmisora.emitirAnuncioIBeacon(beaconUUID, major, valor, RSSI);
    esperar(tiempoEspera);
    laEmisora.detenerAnuncio();
  } // ()

}; // class

#endif
