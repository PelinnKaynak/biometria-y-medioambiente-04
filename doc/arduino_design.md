# Diseño del componente: nodo sensor (arduino)

**Tarea:** T004 · **Historias:** H003 · **Implementación:** `src/arduino/NodoAERIS/` · **Tests:** `src/arduino/test/`

Programa del nodo AERIS: placa **SparkFun Pro nRF52840 Mini** (núcleo *Adafruit nRF52*), sensor de ozono **SPEC Sensors ULPSM-O3 968-046** y batería. Mide el ozono y la temperatura y los emite por **Bluetooth LE en tramas iBeacon**. La app (H003) recibe las tramas, se queda solo con las de su sensor y las envía al servidor con la hora y la ubicación.

Parte del `HolaMundoIBeacon` del Sprint 0 (código de Jordi Bataller i Mascarell). `EmisoraBLE.h`, `ServicioEnEmisora.h` y `LED.h` se usan tal cual. `PuertoSerie.h` tiene dos cambios pequeños. El resto es nuevo o se ha rehecho.

## 1. Montaje

| Pin del ULPSM-O3 | Placa | Uso |
|---|---|---|
| 1 · Vgas | 29 (AIN5) | Señal del gas |
| 2 · Vref | 5 (AIN3) | Referencia (≈ V+/2) |
| 3 · Vtemp | 2 (AIN0) | Temperatura |
| 7, 8 · V+ | 3V3 | Alimentación (2,7–3,3 V; nunca a VBAT ni a 5 V) |
| 6 · GND | GND | Masa |

Solo leen tensiones las entradas analógicas del nRF52840: los pines 2, 3, 4, 5, 28, 29, 30 y 31. Si el montaje usa otros de esa lista, se cambian en `Configuracion.h`.

Comprobación con el polímetro (sensor alimentado, aire limpio): Vref ≈ 1,65 V; Vgas muy cerca de Vref (unos pocos mV por debajo); Vtemp ≈ 1,6 V a 25 °C.

## 2. Trama iBeacon

```text
TramaIBeacon = ( beaconUUID: [N]_16, major: N, minor: Z, txPower: Z )   fabricante 0x004C (Apple)

   beaconUUID = "AERI" (4 bytes ASCII) + numeroSerie (12 bytes ASCII, las cifras de la etiqueta)
                p. ej. "AERI092021011003"
   major      = tipo * 256 + contador          (byte alto: tipo; byte bajo: contador 0..255)
   minor      = valor (int16, con signo)

TipoMedicion = { OZONO = 11, TEMPERATURA = 12 }
   OZONO:       minor = µg/m³ (ya calibrado, nunca negativo)
   TEMPERATURA: minor = décimas de °C (215 = 21,5 °C)

Nombre del dispositivo: "AERIS"
```

- El **número de serie** es el mismo que lee la app al escanear la etiqueta y que guarda el servidor en `Sensores.numeroSerie`. Así la app puede aceptar solo las tramas de su sensor (T005) sin conocer el `idSensor` de la base de datos. En el Sprint 0 el UUID era `"EPSG-GTI-PELIN"` + IdSensor (2 bytes).
- El **contador** es el mismo para el ozono y la temperatura de una vuelta. Cambia en cada vuelta, así la app sabe si una trama es nueva o repetida.

En cada vuelta (≈ 9 s) se mide, el LED parpadea 100 ms, se emite el ozono durante 6 s y la temperatura durante 3 s.

## 3. Cálculos (`ConversorOzono.h`)

Fórmulas del datasheet del ULPSM-O3 y del *Analog SDK Users Manual* de SPEC Sensors:

```text
V      = lectura × Vref_ADC / (2^bits − 1)
M      = sensibilidad (nA/ppm) × ganancia TIA (kV/A) × 10⁻⁶           (V/ppm; con el ozono es negativa)
ppm    = (Vgas − (Vref + Voffset)) / M
T (°C) = 87 / V+ × Vtemp − 18                                          (±3 °C entre −10 y 50 °C)
µg/m³  = ppm × 48 × 1000 / (22,414 × (T + 273,15) / 273,15)            (1 ppm ≈ 1962 µg/m³ a 25 °C)
ozono  = max(0, µg/m³ × factor)
```

- Sensibilidad: la de la etiqueta del sensor (−38,11 nA/ppm en el del nodo de Pelin, etiqueta «092021011003 110406 O3 2109 -38.11»). Ganancia TIA del módulo de ozono: 499 kV/A.
- **ADC:** 1 ppm mueve Vgas solo unos 22 mV (100 µg/m³ ≈ 1,1 mV), así que se lee a 14 bits con referencia de 3,0 V (un paso ≈ 0,18 mV ≈ 16 µg/m³). Cada lectura es la media de 256 muestras, guardando los decimales.

```text
lectura: R, bits: N, vReferencia: R   --> voltiosDesdeLectura() --> R
sensibilidad: R, gananciaTIA: R      --> factorM() --> R
vGas: R, vRef: R, vOffset: R, m: R   --> ppmOzono() --> R
vTemp: R, vAlimentacion: R           --> temperatura() --> R
ppm: R, temperaturaC: R              --> microgramosPorM3() --> R
valor: R, factor: R                  --> ajustar() --> R
valor: R                             --> valorParaTrama() --> Z      (redondea y limita a int16)
```

