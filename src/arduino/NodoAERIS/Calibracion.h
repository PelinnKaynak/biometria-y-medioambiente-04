// -*- mode: c++ -*-

// ---------------------------------------------------------------------------
// Fichero:     Calibracion.h
// Descripción: Ajuste de calibración del nodo, guardado en la memoria flash
//              de la placa (sistema de ficheros interno del nRF52840), así
//              que no se pierde al apagarla ni al cambiar la batería:
//              - vOffset: lo que marca el sensor con aire limpio (orden «cero»).
//              - factor: corrección al comparar con un valor de referencia,
//                por ejemplo la estación oficial más cercana (orden «ref»).
//              Diseño en doc/arduino_design.md. Tarea T004.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------

#ifndef CALIBRACION_H_INCLUIDO
#define CALIBRACION_H_INCLUIDO

#include <Adafruit_LittleFS.h>
#include <InternalFileSystem.h>

using namespace Adafruit_LittleFS_Namespace;

// ----------------------------------------------------------
// Calibracion class: the calibration of this node, kept in flash.
// ----------------------------------------------------------
class Calibracion {

private:

  static constexpr const char * FICHERO = "/calibracion.dat";
  static const uint32_t MARCA = 0x41455231;          // "AER1": el fichero es nuestro

  // Límites para no guardar un ajuste absurdo (p. ej. referencia mal escrita)
  static constexpr float FACTOR_MINIMO = 0.2;
  static constexpr float FACTOR_MAXIMO = 5.0;
  static constexpr float OFFSET_MAXIMO = 0.3;        // V

  // Lo que se guarda en la flash
  struct Datos {
    uint32_t marca;
    float vOffset;
    float factor;
  };

  float vOffset = 0.0;
  float factor = 1.0;

public:

  // ------------------------------------------------------------
  // getVOffset() --> R
  // What it does: the offset (V) of the sensor with clean air.
  // ------------------------------------------------------------
  float getVOffset() const { return vOffset; }

  // ------------------------------------------------------------
  // getFactor() --> R
  // What it does: the correction factor (1 = no correction).
  // ------------------------------------------------------------
  float getFactor() const { return factor; }

  // ------------------------------------------------------------
  // cargar() --> V/F
  // What it does: starts the flash file system and reads the saved
  //               calibration. If there is none (new board) or it is not
  //               valid, it keeps the default values (0 V, factor 1) and
  //               returns false.
  // ------------------------------------------------------------
  bool cargar() {
    InternalFS.begin();
    File fichero(InternalFS);
    if (!fichero.open(FICHERO, FILE_O_READ)) {
      return false;
    }
    Datos datos;
    const bool leido = fichero.read((uint8_t *) &datos, sizeof(datos)) == (int) sizeof(datos);
    fichero.close();
    if (!leido || datos.marca != MARCA || !esFactorValido(datos.factor) || !esOffsetValido(datos.vOffset)) {
      return false;
    }
    vOffset = datos.vOffset;
    factor = datos.factor;
    return true;
  } // ()

  // ------------------------------------------------------------
  // vGasMenosVRef: R --> ponerCero() --> V/F
  // What it does: with the sensor in clean air, Vgas − Vref is the offset.
  //               Saves it (false if it is too big: the air was not clean or
  //               the sensor is not connected).
  // ------------------------------------------------------------
  bool ponerCero(float vGasMenosVRef) {
    if (!esOffsetValido(vGasMenosVRef)) {
      return false;
    }
    vOffset = vGasMenosVRef;
    return guardar();
  } // ()

  // ------------------------------------------------------------
  // valorReferencia: R, valorSinAjustar: R --> ponerReferencia() --> V/F
  // What it does: factor := referencia / lo que mide el sensor sin ajustar
  //               (both in µg/m³, at the same place and time). Saves it.
  //               False (nothing changes) if the result is out of limits.
  // ------------------------------------------------------------
  bool ponerReferencia(float valorReferencia, float valorSinAjustar) {
    if (valorReferencia <= 0 || valorSinAjustar <= 0) {
      return false;
    }
    const float nuevo = valorReferencia / valorSinAjustar;
    if (!esFactorValido(nuevo)) {
      return false;
    }
    factor = nuevo;
    return guardar();
  } // ()

  // ------------------------------------------------------------
  // borrar() --> V/F
  // What it does: goes back to no calibration (0 V, factor 1) and saves it.
  // ------------------------------------------------------------
  bool borrar() {
    vOffset = 0.0;
    factor = 1.0;
    return guardar();
  } // ()

private:

  // ------------------------------------------------------------
  // guardar() --> V/F
  // What it does: writes vOffset and factor in the flash file.
  // ------------------------------------------------------------
  bool guardar() {
    InternalFS.remove(FICHERO);
    File fichero(InternalFS);
    if (!fichero.open(FICHERO, FILE_O_WRITE)) {
      return false;
    }
    Datos datos = { MARCA, vOffset, factor };
    const bool escrito = fichero.write((const uint8_t *) &datos, sizeof(datos)) == sizeof(datos);
    fichero.close();
    return escrito;
  } // ()

  static bool esFactorValido(float f) { return f >= FACTOR_MINIMO && f <= FACTOR_MAXIMO; }
  static bool esOffsetValido(float v) { return v >= -OFFSET_MAXIMO && v <= OFFSET_MAXIMO; }

}; // class

#endif
