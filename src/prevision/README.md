# Previsión de ozono (IA)

Este componente de AERIS utiliza aprendizaje automático para predecir la concentración de ozono (O3) en la estación de Gandia (46131002) durante las próximas 48 horas.

## Tecnologías

- Python.
- pandas.
- scikit-learn.
- NumPy.
- joblib.
- Matplotlib.

## Fuentes de datos

- Ozono: Red Valenciana de Vigilancia y Control de la Contaminación Atmosférica.
- Meteorología: Open-Meteo Archive.

Los datos meteorológicos corresponden al punto geográfico 38.910366, -0.12313843.

La zona horaria de las mediciones de ozono está pendiente de verificación. Por tanto, la correspondencia horaria entre ambas fuentes debe considerarse experimental.

## Organización

- `preparar_datos.py`: prepara y combina los datos históricos de 2025.
- `descargar_datos_gva.py`: descarga mediciones de la Generalitat Valenciana.
- `inspeccionar_historico_gva.py`: inspecciona los datos históricos descargados.
- `convertir_ozono_gva.py`: extrae y convierte las mediciones de ozono.
- `descargar_meteorologia_openmeteo_2026.py`: descarga datos meteorológicos de Open-Meteo.
- `combinar_datos_gva_openmeteo_2026.py`: combina los datos de octubre de 2026.
- `comparar_modelos_ozono.py` y `comparar_modelos_ozono_v2.py`: comparan distintos algoritmos.
- `entrenar_modelo_final.py`: entrena y guarda el modelo definitivo.
- `evaluar_modelo_gandia_2026.py`: evalúa el modelo con datos independientes de octubre de 2026.
- `predecir_ozono.py`: genera una predicción de las próximas 48 horas.
- `modelos/`: contiene los modelos entrenados y sus metadatos.
- `test/`: carpeta destinada a las pruebas automatizadas del componente.

## Modelo seleccionado

Se utiliza HistGradientBoostingRegressor mediante MultiOutputRegressor.

El modelo recibe las últimas 48 horas de ozono y meteorología, junto con variables de calendario para las 48 horas futuras.

No utiliza previsiones meteorológicas futuras.

El modelo definitivo se almacena en:

- `modelos/hist_gradient_boosting_ozono_48h.joblib`
- `modelos/hist_gradient_boosting_ozono_48h.json`

## Ejecución

Desde la raíz del repositorio:

### Preparar los datos históricos

```powershell
py src/prevision/preparar_datos.py
```

### Entrenar el modelo definitivo

```powershell
py src/prevision/entrenar_modelo_final.py
```

### Evaluar con datos independientes de octubre de 2026

```powershell
py src/prevision/evaluar_modelo_gandia_2026.py
```

### Generar una predicción de 48 horas

```powershell
py src/prevision/predecir_ozono.py
```

La predicción requiere un conjunto de datos reciente y 48 horas consecutivas válidas. Si los datos están desactualizados, el script comunica el problema y no genera una previsión basada en ellos.

## Resultados de evaluación

En la evaluación externa con datos de octubre de 2026 se obtuvieron los siguientes resultados:

| Métrica | HistGradientBoosting | Baseline |
|---|---:|---:|
| MAE | 11,824 µg/m³ | 14,967 µg/m³ |
| RMSE | 15,979 µg/m³ | 19,531 µg/m³ |

La mejora frente al baseline fue del 20,99 % en MAE y del 18,19 % en RMSE.

La evaluación comprende cinco bloques de 48 horas, con 240 horas evaluadas. Sus resultados son experimentales debido al número limitado de bloques y a las limitaciones temporales de los datos.

## Limitaciones y trabajo pendiente

- Verificar la zona horaria de las mediciones de ozono.
- Ampliar la evaluación con otros periodos independientes.
- Incorporar la predicción al servidor mediante una API.
- Añadir y ejecutar pruebas automatizadas del componente.

El diseño detallado se encuentra en `doc/prevision_design.md`.
