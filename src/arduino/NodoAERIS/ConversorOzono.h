// -*- mode: c++ -*-

// ---------------------------------------------------------------------------
// Fichero:     ConversorOzono.h
// Descripción: Cálculos del sensor de ozono, sin tocar el hardware (por eso se
//              pueden probar en el ordenador): lectura del ADC a voltios,
//              voltios a ppm de ozono, ppm a µg/m³, temperatura y ajuste de
//              calibración. Fórmulas del datasheet del ULPSM-O3 y del
//              manual del Analog SDK de SPEC Sensors.
//              Diseño en doc/arduino_design.md. Tarea T004.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------

#ifndef CONVERSOR_OZONO_H_INCLUIDO
#define CONVERSOR_OZONO_H_INCLUIDO

#include <math.h>
#include <stdint.h>

namespace ConversorOzono {

  const float MASA_MOLAR_OZONO = 48.00;      // g/mol
  const float VOLUMEN_MOLAR_0C = 22.414;     // L/mol a 0 °C y 1 atm
  const float CERO_ABSOLUTO = 273.15;        // K

  // ------------------------------------------------------------
  // lectura: R, bits: N, vReferencia: R --> voltiosDesdeLectura() --> R
  // What it does: turns an ADC reading (0 .. 2^bits − 1, it can be the
  //               average of several, with decimals) into volts.
  // ------------------------------------------------------------
  inline float voltiosDesdeLectura(float lectura, int bits, float vReferencia) {
    const long maximo = (1L << bits) - 1;
    return lectura * vReferencia / maximo;
  } // ()

  // ------------------------------------------------------------
  // sensibilidad: R, gananciaTIA: R --> factorM() --> R
  // What it does: M (V/ppm) = sensibilidad (nA/ppm) × ganancia (kV/A) × 10⁻⁹ × 10³.
  //               With the ozone sensor it is negative.
  // ------------------------------------------------------------
  inline float factorM(float sensibilidad, float gananciaTIA) {
    return sensibilidad * gananciaTIA * 1e-6;
  } // ()

  // ------------------------------------------------------------
  // vGas: R, vRef: R, vOffset: R, m: R --> ppmOzono() --> R
  // What it does: Cx = (Vgas − Vgas0) / M, with Vgas0 = Vref + Voffset (the
  //               output in clean air). It can be a little negative because
  //               of noise.
  // ------------------------------------------------------------
  inline float ppmOzono(float vGas, float vRef, float vOffset, float m) {
    return (vGas - (vRef + vOffset)) / m;
  } // ()

  // ------------------------------------------------------------
  // vTemp: R, vAlimentacion: R --> temperatura() --> R
  // What it does: T (°C) = 87 / V+ × Vtemp − 18 (±3 °C between −10 and 50 °C).
  // ------------------------------------------------------------
  inline float temperatura(float vTemp, float vAlimentacion) {
    return 87.0 / vAlimentacion * vTemp - 18.0;
  } // ()

  // ------------------------------------------------------------
  // ppm: R, temperaturaC: R --> microgramosPorM3() --> R
  // What it does: ppm to µg/m³ at that temperature and 1 atm:
  //               ppm × 48 × 1000 / volumen molar (24,45 L/mol at 25 °C,
  //               so 1 ppm ≈ 1962 µg/m³).
  // ------------------------------------------------------------
  inline float microgramosPorM3(float ppm, float temperaturaC) {
    const float volumenMolar = VOLUMEN_MOLAR_0C * (temperaturaC + CERO_ABSOLUTO) / CERO_ABSOLUTO;
    return ppm * MASA_MOLAR_OZONO * 1000.0 / volumenMolar;
  } // ()

  // ------------------------------------------------------------
  // valor: R, factor: R --> ajustar() --> R
  // What it does: applies the calibration factor; negative values (noise
  //               with clean air) become 0.
  // ------------------------------------------------------------
  inline float ajustar(float valor, float factor) {
    const float ajustado = valor * factor;
    return ajustado > 0 ? ajustado : 0;
  } // ()

  // ------------------------------------------------------------
  // valor: R --> valorParaTrama() --> Z
  // What it does: rounds the value and keeps it inside an int16 (the minor
  //               of the iBeacon packet).
  // ------------------------------------------------------------
  inline int16_t valorParaTrama(float valor) {
    const long redondeado = lroundf(valor);
    if (redondeado > 32767) return 32767;
    if (redondeado < -32768) return -32768;
    return (int16_t) redondeado;
  } // ()

}; // namespace

#endif
