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
  float diferenciaMedia;    // media de Vgas − Vref de las últimas mediciones (V)
  float temperatura;        // la que se usa: la de Vtemp o, si no es válida, la de por defecto
  bool temperaturaFija;     // true si Vtemp no era válida y se ha usado TEMPERATURA_POR_DEFECTO
  float ppm;                // ozono en ppm, sin ajustar (puede ser negativo)
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
  bool gndActivado = false;
  float diferencias[Configuracion::MEDICIONES_MEDIA];   // últimas Vgas − Vref
  int cuantas = 0;        // cuántas hay guardadas (hasta MEDICIONES_MEDIA)
  int siguiente = 0;      // dónde va la próxima
  float vPinGnd = 0;      // lo que tenía el pin del GND al arrancar

  // ------------------------------------------------------------
  // pin: Z --> leerVoltios() --> R
  // What it does: average of MUESTRAS_POR_LECTURA readings of that pin, in
  //               volts. The first reading after changing pin is thrown
  //               away and it waits a little before and between readings,
  //               so the ADC has time to charge from the sensor's output.
  // ------------------------------------------------------------
  float leerVoltios(int pin) {
    analogRead(pin);                                  // se tira: aún tiene algo del pin anterior
    delay(Configuracion::ESPERA_CAMBIO_PIN_MS);
    long suma = 0;
    for (int i = 0; i < Configuracion::MUESTRAS_POR_LECTURA; i++) {
      suma += analogRead(pin);
      delay(Configuracion::ESPERA_ENTRE_MUESTRAS_MS);
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
    activarGndSensor();
  } // ()

  // ------------------------------------------------------------
  // activarGndSensor() -->
  // What it does: makes PIN_GND_SENSOR the sensor's ground (output at 0 V),
  //               but only if it does not have more than V_MAXIMA_PIN_GND:
  //               if it had, the wire there is not GND and it is left alone.
  // ------------------------------------------------------------
  void activarGndSensor() {
    vPinGnd = leerVoltios(Configuracion::PIN_GND_SENSOR);
    gndActivado = vPinGnd <= Configuracion::V_MAXIMA_PIN_GND;
    if (gndActivado) {
      pinMode(Configuracion::PIN_GND_SENSOR, OUTPUT);
      digitalWrite(Configuracion::PIN_GND_SENSOR, LOW);
    }
  } // ()

  // ------------------------------------------------------------
  // diferencia: R --> mediaMovil() --> R
  // What it does: keeps the new Vgas − Vref and returns the average of the
  //               last MEDICIONES_MEDIA (fewer at the beginning).
  // ------------------------------------------------------------
  float mediaMovil(float diferencia) {
    diferencias[siguiente] = diferencia;
    siguiente = (siguiente + 1) % Configuracion::MEDICIONES_MEDIA;
    if (cuantas < Configuracion::MEDICIONES_MEDIA) {
      cuantas++;
    }
    float suma = 0;
    for (int i = 0; i < cuantas; i++) {
      suma += diferencias[i];
    }
    return suma / cuantas;
  } // ()

  // ------------------------------------------------------------
  // reiniciarMedia() -->
  // What it does: forgets the saved differences (the next measurement
  //               starts the average again).
  // ------------------------------------------------------------
  void reiniciarMedia() {
    cuantas = 0;
    siguiente = 0;
  } // ()

  // ------------------------------------------------------------
  // diferenciaParaCero() --> R
  // What it does: average of Vgas − Vref of MEDICIONES_CERO new
  //               measurements in a row (for the order «cero»).
  // ------------------------------------------------------------
  float diferenciaParaCero() {
    float suma = 0;
    for (int i = 0; i < Configuracion::MEDICIONES_CERO; i++) {
      suma += leerVoltios(Configuracion::PIN_VGAS) - leerVoltios(Configuracion::PIN_VREF);
    }
    return suma / Configuracion::MEDICIONES_CERO;
  } // ()

  // gndSensorActivado() --> B      /  voltiosPinGnd() --> R
  bool gndSensorActivado() const { return gndActivado; }
  float voltiosPinGnd() const { return vPinGnd; }

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
    l.temperaturaFija = !Configuracion::HAY_VTEMP || !ConversorOzono::temperaturaValida(l.temperatura,
        Configuracion::TEMPERATURA_MINIMA, Configuracion::TEMPERATURA_MAXIMA);
    if (l.temperaturaFija) {
      l.temperatura = Configuracion::TEMPERATURA_POR_DEFECTO;
    }
    l.diferenciaMedia = mediaMovil(l.vGas - l.vRef);
    l.ppm = ConversorOzono::ppmOzono(l.vRef + l.diferenciaMedia, l.vRef, laCalibracion.getVOffset(), m);
    l.ozonoSinAjustar = ConversorOzono::microgramosPorM3(l.ppm, l.temperatura);
    l.ozono = ConversorOzono::ajustar(l.ozonoSinAjustar, laCalibracion.getFactor());
    return l;
  } // ()

}; // class

#endif
