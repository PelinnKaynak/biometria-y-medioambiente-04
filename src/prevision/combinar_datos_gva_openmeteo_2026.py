"""Combina ozono GVA y meteorología Open-Meteo para octubre de 2026.

Crea un CSV experimental separado. No modifica los datos de 2025 ni el modelo.
La unión se realiza por etiquetas de fecha/hora sin convertir zona horaria.
La zona horaria de la fecha/hora GVA debe verificarse antes de interpretar
la unión como coincidencia exacta de instantes físicos.
"""

from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"

ARCHIVO_O3 = RAW / "ozono_gandia_2026_10.csv"
ARCHIVO_METEO = RAW / "meteorologia_gandia_2026_10.csv"
SALIDA = PROCESSED / "datos_prevision_gandia_2026_10.csv"
INFORME = PROCESSED / "informe_calidad_gandia_2026_10.txt"

ESTACION_O3 = "46131002"

MAPEO_METEO = {
    "temperature_2m (°C)": "temperatura",
    "relative_humidity_2m (%)": "humedad_relativa",
    "wind_speed_10m (km/h)": "velocidad_viento",
    "wind_direction_10m (°)": "direccion_viento",
    "shortwave_radiation (W/m²)": "radiacion_solar",
    "surface_pressure (hPa)": "presion",
    "cloud_cover (%)": "nubosidad",
}


def cargar_ozono():
    if not ARCHIVO_O3.exists():
        raise FileNotFoundError(f"No existe: {ARCHIVO_O3}")

    datos = pd.read_csv(ARCHIVO_O3, parse_dates=["date"])
    requeridas = {"date", "O3"}
    if not requeridas.issubset(datos.columns):
        raise ValueError(f"El CSV de ozono debe contener {sorted(requeridas)}")

    datos = datos.rename(columns={"date": "fecha_hora"})
    datos["O3"] = pd.to_numeric(datos["O3"], errors="coerce")
    datos = datos.dropna(subset=["fecha_hora", "O3"])
    datos = datos[datos["O3"] >= 0]
    datos = datos.sort_values("fecha_hora")

    duplicados = int(datos["fecha_hora"].duplicated().sum())
    datos = datos.drop_duplicates("fecha_hora", keep="last")
    datos["estacion_ozono"] = ESTACION_O3
    return datos, duplicados


def cargar_meteorologia():
    if not ARCHIVO_METEO.exists():
        raise FileNotFoundError(f"No existe: {ARCHIVO_METEO}")

    datos = pd.read_csv(ARCHIVO_METEO, parse_dates=["time"])
    requeridas = {"time", *MAPEO_METEO.keys()}
    faltan = requeridas.difference(datos.columns)
    if faltan:
        raise ValueError(f"Faltan columnas meteorológicas: {sorted(faltan)}")

    datos = datos.rename(
        columns={"time": "fecha_hora", **MAPEO_METEO}
    )
    for columna in MAPEO_METEO.values():
        datos[columna] = pd.to_numeric(datos[columna], errors="coerce")

    datos = datos.dropna(subset=["fecha_hora"])
    datos = datos.sort_values("fecha_hora")
    duplicados = int(datos["fecha_hora"].duplicated().sum())
    datos = datos.drop_duplicates("fecha_hora", keep="last")
    return datos, duplicados


def main():
    ozono, duplicados_o3 = cargar_ozono()
    meteo, duplicados_meteo = cargar_meteorologia()

    columnas_meteo = ["fecha_hora", *MAPEO_METEO.values()]
    combinado = ozono.merge(
        meteo[columnas_meteo],
        on="fecha_hora",
        how="inner",
        validate="one_to_one",
    )

    columnas_finales = [
        "fecha_hora",
        "O3",
        "estacion_ozono",
        "temperatura",
        "humedad_relativa",
        "velocidad_viento",
        "direccion_viento",
        "radiacion_solar",
        "presion",
        "nubosidad",
    ]
    combinado = combinado[columnas_finales].sort_values("fecha_hora")

    horas_esperadas = pd.date_range(
        start="2026-10-01 00:00:00",
        end="2026-10-13 23:00:00",
        freq="h",
    )
    horas_combinadas = pd.DatetimeIndex(combinado["fecha_hora"])
    horas_faltantes = horas_esperadas.difference(horas_combinadas)
    horas_extra = horas_combinadas.difference(horas_esperadas)

    variables = [
        "O3", "temperatura", "humedad_relativa", "velocidad_viento",
        "direccion_viento", "radiacion_solar", "presion", "nubosidad",
    ]
    valores = combinado[variables]
    filas_con_nulos = int(valores.isna().any(axis=1).sum())

    PROCESSED.mkdir(parents=True, exist_ok=True)
    combinado.to_csv(SALIDA, index=False, date_format="%Y-%m-%d %H:%M:%S")

    lineas = [
        "INFORME DE CALIDAD - GANDIA OCTUBRE 2026",
        "=" * 48,
        f"Filas de ozono válidas: {len(ozono)}",
        f"Duplicados eliminados en ozono: {duplicados_o3}",
        f"Filas meteorológicas: {len(meteo)}",
        f"Duplicados eliminados en meteorología: {duplicados_meteo}",
        f"Filas tras unión por fecha/hora: {len(combinado)}",
        f"Periodo combinado: {combinado['fecha_hora'].min()} a {combinado['fecha_hora'].max()}",
        f"Horas esperadas en el periodo: {len(horas_esperadas)}",
        f"Horas sin coincidencia: {len(horas_faltantes)}",
        f"Horas fuera del periodo esperado: {len(horas_extra)}",
        f"Filas con algún valor nulo: {filas_con_nulos}",
        "",
        "ADVERTENCIAS METODOLÓGICAS:",
        "- Ozono: estación GVA Gandia, código 46131002, unidad original µg/m³.",
        "- Meteorología: Open-Meteo, coordenadas 38.910366, -0.12313843.",
        "- Open-Meteo se solicitó en GMT/UTC.",
        "- La zona horaria de las marcas fecha/hora GVA no está confirmada.",
        "- La unión compara las etiquetas de fecha/hora tal como aparecen, sin conversión.",
        "- No interpretar la coincidencia como simultaneidad confirmada hasta verificar la zona horaria.",
        "- Los datos GVA son provisionales y pendientes de validación.",
        "- Este conjunto experimental no sustituye al histórico de 2025.",
        "",
        f"CSV generado: {SALIDA}",
    ]

    if len(horas_faltantes):
        lineas.append("Primeras horas sin coincidencia:")
        lineas.extend(str(x) for x in horas_faltantes[:20])

    INFORME.write_text("\n".join(lineas), encoding="utf-8")

    print("\n".join(lineas))
    print(f"\nInforme guardado: {INFORME}")


if __name__ == "__main__":
    main()
