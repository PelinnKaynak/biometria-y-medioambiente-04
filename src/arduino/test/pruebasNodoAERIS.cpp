// -*- mode: c++ -*-
// ---------------------------------------------------------------------------
// Fichero:     pruebasNodoAERIS.cpp
// Descripción: Tests automáticos del programa del nodo, ejecutados en el
//              ordenador con los dobles de prueba de stubs/ (sin placa ni
//              sensor: el test elige los voltios de cada pin). Mismo estilo
//              que los del Sprint 0. Diseño en doc/arduino_design.md. T004.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
#include <cstdio>

#include "../NodoAERIS/NodoAERIS.ino"

static int pruebasFallidas = 0;
static int comprobaciones = 0;

// Valores del sensor de prueba (los de Configuracion.h)
static const double M = -44.75 * 499 * 1e-6;     // V/ppm ≈ -0,02233
static const double V_REF = 1.65;                 // V+/2

// ------------------------------------------------------------
// condicion: V/F, descripcion: Texto --> comprobar() -->
// What it does: counts the check and prints FALLO if the condition is false.
// ------------------------------------------------------------
static void comprobar(bool condicion, const char * descripcion) {
  comprobaciones++;
  if (!condicion) {
    pruebasFallidas++;
    printf("  FALLO: %s\n", descripcion);
  }
}

// ------------------------------------------------------------
// a: R, b: R, margen: R --> cerca() --> V/F
// ------------------------------------------------------------
static bool cerca(double a, double b, double margen) { return std::fabs(a - b) <= margen; }

// ------------------------------------------------------------
// ppm: R, temperaturaC: R --> ponerSensor() -->
// What it does: chooses the voltages of the three pins for that ozone (ppm,
//               with offset 0) and that temperature.
// ------------------------------------------------------------
static void ponerSensor(double ppm, double temperaturaC) {
  Doble::voltiosPin[A1] = V_REF;
  Doble::voltiosPin[A0] = V_REF + ppm * M;
  Doble::voltiosPin[A2] = (temperaturaC + 18.0) * 3.3 / 87.0;
}

// ------------------------------------------------------------
// reiniciarDoble() -->
// What it does: empties what the test doubles have recorded.
// ------------------------------------------------------------
static void reiniciarDoble() {
  Doble::tiempoEsperado = 0;
  Doble::escriturasPin.clear();
  Doble::salidaSerie.clear();
  Doble::entradaSerie.clear();
  Doble::ficheros.clear();
  Bluefruit.Advertising = AdvertisingDoble();
}

// ------------------------------------------------------------
// pruebaConversor() -->
// What it does: checks the formulas of ConversorOzono.
// ------------------------------------------------------------
static void pruebaConversor() {
  printf("ConversorOzono\n");
  using namespace ConversorOzono;
  comprobar(cerca(voltiosDesdeLectura(16383, 14, 3.0), 3.0, 1e-6), "lectura máxima = referencia");
  comprobar(cerca(voltiosDesdeLectura(8191.5, 14, 3.0), 1.5, 1e-4), "la media con decimales también vale");
  comprobar(cerca(factorM(-44.75, 499), -0.0223303, 1e-6), "M = sensibilidad × ganancia × 10⁻⁶ (negativa)");
  comprobar(cerca(ppmOzono(1.65, 1.65, 0, M), 0, 1e-9), "Vgas = Vref: 0 ppm");
  comprobar(cerca(ppmOzono(1.65 + M, 1.65, 0, M), 1.0, 1e-4), "Vgas baja M voltios: 1 ppm");
  comprobar(cerca(ppmOzono(1.66 + M, 1.65, 0.01, M), 1.0, 1e-4), "el offset se resta");
  comprobar(cerca(temperatura((25 + 18) * 3.3 / 87, 3.3), 25, 1e-4), "T = 87/V+ × Vtemp − 18");
  comprobar(cerca(microgramosPorM3(1, 25), 1962, 1), "1 ppm a 25 °C ≈ 1962 µg/m³");
  comprobar(cerca(microgramosPorM3(0.1, 0), 214.2, 0.5), "0,1 ppm a 0 °C ≈ 214 µg/m³");
  comprobar(ajustar(-5, 1) == 0, "un valor negativo (ruido) queda en 0");
  comprobar(cerca(ajustar(80, 1.25), 100, 1e-4), "el factor multiplica");
  comprobar(valorParaTrama(97.5) == 98 && valorParaTrama(97.4) == 97, "redondea");
  comprobar(valorParaTrama(50000) == 32767 && valorParaTrama(-50000) == -32768, "no se sale de int16");
}

