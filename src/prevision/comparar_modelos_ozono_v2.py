"""Comparación mejorada de modelos de ozono a 48 horas.

Mejoras respecto a la versión anterior:
- Evaluación de prueba con orígenes separados 48 horas: los bloques objetivo
  de prueba no se solapan.
- Variables temporales futuras conocidas: hora del día y día de la semana,
  codificados de forma cíclica.
- Variables históricas: últimas 48 horas de ozono y meteorología.
- Comparación de Random Forest, Extra Trees e HistGradientBoosting frente
  a una referencia que repite las últimas 24 horas de ozono.

La selección se realiza por MAE, pero no se declara un modelo validado si no
supera la referencia. La evaluación sigue siendo experimental: solo hay un
año de datos y la zona horaria del ozono está pendiente de confirmar.
"""

from pathlib import Path
import json
import warnings

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import (
    ExtraTreesRegressor,
    HistGradientBoostingRegressor,
    RandomForestRegressor,
)
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.multioutput import MultiOutputRegressor

ROOT = Path(__file__).resolve().parents[2]
ARCHIVO_DATOS = ROOT / "data" / "processed" / "datos_prevision_gandia_2025.csv"
SALIDA = ROOT / "data" / "processed"
CARPETA_MODELOS = ROOT / "src" / "prevision" / "modelos"

HISTORIAL = 48
HORIZONTE = 48
FRACCION_ENTRENAMIENTO = 0.80
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
    faltantes = sorted(({"fecha_hora", *VARIABLES}) - set(df.columns))
    if faltantes:
        raise ValueError(f"Faltan columnas en el CSV: {faltantes}")

    df = df.sort_values("fecha_hora").drop_duplicates("fecha_hora")
    df = df.set_index("fecha_hora")
    calendario = pd.date_range(
        df.index.min().floor("h"), df.index.max().ceil("h"), freq="h"
    )
    return df[VARIABLES].reindex(calendario)


def variables_calendario(fechas):
    """Variables conocidas de calendario para cada una de las 48 horas futuras."""
    hora = fechas.hour.to_numpy()
    dia = fechas.dayofweek.to_numpy()
    return np.column_stack([
        np.sin(2 * np.pi * hora / 24),
        np.cos(2 * np.pi * hora / 24),
        np.sin(2 * np.pi * dia / 7),
        np.cos(2 * np.pi * dia / 7),
    ]).reshape(-1)


def construir_muestra(matriz, fechas, inicio):
    fin_entrada = inicio + HISTORIAL
    fin_objetivo = fin_entrada + HORIZONTE
    entrada = matriz[inicio:fin_entrada]
    objetivo = matriz[fin_entrada:fin_objetivo, 0]

    if not np.isfinite(entrada).all() or not np.isfinite(objetivo).all():
        return None

    fechas_futuras = fechas[fin_entrada:fin_objetivo]
    caracteristicas = np.concatenate([
        entrada.reshape(-1),
        variables_calendario(fechas_futuras),
    ])
    return caracteristicas, objetivo


def crear_conjuntos(df):
    matriz = df[VARIABLES].to_numpy(dtype=float)
    fechas = df.index
    corte = int(len(df) * FRACCION_ENTRENAMIENTO)

    X_train, y_train = [], []
    ultimo_inicio = len(df) - HISTORIAL - HORIZONTE

    # Entrenamiento: ventanas cuyo bloque objetivo termina antes del corte.
    for inicio in range(ultimo_inicio + 1):
        fin_objetivo = inicio + HISTORIAL + HORIZONTE
        if fin_objetivo > corte:
            break
        muestra = construir_muestra(matriz, fechas, inicio)
        if muestra is not None:
            x, y = muestra
            X_train.append(x)
            y_train.append(y)

    # Prueba: origen en el corte y después, avanzando de 48 en 48 horas.
    # Así los bloques objetivo de prueba no comparten horas.
    X_test, y_test, fechas_inicio = [], [], []
    primer_inicio_prueba = max(0, corte - HISTORIAL)
    for inicio in range(
        primer_inicio_prueba,
        ultimo_inicio + 1,
        HORIZONTE,
    ):
        if inicio + HISTORIAL < corte:
            continue
        muestra = construir_muestra(matriz, fechas, inicio)
        if muestra is not None:
            x, y = muestra
            X_test.append(x)
            y_test.append(y)
            fechas_inicio.append(fechas[inicio + HISTORIAL])

    if not X_train or not X_test:
        raise ValueError(
            "No hay suficientes ventanas completas. Comprueba los huecos "
            "temporales o el periodo disponible."
        )

    return (
        np.asarray(X_train), np.asarray(y_train),
        np.asarray(X_test), np.asarray(y_test),
        pd.DatetimeIndex(fechas_inicio), corte,
    )


