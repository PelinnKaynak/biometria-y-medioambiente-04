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

## Tecnologías

| Componente | Carpeta | Tecnología |
|---|---|---|
| Nodo sensor | `src/arduino` | C++ para Arduino (SparkFun nRF52840) |
| App del portador | `src/app` | Java (Android) |
| Servidor REST | `src/servidor_rest` | Node.js con Express |
| Lógica de negocio | `src/logica` | Node.js |
| Base de datos | `src/bd` | MySQL |
| Web pública y Mi cuenta | `src/web_publica` | HTML, CSS y JavaScript |
| Panel de administración | `src/web_admin` | HTML, CSS y JavaScript |
| Previsión de ozono (IA) | `src/prevision` | Python con pandas y scikit-learn |

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


## Despliegue del servidor y la base de datos (T026)

### Alojamiento

El servidor REST de AERIS está desplegado en el alojamiento
Webs Avanzadas de la UPV mediante Plesk.

- URL pública: https://pfermar1.upv.edu.es
- Backend: Node.js + Express
- Base de datos: MariaDB
- Comunicación externa: HTTPS
- Punto de entrada: app.js

La aplicación Android y la web deben consumir la misma API REST.
La base de datos no se expone directamente a internet.

### 1. Preparar los archivos

Subir el código del repositorio al directorio httpdocs
del alojamiento Plesk.

No subir node_modules, .env, contraseñas ni directorios .git.

La estructura necesaria es:

httpdocs/
  app.js
  package.json
  src/
    logica/
    servidor_rest/
    web_publica/
    bd/

### 2. Configurar Node.js en Plesk

En Websites & Domains > Node.js:

- Application Root: /httpdocs
- Document Root: /httpdocs/src/web_publica
- Application Startup File: app.js
- Application Mode: production
- Node.js: versión compatible, 20 o superior

El archivo app.js inicia el servidor REST:

    require('./src/servidor_rest/mainServidorREST.js');

### 3. Instalar dependencias

En Run Node.js commands, seleccionar npm y ejecutar
los siguientes comandos por separado:

    ci --omit=dev --prefix src/logica

    ci --omit=dev --prefix src/servidor_rest

En un entorno local también se puede ejecutar:

    npm run build

En el alojamiento UPV se utilizan los dos comandos
separados para evitar un problema de resolución de npm
con nodenv al ejecutar scripts anidados.

### 4. Configurar MariaDB

Desde Plesk > Databases:

1. Crear la base de datos aeris.
2. Crear un usuario con permisos sobre esa base de datos.
3. Abrir phpMyAdmin.
4. Seleccionar aeris.
5. Importar el esquema SQL actualizado del proyecto.

Si el script contiene CREATE DATABASE y USE aeris,
preparar una copia para la importación que omita esas
instrucciones, puesto que la base ya está creada en Plesk.

El esquema debe mantenerse sincronizado con el aprobado
por el equipo. No utilizar datos personales reales
para las pruebas de despliegue.

### 5. Configurar variables de entorno

En Plesk > Node.js > Environment:

BD_HOST=localhost
BD_PUERTO=3306
BD_NOMBRE=aeris
BD_USUARIO=<usuario configurado en Plesk>
URL_RESTABLECER=https://pfermar1.upv.edu.es/restablecer.html

Configurar NODE_ENV=production mediante Application Mode.

En Secrets guardar:

BD_CONTRASENYA=<contraseña privada de MariaDB>
CLAVE_TOKENS=<clave aleatoria larga>

No incluir valores secretos en el repositorio.
Si se configura el envío de correos, añadir también
las variables SMTP correspondientes de forma segura.

### 6. Arrancar el servidor

En Plesk > Node.js:

1. Comprobar la configuración de la aplicación.
2. Activar Node.js.
3. Reiniciar la aplicación tras modificar variables
   de entorno o archivos del servidor.
4. Revisar Logs si aparece un error HTTP 500.

### 7. Comprobar el funcionamiento

Abrir:

https://pfermar1.upv.edu.es/usuarioActual

Sin autenticación debe devolver HTTP 401.

Comprobar además mediante peticiones HTTPS:

1. POST /registrarUsuario: crear un usuario de prueba.
2. POST /iniciarSesion: obtener una sesión válida.
3. GET /usuarioActual: consultar el usuario con su token.
4. Verificar el registro en phpMyAdmin.
5. Repetir una consulta desde una red distinta.

No publicar contraseñas ni tokens de sesión en los
registros, capturas o documentación.

### 8. Actualizar el despliegue

Para publicar una nueva versión:

1. Integrar primero los cambios revisados del equipo.
2. Actualizar los archivos del alojamiento desde GitHub
   o mediante un paquete de despliegue.
3. Instalar dependencias si han cambiado.
4. Aplicar las migraciones SQL necesarias, sin borrar
   los datos existentes.
5. Reiniciar la aplicación en Plesk.
6. Comprobar las rutas REST y revisar los registros.

Este procedimiento no sincroniza automáticamente la
base de datos local de XAMPP con MariaDB de la UPV.


## Equipo

Los autores están en [author.md](author.md).