// ------------------------------------------------------------
// pruebaCalibracion() -->
// What it does: checks that the calibration is saved, loaded after a
//               restart and that absurd values are not saved.
// ------------------------------------------------------------
static void pruebaCalibracion() {
  printf("Calibracion\n");
  reiniciarDoble();
  Calibracion c;
  comprobar(!c.cargar(), "placa nueva: no hay calibración guardada");
  comprobar(c.getVOffset() == 0 && c.getFactor() == 1, "por defecto offset 0 y factor 1");

  comprobar(c.ponerCero(0.012), "ponerCero() con un offset normal se guarda");
  comprobar(c.ponerReferencia(100, 80), "ponerReferencia() guarda el factor");
  Calibracion despuesDeReiniciar;
  comprobar(despuesDeReiniciar.cargar(), "tras reiniciar la placa se carga");
  comprobar(cerca(despuesDeReiniciar.getVOffset(), 0.012, 1e-6), "se recupera el offset");
  comprobar(cerca(despuesDeReiniciar.getFactor(), 1.25, 1e-6), "se recupera el factor (100 / 80)");

  comprobar(!c.ponerCero(0.8), "un offset de 0,8 V no se acepta (sensor mal conectado)");
  comprobar(!c.ponerReferencia(100, 10), "un factor de 10 no se acepta");
  comprobar(!c.ponerReferencia(0, 80), "una referencia de 0 no se acepta");
  comprobar(cerca(c.getFactor(), 1.25, 1e-6), "lo rechazado no cambia nada");

  comprobar(c.borrar() && c.getFactor() == 1 && c.getVOffset() == 0, "borrar() vuelve a 0 y 1");
  Calibracion trasBorrar;
  comprobar(trasBorrar.cargar() && trasBorrar.getFactor() == 1, "el borrado también se guarda");

  Doble::ficheros["/calibracion.dat"] = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 };
  Calibracion estropeada;
  comprobar(!estropeada.cargar() && estropeada.getFactor() == 1, "un fichero que no es nuestro se ignora");
}

// ------------------------------------------------------------
// pruebaMedidor() -->
// What it does: checks the measurement with known voltages (with the ADC
//               rounding of 14 bits).
// ------------------------------------------------------------
static void pruebaMedidor() {
  printf("Medidor\n");
  reiniciarDoble();
  Calibracion c;
  Medidor medidor(c);
  medidor.iniciarMedidor();
  comprobar(Doble::bitsADC == 14, "usa el ADC a 14 bits");

  ponerSensor(0.05, 25);                                   // 0,05 ppm ≈ 98 µg/m³
  Lectura l = medidor.medir();
  comprobar(cerca(l.vRef, V_REF, 0.001), "lee Vref");
  comprobar(cerca(l.temperatura, 25, 0.2), "temperatura 25 °C");
  comprobar(cerca(l.ozono, 98.1, 16), "0,05 ppm a 25 °C ≈ 98 µg/m³ (±1 paso del ADC)");

  ponerSensor(0, 20);
  comprobar(medidor.medir().ozono < 16, "aire limpio: casi 0");

  ponerSensor(-0.02, 20);                                  // ruido por debajo de Vref
  comprobar(medidor.medir().ozono == 0, "nunca da ozono negativo");

  ponerSensor(0.05, 25);
  comprobar(c.ponerReferencia(196.2, medidor.medir().ozonoSinAjustar), "ref: la estación marca 196,2");
  comprobar(cerca(medidor.medir().ozono, 196.2, 0.5), "con el factor de calibración el nodo da lo mismo que la referencia");
}

// ------------------------------------------------------------
// pruebaPublicador() -->
// What it does: checks the iBeacon packet: UUID with the serial number,
//               major with type and counter, minor with the value.
// ------------------------------------------------------------
static void pruebaPublicador() {
  printf("Publicador\n");
  reiniciarDoble();
  Publicador p;
  comprobar(memcmp(p.getUUID(), "AERI092021010920", 16) == 0, "UUID = \"AERI\" + número de serie");
  p.encenderEmisora();
  p.publicar(Publicador::OZONO, 98, 7, 6000);
  const BLEBeacon & b = Bluefruit.Advertising.ultimoBeacon;
  comprobar(b.major == (11 << 8) + 7, "major = 11 (ozono) × 256 + contador");
  comprobar(b.minor == 98, "minor = valor");
  comprobar(b.fabricante == 0x004c, "fabricante Apple: es un iBeacon");
  comprobar(Bluefruit.nombre == "AERIS", "se anuncia con el nombre AERIS");
  comprobar(Doble::tiempoEsperado == 6000 && !Bluefruit.Advertising.anunciando, "emite 6 s y para");

  p.publicar(Publicador::TEMPERATURA, -35, 8, 3000);
  comprobar(Bluefruit.Advertising.ultimoBeacon.major == (12 << 8) + 8, "major = 12 (temperatura) × 256 + contador");
  comprobar((int16_t) Bluefruit.Advertising.ultimoBeacon.minor == -35, "una temperatura negativa (-3,5 °C) también cabe");
}

