
# Diseño del componente de previsión de ozono

## 1. Objetivo

Preparar un conjunto de datos histórico que permita entrenar
un modelo de inteligencia artificial para predecir los niveles
de ozono de las próximas 48 horas.

El conjunto de datos combinará las mediciones de ozono de
las estaciones de la Red Valenciana de Vigilancia de la
Contaminación Atmosférica con los datos meteorológicos
de AEMET.

## 2. Entradas

- Datos históricos horarios de ozono (O3).
- Datos meteorológicos horarios de AEMET.
- Identificación de las estaciones de medición.
- Fecha y hora de cada medición.
- Correspondencia entre estaciones de calidad del aire
  y estaciones meteorológicas.

## 3. Procesamiento

1. Cargar los datos originales.
2. Normalizar los formatos de fecha y hora.
3. Comprobar las estaciones y sus correspondencias.
4. Detectar registros duplicados.
5. Identificar valores ausentes e incorrectos.
6. Limpiar los registros inválidos.
7. Unir los datos de ozono y meteorología.
8. Ordenar los registros cronológicamente.
9. Validar la cobertura temporal del conjunto de datos.

## 4. Salida

Un conjunto de datos procesado en formato CSV que incluirá:

- Fecha y hora.
- Estación de calidad del aire.
- Concentración de ozono.
- Variables meteorológicas disponibles.

El archivo se almacenará en data/processed/.

## 5. Validaciones

- Debe existir al menos un año de mediciones horarias.
- Deben identificarse las horas sin datos.
- Deben detectarse valores imposibles o incorrectos.
- Deben eliminarse o tratarse los duplicados.
- Debe documentarse el tratamiento de los valores ausentes.
- La unión debe respetar la correspondencia entre estaciones.

## 6. Tratamiento de errores

Los registros con fechas inválidas serán descartados.

Los valores negativos de concentración de ozono se
considerarán inválidos.

Los valores ausentes no se sustituirán automáticamente
por mediciones inventadas.

Los problemas de lectura de archivos y de disponibilidad
de datos deberán comunicarse mediante mensajes de error.

## 7. Pruebas

Se comprobará:

- La carga correcta de los archivos.
- La conversión de fechas.
- La detección de duplicados.
- La identificación de valores inválidos.
- La unión de los conjuntos de datos.
- La detección de horas ausentes.
- La validación del periodo mínimo de un año.
- La generación del CSV final.
