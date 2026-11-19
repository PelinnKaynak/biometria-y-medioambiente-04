
"""Servicio de predicción de ozono para la API REST de AERIS.

Modo demostración: reutiliza 48 horas del histórico de 2025,
desplaza sus fechas y genera una predicción identificada como simulada.
No modifica los datos históricos ni el modelo entrenado.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from predecir_ozono import (
    VARIABLES,
    ARCHIVO_DATOS,
    ARCHIVO_MODELO,
    cargar_recursos,
    generar_prediccion,
)

HISTORIAL = 48


def obtener_historial_simulado(datos):
    """Obtiene 48 horas consecutivas válidas y simula fechas actuales."""
    datos = datos.sort_index().copy()

    valores = datos[VARIABLES].apply(pd.to_numeric, errors="coerce")
    datos[VARIABLES] = valores
    datos = datos[np.isfinite(valores.to_numpy(dtype=float)).all(axis=1)]

    if len(datos) < HISTORIAL:
        raise ValueError("No hay suficientes registros históricos válidos.")

    # Buscar las últimas 48 observaciones consecutivas.
    historial = None
    for fin in range(len(datos), HISTORIAL - 1, -1):
        candidato = datos.iloc[fin - HISTORIAL:fin]
        diferencias = candidato.index.to_series().diff().dropna()

        if (diferencias == pd.Timedelta(hours=1)).all():
            historial = candidato.copy()
            break

    if historial is None:
        raise ValueError("No se encuentran 48 horas históricas consecutivas.")

    # Desplazar las fechas para que el predictor pueda ejecutarse
    # sin desactivar su comprobación de antigüedad.
    ahora = pd.Timestamp(
        datetime.now().replace(minute=0, second=0, microsecond=0)
    )
    nuevas_fechas = pd.date_range(
        end=ahora,
        periods=HISTORIAL,
        freq="h",
    )
    historial.index = nuevas_fechas

    return historial


def clasificar_nivel(valor):
    """Nivel de ozono en µg/m³, con los mismos límites y nombres que
    NivelOzono.java de la app y el mapa de la web: hasta 100 bueno
    (guía de la OMS), hasta 180 moderado (umbral de información),
    hasta 240 malo (umbral de alerta) y más, muy_malo."""
    if valor <= 100:
        return "bueno"
    if valor <= 180:
        return "moderado"
    if valor <= 240:
        return "malo"
    return "muy_malo"


def generar_respuesta():
    if not ARCHIVO_MODELO.exists():
        raise FileNotFoundError("No se encuentra el modelo entrenado.")

    datos, modelo = cargar_recursos()
    historial = obtener_historial_simulado(datos)

    resultado, ultima_fecha, antiguedad = generar_prediccion(
        historial, modelo
    )

    predicciones = []
    for _, fila in resultado.iterrows():
        valor = float(fila["O3_predicho"])
        predicciones.append({
            "fecha_hora": fila["fecha_hora"].isoformat(),
            "ozono_predicho": round(valor, 2),
            "nivel": clasificar_nivel(valor),
        })

    pico = max(predicciones, key=lambda item: item["ozono_predicho"])

    return {
        "zona": "Gandia",
        "simulados": True,
        "estado": "demostracion",
        "modelo": ARCHIVO_MODELO.name,
        "ultima_observacion_utilizada": ultima_fecha.isoformat(),
        "numero_predicciones": len(predicciones),
        "predicciones": predicciones,
        "hora_pico": pico["fecha_hora"],
        "valor_pico": pico["ozono_predicho"],
        "nivel_pico": pico["nivel"],
        "criterios_nivel": {
            "bueno": "hasta 100",
            "moderado": "más de 100 y hasta 180",
            "malo": "más de 180 y hasta 240",
            "muy_malo": "más de 240",
            "nota": "Mismos niveles que la app (NivelOzono), en µg/m³."
        },
        "advertencia": (
            "Datos históricos desplazados temporalmente para pruebas. "
            "No es una previsión basada en mediciones actuales."
        ),
    }


if __name__ == "__main__":
    try:
        print(json.dumps(generar_respuesta(), ensure_ascii=False))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
