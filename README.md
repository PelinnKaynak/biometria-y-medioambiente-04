# AERIS · biometria-y-medioambiente-04

AERIS es una plataforma de crowdsensing para medir la calidad del aire. Cada portador lleva un pequeño nodo con un sensor de ozono que envía sus mediciones al móvil por Bluetooth. La app las sube a un servidor y con ellas se construye un mapa de la contaminación que cualquiera puede consultar en la web.

El proyecto lo desarrolla el equipo 04 de la asignatura Proyecto Aplicaciones de Biometría y Medio Ambiente para la empresa SenseTech. Trabajamos con Scrum en sprints de unas tres semanas.

## Cómo funciona

```
Nodo sensor (ozono)
   ↓ Bluetooth LE
App Android del portador
   ↓ HTTP / REST (JSON)
Servidor REST → lógica de negocio → base de datos
   ↓
Web: mapa público, Mi cuenta y panel de administración
```

Además, un modelo de aprendizaje automático predice el nivel de ozono de las próximas 48 horas a partir del histórico de las estaciones oficiales y de los datos meteorológicos de AEMET.

## Tipos de usuario

- Ciudadano: consulta el mapa y la información sobre el ozono sin crear una cuenta.
- Portador: lleva un sensor, recibe alertas en la app y consulta sus datos en la app o en la web.
- Usuario premium: además guarda sus lugares habituales y tiene funciones avanzadas.
- Técnico del ayuntamiento y administrador: supervisan la red de nodos, los usuarios, las campañas y las zonas sensibles desde el panel web.

## Organización del repositorio

Seguimos la estructura que pide la asignatura. Cada componente tiene su diseño en `doc/` (con el nombre `xxx_design.md`) y su código en `src/xxx/`. El diseño se escribe antes que el código, y el código tiene que corresponderse con él.

Cada función lleva una cabecera con su diseño lógico y cada componente tiene sus pruebas automáticas.

## Forma de trabajar

- `main` solo contiene código que funciona.
- Cada tarea se hace en su propia rama, con el número de la tarea de Trello en el nombre (por ejemplo, `t013-login-web`).
- Antes de unir una rama a `main`, otro miembro del equipo revisa la pull request.

## Enlaces

- Tablero de Trello: https://trello.com/b/F0dN6jD0/biometria-y-medioambiente-04
- Diseño de la web en Figma: https://www.figma.com/design/0FipRSkVbkOjSjXazv4Wl4
- Diseño de la app en Figma: https://www.figma.com/design/slNGNQPHMB5vRDxncOQyd0
- Diseño de la base de datos en Figma: https://www.figma.com/design/NtaIMmIIOd5Wn7FmwqCdAm

## Equipo

Los autores están en [author.md](author.md).