// ------------------------------------------------------------
// pruebaOrdenes() -->
// What it does: checks how the serial orders are read.
// ------------------------------------------------------------
static void pruebaOrdenes() {
  printf("OrdenesSerie\n");
  comprobar(interpretarOrden("ver").tipo == VER, "ver");
  comprobar(interpretarOrden("  CERO \r").tipo == CERO, "cero con espacios, mayúsculas y \\r");
  comprobar(interpretarOrden("borrar").tipo == BORRAR, "borrar");
  Orden o = interpretarOrden("ref 85.5");
  comprobar(o.tipo == REFERENCIA && cerca(o.valor, 85.5, 1e-4), "ref 85.5");
  comprobar(interpretarOrden("ref").tipo == DESCONOCIDA, "ref sin número");
  comprobar(interpretarOrden("ref abc").tipo == DESCONOCIDA, "ref con texto");
  comprobar(interpretarOrden("ref -3").tipo == DESCONOCIDA, "ref negativa");
  comprobar(interpretarOrden("ref 9x").tipo == DESCONOCIDA, "ref con basura detrás");
  comprobar(interpretarOrden("").tipo == NINGUNA, "línea vacía");
  comprobar(interpretarOrden("hola").tipo == DESCONOCIDA, "orden desconocida");

  reiniciarDoble();
  LectorLineas lector;
  Doble::entradaSerie = "ve";
  comprobar(!lector.hayLinea(), "sin Enter todavía no hay línea");
  Doble::entradaSerie = "r\r\n";
  comprobar(lector.hayLinea() && strcmp(lector.linea(), "ver") == 0, "con Enter llega «ver» entero");
  comprobar(!lector.hayLinea(), "el \\n después del \\r no da una línea vacía");
}

// ------------------------------------------------------------
// pruebaProgramaCompleto() -->
// What it does: runs setup() and loop() as the board would: one round
//               broadcasts ozone and then temperature with the same counter;
//               «ref» written in the serial monitor is saved in flash.
// ------------------------------------------------------------
static void pruebaProgramaCompleto() {
  printf("setup() y loop()\n");
  reiniciarDoble();
  Loop::cont = 0;
  Globales::laCalibracion.borrar();
  ponerSensor(0.05, 25);

  setup();
  comprobar(Bluefruit.encendido, "setup() enciende Bluetooth");
  comprobar(Doble::salidaSerie.find("092021010920") != std::string::npos, "setup() escribe el número de serie");

  Doble::tiempoEsperado = 0;
  loop();
  const std::vector<BLEBeacon> & emitidos = Bluefruit.Advertising.beacons;
  comprobar(emitidos.size() == 2, "una vuelta emite 2 tramas");
  comprobar(emitidos.size() == 2 && emitidos[0].major == (11 << 8) + 1 && cerca(emitidos[0].minor, 98, 16),
            "primero el ozono (contador 1, ≈ 98 µg/m³)");
  comprobar(emitidos.size() == 2 && emitidos[1].major == (12 << 8) + 1 && cerca(emitidos[1].minor, 250, 3),
            "después la temperatura en décimas (≈ 250 = 25,0 °C)");
  comprobar(Doble::tiempoEsperado >= 9000 && Doble::tiempoEsperado < 10000, "una vuelta dura unos 9 s");

  Doble::entradaSerie = "ref 196\n";
  loop();
  comprobar(cerca(Globales::laCalibracion.getFactor(), 2.0, 0.35), "«ref 196» por el puerto serie cambia el factor");
  Calibracion guardada;
  comprobar(guardada.cargar() && cerca(guardada.getFactor(), Globales::laCalibracion.getFactor(), 1e-6),
            "y queda guardado en la flash");
  comprobar(Bluefruit.Advertising.beacons.back().major == (12 << 8) + 2, "la segunda vuelta usa el contador 2");

  Doble::entradaSerie = "hola\n";
  Doble::salidaSerie.clear();
  loop();
  comprobar(Doble::salidaSerie.find("Ordenes:") != std::string::npos, "una orden desconocida enseña la ayuda");
}

// ------------------------------------------------------------
// main() --> Z
// What it does: runs all the tests; returns 1 if any check failed.
// ------------------------------------------------------------
int main() {
  pruebaConversor();
  pruebaCalibracion();
  pruebaMedidor();
  pruebaPublicador();
  pruebaOrdenes();
  pruebaProgramaCompleto();
  printf("%d comprobaciones, %d fallidas\n", comprobaciones, pruebasFallidas);
  return pruebasFallidas == 0 ? 0 : 1;
}
