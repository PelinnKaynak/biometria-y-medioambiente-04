# Diseño del componente de previsión de ozono

## 1. Objetivo

Desarrollar un componente de inteligencia artificial capaz de predecir la concentración de ozono (O3) en la estación de calidad del aire de Gandia para las próximas 48 horas.

Para ello, se utilizan datos históricos horarios de concentración de ozono procedentes de la Red Valenciana de Vigilancia y Control de la Contaminación Atmosférica y datos meteorológicos históricos de Open-Meteo Archive.

El sistema combina ambas fuentes para preparar un conjunto de datos que permite entrenar y evaluar un modelo de predicción.

## 2. Entradas

El componente utiliza las siguientes entradas:

- Datos históricos horarios de concentración de ozono (O3).
- Datos meteorológicos horarios procedentes de Open-Meteo Archive.
- Identificación de la estación de calidad del aire.
- Fecha y hora de cada medición.
- Coordenadas geográficas utilizadas para obtener los datos meteorológicos.

La estación de calidad del aire utilizada inicialmente es la 46131002, situada en Gandia.

Los datos meteorológicos utilizados corresponden al punto geográfico 38.910366, -0.12313843.

Las variables meteorológicas incluidas son:

- Temperatura.
- Humedad relativa.
- Velocidad del viento.
- Dirección del viento.
- Radiación solar.
- Presión atmosférica.
- Nubosidad.

## 3. Procesamiento de datos

El procesamiento de los datos históricos de 2025 se realiza mediante el script `src/prevision/preparar_datos.py`.

Las operaciones realizadas son:

1. Cargar los archivos originales de ozono y meteorología.
2. Normalizar los formatos de fecha y hora.
3. Convertir las variables numéricas.
4. Detectar registros duplicados.
5. Identificar fechas inválidas.
6. Detectar valores ausentes y concentraciones negativas de ozono.
7. Eliminar los registros inválidos.
8. Unir los datos de ozono y meteorología mediante la fecha y hora.
9. Ordenar los registros cronológicamente.
10. Comprobar la cobertura temporal.
11. Generar el conjunto de datos procesado.
12. Generar informes de calidad y registros de horas ausentes.

La unión se realiza utilizando las horas disponibles en el conjunto de datos de ozono como referencia.

No se rellenan automáticamente las mediciones ausentes.

Para la evaluación externa también se ha preparado un conjunto independiente correspondiente a octubre de 2026. En este caso se han utilizado scripts específicos para descargar y combinar las mediciones de ozono de la Generalitat Valenciana y los datos meteorológicos de Open-Meteo.

## 4. Salida del procesamiento

Los resultados del procesamiento se almacenan en `data/processed/`.

Los principales archivos generados son:

- `datos_prevision_gandia_2025.csv`: conjunto de datos de 2025 preparado para el modelo.
- `informe_calidad_datos.txt`: informe con los resultados de las comprobaciones de 2025.
- `horas_ozono_sin_medicion.csv`: listado de horas sin medición de ozono.
- `horas_sin_meteorologia.csv`: listado de horas sin datos meteorológicos.
- `datos_prevision_gandia_2026_10.csv`: conjunto independiente de octubre de 2026 utilizado para evaluar el modelo.
- `informe_calidad_gandia_2026_10.txt`: informe de calidad del conjunto de octubre de 2026.

El CSV procesado contiene:

- Fecha y hora.
- Concentración de ozono.
- Identificación de la estación.
- Temperatura.
- Humedad relativa.
- Velocidad del viento.
- Dirección del viento.
- Radiación solar.
- Presión atmosférica.
- Nubosidad.

## 5. Validaciones de calidad

El procesamiento incluye las siguientes comprobaciones:

- Existencia de al menos un año de datos en el conjunto histórico de 2025.
- Identificación de horas sin mediciones.
- Detección de fechas inválidas.
- Detección de registros duplicados.
- Identificación de concentraciones negativas de ozono.
- Comprobación de valores meteorológicos fuera de rangos orientativos.
- Comprobación de la disponibilidad de variables meteorológicas después de la unión.
- Generación de informes de calidad.

