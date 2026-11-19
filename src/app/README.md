# src/app

App del portador: Java (Android). Pantallas de la app, escaneo Bluetooth LE y envío de las mediciones al servidor.

Diseño: `doc/app_design.md`

El icono y la pantalla de carga usan el logo de AERIS. Tras el splash, `BienvenidaActivity`
mantiene la decisión existente: muestra bienvenida sin sesión y comprueba la sesión guardada
para abrir Inicio.
