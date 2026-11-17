"""Evalúa el modelo entrenado con octubre de 2026, sin reentrenarlo.

Usa bloques de evaluación de 48 horas no solapados. Compara el modelo
HistGradientBoosting con una referencia que repite las últimas 24 horas
observadas dos veces.

La unión GVA/Open-Meteo se basa en etiquetas de fecha/hora; la zona horaria
de las marcas GVA aún no está confirmada. Los resultados son experimentales.
"""

from pathlib import Path
import json

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error

ROOT = Path(__file__).resolve().parents[2]
ARCHIVO_DATOS = (
    ROOT / "data" / "processed" / "datos_prevision_gandia_2026_10.csv"
)
ARCHIVO_MODELO = (
    ROOT / "src" / "prevision" / "modelos"
    / "hist_gradient_boosting_ozono_48h.joblib"
)
CARPETA_SALIDA = ROOT / "data" / "processed"

ARCHIVO_RESULTADOS = (
    CARPETA_SALIDA / "evaluacion_modelo_gandia_2026_10.csv"
)
ARCHIVO_METRICAS = (
    CARPETA_SALIDA / "metricas_modelo_gandia_2026_10.json"
)
ARCHIVO_GRAFICA = (
    CARPETA_SALIDA / "grafica_evaluacion_gandia_2026_10.png"
)

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


def variables_calendario(fechas):
    hora = fechas.hour.to_numpy()
    dia_semana = fechas.day_of_week.to_numpy()

    return np.column_stack([
        np.sin(2 * np.pi * hora / 24),
        np.cos(2 * np.pi * hora / 24),
        np.sin(2 * np.pi * dia_semana / 7),
        np.cos(2 * np.pi * dia_semana / 7),
    ]).reshape(-1)


def cargar_datos():
    if not ARCHIVO_DATOS.exists():
        raise FileNotFoundError(f"No existe el conjunto de evaluación: {ARCHIVO_DATOS}")
    if not ARCHIVO_MODELO.exists():
        raise FileNotFoundError(
            f"No existe el modelo entrenado: {ARCHIVO_MODELO}. "
            "Ejecuta entrenar_modelo_final.py antes de evaluar."
        )

    datos = pd.read_csv(ARCHIVO_DATOS, parse_dates=["fecha_hora"])
    faltantes = sorted(set(["fecha_hora", *VARIABLES]) - set(datos.columns))
    if faltantes:
        raise ValueError(f"Faltan columnas en el conjunto de evaluación: {faltantes}")

    datos = datos.sort_values("fecha_hora").drop_duplicates("fecha_hora")
    datos = datos.set_index("fecha_hora")

    for columna in VARIABLES:
        datos[columna] = pd.to_numeric(datos[columna], errors="coerce")

    datos = datos.dropna(subset=VARIABLES)

    if len(datos) < HISTORIAL + HORIZONTE:
        raise ValueError(
            f"Se necesitan al menos {HISTORIAL + HORIZONTE} horas válidas; "
            f"solo hay {len(datos)}."
        )

    diferencias = datos.index.to_series().diff().dropna()
    if not (diferencias == pd.Timedelta(hours=1)).all():
        raise ValueError(
            "El conjunto no es completamente consecutivo hora a hora. "
            "No se evaluará sobre una secuencia con huecos."
        )

    modelo = joblib.load(ARCHIVO_MODELO)
    return datos, modelo


