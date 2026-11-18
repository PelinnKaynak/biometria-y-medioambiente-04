// -*- mode: c++ -*-

// ---------------------------------------------------------------------------
// Fichero:     LED.h
// Descripción: Control de un LED de la placa (encender, apagar, parpadear).
//              Diseño en doc/arduino_design.md.
// Autor:       Jordi Bataller i Mascarell (código original proporcionado)
// Aportación:  Pelin Kaynak - cabeceras de fichero y de función con el
//              diseño lógico (29/09/2026)
//              Equipo 04 (AERIS, T004): sin cambios, se usa tal cual
// Copyright:   (c) Jordi Bataller i Mascarell - EPSG-UPV
// ---------------------------------------------------------------------------

#ifndef LED_H_INCLUIDO
#define LED_H_INCLUIDO

// ----------------------------------------------------------
// Jordi Bataller i Mascarell
// 2019-07-07
// ----------------------------------------------------------

// ------------------------------------------------------------
// tiempo: Z --> esperar()
// What it does: pauses the program for 'tiempo' milliseconds.
// ------------------------------------------------------------
void esperar (long tiempo) {
  delay (tiempo);
}

// ----------------------------------------------------------
// ----------------------------------------------------------
// LED class: controls the small light on the board (on, off, blink).
class LED {
private:
  int numeroLED;
  bool encendido;
public:

  // ------------------------------------------------------------
  // numero: Z --> LED() -->
  // What it does: creates the LED on pin 'numero' and starts it switched off.
  // ------------------------------------------------------------
  LED (int numero)
	: numeroLED (numero), encendido(false)
  {
	pinMode(numeroLED, OUTPUT);
	apagar ();
  }

  // ------------------------------------------------------------
  // encender() -->
  // What it does: turns the LED on.
  // ------------------------------------------------------------
  void encender () {
	digitalWrite(numeroLED, HIGH); 
	encendido = true;
  }

  // ------------------------------------------------------------
  // apagar() -->
  // What it does: turns the LED off.
  // ------------------------------------------------------------
  void apagar () {
	  digitalWrite(numeroLED, LOW);
	  encendido = false;
  }

  // ------------------------------------------------------------
  // alternar() -->
  // What it does: if the LED is on it turns it off, if it is off it turns it on.
  // ------------------------------------------------------------
  void alternar () {
	if (encendido) {
	  apagar();
	} else {
	  encender ();
	}
  } // ()

  // ------------------------------------------------------------
  // tiempo: Z --> brillar() -->
  // What it does: turns the LED on for 'tiempo' ms and then turns it off (one blink).
  // ------------------------------------------------------------
  void brillar (long tiempo) {
	encender ();
	esperar(tiempo); 
	apagar ();
  }
}; // class

// ----------------------------------------------------------
// ----------------------------------------------------------
// ----------------------------------------------------------
// ----------------------------------------------------------
#endif
