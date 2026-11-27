// -*- mode: c++ -*-
// ---------------------------------------------------------------------------
// Fichero:     bluefruit.h  (doble de prueba)
// Descripción: Sustituye, solo para los tests en el ordenador, a las funciones
//              de Arduino (delay, digitalWrite, analogRead, Serial...) y a la
//              biblioteca Bluefruit. No emite nada: apunta lo que se le pide
//              para que los tests lo comprueben. Diseño en doc/arduino_design.md.
//              Viene del Sprint 0; en AERIS (T004) se añaden analogRead()
//              (el test elige los voltios de cada pin) y la lectura del
//              puerto serie (Serial.available / read).
// Autores:     Pelin Kaynak (Sprint 0) · Equipo 04 – SenseTech (AERIS)
// Fecha:       13/10/2026 · 18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
#ifndef BLUEFRUIT_DOBLE_DE_PRUEBA_H
#define BLUEFRUIT_DOBLE_DE_PRUEBA_H

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <map>
#include <string>
#include <vector>

// ------------------------------- Arduino ----------------------------------
#define HIGH 1
#define LOW 0
#define OUTPUT 1
#define A0 2
#define A1 3
#define A2 4
#define AR_DEFAULT 0
#define AR_INTERNAL_3_0 1

typedef uint32_t err_t;
enum SecureMode_t { SECMODE_NO_ACCESS = 0, SECMODE_OPEN = 1 };

// Sin «inline» en las variables (es de C++17): las pruebas se compilan en un
// solo archivo, así que basta con definirlas aquí, y funciona con g++ antiguos.
namespace Doble {
  long tiempoEsperado = 0;                    // suma de todos los delay()
  std::vector<std::pair<int, int>> escriturasPin; // (pin, valor)
  std::string salidaSerie;                    // lo escrito por Serial
  std::string entradaSerie;                   // lo que «escribe» el usuario
  std::map<int, double> voltiosPin;           // voltios de cada pin analógico
  int bitsADC = 10;
  double vReferenciaADC = 3.0;
}

// ------------------------------------------------------------
// referencia: Z --> analogReference()
// What it does: nothing (the test double always uses 3,0 V, like AR_INTERNAL_3_0).
// ------------------------------------------------------------
inline void analogReference(int) {}

// ------------------------------------------------------------
// bits: N --> analogReadResolution()
// What it does: keeps the resolution, used by analogRead().
// ------------------------------------------------------------
inline void analogReadResolution(int bits) { Doble::bitsADC = bits; }

// ------------------------------------------------------------
// pin: Z --> analogRead() --> N
// What it does: the reading that the voltage chosen by the test
//               (Doble::voltiosPin) would give.
// ------------------------------------------------------------
inline int analogRead(int pin) {
  const long maximo = (1L << Doble::bitsADC) - 1;
  long lectura = std::lround(Doble::voltiosPin[pin] / Doble::vReferenciaADC * maximo);
  return (int) (lectura < 0 ? 0 : (lectura > maximo ? maximo : lectura));
}

// ------------------------------------------------------------
// ms: Z --> delay()
// What it does: does not wait; only adds ms to Doble::tiempoEsperado.
// ------------------------------------------------------------
inline void delay(long ms) { Doble::tiempoEsperado += ms; }

// ------------------------------------------------------------
// pin: Z, modo: Z --> pinMode()
// What it does: nothing (there are no pins on the computer).
// ------------------------------------------------------------
inline void pinMode(int, int) {}

// ------------------------------------------------------------
// pin: Z, valor: Z --> digitalWrite()
// What it does: remembers (pin, valor) in Doble::escriturasPin.
// ------------------------------------------------------------
inline void digitalWrite(int pin, int valor) { Doble::escriturasPin.push_back({ pin, valor }); }

class SerialDoble {
public:
  // ------------------------------------------------------------
  // baudios: Z --> begin() -->
  // What it does: nothing (there is no real serial port).
  // ------------------------------------------------------------
  void begin(long) {}

  // ------------------------------------------------------------
  // operator bool() --> B
  // What it does: always true: the fake port is always ready.
  // ------------------------------------------------------------
  explicit operator bool() const { return true; }

  // ------------------------------------------------------------
  // available() --> N
  // What it does: how many characters of Doble::entradaSerie are left.
  // ------------------------------------------------------------
  int available() { return (int) Doble::entradaSerie.size(); }

  // ------------------------------------------------------------
  // read() --> Z
  // What it does: takes the first character of Doble::entradaSerie (−1 if empty).
  // ------------------------------------------------------------
  int read() {
    if (Doble::entradaSerie.empty()) return -1;
    const char c = Doble::entradaSerie[0];
    Doble::entradaSerie.erase(0, 1);
    return (unsigned char) c;
  }