def prediccion_referencia(X):
    # Las primeras HISTORIAL*variables columnas corresponden a la historia.
    n_variables = len(VARIABLES)
    historia = X[:, :HISTORIAL * n_variables].reshape(
        -1, HISTORIAL, n_variables
    )
    ultimas_24 = historia[:, -24:, 0]
    return np.concatenate([ultimas_24, ultimas_24], axis=1)


def calcular_metricas(real, predicho):
    return {
        "MAE": float(mean_absolute_error(real.ravel(), predicho.ravel())),
        "RMSE": float(np.sqrt(mean_squared_error(real.ravel(), predicho.ravel()))),
    }


def crear_modelos():
    return {
        "Random Forest": RandomForestRegressor(
            n_estimators=250, max_features=0.7, min_samples_leaf=2,
            random_state=42, n_jobs=-1,
        ),
        "Extra Trees": ExtraTreesRegressor(
            n_estimators=250, max_features=0.7, min_samples_leaf=2,
            random_state=42, n_jobs=-1,
        ),
        "HistGradientBoosting": MultiOutputRegressor(
            HistGradientBoostingRegressor(
                max_iter=150, learning_rate=0.06, max_leaf_nodes=15,
                l2_regularization=1.0, random_state=42,
            ),
            n_jobs=-1,
        ),
    }


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    CARPETA_MODELOS.mkdir(parents=True, exist_ok=True)

    df = cargar_datos()
    X_train, y_train, X_test, y_test, fechas_test, corte = crear_conjuntos(df)

    resultados = {}
    predicciones = {}
    modelos = crear_modelos()

    for nombre, modelo in modelos.items():
        print(f"Entrenando {nombre}...")
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            modelo.fit(X_train, y_train)
        pred = modelo.predict(X_test)
        predicciones[nombre] = pred
        resultados[nombre] = calcular_metricas(y_test, pred)

    pred_ref = prediccion_referencia(X_test)
    resultados["Referencia"] = calcular_metricas(y_test, pred_ref)

    ganador = min(modelos, key=lambda n: resultados[n]["MAE"])
    mae_ref = resultados["Referencia"]["MAE"]
    mae_ganador = resultados[ganador]["MAE"]
    mejora = ((mae_ref - mae_ganador) / mae_ref * 100) if mae_ref else None
    supera = mae_ganador < mae_ref

    informe = {
        "experimento": "Comparación con bloques de prueba no solapados y variables temporales",
        "criterio_seleccion": "Menor MAE",
        "mejor_modelo_por_MAE": ganador,
        "supera_referencia_en_MAE": bool(supera),
        "mejora_MAE_porcentaje_vs_referencia": float(mejora) if mejora is not None else None,
        "resultados": resultados,
        "ventanas_entrenamiento": len(X_train),
        "bloques_prueba_no_solapados": len(X_test),
        "horas_historicas": HISTORIAL,
        "horas_predichas": HORIZONTE,
        "inicio_primer_bloque_prueba": str(fechas_test.min()),
        "inicio_ultimo_bloque_prueba": str(fechas_test.max()),
        "variables_adicionales": [
            "Seno y coseno de la hora del día para cada hora futura.",
            "Seno y coseno del día de la semana para cada hora futura.",
        ],
        "limitaciones": [
            "La zona horaria del ozono sigue pendiente de verificar.",
            "Se usan variables meteorológicas históricas, no previsiones meteorológicas futuras.",
            "La meteorología procede de un punto geográfico que no coincide exactamente con la estación de ozono.",
            "La evaluación utiliza bloques de prueba no solapados, pero solo un año de datos.",
        ],
        "estado": (
            "El mejor modelo supera la referencia en MAE."
            if supera else
            "Ningún modelo supera la referencia en MAE; no se valida para uso."
        ),
    }

    (SALIDA / "metricas_comparacion_modelos_v2.json").write_text(
        json.dumps(informe, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    lineas = [
        "INFORME DEL EXPERIMENTO: MODELOS DE OZONO A 48 HORAS",
        "",
        "Cambio metodológico: bloques de prueba separados 48 horas para evitar",
        "que los periodos objetivo de prueba se solapen.",
        "Se añaden variables de calendario conocidas: hora y día de la semana",
        "codificados mediante seno y coseno.",
        "",
        f"Ventanas de entrenamiento: {len(X_train)}",
        f"Bloques de prueba no solapados: {len(X_test)}",
        "",
        "RESULTADOS (menor es mejor)",
    ]
    for nombre, valores in resultados.items():
        lineas.extend([
            "",
            nombre,
            f"MAE: {valores['MAE']:.4f}",
            f"RMSE: {valores['RMSE']:.4f}",
        ])
    lineas.extend([
        "",
        f"Mejor modelo por MAE: {ganador}",
        f"Mejora de MAE frente a referencia: {mejora:.2f}%",
        informe["estado"],
        "",
        "DESCRIPCIÓN",
        "Random Forest: conjunto de árboles de decisión.",
        "Extra Trees: conjunto de árboles con mayor aleatoriedad.",
        "HistGradientBoosting: boosting de árboles, con un estimador por horizonte.",
        "Referencia: repite las últimas 24 horas de ozono dos veces.",
        "",
        "LIMITACIONES",
        *[f"- {x}" for x in informe["limitaciones"]],
        "",
    ])
    (SALIDA / "informe_experimento_modelos_v2.txt").write_text(
        "\n".join(lineas), encoding="utf-8"
    )

    filas = []
    for i, fecha_inicio in enumerate(fechas_test):
        for h in range(HORIZONTE):
            fila = {
                "origen_prediccion": fecha_inicio,
                "fecha_hora_objetivo": fecha_inicio + pd.Timedelta(hours=h),
                "O3_real": y_test[i, h],
                "O3_referencia": pred_ref[i, h],
            }
            for nombre, pred in predicciones.items():
                fila[f"O3_{nombre.replace(' ', '_')}"] = pred[i, h]
            filas.append(fila)
    pd.DataFrame(filas).to_csv(
        SALIDA / "comparacion_modelos_v2.csv", index=False
    )

    plt.figure(figsize=(13, 6))
    horas = pd.date_range(fechas_test[0], periods=HORIZONTE, freq="h")
    plt.plot(horas, y_test[0], label="Ozono real", marker="o", markersize=3)
    plt.plot(horas, pred_ref[0], label="Referencia", linestyle="--")
    for nombre, pred in predicciones.items():
        plt.plot(horas, pred[0], label=nombre)
    plt.title("Ozono real frente a modelos: bloque de prueba de 48 horas")
    plt.xlabel("Fecha y hora")
    plt.ylabel("Concentración de ozono (unidad del conjunto original)")
    plt.xticks(rotation=30)
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(SALIDA / "comparacion_modelos_v2.png", dpi=150)
    plt.close()

    for nombre, modelo in modelos.items():
        slug = nombre.lower().replace(" ", "_")
        joblib.dump(modelo, CARPETA_MODELOS / f"{slug}_ozono_48h_v2.joblib")
    joblib.dump(
        modelos[ganador],
        CARPETA_MODELOS / "mejor_modelo_experimental_ozono_48h_v2.joblib",
    )

    print("\nExperimento terminado.")
    print(f"Ventanas de entrenamiento: {len(X_train)}")
    print(f"Bloques de prueba no solapados: {len(X_test)}")
    for nombre, valores in resultados.items():
        print(f"{nombre}: MAE={valores['MAE']:.3f}; RMSE={valores['RMSE']:.3f}")
    print(f"Mejor modelo por MAE: {ganador}")
    print(f"Mejora frente a referencia: {mejora:.2f}%")
    print(informe["estado"])
    print(f"Informe: {SALIDA / 'informe_experimento_modelos_v2.txt'}")
    print(f"Métricas: {SALIDA / 'metricas_comparacion_modelos_v2.json'}")
    print(f"Gráfica: {SALIDA / 'comparacion_modelos_v2.png'}")
    print(f"CSV: {SALIDA / 'comparacion_modelos_v2.csv'}")


if __name__ == "__main__":
    main()
