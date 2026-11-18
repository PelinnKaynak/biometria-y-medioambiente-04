# src/arduino

Nodo sensor AERIS: C++ para Arduino (SparkFun Pro nRF52840 Mini + sensor de ozono SPEC ULPSM-O3). Lee y calibra el sensor y envía el ozono y la temperatura por Bluetooth LE (tramas iBeacon con el número de serie del sensor).

- Programa: `NodoAERIS/NodoAERIS.ino` (abrir esta carpeta en el Arduino IDE, con el núcleo *Adafruit nRF52*).
- Al programar otro nodo, cambiar el número de serie y la sensibilidad de su etiqueta en `NodoAERIS/Configuracion.h`.
- Calibración: órdenes `ver`, `cero`, `ref <µg/m³>` y `borrar` en el Monitor Serie (115200).
- Tests: `npm install` y `npm test` (necesita `g++`).

Diseño: `doc/arduino_design.md`