  // ------------------------------------------------------------
  // valor: R, decimales: N --> print() -->
  // What it does: adds the number with that many decimals to Doble::salidaSerie.
  // ------------------------------------------------------------
  void print(double valor, int decimales) {
    char texto[64];
    snprintf(texto, sizeof(texto), "%.*f", decimales, valor);
    Doble::salidaSerie += texto;
  }

  // ------------------------------------------------------------
  // texto: Text --> print() -->
  // What it does: adds the text to Doble::salidaSerie.
  // ------------------------------------------------------------
  void print(const char * texto) { Doble::salidaSerie += texto; }

  // ------------------------------------------------------------
  // c: Text --> print() -->
  // What it does: adds one character to Doble::salidaSerie.
  // ------------------------------------------------------------
  void print(char c) { Doble::salidaSerie += c; }

  // ------------------------------------------------------------
  // numero: Z --> print() -->
  // What it does: adds the number, as text, to Doble::salidaSerie.
  // ------------------------------------------------------------
  template <typename T> void print(T numero) { Doble::salidaSerie += std::to_string((long long) numero); }

  // ------------------------------------------------------------
  // valor: T --> println() -->
  // What it does: like print() and then a new line.
  // ------------------------------------------------------------
  template <typename T> void println(T valor) { print(valor); Doble::salidaSerie += "\n"; }
};
SerialDoble Serial;

// ------------------------------- Bluefruit --------------------------------
#define BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE 0x06
#define CHR_PROPS_READ 0x02
#define CHR_PROPS_WRITE 0x08
#define BLE_GAP_AD_TYPE_MANUFACTURER_SPECIFIC_DATA 0xFF

class BLEBeacon {
public:
  uint8_t uuid[16];
  uint16_t major;
  uint16_t minor;
  int8_t rssi;
  uint16_t fabricante = 0;
  // ------------------------------------------------------------
  // uuid: [N]_16, major: N, minor: N, rssi: Z --> BLEBeacon() -->
  // What it does: keeps the packet data so the tests can read it.
  // ------------------------------------------------------------
  BLEBeacon(const uint8_t * uuid_, uint16_t major_, uint16_t minor_, int8_t rssi_)
    : major(major_), minor(minor_), rssi(rssi_) { memcpy(uuid, uuid_, 16); }

  // ------------------------------------------------------------
  // f: N --> setManufacturer() -->
  // What it does: keeps the manufacturer ID.
  // ------------------------------------------------------------
  void setManufacturer(uint16_t f) { fabricante = f; }
};

class BLEConnection {};

// BLECharacteristic, BLEService: only so that ServicioEnEmisora.h compiles.
class BLECharacteristic {
public:
  // ------------------------------------------------------------
  // uuid: [N]_16 --> BLECharacteristic() -->
  // What it does: nothing.
  // ------------------------------------------------------------
  BLECharacteristic(const uint8_t *) {}

  // ------------------------------------------------------------
  // props: N --> setProperties() -->
  // What it does: nothing.
  // ------------------------------------------------------------
  void setProperties(uint8_t) {}

  // ------------------------------------------------------------
  // permisoRead: SecureMode_t, permisoWrite: SecureMode_t --> setPermission() -->
  // What it does: nothing.
  // ------------------------------------------------------------
  void setPermission(SecureMode_t, SecureMode_t) {}

  // ------------------------------------------------------------
  // tam: N --> setMaxLen() -->
  // What it does: nothing.
  // ------------------------------------------------------------
  void setMaxLen(uint8_t) {}

  // ------------------------------------------------------------
  // tam: N --> setFixedLen() -->
  // What it does: nothing.
  // ------------------------------------------------------------
  void setFixedLen(uint8_t) {}

  // ------------------------------------------------------------
  // v: N --> write8() --> N
  // What it does: keeps the value in valor8 (the tests read it).
  // ------------------------------------------------------------
  uint16_t write8(uint8_t v) { valor8 = v; return 1; }
  uint8_t valor8 = 0;

  // ------------------------------------------------------------
  // s: Text --> write() --> N
  // What it does: returns the length of the text, as if it had been written.
  // ------------------------------------------------------------
  uint16_t write(const char * s) { return (uint16_t) strlen(s); }

  // ------------------------------------------------------------
  // s: Text --> notify() --> N
  // What it does: returns the length of the text, as if it had been notified.
  // ------------------------------------------------------------
  uint16_t notify(const char * s) { return (uint16_t) strlen(s); }

  // ------------------------------------------------------------
  // setWriteCallback() -->   (el callback se omite en la notación)
  // What it does: nothing.
  // ------------------------------------------------------------
  template <typename F> void setWriteCallback(F) {}

  // ------------------------------------------------------------
  // begin() --> N
  // What it does: returns 0 (no error).
  // ------------------------------------------------------------
  err_t begin() { return 0; }
};

class BLEService {
public:
  // ------------------------------------------------------------
  // uuid: [N]_16 --> BLEService() -->
  // What it does: nothing.
  // ------------------------------------------------------------
  BLEService(const uint8_t *) {}

