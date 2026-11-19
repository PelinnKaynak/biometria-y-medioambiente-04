"""Preparación y control de calidad de datos horarios de ozono y meteorología.

Ozono: Red Valenciana de Vigilancia y Control de la Contaminación Atmosférica,
estación 46131002 (Gandia).
Meteorología: Open-Meteo Archive, punto 38.910366, -0.12313843.

IMPORTANTE SOBRE LAS HORAS:
Open-Meteo indica GMT/UTC (utc_offset_seconds=0) en el CSV descargado.
El CSV de ozono no incluye zona horaria. Por eso este script NO convierte horas:
compara las etiquetas horarias tal como aparecen en ambos archivos. Antes de
usar los datos para entrenar un modelo debe confirmarse la zona horaria de ozono.
"""

from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
ARCHIVO_OZONO = ROOT / "data" / "raw" / "ozono_gandia_2025.csv"
ARCHIVO_METEO = ROOT / "data" / "raw" / "meteorologia_gandia_2025.csv"
CARPETA_SALIDA = ROOT / "data" / "processed"

ARCHIVO_SALIDA = CARPETA_SALIDA / "datos_prevision_gandia_2025.csv"
ARCHIVO_INFORME = CARPETA_SALIDA / "informe_calidad_datos.txt"
ARCHIVO_HORAS_OZONO = CARPETA_SALIDA / "horas_ozono_sin_medicion.csv"
ARCHIVO_HORAS_METEO = CARPETA_SALIDA / "horas_sin_meteorologia.csv"

ESTACION_OZONO = "46131002"
ANIO = 2025

# Límites amplios de plausibilidad. Se notifican, pero no se eliminan automáticamente.
RANGOS_METEO = {
    "temperatura": (-90, 60),
    "humedad_relativa": (0, 100),
    "velocidad_viento": (0, 400),
    "direccion_viento": (0, 360),
    "radiacion_solar": (0, 1500),
    "presion": (800, 1100),
    "nubosidad": (0, 100),
}
def cargar_ozono():
    """Carga y limpia las mediciones de ozono."""
    if not ARCHIVO_OZONO.exists():
        raise FileNotFoundError(f"No se encuentra el archivo de ozono: {ARCHIVO_OZONO}")

    bruto = pd.read_csv(ARCHIVO_OZONO)
    columnas_necesarias = {"date", "O3"}
    if not columnas_necesarias.issubset(bruto.columns):
        raise ValueError("El CSV de ozono debe contener las columnas 'date' y 'O3'.")

    datos = bruto[["date", "O3"]].copy()
    datos["fecha_hora"] = pd.to_datetime(
        datos["date"], format="%Y-%m-%d %H:%M", errors="coerce"
    )
    datos["O3"] = pd.to_numeric(datos["O3"], errors="coerce")

    control = {
        "filas_originales": len(datos),
        "fechas_invalidas": int(datos["fecha_hora"].isna().sum()),
        "duplicados_fecha": int(datos.duplicated("fecha_hora").sum()),
        "ozono_ausente_o_no_numerico": int(datos["O3"].isna().sum()),
        "ozono_negativo": int((datos["O3"] < 0).sum()),
    }

    # Horas del año que no aparecen como fila en el archivo original.
    calendario = pd.date_range(
        f"{ANIO}-01-01 00:00", f"{ANIO}-12-31 23:00", freq="h"
    )
    fechas_validas = pd.DatetimeIndex(datos["fecha_hora"].dropna().unique())
    horas_sin_fila = calendario.difference(fechas_validas)

    datos = datos.dropna(subset=["fecha_hora", "O3"])
    datos = datos[datos["O3"] >= 0]
    datos = datos.drop_duplicates(subset="fecha_hora", keep="first")
    datos = datos[["fecha_hora", "O3"]].copy()
    datos["estacion_ozono"] = ESTACION_OZONO

    return datos, control, horas_sin_fila

def cargar_meteorologia():
    """Carga y valida las variables meteorológicas de Open-Meteo."""
    if not ARCHIVO_METEO.exists():
        raise FileNotFoundError(
            f"No se encuentra el archivo meteorológico: {ARCHIVO_METEO}"
        )

    # La descarga utilizada de Open-Meteo contiene tres líneas antes de la cabecera.
    with open(ARCHIVO_METEO, encoding="utf-8") as archivo:
        metadatos = [next(archivo).strip() for _ in range(2)]

    datos = pd.read_csv(ARCHIVO_METEO, skiprows=3)

    columnas = {
        "time": "fecha_hora",
        "temperature_2m (°C)": "temperatura",
        "relative_humidity_2m (%)": "humedad_relativa",
        "wind_speed_10m (km/h)": "velocidad_viento",
        "wind_direction_10m (°)": "direccion_viento",
        "shortwave_radiation (W/m²)": "radiacion_solar",
        "surface_pressure (hPa)": "presion",
        "cloud_cover (%)": "nubosidad",
    }

    faltantes = [columna for columna in columnas if columna not in datos.columns]
    if faltantes:
        raise ValueError(
            f"Faltan columnas meteorológicas en el CSV: {faltantes}"
        )

    datos = datos.rename(columns=columnas)
    datos["fecha_hora"] = pd.to_datetime(datos["fecha_hora"], errors="coerce")

    variables = [columna for columna in columnas.values() if columna != "fecha_hora"]
    for columna in variables:
        datos[columna] = pd.to_numeric(datos[columna], errors="coerce")

    control = {
        "filas_originales": len(datos),
        "fechas_invalidas": int(datos["fecha_hora"].isna().sum()),
        "duplicados_fecha": int(datos.duplicated("fecha_hora").sum()),
        "metadatos": metadatos,
        "rangos": {},
    }

    for columna, (minimo, maximo) in RANGOS_METEO.items():
        fuera = datos[columna].notna() & ~datos[columna].between(minimo, maximo)
        control["rangos"][columna] = int(fuera.sum())

    datos = datos.dropna(subset=["fecha_hora"])
    datos = datos.drop_duplicates(subset="fecha_hora", keep="first")

    return datos, control