### 5.1. Resultados de la preparación de datos de 2025

Los resultados obtenidos son:

- Horas esperadas: 8.760.
- Registros originales de ozono: 8.436.
- Registros originales de meteorología: 8.760.
- Fechas inválidas: 0.
- Duplicados: 0.
- Mediciones de ozono ausentes o no numéricas: 47.
- Concentraciones negativas de ozono: 0.
- Horas sin fila de ozono: 324.
- Registros válidos de ozono: 8.389.
- Filas finales después de la unión: 8.389.
- Horas sin ninguna variable meteorológica: 0.

Los valores meteorológicos comprobados no presentan registros fuera de los rangos orientativos establecidos.

### 5.2. Resultados de la preparación de datos de octubre de 2026

Para realizar una evaluación con datos independientes se preparó un segundo conjunto de datos.

Sus características son:

- Estación de ozono: Gandia (46131002).
- Periodo: del 1 al 13 de octubre de 2026.
- Registros horarios de ozono: 312.
- Registros meteorológicos: 312.
- Registros después de la unión: 312.
- Horas sin correspondencia meteorológica: 0.
- Registros con valores ausentes después de la unión: 0.

El conjunto se ha utilizado para evaluar el modelo entrenado con los datos de 2025, sin volver a entrenarlo con los datos de octubre.

### 5.3. Limitaciones identificadas

El archivo meteorológico de Open-Meteo indica que utiliza UTC (GMT, desplazamiento 0).

El archivo de ozono no contiene información explícita sobre su zona horaria.

Por este motivo, actualmente no se realiza ninguna conversión horaria y la unión compara las etiquetas de fecha y hora de ambos archivos.

Será necesario verificar la zona horaria de los datos de ozono antes de considerar definitivamente alineadas las mediciones.

También debe tenerse en cuenta que las coordenadas meteorológicas utilizadas no corresponden exactamente a las de la estación de calidad del aire. Los datos meteorológicos proceden de un punto de la cuadrícula de Open-Meteo y no de una estación meteorológica situada junto a la estación de ozono.

Los datos de contaminación de octubre de 2026 tienen carácter provisional y la evaluación realizada debe considerarse experimental.

## 6. Diseño del modelo de predicción

Se ha desarrollado un modelo de aprendizaje automático para predecir las concentraciones de ozono de las próximas 48 horas.

### 6.1. Datos de entrada

El modelo utiliza las últimas 48 horas de información histórica.

Las variables históricas utilizadas son:

- Concentración de ozono.
- Temperatura.
- Humedad relativa.
- Velocidad del viento.
- Dirección del viento.
- Radiación solar.
- Presión atmosférica.
- Nubosidad.

Además, se incorporan variables de calendario para las 48 horas que se desean predecir:

- Hora del día, representada mediante funciones seno y coseno.
- Día de la semana, representado mediante funciones seno y coseno.

No se utilizan previsiones meteorológicas futuras como entrada del modelo.

### 6.2. Algoritmo seleccionado

Se ha seleccionado HistGradientBoostingRegressor, utilizando MultiOutputRegressor para generar las 48 predicciones horarias.

El entrenamiento final utiliza las 3.575 ventanas históricas válidas disponibles en el conjunto de datos de 2025.

El modelo entrenado se guarda en:

- `src/prevision/modelos/hist_gradient_boosting_ozono_48h.joblib`
- `src/prevision/modelos/hist_gradient_boosting_ozono_48h.json`

### 6.3. Predicción

El resultado es una serie de 48 predicciones horarias consecutivas de concentración de ozono.

El script `src/prevision/predecir_ozono.py` carga el modelo entrenado y utiliza las últimas 48 horas disponibles del conjunto procesado para generar la predicción.