  // ------------------------------------------------------------
  // begin() --> N
  // What it does: returns 0 (no error).
  // ------------------------------------------------------------
  err_t begin() { return 0; }
};

class AdvertisingDoble {
public:
  bool anunciando = false;
  int vecesIniciado = 0;
  bool hayBeacon = false;
  BLEBeacon ultimoBeacon { (const uint8_t *) "----------------", 0, 0, 0 };
  std::vector<BLEBeacon> beacons;     // todos los que se han emitido (AERIS)
  uint16_t intervaloMin = 0, intervaloMax = 0;
  // ------------------------------------------------------------
  // stop() -->
  // What it does: marks that it is not advertising.
  // ------------------------------------------------------------
  void stop() { anunciando = false; }

  // ------------------------------------------------------------
  // isRunning() --> B
  // What it does: returns true if it is advertising.
  // ------------------------------------------------------------
  bool isRunning() { return anunciando; }

  // ------------------------------------------------------------
  // b: BLEBeacon --> setBeacon() -->
  // What it does: keeps the iBeacon packet to advertise (and adds it to beacons).
  // ------------------------------------------------------------
  void setBeacon(BLEBeacon & b) { ultimoBeacon = b; hayBeacon = true; beacons.push_back(b); }

  // ------------------------------------------------------------
  // reiniciar: B --> restartOnDisconnect() -->
  // What it does: nothing.
  // ------------------------------------------------------------
  void restartOnDisconnect(bool) {}

  // ------------------------------------------------------------
  // a: N, b: N --> setInterval() -->
  // What it does: keeps the advertising interval.
  // ------------------------------------------------------------
  void setInterval(uint16_t a, uint16_t b) { intervaloMin = a; intervaloMax = b; }

  // ------------------------------------------------------------
  // segundos: N --> setFastTimeout() -->
  // What it does: nothing.
  // ------------------------------------------------------------
  void setFastTimeout(int) {}

  // ------------------------------------------------------------
  // tiempo: N --> start() -->
  // What it does: marks that it is advertising and counts how many times it started.
  // ------------------------------------------------------------
  void start(int) { anunciando = true; vecesIniciado++; }

  // ------------------------------------------------------------
  // clearData() -->
  // What it does: nothing.
  // ------------------------------------------------------------
  void clearData() {}

  // ------------------------------------------------------------
  // flags: N --> addFlags() -->
  // What it does: nothing.
  // ------------------------------------------------------------
  void addFlags(uint8_t) {}

  // ------------------------------------------------------------
  // tipo: N, datos: [N], tam: N --> addData() -->
  // What it does: nothing.
  // ------------------------------------------------------------
  void addData(uint8_t, const uint8_t *, int) {}

  // ------------------------------------------------------------
  // servicio: BLEService --> addService() --> B
  // What it does: returns true (service added).
  // ------------------------------------------------------------
  bool addService(BLEService &) { return true; }
};

class ScanResponseDoble {
public:
  // ------------------------------------------------------------
  // addName() -->
  // What it does: nothing.
  // ------------------------------------------------------------
  void addName() {}

  // ------------------------------------------------------------
  // clearData() -->
  // What it does: nothing.
  // ------------------------------------------------------------
  void clearData() {}
};

class PeriphDoble {
public:
  // ------------------------------------------------------------
  // setConnectCallback() -->   (el callback se omite en la notación)
  // What it does: nothing.
  // ------------------------------------------------------------
  template <typename F> void setConnectCallback(F) {}

  // ------------------------------------------------------------
  // setDisconnectCallback() -->   (el callback se omite en la notación)
  // What it does: nothing.
  // ------------------------------------------------------------
  template <typename F> void setDisconnectCallback(F) {}
};

class BluefruitDoble {
public:
  bool encendido = false;
  std::string nombre;
  int8_t potencia = 0;
  AdvertisingDoble Advertising;
  ScanResponseDoble ScanResponse;
  PeriphDoble Periph;
  // ------------------------------------------------------------
  // begin() -->
  // What it does: marks that Bluetooth is on.
  // ------------------------------------------------------------
  void begin() { encendido = true; }

  // ------------------------------------------------------------
  // n: Text --> setName() -->
  // What it does: keeps the device name.
  // ------------------------------------------------------------
  void setName(const char * n) { nombre = n; }

  // ------------------------------------------------------------
  // p: Z --> setTxPower() -->
  // What it does: keeps the transmission power.
  // ------------------------------------------------------------
  void setTxPower(int8_t p) { potencia = p; }

  // ------------------------------------------------------------
  // connHandle: N --> Connection() --> BLEConnection
  // What it does: returns no connection (there are no connections in the tests).
  // ------------------------------------------------------------
  BLEConnection * Connection(uint16_t) { return nullptr; }
};
BluefruitDoble Bluefruit;

#endif
