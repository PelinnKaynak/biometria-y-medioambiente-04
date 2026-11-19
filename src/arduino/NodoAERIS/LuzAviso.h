// -*- mode: c++ -*-

// ---------------------------------------------------------------------------
// Fichero:     LuzAviso.h
// Descripción: Luz de aviso del nodo (H033): con la luz activada, el LED de
//              la placa parpadea mientras se emiten las tramas, más rápido
//              cuanto peor está el aire (niveles de Configuracion: bueno,
//              moderado, malo, muy malo). La app la activa o desactiva por
//              Bluetooth (ServicioLuz.h). El estado se guarda en la memoria
//              flash, así que no se pierde al apagar la placa.
//              Diseño en doc/arduino_design.md.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------

#ifndef LUZ_AVISO_H_INCLUIDO
#define LUZ_AVISO_H_INCLUIDO

#include <Adafruit_LittleFS.h>
#include <InternalFileSystem.h>

#include "Configuracion.h"

using namespace Adafruit_LittleFS_Namespace;

// ----------------------------------------------------------
// LuzAviso class: makes the board LED blink faster when the air is worse.
// ----------------------------------------------------------
class LuzAviso {

private:

  static constexpr const char * FICHERO = "/luz.dat";
  static const uint8_t MARCA = 0x4C;                 // 'L': el fichero es nuestro

  LED & elLED;
  bool activa = false;
  float ozono = 0;
  // Lo que pide la app por Bluetooth: llega en otro hilo, así que solo se
  // anota aquí y se aplica en el programa principal (atenderPedido)
  volatile int8_t pedido = -1;                       // -1 nada, 0 apagar, 1 encender

public:

  // ------------------------------------------------------------
  // led: LED --> LuzAviso() -->
  // ------------------------------------------------------------
  LuzAviso( LED & led ) : elLED( led ) { }

  // ------------------------------------------------------------
  // ozono: R --> periodo() --> Z
  // What it does: milliseconds of one blink (on + off) for that ozone
  //               (µg/m³): good 2000, moderate 1000, bad 500, very bad 250.
  // ------------------------------------------------------------
  static long periodo( float ozono ) {
    if ( ozono < Configuracion::UMBRAL_MODERADO ) return Configuracion::PERIODO_LUZ_BUENO;
    if ( ozono < Configuracion::UMBRAL_MALO )     return Configuracion::PERIODO_LUZ_MODERADO;
    if ( ozono < Configuracion::UMBRAL_MUY_MALO ) return Configuracion::PERIODO_LUZ_MALO;
    return Configuracion::PERIODO_LUZ_MUY_MALO;
  } // ()

  // estaActiva() --> B
  bool estaActiva() const { return activa; }

  // ------------------------------------------------------------
  // o: R --> ponerOzono() -->
  // What it does: the last ozone measured, to choose how fast to blink.
  // ------------------------------------------------------------
  void ponerOzono( float o ) { ozono = o; }

  // ------------------------------------------------------------
  // encender: B --> pedir() -->
  // What it does: notes what the phone asked (it can be called from the
  //               Bluetooth callback; nothing else is done there).
  // ------------------------------------------------------------
  void pedir( bool encender ) { pedido = encender ? 1 : 0; }

  // ------------------------------------------------------------
  // atenderPedido() --> B
  // What it does: if the phone asked something, applies it and saves it in
  //               flash. True if something changed.
  // ------------------------------------------------------------
  bool atenderPedido() {
    const int8_t p = pedido;
    if ( p < 0 ) {
      return false;
    }
    pedido = -1;
    cambiar( p == 1 );
    return true;
  } // ()

  // ------------------------------------------------------------
  // encender: B --> cambiar() -->
  // What it does: turns the warning light on or off and saves it.
  // ------------------------------------------------------------
  void cambiar( bool encender ) {
    activa = encender;
    if ( !activa ) {
      elLED.apagar();
    }
    guardar();
  } // ()

  // ------------------------------------------------------------
  // tiempo: Z --> esperar() -->
  // What it does: waits 'tiempo' ms. With the light on, meanwhile the LED
  //               blinks with periodo(ozono) (half on, half off); the
  //               total time is the same.
  // ------------------------------------------------------------
  void esperar( long tiempo ) {
    long pasado = 0;
    while ( pasado < tiempo ) {
      atenderPedido();
      if ( !activa ) {
        const long trozo = ( tiempo - pasado < 100 ? tiempo - pasado : 100 );
        delay( trozo );
        pasado += trozo;
        continue;
      }
      const long medio = periodo( ozono ) / 2;
      elLED.encender();
      long trozo = ( tiempo - pasado < medio ? tiempo - pasado : medio );
      delay( trozo );
      pasado += trozo;
      elLED.apagar();
      trozo = ( tiempo - pasado < medio ? tiempo - pasado : medio );
      delay( trozo );
      pasado += trozo;
    }
  } // ()

  // ------------------------------------------------------------
  // cargar() --> B
  // What it does: reads from flash whether the light was on (off if there
  //               is nothing saved).
  // ------------------------------------------------------------
  bool cargar() {
    InternalFS.begin();
    File fichero( InternalFS );
    if ( !fichero.open( FICHERO, FILE_O_READ ) ) {
      return false;
    }
    uint8_t datos[2] = { 0, 0 };
    const bool leido = fichero.read( datos, 2 ) == 2;
    fichero.close();
    if ( !leido || datos[0] != MARCA ) {
      return false;
    }
    activa = datos[1] == 1;
    return true;
  } // ()

private:

  // guardar() -->   (escribe el estado en la flash)
  void guardar() {
    InternalFS.remove( FICHERO );
    File fichero( InternalFS );
    if ( fichero.open( FICHERO, FILE_O_WRITE ) ) {
      const uint8_t datos[2] = { MARCA, (uint8_t) ( activa ? 1 : 0 ) };
      fichero.write( datos, 2 );
      fichero.close();
    }
  } // ()

}; // class

#endif
