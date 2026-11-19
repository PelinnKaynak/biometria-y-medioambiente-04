"""Compara varios modelos para la previsión de ozono a 48 horas.

Todos los modelos usan las mismas ventanas, la misma separación temporal y
las mismas métricas. La referencia repite las últimas 24 horas observadas
para las siguientes 48 horas.

El ganador experimental se elige por menor MAE. Solo se considera que mejora
la referencia si también obtiene un MAE inferior al de esta. Si ninguno la
supera, se documenta que no hay todavía un modelo candidato validado.

AVISOS:
- La zona horaria de las mediciones de ozono sigue pendiente de verificar.
- Se utilizan variables meteorológicas históricas, no previsiones futuras.
- Las ventanas de prueba tienen objetivos solapados; las métricas representan
  el conjunto de predicciones de todos los orígenes de prueba, no 48 horas
  independientes. Se documenta esta limitación en el informe.
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
CARPETA_SALIDA = ROOT / "data" / "processed"
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
    datos = pd.read_csv(ARCHIVO_DATOS, parse_dates=["fecha_hora"])
    requeridas = {"fecha_hora", *VARIABLES}
    faltantes = sorted(requeridas.difference(datos.columns))
    if faltantes:
        raise ValueError(f"Faltan columnas en el CSV procesado: {faltantes}")

    datos = datos.sort_values("fecha_hora").drop_duplicates("fecha_hora")
    datos = datos.set_index("fecha_hora")
    calendario = pd.date_range(
        datos.index.min().floor("h"), datos.index.max().ceil("h"), freq="h"
    )
    return datos[VARIABLES].reindex(calendario)


def crear_ventanas(datos, indice_corte):
    matriz = datos[VARIABLES].to_numpy(dtype=float)
    fechas = datos.index
    X_train, y_train = [], []
    X_test, y_test, fechas_test = [], [], []

    ultimo_inicio = len(datos) - HISTORIAL - HORIZONTE
    for inicio in range(ultimo_inicio + 1):
        fin_entrada = inicio + HISTORIAL
        fin_objetivo = fin_entrada + HORIZONTE
        entrada = matriz[inicio:fin_entrada]
        objetivo = matriz[fin_entrada:fin_objetivo, 0]

        if not np.isfinite(entrada).all() or not np.isfinite(objetivo).all():
            continue

        muestra = entrada.reshape(-1)
        if fin_objetivo <= indice_corte:
            X_train.append(muestra)
            y_train.append(objetivo)
        elif fin_entrada >= indice_corte:
            X_test.append(muestra)
            y_test.append(objetivo)
            fechas_test.append(fechas[fin_entrada])

    if not X_train or not X_test:
        raise ValueError("No hay suficientes ventanas completas para entrenar y probar.")

    return (
        np.asarray(X_train), np.asarray(y_train),
        np.asarray(X_test), np.asarray(y_test),
        pd.DatetimeIndex(fechas_test),
    )


def prediccion_referencia(X):
    # Las últimas 24 horas observadas se repiten para cubrir 48 horas.
    ventanas = X.reshape(-1, HISTORIAL, len(VARIABLES))
    ultimas_24 = ventanas[:, -24:, 0]
    return np.concatenate([ultimas_24, ultimas_24], axis=1)


def metricas(y_real, y_pred):
    return {
        "MAE": float(mean_absolute_error(y_real.ravel(), y_pred.ravel())),
        "RMSE": float(np.sqrt(mean_squared_error(y_real.ravel(), y_pred.ravel()))),
    }


def crear_modelos():
    return {
        "Random Forest": RandomForestRegressor(
            n_estimators=200, max_features=0.7, min_samples_leaf=2,
            random_state=42, n_jobs=-1,
        ),
        "Extra Trees": ExtraTreesRegressor(
            n_estimators=200, max_features=0.7, min_samples_leaf=2,
            random_state=42, n_jobs=-1,
        ),
        "HistGradientBoosting": MultiOutputRegressor(
            HistGradientBoostingRegressor(
                max_iter=120, learning_rate=0.08, max_leaf_nodes=15,
                l2_regularization=1.0, random_state=42,
            ),
            n_jobs=-1,
        ),
    }


def main():
    CARPETA_SALIDA.mkdir(parents=True, exist_ok=True)
    CARPETA_MODELOS.mkdir(parents=True, exist_ok=True)

    datos = cargar_datos()
    corte = int(len(datos) * FRACCION_ENTRENAMIENTO)
    X_train, y_train, X_test, y_test, fechas_test = crear_ventanas(datos, corte)

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
        resultados[nombre] = metricas(y_test, pred)

    pred_ref = prediccion_referencia(X_test)
    resultados["Referencia"] = metricas(y_test, pred_ref)

    # Selección experimental por MAE entre los modelos de IA.
    ganador = min(modelos, key=lambda nombre: resultados[nombre]["MAE"])
    mejora = (
        (resultados["Referencia"]["MAE"] - resultados[ganador]["MAE"])
        / resultados["Referencia"]["MAE"] * 100
        if resultados["Referencia"]["MAE"] else None
    )
    supera_referencia = resultados[ganador]["MAE"] < resultados["Referencia"]["MAE"]

    # Si ningún modelo supera la referencia, no se declara candidato validado.
    estado = (
        "El mejor modelo supera la referencia en MAE."
        if supera_referencia
        else "Ningún modelo supera la referencia en MAE; no se valida un modelo ganador para uso."
    )

    metricas_salida = {
        "criterio_seleccion": "Menor MAE en el conjunto de prueba",
        "modelo_mejor_mae": ganador,
        "supera_referencia_en_MAE": bool(supera_referencia),
        "mejora_MAE_porcentaje_vs_referencia": float(mejora) if mejora is not None else None,
        "resultados": resultados,
        "ventanas_entrenamiento": int(len(X_train)),
        "ventanas_prueba": int(len(X_test)),
        "periodo_objetivos_prueba": {
            "primer_inicio": str(fechas_test.min()),
            "ultimo_inicio": str(fechas_test.max()),
        },
        "horas_historicas": HISTORIAL,
        "horas_predichas": HORIZONTE,
        "nota_evaluacion": (
            "Las ventanas de prueba tienen objetivos solapados. Las métricas "
            "agregan todas las predicciones de todos los orígenes y no representan "
            "48 horas independientes. En una siguiente iteración conviene evaluar "
            "orígenes separados por 48 horas."
        ),
        "limitaciones": [
            "Zona horaria de ozono pendiente de verificar.",
            "Se usan variables meteorológicas históricas, no previsiones futuras.",
            "La meteorología corresponde a un punto geográfico distinto de la estación de ozono.",
        ],
        "estado": estado,
    }

    (CARPETA_SALIDA / "metricas_comparacion_modelos.json").write_text(
        json.dumps(metricas_salida, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Informe legible: deja constancia de cada algoritmo y sus resultados.
    lineas = [
        "INFORME DE COMPARACIÓN DE MODELOS - PREVISIÓN DE OZONO",
        "",
        f"Entrada: últimas {HISTORIAL} horas.",
        f"Horizonte: {HORIZONTE} horas.",
        f"Ventanas de entrenamiento: {len(X_train)}.",
        f"Ventanas de prueba: {len(X_test)}.",
        "",
        "RESULTADOS (menor es mejor)",
    ]
    for nombre, valores in resultados.items():
        lineas += [
            "",
            nombre,
            f"  MAE: {valores['MAE']:.4f}",
            f"  RMSE: {valores['RMSE']:.4f}",
        ]
    lineas += [
        "",
        f"Mejor MAE entre modelos: {ganador}.",
        f"Mejora porcentual de MAE frente a referencia: {mejora:.2f}%.",
        estado,
        "",
        "DESCRIPCIÓN DE LOS MODELOS",
        "Random Forest: conjunto de árboles entrenados sobre muestras aleatorias.",
        "Extra Trees: conjunto de árboles con mayor aleatoriedad en los cortes.",
        "HistGradientBoosting: boosting de árboles; se adapta a salida múltiple mediante un estimador por horizonte.",
        "Referencia: repite las últimas 24 horas observadas para las siguientes 48 horas.",
        "",
        "LIMITACIONES Y PRECAUCIONES",
        "Las ventanas de prueba se solapan en sus objetivos; las métricas agregan predicciones de distintos orígenes.",
        "La zona horaria del ozono sigue pendiente de verificar.",
        "Se utilizan variables meteorológicas históricas, no previsiones meteorológicas futuras.",
        "Las coordenadas meteorológicas no coinciden exactamente con la estación de ozono.",
        "",
    ]
    (CARPETA_SALIDA / "informe_comparacion_modelos.txt").write_text(
        "\n".join(lineas), encoding="utf-8"
    )

    # CSV de resultados agregados por hora de inicio de predicción.
    filas = []
    for i, fecha in enumerate(fechas_test):
        for h in range(HORIZONTE):
            fila = {
                "origen_prediccion": fecha,
                "fecha_hora_objetivo": fecha + pd.Timedelta(hours=h),
                "O3_real": y_test[i, h],
                "O3_referencia": pred_ref[i, h],
            }
            for nombre, pred in predicciones.items():
                fila[f"O3_{nombre.replace(' ', '_')}"] = pred[i, h]
            filas.append(fila)
    pd.DataFrame(filas).to_csv(
        CARPETA_SALIDA / "comparacion_todos_modelos.csv", index=False
    )

    # Gráfica comparativa de una ventana de prueba representativa (primera válida).
    plt.figure(figsize=(12, 6))
    horas = pd.date_range(fechas_test[0], periods=HORIZONTE, freq="h")
    plt.plot(horas, y_test[0], label="Ozono real", marker="o", markersize=3)
    plt.plot(horas, pred_ref[0], label="Referencia", linestyle="--")
    for nombre, pred in predicciones.items():
        plt.plot(horas, pred[0], label=nombre, alpha=0.9)
    plt.title("Ozono real frente a modelos: ventana de prueba de 48 horas")
    plt.xlabel("Fecha y hora")
    plt.ylabel("Concentración de ozono (unidad del conjunto original)")
    plt.xticks(rotation=30)
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(CARPETA_SALIDA / "comparacion_todos_modelos.png", dpi=150)
    plt.close()

    # Guardar todos los modelos para conservar el experimento reproducible.
    for nombre, modelo in modelos.items():
        nombre_archivo = nombre.lower().replace(" ", "_")
        joblib.dump(modelo, CARPETA_MODELOS / f"{nombre_archivo}_ozono_48h.joblib")

    # Guardar el candidato con menor MAE como mejor experimental, sin afirmar
    # que sea apto si no supera la referencia.
    joblib.dump(
        modelos[ganador],
        CARPETA_MODELOS / "mejor_modelo_experimental_ozono_48h.joblib",
    )

    print("\nComparación terminada.")
    for nombre, valores in resultados.items():
        print(f"{nombre}: MAE={valores['MAE']:.3f}; RMSE={valores['RMSE']:.3f}")
    print(f"Mejor MAE: {ganador}")
    print(f"Mejora de MAE frente a referencia: {mejora:.2f}%")
    print(estado)
    print(f"Informe: {CARPETA_SALIDA / 'informe_comparacion_modelos.txt'}")
    print(f"Métricas: {CARPETA_SALIDA / 'metricas_comparacion_modelos.json'}")
    print(f"Gráfica: {CARPETA_SALIDA / 'comparacion_todos_modelos.png'}")
    print(f"CSV: {CARPETA_SALIDA / 'comparacion_todos_modelos.csv'}")


if __name__ == "__main__":
    main()
