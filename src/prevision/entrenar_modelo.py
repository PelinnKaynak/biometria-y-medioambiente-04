"""Entrena, compara y evalúa un modelo de previsión de ozono a 48 horas.

Se utiliza una separación temporal estricta:
- entrenamiento: objetivos íntegramente anteriores al corte;
- prueba: objetivos que empiezan en el corte o después.
Las últimas 48 horas anteriores a cada objetivo se usan como entrada.

La referencia es una predicción estacional sencilla: repetir las últimas
24 horas observadas para las siguientes 24 horas y volver a repetirlas
para las 24 horas posteriores. Así no se utilizan observaciones futuras.

AVISO: las horas de ozono siguen sin tener zona horaria verificada.
"""

from pathlib import Path
import json

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

ROOT = Path(__file__).resolve().parents[2]
ARCHIVO_DATOS = ROOT / "data" / "processed" / "datos_prevision_gandia_2025.csv"
CARPETA_SALIDA = ROOT / "data" / "processed"
CARPETA_MODELO = ROOT / "src" / "prevision" / "modelos"

HISTORIAL_HORAS = 48
HORIZONTE_HORAS = 48
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
        start=datos.index.min().floor("h"),
        end=datos.index.max().ceil("h"),
        freq="h",
    )
    return datos[VARIABLES].reindex(calendario)


def crear_ventanas(datos, indice_corte):
    """Crea ventanas y separa por fecha de los objetivos, no por filas aleatorias."""
    matriz = datos[VARIABLES].to_numpy(dtype=float)
    fechas = datos.index
    X_train, y_train = [], []
    X_test, y_test, fechas_test = [], [], []

    ultimo_inicio = len(datos) - HISTORIAL_HORAS - HORIZONTE_HORAS
    for inicio in range(ultimo_inicio + 1):
        fin_entrada = inicio + HISTORIAL_HORAS
        fin_objetivo = fin_entrada + HORIZONTE_HORAS

        entrada = matriz[inicio:fin_entrada]
        objetivo = matriz[fin_entrada:fin_objetivo, 0]

        if not np.isfinite(entrada).all() or not np.isfinite(objetivo).all():
            continue

        muestra = entrada.reshape(-1)

        # El objetivo completo debe quedar antes del corte para entrenar.
        if fin_objetivo <= indice_corte:
            X_train.append(muestra)
            y_train.append(objetivo)
        # El primer instante objetivo debe estar en el periodo de prueba.
        elif fin_entrada >= indice_corte:
            X_test.append(muestra)
            y_test.append(objetivo)
            fechas_test.append(fechas[fin_entrada])

    if not X_train or not X_test:
        raise ValueError(
            "No hay suficientes ventanas completas en entrenamiento y prueba. "
            "Comprueba los huecos temporales del conjunto de datos."
        )

    return (
        np.asarray(X_train),
        np.asarray(y_train),
        np.asarray(X_test),
        np.asarray(y_test),
        pd.DatetimeIndex(fechas_test),
    )


def crear_referencia_estacional(X):
    """Repite las últimas 24 mediciones de O3 para cubrir 48 horas."""
    filas = X.reshape(-1, HISTORIAL_HORAS, len(VARIABLES))
    ultimas_24_horas = filas[:, -24:, 0]
    return np.concatenate([ultimas_24_horas, ultimas_24_horas], axis=1)


def calcular_metricas(real, predicho):
    return {
        "MAE": float(mean_absolute_error(real.ravel(), predicho.ravel())),
        "RMSE": float(np.sqrt(mean_squared_error(real.ravel(), predicho.ravel()))),
    }


