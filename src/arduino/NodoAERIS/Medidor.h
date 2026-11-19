// -*- mode: c++ -*-

// ---------------------------------------------------------------------------
// Fichero:     Medidor.h
// Descripción: Lee el sensor de ozono SPEC ULPSM-O3 por el ADC (Vgas, Vref y
//              Vtemp, con la media de varias muestras) y da el ozono en
//              µg/m³, ya calibrado, y la temperatura. En el Sprint 0 daba un
//              valor fijo (123); ahora mide de verdad.
//              Diseño en doc/arduino_design.md. Tarea T004.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------

#ifndef MEDIDOR_H_INCLUIDO
#define MEDIDOR_H_INCLUIDO

#include "Configuracion.h"
#include "ConversorOzono.h"
#include "Calibracion.h"

// ----------------------------------------------------------
// Lectura = ( vGas: R, vRef: R, vTemp: R, temperatura: R,
//             ozonoSinAjustar: R, ozono: R )
// Una medición completa: los voltios leídos, la temperatura (°C) y el ozono
// en µg/m³ antes y después del factor de calibración.
// ----------------------------------------------------------
struct Lectura {
  float vGas;
  float vRef;
  float vTemp;
  float temperatura;
  float ozonoSinAjustar;
  float ozono;
};

// ----------------------------------------------------------
// Medidor class: reads the ozone sensor.
// ----------------------------------------------------------
class Medidor {

private:

  Calibracion & laCalibracion;
  const float m;          // V/ppm, de la sensibilidad de la etiqueta

  // ------------------------------------------------------------
  // pin: Z --> leerVoltios() --> R
  // What it does: average of MUESTRAS_POR_LECTURA readings of that pin, in volts.
  // ------------------------------------------------------------
  float leerVoltios(int pin) {
    long suma = 0;
    for (int i = 0; i < Configuracion::MUESTRAS_POR_LECTURA; i++) {
      suma += analogRead(pin);
    }
    const float media = (float) suma / Configuracion::MUESTRAS_POR_LECTURA;   // con decimales
    return ConversorOzono::voltiosDesdeLectura(media, Configuracion::BITS_ADC, Configuracion::V_REFERENCIA_ADC);
  } // ()

public:

  // ------------------------------------------------------------
  // calibracion: Calibracion --> Medidor() -->
  // What it does: keeps the calibration and calculates M from the label.
  // ------------------------------------------------------------
  Medidor(Calibracion & calibracion)
    : laCalibracion(calibracion),
      m(ConversorOzono::factorM(Configuracion::SENSIBILIDAD, Configuracion::GANANCIA_TIA)) {
  } // ()

  // ------------------------------------------------------------
  // iniciarMedidor() -->
  // What it does: sets the ADC resolution and reference.
  // ------------------------------------------------------------
  void iniciarMedidor() {
    analogReference(AR_INTERNAL_3_0);
    analogReadResolution(Configuracion::BITS_ADC);
  } // ()

  // ------------------------------------------------------------
  // medir() --> Lectura
  // What it does: reads the three outputs and calculates temperature and
  //               ozone (µg/m³ at the measured temperature, with the offset
  //               and the factor of the calibration).
  // ------------------------------------------------------------
  Lectura medir() {
    Lectura l;
    l.vGas = leerVoltios(Configuracion::PIN_VGAS);
    l.vRef = leerVoltios(Configuracion::PIN_VREF);
    l.vTemp = leerVoltios(Configuracion::PIN_VTEMP);
    l.temperatura = ConversorOzono::temperatura(l.vTemp, Configuracion::V_ALIMENTACION);
    const float ppm = ConversorOzono::ppmOzono(l.vGas, l.vRef, laCalibracion.getVOffset(), m);
    l.ozonoSinAjustar = ConversorOzono::microgramosPorM3(ppm, l.temperatura);
    l.ozono = ConversorOzono::ajustar(l.ozonoSinAjustar, laCalibracion.getFactor());
    return l;
  } // ()

}; // class

#endif
