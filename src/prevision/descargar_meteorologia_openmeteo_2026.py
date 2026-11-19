"""Descarga meteorología horaria de Open-Meteo para octubre de 2026.

Mantiene el CSV de 2025 intacto y guarda el nuevo periodo en otro archivo.
Las horas se solicitan en GMT/UTC para mantener la convención del CSV
meteorológico histórico del proyecto. La correspondencia horaria con el
ozono de la GVA debe verificarse antes de fusionar ambas fuentes.
"""

from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json
import ssl

import pandas as pd
import truststore

ROOT = Path(__file__).resolve().parents[2]
CARPETA_RAW = ROOT / "data" / "raw"
SALIDA = CARPETA_RAW / "meteorologia_gandia_2026_10.csv"

LATITUD = 38.910366
LONGITUD = -0.12313843
FECHA_INICIO = "2026-10-01"
FECHA_FIN = "2026-10-13"

URL_BASE = "https://archive-api.open-meteo.com/v1/archive"

VARIABLES_API = [
    "temperature_2m",
    "relative_humidity_2m",
    "wind_speed_10m",
    "wind_direction_10m",
    "shortwave_radiation",
    "surface_pressure",
    "cloud_cover",
]

NOMBRES_COLUMNAS = {
    "temperature_2m": "temperature_2m (°C)",
    "relative_humidity_2m": "relative_humidity_2m (%)",
    "wind_speed_10m": "wind_speed_10m (km/h)",
    "wind_direction_10m": "wind_direction_10m (°)",
    "shortwave_radiation": "shortwave_radiation (W/m²)",
    "surface_pressure": "surface_pressure (hPa)",
    "cloud_cover": "cloud_cover (%)",
}


def descargar():
    CARPETA_RAW.mkdir(parents=True, exist_ok=True)

    parametros = {
        "latitude": LATITUD,
        "longitude": LONGITUD,
        "start_date": FECHA_INICIO,
        "end_date": FECHA_FIN,
        "hourly": ",".join(VARIABLES_API),
        "timezone": "GMT",
        "wind_speed_unit": "kmh",
        "temperature_unit": "celsius",
        "timeformat": "iso8601",
    }

    url = f"{URL_BASE}?{urlencode(parametros)}"
    solicitud = Request(
        url,
        headers={"User-Agent": "AERIS-proyecto-academico/1.0"},
    )
    contexto_ssl = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)

    with urlopen(solicitud, timeout=60, context=contexto_ssl) as respuesta:
        datos = json.loads(respuesta.read().decode("utf-8"))

    if datos.get("error"):
        raise RuntimeError(datos.get("reason", "Error devuelto por Open-Meteo."))

    if "hourly" not in datos or "time" not in datos["hourly"]:
        raise ValueError("La respuesta de Open-Meteo no contiene datos horarios.")

    horario = datos["hourly"]
    resultado = pd.DataFrame({"time": horario["time"]})

    for variable in VARIABLES_API:
        if variable not in horario:
            raise ValueError(f"Falta la variable meteorológica: {variable}")
        resultado[NOMBRES_COLUMNAS[variable]] = horario[variable]

    resultado["time"] = pd.to_datetime(resultado["time"], errors="coerce")
    resultado = resultado.dropna(subset=["time"]).sort_values("time")

    if resultado.empty:
        raise ValueError("Open-Meteo no devolvió registros para el periodo solicitado.")

    esperadas = 13 * 24
    if len(resultado) != esperadas:
        print(
            f"AVISO: se esperaban {esperadas} horas para el periodo, "
            f"pero se han recibido {len(resultado)}."
        )

    resultado.to_csv(SALIDA, index=False, date_format="%Y-%m-%dT%H:%M")

    print(f"Archivo generado: {SALIDA}")
    print(f"Registros horarios: {len(resultado)}")
    print(f"Desde: {resultado['time'].min()}")
    print(f"Hasta: {resultado['time'].max()}")
    print(f"Zona horaria solicitada: {datos.get('timezone', 'GMT')}")
    print(f"Coordenadas de Open-Meteo: {datos.get('latitude')}, {datos.get('longitude')}")
    print("Variables incluidas:")
    for columna in resultado.columns[1:]:
        print(f"- {columna}")
    print(
        "\nAVISO: Open-Meteo proporciona datos de reanálisis/modelización "
        "para una celda geográfica, no observaciones de una estación física. "
        "La zona horaria del ozono GVA aún debe verificarse antes de unir."
    )


if __name__ == "__main__":
    descargar()