def evaluar(datos, modelo):
    registros = []
    numero_bloque = 0

    # Los primeros 48 registros sirven como historial.
    # Después se evalúan bloques de 48 horas sin solapar objetivos.
    inicio = HISTORIAL
    while inicio + HORIZONTE <= len(datos):
        historial = datos.iloc[inicio - HISTORIAL:inicio]
        objetivo = datos.iloc[inicio:inicio + HORIZONTE]

        entrada_historica = historial[VARIABLES].to_numpy(dtype=float).reshape(-1)
        calendario = variables_calendario(objetivo.index)
        caracteristicas = np.concatenate(
            [entrada_historica, calendario]
        ).reshape(1, -1)

        pred_modelo = np.asarray(modelo.predict(caracteristicas)).reshape(-1)
        if len(pred_modelo) != HORIZONTE:
            raise ValueError(
                f"El modelo devolvió {len(pred_modelo)} valores; "
                f"se esperaban {HORIZONTE}."
            )

        # Baseline: repetir las últimas 24 observaciones dos veces.
        ultimas_24 = historial["O3"].to_numpy(dtype=float)[-24:]
        pred_baseline = np.tile(ultimas_24, 2)
        reales = objetivo["O3"].to_numpy(dtype=float)

        numero_bloque += 1
        for i, fecha in enumerate(objetivo.index):
            registros.append({
                "bloque": numero_bloque,
                "fecha_hora": fecha,
                "O3_real": reales[i],
                "O3_predicho_modelo": float(pred_modelo[i]),
                "O3_predicho_baseline": float(pred_baseline[i]),
            })

        inicio += HORIZONTE

    resultados = pd.DataFrame(registros)
    if resultados.empty:
        raise ValueError("No se han podido construir bloques de evaluación.")

    metricas = {}
    for nombre, columna in [
        ("modelo", "O3_predicho_modelo"),
        ("baseline", "O3_predicho_baseline"),
    ]:
        mae = mean_absolute_error(resultados["O3_real"], resultados[columna])
        rmse = np.sqrt(mean_squared_error(resultados["O3_real"], resultados[columna]))
        metricas[nombre] = {
            "MAE": float(mae),
            "RMSE": float(rmse),
        }

    mejora_mae = (
        (metricas["baseline"]["MAE"] - metricas["modelo"]["MAE"])
        / metricas["baseline"]["MAE"] * 100
        if metricas["baseline"]["MAE"] != 0 else None
    )
    mejora_rmse = (
        (metricas["baseline"]["RMSE"] - metricas["modelo"]["RMSE"])
        / metricas["baseline"]["RMSE"] * 100
        if metricas["baseline"]["RMSE"] != 0 else None
    )

    resumen = {
        "periodo_datos": {
            "inicio": str(datos.index.min()),
            "fin": str(datos.index.max()),
        },
        "periodo_evaluado": {
            "inicio": str(resultados["fecha_hora"].min()),
            "fin": str(resultados["fecha_hora"].max()),
        },
        "filas_disponibles": int(len(datos)),
        "bloques_48h": int(resultados["bloque"].nunique()),
        "horas_evaluadas": int(len(resultados)),
        "metricas": metricas,
        "mejora_porcentual_modelo_frente_baseline": {
            "MAE": float(mejora_mae) if mejora_mae is not None else None,
            "RMSE": float(mejora_rmse) if mejora_rmse is not None else None,
        },
        "advertencias": [
            "Evaluación experimental con octubre de 2026; el modelo no se reentrena.",
            "Los objetivos de los bloques de 48 horas no se solapan.",
            "Las ventanas históricas de entrada sí pueden compartir observaciones.",
            "La zona horaria de las marcas GVA no está confirmada.",
            "La unión con Open-Meteo compara etiquetas de fecha/hora sin conversión.",
            "Los datos GVA son provisionales y pendientes de validación.",
            "Open-Meteo aporta datos modelizados/reanálisis para una coordenada, no una estación física.",
            "El número de bloques es reducido; las métricas no constituyen una validación definitiva.",
        ],
    }
    return resultados, resumen


def guardar(resultados, resumen):
    CARPETA_SALIDA.mkdir(parents=True, exist_ok=True)
    resultados.to_csv(ARCHIVO_RESULTADOS, index=False)
    ARCHIVO_METRICAS.write_text(
        json.dumps(resumen, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    plt.figure(figsize=(13, 5))
    plt.plot(
        resultados["fecha_hora"],
        resultados["O3_real"],
        label="Ozono real",
        linewidth=1.5,
    )
    plt.plot(
        resultados["fecha_hora"],
        resultados["O3_predicho_modelo"],
        label="Modelo IA",
        linewidth=1.2,
    )
    plt.plot(
        resultados["fecha_hora"],
        resultados["O3_predicho_baseline"],
        label="Baseline",
        linewidth=1.0,
        alpha=0.8,
    )
    plt.xlabel("Fecha y hora")
    plt.ylabel("Ozono (µg/m³)")
    plt.title("Evaluación de predicción de ozono - Gandia, octubre de 2026")
    plt.legend()
    plt.grid(True, alpha=0.25)
    plt.tight_layout()
    plt.savefig(ARCHIVO_GRAFICA, dpi=150)
    plt.close()


def main():
    datos, modelo = cargar_datos()
    resultados, resumen = evaluar(datos, modelo)
    guardar(resultados, resumen)

    print("EVALUACIÓN COMPLETADA")
    print("=" * 42)
    print(f"Datos disponibles: {resumen['filas_disponibles']} horas")
    print(f"Bloques de 48 horas: {resumen['bloques_48h']}")
    print(f"Horas evaluadas: {resumen['horas_evaluadas']}")
    print(
        f"Periodo evaluado: {resumen['periodo_evaluado']['inicio']} "
        f"a {resumen['periodo_evaluado']['fin']}"
    )

    for nombre in ("modelo", "baseline"):
        print(
            f"{nombre.upper()}: "
            f"MAE={resumen['metricas'][nombre]['MAE']:.3f} µg/m³ | "
            f"RMSE={resumen['metricas'][nombre]['RMSE']:.3f} µg/m³"
        )

    print(
        "Mejora del modelo frente al baseline: "
        f"MAE={resumen['mejora_porcentual_modelo_frente_baseline']['MAE']:.2f}% | "
        f"RMSE={resumen['mejora_porcentual_modelo_frente_baseline']['RMSE']:.2f}%"
    )
    print("\nArchivos generados:")
    print(ARCHIVO_RESULTADOS)
    print(ARCHIVO_METRICAS)
    print(ARCHIVO_GRAFICA)
    print(
        "\nAVISO: la zona horaria GVA no está confirmada y la evaluación "
        "es experimental, con un número limitado de bloques."
    )


if __name__ == "__main__":
    main()