## 4. Calibración (`Calibracion.h`, `OrdenesSerie.h`)

El ajuste se guarda en la flash de la placa (`InternalFS`, fichero `/calibracion.dat`), así que no se pierde al apagarla. Tiene dos valores:

- **vOffset** (V): lo que marca el sensor con aire limpio (Vgas0 = Vref + Voffset). Por defecto 0.
- **factor**: corrección frente a un valor de referencia. Por defecto 1.

Se calibra con el nodo conectado por USB, escribiendo órdenes en el Monitor Serie (115200 baudios):

| Orden | Qué hace |
|---|---|
| `ver` | Enseña la lectura (Vgas, Vref, temperatura, ozono con y sin ajustar) y la calibración |
| `cero` | El sensor está en aire limpio (tras estabilizarse; SPEC recomienda tenerlo encendido 24 h antes): guarda Voffset = Vgas − Vref |
| `ref 85` | En el mismo sitio, la referencia (p. ej. la estación oficial más cercana) marca 85 µg/m³: guarda factor = 85 / ozono sin ajustar |
| `borrar` | Vuelve a offset 0 y factor 1 |

Para que varios sensores en el mismo sitio den valores parecidos, se calibran todos con `ref` frente a la misma referencia. No se guardan valores absurdos (offset de más de ±0,3 V o factor fuera de 0,2–5): se avisa y no cambia nada.

```text
                                       --------- Calibracion --------------------
                                       | vOffset: R, factor: R
                                       |
                                       cargar() --> V/F            (false: no hay o no es válida → 0 y 1)
  vGasMenosVRef: R                 --> ponerCero() --> V/F
  valorReferencia: R, valorSinAjustar: R
                                   --> ponerReferencia() --> V/F
                                       borrar() --> V/F
                                       getVOffset() --> R  ||  getFactor() --> R
                                       ------------------------------------------

TipoOrden = { NINGUNA, VER, CERO, REFERENCIA, BORRAR, DESCONOCIDA }
Orden = ( tipo: TipoOrden, valor: R )
  texto: Texto --> interpretarOrden() --> Orden
  LectorLineas: hayLinea() --> V/F  ||  linea() --> Texto     (lee el puerto serie sin parar el programa)
```

## 5. Clases

```text
Lectura = ( vGas: R, vRef: R, vTemp: R, temperatura: R, ozonoSinAjustar: R, ozono: R )

                                       --------- Medidor ------------------------
  calibracion: Calibracion         --> Medidor() -->
                                       iniciarMedidor() -->        (ADC a 14 bits, referencia 3,0 V)
                                       medir() --> Lectura
                                       ------------------------------------------

                                       --------- Publicador ---------------------
                                       | laEmisora: EmisoraBLE ("AERIS", 0x004C, 4)
                                       Publicador() -->            (UUID = "AERI" + numeroSerie)
                                       encenderEmisora() -->
  tipo: TipoMedicion, valor: Z, contador: N, tiempoEspera: Z
                                   --> publicar() -->              (emite y para a los tiempoEspera ms)
                                       getUUID() --> [N]_16
                                       ------------------------------------------
```

Programa principal (`NodoAERIS.ino`):

```text
setup()    espera el puerto serie como mucho 3 s (con batería no hay USB), carga la calibración,
           prepara el ADC y enciende Bluetooth
loop()     cont := cont + 1; órdenes; l := medir(); LED; publicar(OZONO, l.ozono, cont, 6 s);
           órdenes; publicar(TEMPERATURA, l.temperatura × 10, cont, 3 s)
```

`Configuracion.h` reúne lo que cambia de un nodo a otro: número de serie y sensibilidad (de la etiqueta), pines, ADC y tiempos.

## 6. Cambios respecto al Sprint 0

| Sprint 0 | AERIS |
|---|---|
| `Medidor` devolvía 123 (CO2 ficticio) | Lee el ULPSM-O3 por el ADC y da ozono en µg/m³ y temperatura |
| UUID `"EPSG-GTI-PELIN"` + IdSensor | UUID `"AERI"` + número de serie del sensor |
| Nombre `PelinIBeacon`, tipo CO2 = 11 | Nombre `AERIS`, tipos OZONO = 11 y TEMPERATURA = 12 |
| Sin calibración | Offset y factor en la flash, órdenes por el puerto serie |
| `esperarDisponible()` esperaba el USB para siempre | Espera como mucho 3 s, para que funcione con batería |

## 7. Tests

`npm test` desde `src/arduino` (hace falta `npm install` la primera vez y `g++`; si no hay `g++`, el test se omite). Compila el programa en el ordenador con los dobles de prueba de `test/stubs/`: `bluefruit.h` (Arduino y Bluetooth; el test elige los voltios de cada pin) y `Adafruit_LittleFS.h` / `InternalFileSystem.h` (la flash, en memoria). Comprueban las fórmulas, la calibración (que se guarda y se recupera tras reiniciar, y que no acepta valores absurdos), la medida con voltios conocidos, la trama, las órdenes y una vuelta completa de `setup()` y `loop()`.

Antes de subir el programa a la placa hay que instalar en el Arduino IDE el núcleo *Adafruit nRF52* y elegir la placa *SparkFun Pro nRF52840 Mini*. Las tramas se pueden ver con la app *nRF Connect* (nombre `AERIS`).