La predicción se guarda en `data/processed/prediccion_ozono_48h_actual.csv`.

También se genera un archivo de estado en `data/processed/estado_prediccion_ozono.json`.

El script comprueba que existen suficientes datos horarios consecutivos y que las observaciones no están desactualizadas. Si no se cumplen estas condiciones, comunica el problema en lugar de generar una predicción basada en datos antiguos.

### 6.4. Entrenamiento y evaluación

Se han realizado comparaciones entre distintos algoritmos y una referencia sencilla (baseline), que repite las últimas 24 horas observadas para estimar las siguientes 48 horas.

La evaluación inicial se realizó mediante separación cronológica de los datos de 2025, evitando solapamientos entre los periodos objetivo de entrenamiento y prueba.

En la comparación final, HistGradientBoosting obtuvo los siguientes resultados:

- MAE: 17,136 µg/m³.
- RMSE: 21,082 µg/m³.

La referencia obtuvo:

- MAE: 18,391 µg/m³.
- RMSE: 24,561 µg/m³.

Esto supone una mejora del 6,82 % en MAE y del 14,16 % en RMSE respecto al baseline.

### 6.5. Evaluación externa con datos de octubre de 2026

Posteriormente, se evaluó el modelo entrenado con datos de 2025 utilizando el conjunto independiente de octubre de 2026.

La evaluación se realizó sin volver a entrenar el modelo con estos datos.

Se utilizaron cinco bloques de 48 horas, con un total de 240 horas evaluadas.

Los resultados obtenidos fueron:

| Métrica | Modelo | Baseline |
|---|---:|---:|
| MAE | 11,824 µg/m³ | 14,967 µg/m³ |
| RMSE | 15,979 µg/m³ | 19,531 µg/m³ |

La mejora del modelo frente al baseline fue:

- MAE: 20,99 %.
- RMSE: 18,19 %.

Estos resultados indican que el modelo obtiene menor error que la referencia sencilla en el periodo evaluado.

No obstante, la evaluación es experimental debido al número limitado de bloques, al carácter provisional de los datos de contaminación y a la zona horaria todavía pendiente de verificar.

Los resultados y la gráfica se guardan en:

- `data/processed/evaluacion_modelo_gandia_2026_10.csv`
- `data/processed/metricas_modelo_gandia_2026_10.json`
- `data/processed/grafica_evaluacion_gandia_2026_10.png`

## 7. Tratamiento de errores

- Los registros con fechas inválidas serán descartados.
- Las concentraciones negativas de ozono se considerarán inválidas.
- Los valores ausentes no se sustituirán automáticamente por mediciones inventadas.
- Los registros duplicados se identificarán y tratarán durante la preparación.
- Los valores meteorológicos fuera de los rangos orientativos se notificarán.
- Los problemas de lectura de archivos y disponibilidad de datos se comunicarán mediante mensajes de error.
- El proceso de predicción comprobará la disponibilidad, continuidad y actualidad de los datos históricos necesarios.

## 8. Pruebas

Se comprobará:

- La carga correcta de los archivos originales.
- La conversión de fechas.
- La detección de duplicados.
- La identificación de valores inválidos.
- La detección de horas ausentes.
- La unión de los conjuntos de datos.
- La validación del periodo mínimo de un año.
- La generación del CSV procesado.
- La generación del informe de calidad.
- El entrenamiento del modelo de predicción.
- La evaluación cronológica y la comparación con el baseline.
- La evaluación externa con datos independientes de octubre de 2026.
- La generación de 48 predicciones horarias consecutivas.
- La detección de datos insuficientes o desactualizados durante la predicción.

## 9. Trabajo pendiente

Quedan pendientes las siguientes tareas:

- Verificar la zona horaria de las mediciones de ozono y confirmar su correspondencia temporal con los datos meteorológicos.
- Ampliar la evaluación con más periodos independientes.
- Integrar el componente de predicción en el servidor mediante una API.
