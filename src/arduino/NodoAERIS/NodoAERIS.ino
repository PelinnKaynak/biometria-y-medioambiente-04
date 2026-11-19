// -*-c++-*-

// ---------------------------------------------------------------------------
// Fichero:     NodoAERIS.ino
// Descripción: Programa del nodo sensor AERIS (SparkFun Pro nRF52840 Mini +
//              sensor de ozono SPEC ULPSM-O3 + batería). En cada vuelta mide
//              el ozono (µg/m³, calibrado) y la temperatura y los emite por
//              Bluetooth LE en tramas iBeacon con el número de serie del
//              sensor. Por el Monitor Serie se puede calibrar (ver
//              OrdenesSerie.h). Parte del HolaMundoIBeacon del Sprint 0
//              (Jordi Bataller i Mascarell).
//              Diseño en doc/arduino_design.md. Tarea T004 · H003.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------

#include <bluefruit.h>

#undef min // están definidos en bluefruit.h y
#undef max // colisionan con los de la biblioteca estándar

#include "Configuracion.h"
#include "LED.h"
#include "PuertoSerie.h"

// --------------------------------------------------------------
// Global objects: the LED and the serial port (the other classes use them).
// --------------------------------------------------------------
namespace Globales {

  LED elLED ( Configuracion::PIN_LED );

  PuertoSerie elPuerto ( /* velocidad = */ 115200 );

};

#include "EmisoraBLE.h"
#include "Publicador.h"
#include "Calibracion.h"
#include "Medidor.h"
#include "OrdenesSerie.h"

// --------------------------------------------------------------
// More global objects: publisher, calibration, meter and the reader of the
// orders written in the serial monitor.
// --------------------------------------------------------------
namespace Globales {

  Publicador elPublicador;

  Calibracion laCalibracion;

  Medidor elMedidor ( laCalibracion );

  LectorLineas elLector;

}; // namespace

// --------------------------------------------------------------
// Counter of rounds (0..255, goes in the packets). Outside loop() so it keeps
// its value between rounds.
// --------------------------------------------------------------
namespace Loop {
  uint8_t cont = 0;
};

// ------------------------------------------------------------
// l: Lectura --> escribirLectura() -->
// What it does: writes one line with the measurement on the serial monitor.
// ------------------------------------------------------------
void escribirLectura( const Lectura & l ) {
  using namespace Globales;
  elPuerto.escribir( "Vgas=" );     elPuerto.escribir( l.vGas, 4 );
  elPuerto.escribir( " V  Vref=" ); elPuerto.escribir( l.vRef, 4 );
  elPuerto.escribir( " V  Vtemp=" ); elPuerto.escribir( l.vTemp, 4 );
  elPuerto.escribir( " V  T=" );    elPuerto.escribir( l.temperatura, 1 );
  elPuerto.escribir( " C  O3=" );   elPuerto.escribir( l.ozono, 1 );
  elPuerto.escribir( " ug/m3 (sin ajustar " ); elPuerto.escribir( l.ozonoSinAjustar, 1 );
  elPuerto.escribir( ")\n" );
} // ()

// ------------------------------------------------------------
// escribirCalibracion() -->
// What it does: writes the serial number and the saved calibration.
// ------------------------------------------------------------
void escribirCalibracion() {
  using namespace Globales;
  elPuerto.escribir( "Sensor " );
  elPuerto.escribir( Configuracion::NUMERO_SERIE );
  elPuerto.escribir( "  offset=" ); elPuerto.escribir( laCalibracion.getVOffset(), 4 );
  elPuerto.escribir( " V  factor=" ); elPuerto.escribir( laCalibracion.getFactor(), 3 );
  elPuerto.escribir( "\n" );
} // ()

// ------------------------------------------------------------
// orden: Orden --> ejecutarOrden() -->
// What it does: does what the order says (see OrdenesSerie.h) and answers
//               on the serial monitor. «cero» and «ref» take a new
//               measurement first.
// ------------------------------------------------------------
void ejecutarOrden( const Orden & orden ) {
  using namespace Globales;
  bool ok = true;
  switch ( orden.tipo ) {
  case VER:
	escribirLectura( elMedidor.medir() );
	break;
  case CERO: {
	const Lectura l = elMedidor.medir();
	ok = laCalibracion.ponerCero( l.vGas - l.vRef );
	break;
  }
  case REFERENCIA: {
	const Lectura l = elMedidor.medir();
	ok = laCalibracion.ponerReferencia( orden.valor, l.ozonoSinAjustar );
	break;
  }
  case BORRAR:
	ok = laCalibracion.borrar();
	break;
  case DESCONOCIDA:
	elPuerto.escribir( "Ordenes: ver | cero | ref <ug/m3> | borrar\n" );
	return;
  case NINGUNA:
	return;
  }
  if ( !ok ) {
	elPuerto.escribir( "No se ha guardado: valor fuera de limites\n" );
  }
  escribirCalibracion();
} // ()

// ------------------------------------------------------------
// atenderOrdenes() -->
// What it does: if a whole line has arrived by the serial port, runs it.
// ------------------------------------------------------------
void atenderOrdenes() {
  if ( Globales::elLector.hayLinea() ) {
	ejecutarOrden( interpretarOrden( Globales::elLector.linea() ) );
  }
} // ()

// ------------------------------------------------------------
// setup() -->
// What it does: runs ONCE when the board starts: waits a little for the
//               serial port (not forever: on battery there is no USB),
//               loads the calibration from flash, prepares the ADC and
//               turns on Bluetooth.
// ------------------------------------------------------------
void setup() {
  using namespace Globales;

  elPuerto.esperarDisponible( Configuracion::ESPERA_MAXIMA_PUERTO_SERIE );

  if ( !laCalibracion.cargar() ) {
	elPuerto.escribir( "Sin calibracion guardada: offset 0 y factor 1\n" );
  }
  elMedidor.iniciarMedidor();
  elPublicador.encenderEmisora();

  escribirCalibracion();
  elPuerto.escribir( "---- setup(): fin ----\n" );
} // setup ()

// ------------------------------------------------------------
// loop() -->
// What it does: runs FOREVER: counter + 1, measures, short blink, broadcasts
//               the ozone (6 s) and then the temperature in tenths of °C
//               (3 s). Between them it reads the serial orders. One round
//               takes about 9 s.
// ------------------------------------------------------------
void loop() {
  using namespace Loop;
  using namespace Globales;

  cont++;
  atenderOrdenes();

  const Lectura l = elMedidor.medir();
  escribirLectura( l );
  elLED.brillar( 100 );

  elPublicador.publicar( Publicador::OZONO,
						 ConversorOzono::valorParaTrama( l.ozono ),
						 cont, Configuracion::TIEMPO_ANUNCIO_OZONO );

  atenderOrdenes();

  elPublicador.publicar( Publicador::TEMPERATURA,
						 ConversorOzono::valorParaTrama( l.temperatura * 10 ),
						 cont, Configuracion::TIEMPO_ANUNCIO_TEMPERATURA );
} // loop ()
