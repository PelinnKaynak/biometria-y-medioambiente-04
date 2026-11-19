// ---------------------------------------------------------------------------
// Fichero:     DiagnosticoSensor.ino
// Descripción: Programa de diagnóstico del sensor (no es el del nodo: no
//              emite por Bluetooth ni se calibra). Cada 2 s lee VGAS,
//              VREF y VTEMP (media de 50 lecturas, ADC a 12 bits con
//              referencia de 3,0 V) y escribe una línea por el puerto serie
//              (115200 baudios) con cada valor y su nombre, en voltios:
//              t=12 s  VGAS=1.5432 V  VREF=1.5401 V  VTEMP=0.2130 V  VGAS-VREF=3.1 mV
//              O3=-0.163 ppm = -320 ug/m3
//              El ozono se calcula como en NodoAERIS (fórmulas del ULPSM), con
//              la sensibilidad de la etiqueta, 25 °C fijos y sin calibrar (sin
//              la orden «cero»), así que sale también negativo.
//              Sirve para ver si las señales llegan bien y son estables
//              antes de cargar NodoAERIS. Mismos pines que el montaje de 4
//              cables: V+ 3V3, GND 4 (el programa pone el pin a 0 V porque
//              la placa no tiene pin GND soldado), VGAS 28, VREF 5.
//              VTEMP 29 no tiene cable.
//              Código de un compañero de otro equipo (sensor SPEC NO₂).
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------

#include <Arduino.h>
#include <Adafruit_TinyUSB.h>

#define PIN_VGAS  28
#define PIN_VREF  5
#define PIN_VTEMP 29
#define PIN_GND_SENSOR 4     // hace de GND del sensor (salida a 0 V)

const int NUM_MUESTRAS = 50;
const unsigned long INTERVALO_MS = 2000;
const float V_REFERENCIA_ADC = 3.0;      // analogReference(AR_INTERNAL_3_0)
const float MAXIMO_ADC = 4095.0;         // 12 bits

// Ozono (las mismas fórmulas que ConversorOzono.h de NodoAERIS)
const float SENSIBILIDAD = -38.11;       // nA/ppm, de la etiqueta del sensor 092021011003
const float GANANCIA_TIA = 499.0;        // kV/A
const float TEMPERATURA = 25.0;          // °C fijos (este montaje no tiene Vtemp)
const float PESO_MOLECULAR_O3 = 48.0;    // g/mol
const float VOLUMEN_MOLAR_0C = 22.414;   // L/mol a 0 °C
const float CERO_ABSOLUTO = 273.15;

// ------------------------------------------------------------
// diferencia: R --> ppmOzono() --> R
// What it does: ppm = (Vgas − Vref) / M, with M = sensitivity × gain × 10⁻⁶
//               (V/ppm). No offset: the sensor is not calibrated here.
// ------------------------------------------------------------
float ppmOzono(float diferencia) {
  const float m = SENSIBILIDAD * GANANCIA_TIA * 1e-6;
  return diferencia / m;
}

// ------------------------------------------------------------
// ppm: R --> microgramosPorM3() --> R
// What it does: µg/m³ = ppm × 48 × 1000 / volumen molar at TEMPERATURA.
// ------------------------------------------------------------
float microgramosPorM3(float ppm) {
  const float volumenMolar = VOLUMEN_MOLAR_0C * (TEMPERATURA + CERO_ABSOLUTO) / CERO_ABSOLUTO;
  return ppm * PESO_MOLECULAR_O3 * 1000.0 / volumenMolar;
}

// ------------------------------------------------------------
// pin: Z --> leerADC() --> R
// What it does: reads the pin NUM_MUESTRAS times (after one reading to
//               settle the ADC) and returns the average in volts.
// ------------------------------------------------------------
float leerADC(int pin) {
  uint32_t suma = 0;

  // Lectura inicial para estabilizar el ADC
  analogRead(pin);
  delay(5);

  for (int i = 0; i < NUM_MUESTRAS; i++) {
    suma += analogRead(pin);
    delay(2);
  }

  return (float)suma / NUM_MUESTRAS * V_REFERENCIA_ADC / MAXIMO_ADC;
}

// ------------------------------------------------------------
// setup() -->
// What it does: starts the serial port and the ADC.
// ------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1500);

  analogReference(AR_INTERNAL_3_0);
  analogReadResolution(12);

  // GND del sensor: solo si el pin no tiene tensión (si la tiene, ese cable no es GND)
  float vPinGnd = leerADC(PIN_GND_SENSOR);
  if (vPinGnd < 2.0) {
    pinMode(PIN_GND_SENSOR, OUTPUT);
    digitalWrite(PIN_GND_SENSOR, LOW);
    Serial.println("GND del sensor en el pin 4: activado (0 V)");
  } else {
    Serial.print("AVISO: el pin 4 tiene ");
    Serial.print(vPinGnd, 2);
    Serial.println(" V: no parece el GND del sensor y no se toca. Revisa los cables");
  }

  pinMode(PIN_VGAS, INPUT);
  pinMode(PIN_VREF, INPUT);
  pinMode(PIN_VTEMP, INPUT);

  Serial.println("Diagnostico de estabilidad SPEC NO2");
  Serial.println("No se recalibra ni se calcula NO2.");
  Serial.println("Si todo va bien: VGAS y VREF casi iguales (~1,6 V) y estables.");
}

// ------------------------------------------------------------
// loop() -->
// What it does: every INTERVALO_MS writes one line with the three signals
//               (V), VGAS − VREF (mV) and the ozone it means (ppm and
//               µg/m³), each one with its name.
// ------------------------------------------------------------
void loop() {
  static unsigned long ultimaMedida = 0;

  if (millis() - ultimaMedida < INTERVALO_MS) {
    delay(5);
    return;
  }

  ultimaMedida = millis();

  float vgas = leerADC(PIN_VGAS);
  float vref = leerADC(PIN_VREF);
  float vtemp = leerADC(PIN_VTEMP);

  Serial.print("t=");          Serial.print(millis() / 1000UL);
  Serial.print(" s  VGAS=");    Serial.print(vgas, 4);
  Serial.print(" V  VREF=");    Serial.print(vref, 4);
  Serial.print(" V  VTEMP=");   Serial.print(vtemp, 4);
  Serial.print(" V  VGAS-VREF="); Serial.print((vgas - vref) * 1000.0, 1);
  const float ppm = ppmOzono(vgas - vref);
  Serial.print(" mV  O3=");     Serial.print(ppm, 3);
  Serial.print(" ppm = ");      Serial.print(microgramosPorM3(ppm), 0);
  Serial.println(" ug/m3");
}
