// -*- mode: c++ -*-

// ---------------------------------------------------------------------------
// Fichero:     Configuracion.h
// Descripción: Datos de cada nodo y del montaje: número de serie y
//              sensibilidad del sensor de ozono (los de su etiqueta), pines,
//              ADC y tiempos de emisión. Es lo único que hay que cambiar al
//              programar otro nodo. Diseño en doc/arduino_design.md. T004.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------

#ifndef CONFIGURACION_H_INCLUIDO
#define CONFIGURACION_H_INCLUIDO

namespace Configuracion {

  // --- Sensor de ozono de este nodo (SPEC Sensors ULPSM-O3 968-046) ---
  // Los dos primeros números de la etiqueta («092021010920 110406 03 2109 -44.75»):
  // número de serie (12 cifras) y sensibilidad (nA/ppm). Son los mismos que
  // lee la app al vincular el sensor.
  const char NUMERO_SERIE[] = "092021010920";
  const float SENSIBILIDAD = -44.75;     // nA/ppm (negativa en el ozono)

  // Ganancia del amplificador del módulo para el ozono (datasheet ULPSM-O3)
  const float GANANCIA_TIA = 499.0;      // kV/A

  // Tensión con la que se alimenta el sensor (pin V+). Entra en la fórmula de
  // la temperatura. El módulo acepta de 2,7 a 3,3 V.
  const float V_ALIMENTACION = 3.3;      // V

  // --- Pines (cambiarlos si el montaje es otro) ---
  const int PIN_VGAS = A0;     // salida del gas
  const int PIN_VREF = A1;     // referencia (≈ V+/2)
  const int PIN_VTEMP = A2;    // temperatura
  const int PIN_LED = 7;       // LED azul de la SparkFun Pro nRF52840 Mini

  // --- ADC del nRF52840 (núcleo Adafruit nRF52) ---
  // La señal del ozono es muy pequeña: 1 ppm mueve Vgas unos 22 mV y 100 µg/m³
  // solo ~1,1 mV. Por eso se usa la máxima resolución (14 bits) con referencia
  // de 3,0 V: un paso del ADC son 0,18 mV (≈ 16 µg/m³), y la media de muchas
  // muestras afina más. Con 3,0 V aún se lee Vtemp hasta ~55 °C.
  const int BITS_ADC = 14;               // analogReadResolution(14): 0..16383
  const float V_REFERENCIA_ADC = 3.0;    // analogReference(AR_INTERNAL_3_0)
  const int MUESTRAS_POR_LECTURA = 256;  // se hace la media para quitar ruido

  // --- Emisión ---
  const long TIEMPO_ANUNCIO_OZONO = 6000;        // ms que se emite el ozono
  const long TIEMPO_ANUNCIO_TEMPERATURA = 3000;  // ms que se emite la temperatura
  const long ESPERA_MAXIMA_PUERTO_SERIE = 3000;  // sin USB no se queda esperando

}; // namespace

#endif
