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
  // El primer y el último número de la etiqueta («092021011003 110406 O3 2109 -38.11»):
  // número de serie (12 cifras) y sensibilidad (nA/ppm). Son los mismos que
  // lee la app al vincular el sensor.
  const char NUMERO_SERIE[] = "092021011003";
  const float SENSIBILIDAD = -38.11;     // nA/ppm (negativa en el ozono)

  // Ganancia del amplificador del módulo para el ozono (datasheet ULPSM-O3)
  const float GANANCIA_TIA = 499.0;      // kV/A

  // Tensión con la que se alimenta el sensor (pin V+). Entra en la fórmula de
  // la temperatura. El módulo acepta de 2,7 a 3,3 V.
  const float V_ALIMENTACION = 3.3;      // V

  // --- Pines (cambiarlos si el montaje es otro) ---
  // Número que se ve en la placa junto al pin. Solo leen tensiones (entradas
  // analógicas) el 2, 3, 4, 5, 28, 29, 30 y 31: el 15 o el 17 no sirven.
  // Montaje (cables): gris = Vgas (pin 1 del ULPSM) -> 28; morado = Vref
  // (pin 2) -> 5; blanco = GND (pin 6) -> 4; naranja = V+ (pin 7) -> 3V3
  const int PIN_VGAS = 28;     // salida del gas          (AIN4)
  const int PIN_VREF = 5;      // referencia (≈ V+/2)     (AIN3)
  const int PIN_VTEMP = 29;    // temperatura             (AIN5)

  // GND del sensor: la placa no tiene pin GND soldado, así que el cable GND
  // del ULPSM va al pin 4 y el programa lo pone a 0 V (salida a LOW). El
  // sensor gasta unos µA: un pin de salida los aguanta de sobra.
  const int PIN_GND_SENSOR = 4;
  // Seguridad: si al arrancar ese pin ya tiene más de esto, no es el GND del
  // sensor (¿será V+?) y no se toca
  const float V_MAXIMA_PIN_GND = 2.0;

  // ¿Está conectado Vtemp? El montaje de 4 cables (V+, GND, Vgas, Vref) no
  // lo tiene: el pin queda al aire y daría cualquier temperatura.
  const bool HAY_VTEMP = false;
  // Sin Vtemp, o si da una temperatura imposible (mal conectado o saturado
  // a 3 V), para pasar a µg/m³ se usa esta en su lugar
  const float TEMPERATURA_POR_DEFECTO = 25.0;    // °C

  // --- Luz de aviso (H033) ---
  // Niveles del ozono (µg/m³), los mismos que la tabla Contaminantes
  const float UMBRAL_MODERADO = 100.0;
  const float UMBRAL_MALO = 180.0;
  const float UMBRAL_MUY_MALO = 240.0;
  // Cuánto dura un parpadeo (encendido + apagado) en cada nivel (ms)
  const long PERIODO_LUZ_BUENO = 2000;
  const long PERIODO_LUZ_MODERADO = 1000;
  const long PERIODO_LUZ_MALO = 500;
  const long PERIODO_LUZ_MUY_MALO = 250;
  // UUID del servicio Bluetooth de la luz (16 letras, como en el Sprint 0)
  constexpr const char * UUID_SERVICIO_LUZ = "AERIS-SERVICIO-1";
  constexpr const char * UUID_CARACTERISTICA_LUZ = "AERIS-LUZ-ACTIVA";
  const float TEMPERATURA_MINIMA = -20.0;        // °C, fuera de esto no se cree
  const float TEMPERATURA_MAXIMA = 55.0;
  const int PIN_LED = 7;       // LED azul de la SparkFun Pro nRF52840 Mini

  // --- ADC del nRF52840 (núcleo Adafruit nRF52) ---
  // La señal del ozono es muy pequeña: 1 ppm mueve Vgas unos 22 mV y 100 µg/m³
  // solo ~1,1 mV. Por eso se usa la máxima resolución (14 bits) con referencia
  // de 3,0 V: un paso del ADC son 0,18 mV (≈ 16 µg/m³), y la media de muchas
  // muestras afina más. Con 3,0 V aún se lee Vtemp hasta ~55 °C.
  const int BITS_ADC = 14;               // analogReadResolution(14): 0..16383
  const float V_REFERENCIA_ADC = 3.0;    // analogReference(AR_INTERNAL_3_0)
  const int MUESTRAS_POR_LECTURA = 64;   // se hace la media para quitar ruido
  // La salida Vgas del ULPSM no carga el condensador del ADC al instante: al
  // cambiar de pin la primera lectura se tira y se espera un poco, y entre
  // lecturas también (sin esto Vgas salía mezclada con el pin anterior)
  const long ESPERA_CAMBIO_PIN_MS = 5;
  const long ESPERA_ENTRE_MUESTRAS_MS = 2;
  // Vgas − Vref tiene ruido (decenas de mV de una medición a otra): el ozono
  // se calcula con la media de las últimas MEDICIONES_MEDIA (~1,5 min) y la
  // orden «cero» guarda la media de MEDICIONES_CERO mediciones seguidas
  const int MEDICIONES_MEDIA = 10;
  const int MEDICIONES_CERO = 10;

  // --- Emisión ---
  const long TIEMPO_ANUNCIO_OZONO = 6000;        // ms que se emite el ozono
  const long TIEMPO_ANUNCIO_TEMPERATURA = 3000;  // ms que se emite la temperatura
  const long ESPERA_MAXIMA_PUERTO_SERIE = 3000;  // sin USB no se queda esperando

}; // namespace

#endif
