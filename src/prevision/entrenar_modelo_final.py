"""Entrena el modelo final experimental HistGradientBoosting para ozono.

Usa ventanas históricas de 48 horas (ozono y meteorología) y variables
conocidas del calendario futuro (hora del día y día de la semana). Predice
simultáneamente las siguientes 48 horas de ozono.

No busca explícitamente el mismo día de la semana ni el mismo día del año
anterior. Aprende patrones a partir de todas las ventanas históricas válidas
del CSV procesado.

AVISOS:
- La zona horaria del ozono sigue pendiente de verificar.
- La meteorología futura no se incorpora; solo se usan sus valores históricos.
- La previsión generada empieza después de la última fecha disponible en el CSV.
"""

from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.multioutput import MultiOutputRegressor

ROOT = Path(__file__).resolve().parents[2]
ARCHIVO_DATOS = ROOT / "data" / "processed" / "datos_prevision_gandia_2025.csv"
CARPETA_SALIDA = ROOT / "data" / "processed"
CARPETA_MODELOS = ROOT / "src" / "prevision" / "modelos"

HISTORIAL = 48
HORIZONTE = 48
VARIABLES = [
    "O3",
    "temperatura",
    "humedad_relativa",
    "velocidad_viento",
    "direccion_viento",
    "radiacion_solar",
    "presion",
    "nubosidad",
]


def cargar_datos():
    if not ARCHIVO_DATOS.exists():
        raise FileNotFoundError(
            f"No existe {ARCHIVO_DATOS}. Ejecuta primero preparar_datos.py."
        )
    df = pd.read_csv(ARCHIVO_DATOS, parse_dates=["fecha_hora"])
    requeridas = {"fecha_hora", *VARIABLES}
    faltantes = sorted(requeridas.difference(df.columns))
    if faltantes:
        raise ValueError(f"Faltan columnas en el CSV: {faltantes}")

    df = df.sort_values("fecha_hora").drop_duplicates("fecha_hora")
    df = df.set_index("fecha_hora")
    calendario = pd.date_range(
        df.index.min().floor("h"), df.index.max().ceil("h"), freq="h"
    )
    return df[VARIABLES].reindex(calendario)


def variables_calendario(fechas):
    hora = fechas.hour.to_numpy()
    dia_semana = fechas.day_of_week.to_numpy()
    return np.column_stack([
        np.sin(2 * np.pi * hora / 24),
        np.cos(2 * np.pi * hora / 24),
        np.sin(2 * np.pi * dia_semana / 7),
        np.cos(2 * np.pi * dia_semana / 7),
    ]).reshape(-1)


def crear_muestras(df):
    matriz = df[VARIABLES].to_numpy(dtype=float)
    fechas = df.index
    X, y = [], []
    ultimo_inicio = len(df) - HISTORIAL - HORIZONTE

    for inicio in range(ultimo_inicio + 1):
        fin_entrada = inicio + HISTORIAL
        fin_objetivo = fin_entrada + HORIZONTE
        entrada = matriz[inicio:fin_entrada]
        objetivo = matriz[fin_entrada:fin_objetivo, 0]

        if not np.isfinite(entrada).all() or not np.isfinite(objetivo).all():
            continue

        fechas_futuras = fechas[fin_entrada:fin_objetivo]
        caracteristicas = np.concatenate([
            entrada.reshape(-1),
            variables_calendario(fechas_futuras),
        ])
        X.append(caracteristicas)
        y.append(objetivo)

    if not X:
        raise ValueError(
            "No hay ventanas completas de 96 horas para entrenar el modelo."
        )
    return np.asarray(X), np.asarray(y)


def main():
    CARPETA_SALIDA.mkdir(parents=True, exist_ok=True)
    CARPETA_MODELOS.mkdir(parents=True, exist_ok=True)

    datos = cargar_datos()
    X, y = crear_muestras(datos)

    modelo = MultiOutputRegressor(
        HistGradientBoostingRegressor(
            max_iter=150,
            learning_rate=0.06,
            max_leaf_nodes=15,
            l2_regularization=1.0,
            random_state=42,
        ),
        n_jobs=-1,
    )
    modelo.fit(X, y)

    archivo_modelo = CARPETA_MODELOS / "hist_gradient_boosting_ozono_48h.joblib"
    joblib.dump(modelo, archivo_modelo)

    ultima_ventana = datos[VARIABLES].tail(HISTORIAL)
    if len(ultima_ventana) != HISTORIAL or not np.isfinite(
        ultima_ventana.to_numpy(dtype=float)
    ).all():
        raise ValueError(
            "Las últimas 48 horas no están completas. No se puede generar "
            "la previsión final sin tratar esos huecos."
        )

    ultima_fecha = datos.index[-1]
    fechas_futuras = pd.date_range(
        start=ultima_fecha + pd.Timedelta(hours=1),
        periods=HORIZONTE,
        freq="h",
    )
    caracteristicas_futuras = np.concatenate([
        ultima_ventana.to_numpy(dtype=float).reshape(-1),
        variables_calendario(fechas_futuras),
    ]).reshape(1, -1)

    predicciones = modelo.predict(caracteristicas_futuras)[0]
    archivo_prediccion = CARPETA_SALIDA / "prediccion_ozono_48h_final.csv"
    pd.DataFrame({
        "fecha_hora": fechas_futuras,
        "O3_predicho": predicciones,
    }).to_csv(archivo_prediccion, index=False)

    metadata = {
        "modelo": "HistGradientBoostingRegressor mediante MultiOutputRegressor",
        "horas_historicas_entrada": HISTORIAL,
        "horas_predichas": HORIZONTE,
        "numero_ventanas_entrenamiento": int(len(X)),
        "variables_historicas": VARIABLES,
        "variables_calendario_futuro": [
            "seno_hora", "coseno_hora",
            "seno_dia_semana", "coseno_dia_semana",
        ],
        "fecha_ultimo_dato_historico": str(ultima_fecha),
        "inicio_prediccion": str(fechas_futuras[0]),
        "fin_prediccion": str(fechas_futuras[-1]),
        "validacion_externa": (
            "En el experimento comparativo v2, HistGradientBoosting obtuvo "
            "MAE 17.136 y RMSE 21.082 frente a la referencia MAE 18.391 "
            "y RMSE 24.561. Este script vuelve a entrenar con todas las "
            "ventanas válidas; no calcula nuevas métricas de prueba."
        ),
        "limitaciones": [
            "La zona horaria de las mediciones de ozono sigue pendiente de verificar.",
            "No se utilizan previsiones meteorológicas futuras.",
            "Los datos meteorológicos corresponden a un punto geográfico distinto de la estación de ozono.",
            "La evaluación disponible procede de un único año de datos.",
        ],
    }
    archivo_metadata = CARPETA_MODELOS / "hist_gradient_boosting_ozono_48h.json"
    archivo_metadata.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("Modelo final experimental entrenado con todas las ventanas válidas.")
    print(f"Ventanas utilizadas: {len(X)}")
    print(f"Modelo guardado: {archivo_modelo}")
    print(f"Información del modelo: {archivo_metadata}")
    print(f"Predicción de 48 horas: {archivo_prediccion}")
    print(
        "AVISO: la predicción empieza después del último dato del CSV; "
        "no representa necesariamente las próximas 48 horas actuales."
    )
    print(
        "AVISO: zona horaria del ozono pendiente de verificar y sin "
        "previsiones meteorológicas futuras."
    )


if __name__ == "__main__":
    main()
