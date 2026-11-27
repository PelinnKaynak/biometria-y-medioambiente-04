// -*- mode: c++ -*-
// ---------------------------------------------------------------------------
// Fichero:     Adafruit_LittleFS.h  (doble de prueba)
// Descripción: Sustituye, solo para los tests en el ordenador, al sistema de
//              ficheros de la flash del nRF52840 (Adafruit LittleFS). Los
//              ficheros se guardan en memoria (Doble::ficheros), así los
//              tests pueden comprobar lo que se guarda y simular un reinicio.
//              Diseño en doc/arduino_design.md. Tarea T004.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
#ifndef ADAFRUIT_LITTLEFS_DOBLE_DE_PRUEBA_H
#define ADAFRUIT_LITTLEFS_DOBLE_DE_PRUEBA_H

#include <cstdint>
#include <cstring>
#include <map>
#include <string>
#include <vector>

#define FILE_O_READ 0
#define FILE_O_WRITE 1

namespace Doble {
  std::map<std::string, std::vector<uint8_t>> ficheros;   // la «flash»
}

namespace Adafruit_LittleFS_Namespace {

  class Adafruit_LittleFS {
  public:
    // ------------------------------------------------------------
    // begin() --> V/F
    // What it does: always true.
    // ------------------------------------------------------------
    bool begin() { return true; }

    // ------------------------------------------------------------
    // nombre: Texto --> remove() --> V/F
    // What it does: deletes the file from Doble::ficheros.
    // ------------------------------------------------------------
    bool remove(const char * nombre) { return Doble::ficheros.erase(nombre) > 0; }
  };

  class File {
  private:
    std::string nombre;
    int modo = -1;
    size_t posicion = 0;
  public:
    // ------------------------------------------------------------
    // fs: Adafruit_LittleFS --> File() -->
    // What it does: nothing.
    // ------------------------------------------------------------
    File(Adafruit_LittleFS &) {}

    // ------------------------------------------------------------
    // n: Texto, m: N --> open() --> V/F
    // What it does: to read, true only if the file exists; to write, it
    //               creates it if needed and adds at the end (like LittleFS).
    // ------------------------------------------------------------
    bool open(const char * n, int m) {
      if (m == FILE_O_READ && Doble::ficheros.count(n) == 0) return false;
      nombre = n; modo = m; posicion = 0;
      if (m == FILE_O_WRITE) Doble::ficheros[n];
      return true;
    }

    // ------------------------------------------------------------
    // destino: [N], tam: N --> read() --> Z
    // What it does: copies up to 'tam' bytes; returns how many.
    // ------------------------------------------------------------
    int read(uint8_t * destino, size_t tam) {
      const std::vector<uint8_t> & datos = Doble::ficheros[nombre];
      size_t n = 0;
      while (n < tam && posicion < datos.size()) destino[n++] = datos[posicion++];
      return (int) n;
    }

    // ------------------------------------------------------------
    // origen: [N], tam: N --> write() --> N
    // What it does: adds the bytes at the end of the file.
    // ------------------------------------------------------------
    size_t write(const uint8_t * origen, size_t tam) {
      std::vector<uint8_t> & datos = Doble::ficheros[nombre];
      datos.insert(datos.end(), origen, origen + tam);
      return tam;
    }

    // ------------------------------------------------------------
    // close() -->
    // What it does: nothing.
    // ------------------------------------------------------------
    void close() { modo = -1; }
  };

} // namespace

#endif