def main():
    CARPETA_SALIDA.mkdir(parents=True, exist_ok=True)
    CARPETA_MODELO.mkdir(parents=True, exist_ok=True)

    datos = cargar_datos()
    indice_corte = int(len(datos) * FRACCION_ENTRENAMIENTO)

    X_train, y_train, X_test, y_test, fechas_test = crear_ventanas(
        datos, indice_corte
    )

    modelo = RandomForestRegressor(
        n_estimators=200,
        max_features=0.7,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    modelo.fit(X_train, y_train)

    predicciones_modelo = modelo.predict(X_test)
    predicciones_referencia = crear_referencia_estacional(X_test)

    metricas_modelo = calcular_metricas(y_test, predicciones_modelo)
    metricas_referencia = calcular_metricas(y_test, predicciones_referencia)

    comparacion = {
        "modelo": {
            "tipo": "RandomForestRegressor multi-salida",
            **metricas_modelo,
        },
        "referencia": {
            "tipo": "Repetición de las últimas 24 horas observadas",
            **metricas_referencia,
        },
        "mejora_mae_porcentaje": float(
            (metricas_referencia["MAE"] - metricas_modelo["MAE"])
            / metricas_referencia["MAE"] * 100
        ) if metricas_referencia["MAE"] else None,
        "horas_historicas_entrada": HISTORIAL_HORAS,
        "horas_predichas": HORIZONTE_HORAS,
        "ventanas_entrenamiento": int(len(X_train)),
        "ventanas_prueba": int(len(X_test)),
        "inicio_periodo_prueba": str(fechas_test.min()),
        "fin_inicio_objetivos_prueba": str(fechas_test.max()),
        "nota": (
            "Separación cronológica sin solapamiento entre objetivos de "
            "entrenamiento y prueba. La referencia repite las últimas 24 horas "
            "observadas dos veces. Se usan variables meteorológicas históricas, "
            "no previsiones meteorológicas futuras. La zona horaria del ozono "
            "sigue pendiente de verificar."
        ),
    }

    archivo_metricas = CARPETA_SALIDA / "metricas_modelo_ozono.json"
    archivo_metricas.write_text(
        json.dumps(comparacion, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Guardar todas las comparaciones del periodo de prueba.
    registros = []
    for i, fecha_inicio in enumerate(fechas_test):
        for horizonte in range(HORIZONTE_HORAS):
            registros.append({
                "fecha_hora": fecha_inicio + pd.Timedelta(hours=horizonte),
                "O3_real": y_test[i, horizonte],
                "O3_random_forest": predicciones_modelo[i, horizonte],
                "O3_referencia": predicciones_referencia[i, horizonte],
            })

    archivo_comparacion = CARPETA_SALIDA / "comparacion_predicciones_prueba.csv"
    pd.DataFrame(registros).to_csv(archivo_comparacion, index=False)

    # Gráfica de una ventana completa de 48 horas del periodo de prueba.
    # Se escoge la primera ventana de prueba válida.
    grafica = CARPETA_SALIDA / "comparacion_real_vs_predicho.png"
    horas = pd.date_range(
        start=fechas_test[0], periods=HORIZONTE_HORAS, freq="h"
    )
    plt.figure(figsize=(12, 6))
    plt.plot(horas, y_test[0], label="Ozono real", marker="o", markersize=3)
    plt.plot(
        horas,
        predicciones_modelo[0],
        label="Random Forest",
        marker=".",
        markersize=4,
    )
    plt.plot(
        horas,
        predicciones_referencia[0],
        label="Referencia (últimas 24 h)",
        linestyle="--",
    )
    plt.title("Ozono real frente a predicciones: ventana de prueba de 48 horas")
    plt.xlabel("Fecha y hora")
    plt.ylabel("Concentración de ozono (unidad del conjunto original)")
    plt.xticks(rotation=30)
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(grafica, dpi=150)
    plt.close()

    # Guardar el modelo entrenado con los datos anteriores al corte.
    archivo_modelo = CARPETA_MODELO / "random_forest_ozono_48h.joblib"
    joblib.dump(modelo, archivo_modelo)

    # Generar la previsión final si las últimas 48 horas están completas.
    ultima_ventana = datos[VARIABLES].tail(HISTORIAL_HORAS)
    if len(ultima_ventana) == HISTORIAL_HORAS and np.isfinite(
        ultima_ventana.to_numpy(dtype=float)
    ).all():
        prediccion_futura = modelo.predict(
            ultima_ventana.to_numpy(dtype=float).reshape(1, -1)
        )[0]
        fechas_futuras = pd.date_range(
            start=datos.index[-1] + pd.Timedelta(hours=1),
            periods=HORIZONTE_HORAS,
            freq="h",
        )
        pd.DataFrame({
            "fecha_hora": fechas_futuras,
            "O3_predicho": prediccion_futura,
        }).to_csv(CARPETA_SALIDA / "prediccion_ozono_48h.csv", index=False)
    else:
        print(
            "AVISO: no se ha generado la predicción futura porque las últimas "
            "48 horas no están completas."
        )

    print("Entrenamiento y evaluación terminados.")
    print(f"Ventanas de entrenamiento: {len(X_train)}")
    print(f"Ventanas de prueba: {len(X_test)}")
    print(
        f"Random Forest - MAE: {metricas_modelo['MAE']:.3f}; "
        f"RMSE: {metricas_modelo['RMSE']:.3f}"
    )
    print(
        f"Referencia - MAE: {metricas_referencia['MAE']:.3f}; "
        f"RMSE: {metricas_referencia['RMSE']:.3f}"
    )
    if comparacion["mejora_mae_porcentaje"] is not None:
        print(
            "Mejora del MAE frente a la referencia: "
            f"{comparacion['mejora_mae_porcentaje']:.2f}%"
        )
    print(f"Métricas: {archivo_metricas}")
    print(f"Comparación de prueba: {archivo_comparacion}")
    print(f"Gráfica: {grafica}")
    print(f"Modelo: {archivo_modelo}")
    print(
        "AVISO: la zona horaria del ozono sigue pendiente de verificar y "
        "el modelo no utiliza previsiones meteorológicas futuras."
    )


if __name__ == "__main__":
    main()
