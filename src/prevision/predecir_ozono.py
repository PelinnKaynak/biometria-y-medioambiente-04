"""Genera una previsión experimental de ozono para las próximas 48 horas.

Carga el modelo HistGradientBoosting ya entrenado y las últimas 48 horas
del CSV procesado. No entrena de nuevo el modelo.

IMPORTANTE:
- El CSV debe contener observaciones recientes y 48 horas consecutivas.
- Por defecto se rechazan datos cuya última observación tenga más de 48 horas.
- La comparación de antigüedad usa fechas sin zona horaria porque la zona
  horaria del CSV de ozono sigue pendiente de verificar. Esta comprobación
  es orientativa hasta resolver esa cuestión.
- El modelo usa meteorología histórica, no previsiones meteorológicas futuras.
"""

from pathlib import Path
import json
from datetime import datetime

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
ARCHIVO_DATOS = ROOT / "data" / "processed" / "datos_prevision_gandia_2025.csv"
ARCHIVO_MODELO = (
    ROOT / "src" / "prevision" / "modelos"
    / "hist_gradient_boosting_ozono_48h.joblib"
)
CARPETA_SALIDA = ROOT / "data" / "processed"

ARCHIVO_PREDICCION = CARPETA_SALIDA / "prediccion_ozono_48h_actual.csv"
ARCHIVO_ESTADO = CARPETA_SALIDA / "estado_prediccion_ozono.json"

HISTORIAL = 48
HORIZONTE = 48
MAX_ANTIGUEDAD_HORAS = 48

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


def cargar_recursos():
    if not ARCHIVO_DATOS.exists():
        raise FileNotFoundError(f"No se encuentra el CSV: {ARCHIVO_DATOS}")
    if not ARCHIVO_MODELO.exists():
        raise FileNotFoundError(
            f"No se encuentra el modelo: {ARCHIVO_MODELO}. "
            "Ejecuta primero entrenar_modelo_final.py."
        )

    datos = pd.read_csv(ARCHIVO_DATOS, parse_dates=["fecha_hora"])
    requeridas = {"fecha_hora", *VARIABLES}
    faltantes = sorted(requeridas.difference(datos.columns))
    if faltantes:
        raise ValueError(f"Faltan columnas en el CSV: {faltantes}")

    datos = datos.sort_values("fecha_hora").drop_duplicates("fecha_hora")
    datos = datos.set_index("fecha_hora")
    modelo = joblib.load(ARCHIVO_MODELO)
    return datos, modelo


def comprobar_ultimas_horas(datos):
    ultimas = datos.tail(HISTORIAL)

    if len(ultimas) != HISTORIAL:
        raise ValueError(
            f"Se necesitan {HISTORIAL} horas; solo hay {len(ultimas)} registros."
        )

    diferencias = ultimas.index.to_series().diff().dropna()
    if not (diferencias == pd.Timedelta(hours=1)).all():
        raise ValueError(
            "Las últimas 48 observaciones no son consecutivas hora a hora. "
            "No se generará una previsión con huecos temporales."
        )

    valores = ultimas[VARIABLES].apply(pd.to_numeric, errors="coerce")
    if not np.isfinite(valores.to_numpy(dtype=float)).all():
        raise ValueError(
            "Hay valores ausentes o no numéricos en las últimas 48 horas. "
            "No se generará una previsión."
        )

    ultima_fecha = ultimas.index[-1]
    ahora = pd.Timestamp(datetime.now().replace(minute=0, second=0, microsecond=0))
    antiguedad = (ahora - ultima_fecha).total_seconds() / 3600

    if antiguedad < -1:
        raise ValueError(
            "La última fecha del CSV está en el futuro respecto al reloj del equipo. "
            "Comprueba las fechas y la zona horaria."
        )
    if antiguedad > MAX_ANTIGUEDAD_HORAS:
        raise ValueError(
            f"Los datos están desactualizados: la última observación es "
            f"{ultima_fecha} (hace aproximadamente {antiguedad:.0f} horas). "
            f"Se admiten como máximo {MAX_ANTIGUEDAD_HORAS} horas. "
            "Actualiza primero los datos de ozono y meteorología."
        )

    return valores, ultima_fecha, antiguedad


def variables_calendario(fechas):
    hora = fechas.hour.to_numpy()
    dia_semana = fechas.day_of_week.to_numpy()
    return np.column_stack([
        np.sin(2 * np.pi * hora / 24),
        np.cos(2 * np.pi * hora / 24),
        np.sin(2 * np.pi * dia_semana / 7),
        np.cos(2 * np.pi * dia_semana / 7),
    ]).reshape(-1)


def generar_prediccion(datos, modelo):
    ultimas, ultima_fecha, antiguedad = comprobar_ultimas_horas(datos)

    fechas_futuras = pd.date_range(
        start=ultima_fecha + pd.Timedelta(hours=1),
        periods=HORIZONTE,
        freq="h",
    )

    entrada_historica = ultimas[VARIABLES].to_numpy(dtype=float).reshape(-1)
    calendario_futuro = variables_calendario(fechas_futuras)
    caracteristicas = np.concatenate(
        [entrada_historica, calendario_futuro]
    ).reshape(1, -1)

    predicciones = modelo.predict(caracteristicas)[0]
    if len(predicciones) != HORIZONTE or not np.isfinite(predicciones).all():
        raise ValueError("El modelo no ha devuelto 48 predicciones válidas.")

    resultado = pd.DataFrame({
        "fecha_hora": fechas_futuras,
        "O3_predicho": predicciones,
    })
    return resultado, ultima_fecha, antiguedad


def main():
    CARPETA_SALIDA.mkdir(parents=True, exist_ok=True)
    datos, modelo = cargar_recursos()
    resultado, ultima_fecha, antiguedad = generar_prediccion(datos, modelo)

    resultado.to_csv(ARCHIVO_PREDICCION, index=False)

    estado = {
        "estado": "generada",
        "ultima_observacion_utilizada": str(ultima_fecha),
        "antiguedad_aproximada_horas": round(antiguedad, 2),
        "inicio_prediccion": str(resultado["fecha_hora"].iloc[0]),
        "fin_prediccion": str(resultado["fecha_hora"].iloc[-1]),
        "numero_predicciones": int(len(resultado)),
        "modelo": ARCHIVO_MODELO.name,
        "advertencias": [
            "La zona horaria de las observaciones de ozono sigue pendiente de verificar.",
            "La comprobación de antigüedad usa fechas sin zona horaria y es orientativa.",
            "El modelo utiliza meteorología histórica, no previsiones meteorológicas futuras.",
        ],
    }
    ARCHIVO_ESTADO.write_text(
        json.dumps(estado, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("Previsión dinámica generada correctamente.")
    print(f"Última observación utilizada: {ultima_fecha}")
    print(f"Primera hora prevista: {resultado['fecha_hora'].iloc[0]}")
    print(f"Última hora prevista: {resultado['fecha_hora'].iloc[-1]}")
    print(f"Número de predicciones: {len(resultado)}")
    print(f"CSV generado: {ARCHIVO_PREDICCION}")
    print(f"Estado: {ARCHIVO_ESTADO}")
    print(
        "AVISO: la zona horaria del ozono no está verificada y no se utilizan "
        "previsiones meteorológicas futuras."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"No se ha podido generar la previsión: {error}")
        raise