def preparar_datos():
    """Une los datos y genera CSV procesado e informes de calidad."""
    CARPETA_SALIDA.mkdir(parents=True, exist_ok=True)

    ozono, control_o3, horas_sin_fila = cargar_ozono()
    meteo, control_met = cargar_meteorologia()

    datos = ozono.merge(
        meteo,
        on="fecha_hora",
        how="left",
        validate="one_to_one",
    )
    datos = datos.sort_values("fecha_hora").reset_index(drop=True)

    columnas_meteo = list(RANGOS_METEO)
    horas_sin_meteo = datos.loc[
        datos[columnas_meteo].isna().all(axis=1), ["fecha_hora"]
    ]
    ausencias_por_variable = datos[columnas_meteo].isna().sum().to_dict()

    calendario = pd.date_range(
        f"{ANIO}-01-01 00:00", f"{ANIO}-12-31 23:00", freq="h"
    )
    cobertura = {
        "horas_esperadas_2025": len(calendario),
        "horas_con_ozono_valido": len(ozono),
        "horas_ozono_sin_fila": len(horas_sin_fila),
        "horas_sin_ninguna_variable_meteo": len(horas_sin_meteo),
    }

    # Guardar los archivos de salida.
    datos.to_csv(ARCHIVO_SALIDA, index=False)
    pd.DataFrame(
        {"fecha_hora_ausente": horas_sin_fila}
    ).to_csv(ARCHIVO_HORAS_OZONO, index=False)
    horas_sin_meteo.to_csv(ARCHIVO_HORAS_METEO, index=False)

    lineas = [
        "INFORME DE CALIDAD DE DATOS - PREVISIÓN DE OZONO",
        f"Año analizado: {ANIO}",
        "",
        "FUENTES",
        f"Ozono: Red Valenciana, estación {ESTACION_OZONO} (Gandia).",
        "Meteorología: Open-Meteo Archive; coordenadas 38.910366, -0.12313843.",
        "",
        "ZONA HORARIA",
        "Open-Meteo: el archivo indica GMT y utc_offset_seconds=0 (UTC).",
        "Ozono: el CSV no contiene información de zona horaria.",
        "No se ha aplicado conversión horaria. La unión compara las horas tal como aparecen.",
        "La equivalencia de instantes queda pendiente de confirmar con la documentación de la fuente de ozono.",
        "",
        "CONTROL DE OZONO",
    ]
    lineas += [f"{clave}: {valor}" for clave, valor in control_o3.items()]
    lineas += ["", "CONTROL DE METEOROLOGÍA"]
    lineas += [
        f"Filas originales: {control_met['filas_originales']}",
        f"Fechas inválidas: {control_met['fechas_invalidas']}",
        f"Duplicados de fecha: {control_met['duplicados_fecha']}",
    ]
    lineas += [
        f"Valores fuera del rango orientativo en {clave}: {valor}"
        for clave, valor in control_met["rangos"].items()
    ]
    lineas += ["", "COBERTURA Y UNIÓN"]
    lineas += [f"{clave}: {valor}" for clave, valor in cobertura.items()]
    lineas += [f"Filas finales tras la unión: {len(datos)}"]
    lineas += [
        f"Valores ausentes en {clave}: {valor}"
        for clave, valor in ausencias_por_variable.items()
    ]
    lineas += [
        "",
        "TRATAMIENTO",
        "Se eliminan fechas inválidas, O3 ausente/no numérico, O3 negativo y duplicados horarios.",
        "No se rellenan automáticamente los valores ausentes.",
        "Los valores meteorológicos fuera de rangos orientativos se notifican, no se eliminan automáticamente.",
        "La unión es left desde ozono: se conservan las horas con ozono válido.",
        "La zona horaria pendiente impide afirmar todavía que cada pareja horaria represente el mismo instante.",
        "",
    ]

    ARCHIVO_INFORME.write_text("\n".join(lineas), encoding="utf-8")

    print("Preparación terminada correctamente.")
    print(f"CSV procesado: {ARCHIVO_SALIDA}")
    print(f"Informe de calidad: {ARCHIVO_INFORME}")
    print(
        f"Horas de ozono ausentes: {len(horas_sin_fila)} "
        f"(detalle: {ARCHIVO_HORAS_OZONO})"
    )
    print(
        f"Horas sin meteorología: {len(horas_sin_meteo)} "
        f"(detalle: {ARCHIVO_HORAS_METEO})"
    )
    print("AVISO: la zona horaria del ozono sigue pendiente de verificar.")


if __name__ == "__main__":
    preparar_datos()