// -*- mode: c++ -*-

// ---------------------------------------------------------------------------
// Fichero:     OrdenesSerie.h
// Descripción: Órdenes que se escriben en el Monitor Serie de Arduino (con
//              el nodo conectado por USB) para calibrarlo:
//                ver        enseña la última lectura y la calibración
//                cero       el sensor está en aire limpio: guarda el offset
//                ref 85     la referencia (p. ej. la estación oficial) marca
//                           85 µg/m³: guarda el factor de corrección
//                borrar     quita la calibración
//              Diseño en doc/arduino_design.md. Tarea T004.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------

#ifndef ORDENES_SERIE_H_INCLUIDO
#define ORDENES_SERIE_H_INCLUIDO

#include <stdlib.h>
#include <string.h>
#include <ctype.h>

// TipoOrden = { NINGUNA, VER, CERO, REFERENCIA, BORRAR, DESCONOCIDA }
enum TipoOrden { NINGUNA, VER, CERO, REFERENCIA, BORRAR, DESCONOCIDA };

// Orden = ( tipo: TipoOrden, valor: R )    (valor solo en REFERENCIA)
struct Orden {
  TipoOrden tipo;
  float valor;
};

// ------------------------------------------------------------
// texto: Texto --> interpretarOrden() --> Orden
// What it does: reads one line written in the serial monitor (spaces at the
//               ends and capitals do not matter). «ref» needs a number
//               greater than 0; if not, the order is DESCONOCIDA. An empty
//               line is NINGUNA.
// ------------------------------------------------------------
inline Orden interpretarOrden(const char * texto) {
  char linea[32];
  int n = 0;
  while (*texto == ' ' || *texto == '\t') texto++;
  while (*texto && *texto != '\r' && *texto != '\n' && n < (int) sizeof(linea) - 1) {
    linea[n++] = (char) tolower((unsigned char) *texto++);
  }
  while (n > 0 && linea[n - 1] == ' ') n--;
  linea[n] = '\0';

  if (n == 0) return { NINGUNA, 0 };
  if (strcmp(linea, "ver") == 0) return { VER, 0 };
  if (strcmp(linea, "cero") == 0) return { CERO, 0 };
  if (strcmp(linea, "borrar") == 0) return { BORRAR, 0 };
  if (strncmp(linea, "ref ", 4) == 0) {
    char * fin;
    const float valor = strtof(linea + 4, &fin);
    while (*fin == ' ') fin++;
    if (fin != linea + 4 && *fin == '\0' && valor > 0) return { REFERENCIA, valor };
  }
  return { DESCONOCIDA, 0 };
} // ()

// ----------------------------------------------------------
// LectorLineas class: collects the characters that arrive by the serial port
// until a line is complete, without stopping the program.
// ----------------------------------------------------------
class LectorLineas {
private:
  char buffer[32];
  int largo = 0;
public:
  // ------------------------------------------------------------
  // hayLinea() --> V/F
  // What it does: reads what has arrived; true when a whole line (ended in
  //               Enter) is ready in linea(). Longer lines are cut.
  // ------------------------------------------------------------
  bool hayLinea() {
    while (Serial.available() > 0) {
      const char c = (char) Serial.read();
      if (c == '\n' || c == '\r') {
        if (largo == 0) continue;
        buffer[largo] = '\0';
        largo = 0;
        return true;
      }
      if (largo < (int) sizeof(buffer) - 1) buffer[largo++] = c;
    }
    return false;
  } // ()

  // ------------------------------------------------------------
  // linea() --> Texto
  // What it does: the last complete line.
  // ------------------------------------------------------------
  const char * linea() const { return buffer; }
}; // class

#endif
