// -*- mode: c++ -*-

// ---------------------------------------------------------------------------
// Fichero:     ServicioLuz.h
// Descripción: Servicio Bluetooth al que se conecta la app para activar o
//              desactivar la luz de aviso (H033). Tiene una característica
//              de 1 byte que se puede leer y escribir: 1 = luz activada,
//              0 = desactivada. Los UUID se forman con el texto, como en el
//              Sprint 0 (ServicioEnEmisora.h): «AERIS-SERVICIO-1» y
//              «AERIS-LUZ-ACTIVA». Diseño en doc/arduino_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------

#ifndef SERVICIO_LUZ_H_INCLUIDO
#define SERVICIO_LUZ_H_INCLUIDO

#include "Configuracion.h"

// ----------------------------------------------------------
// ServicioLuz class: lets the phone turn the warning light on and off.
// ----------------------------------------------------------
class ServicioLuz {

public:

  using CallbackEscrita = void ( uint16_t conn_handle, BLECharacteristic * chr,
                                 uint8_t * data, uint16_t len );

private:

  uint8_t uuidServicio[16] = { 0 };
  uint8_t uuidCaracteristica[16] = { 0 };
  BLEService elServicio;
  BLECharacteristic laCaracteristica;

public:

  ServicioLuz()
    :
    elServicio( stringAUint8AlReves( Configuracion::UUID_SERVICIO_LUZ, &uuidServicio[0], 16 ) ),
    laCaracteristica( stringAUint8AlReves( Configuracion::UUID_CARACTERISTICA_LUZ, &uuidCaracteristica[0], 16 ) )
  { }

  // ------------------------------------------------------------
  // alEscribir: CallbackEscrita, activa: B --> activar() -->
  // What it does: starts the service (after Bluefruit.begin()) with the
  //               characteristic readable and writable without pairing,
  //               and puts the current state in it.
  // ------------------------------------------------------------
  void activar( CallbackEscrita alEscribir, bool activa ) {
    elServicio.begin();
    laCaracteristica.setProperties( CHR_PROPS_READ | CHR_PROPS_WRITE );
    laCaracteristica.setPermission( SECMODE_OPEN, SECMODE_OPEN );
    laCaracteristica.setFixedLen( 1 );
    laCaracteristica.setWriteCallback( alEscribir );
    laCaracteristica.begin();
    mostrar( activa );
  } // ()

  // ------------------------------------------------------------
  // activa: B --> mostrar() -->
  // What it does: puts the state in the characteristic (what the phone reads).
  // ------------------------------------------------------------
  void mostrar( bool activa ) {
    laCaracteristica.write8( activa ? 1 : 0 );
  } // ()

}; // class

#endif
