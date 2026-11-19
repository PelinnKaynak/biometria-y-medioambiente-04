"""Descarga y examina las últimas mediciones horarias oficiales de la GVA.

No modifica los CSV históricos ni los datos procesados del proyecto.
Primero permite comprobar los nombres reales de los parámetros de la estación.
"""

from pathlib import Path
from urllib.request import Request, urlopen

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
CARPETA_RAW = ROOT / "data" / "raw"
ARCHIVO_CSV = CARPETA_RAW / "mediciones_gva_ultimos_2000.csv"

URL = (
    "https://dadesobertes.gva.es/dataset/"
    "a6cb2dcf-7c08-42b1-957f-0ec7cdd16ab4/resource/"
    "20e3d8ff-ee72-47fe-95c6-c36a134648a5/download/"
    "medidas-de-contaminacion-por-horas-ultimos-2000-registros.csv"
)

CODIGO_ESTACION = "46131002"


def descargar():
    import ssl
    import truststore

    CARPETA_RAW.mkdir(parents=True, exist_ok=True)

    solicitud = Request(
        URL,
        headers={"User-Agent": "AERIS-proyecto-academico/1.0"},
    )

    contexto_ssl = truststore.SSLContext(
        ssl.PROTOCOL_TLS_CLIENT
    )

    with urlopen(
        solicitud,
        timeout=40,
        context=contexto_ssl
    ) as respuesta:
        contenido = respuesta.read()

    if not contenido:
        raise ValueError("La Generalitat ha devuelto un archivo vacío.")

    ARCHIVO_CSV.write_bytes(contenido)

    print(f"Descarga guardada en: {ARCHIVO_CSV}")
    print(f"Tamaño descargado: {len(contenido):,} bytes")


def leer_csv():
    errores = []
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return pd.read_csv(
                ARCHIVO_CSV,
                sep=None,
                engine="python",
                encoding=encoding,
                dtype={"cd_estacion": str},
            )
        except Exception as error:
            errores.append(f"{encoding}: {error}")
    raise ValueError("No se pudo leer el CSV. " + " | ".join(errores))


def inspeccionar(datos):
    datos.columns = [str(col).strip().lower() for col in datos.columns]

    necesarias = {
        "cd_estacion", "ds_estacion", "fecha", "hora",
        "identificador", "ds_identificador", "unidad", "valor",
    }
    faltan = necesarias.difference(datos.columns)
    if faltan:
        raise ValueError(
            f"El formato descargado no coincide con lo esperado. "
            f"Columnas encontradas: {list(datos.columns)}. "
            f"Faltan: {sorted(faltan)}"
        )

    datos["cd_estacion"] = datos["cd_estacion"].astype(str).str.strip()
    estacion = datos[
        datos["cd_estacion"].str.replace(r"\.0$", "", regex=True)
        == CODIGO_ESTACION
    ].copy()

    print(f"\nFilas totales descargadas: {len(datos)}")
    print(f"Filas de la estación {CODIGO_ESTACION}: {len(estacion)}")

    if estacion.empty:
        print("\nCódigos de estación encontrados (muestra):")
        print(
            datos[["cd_estacion", "ds_estacion"]]
            .drop_duplicates()
            .head(30)
            .to_string(index=False)
        )
        print(
            "\nNo aparece el código configurado. No se crearán datos "
            "procesados ni se modificará el histórico."
        )
        return

    print("\nNombre de estación:")
    print(estacion["ds_estacion"].dropna().drop_duplicates().to_string(index=False))

    print("\nParámetros disponibles en esa estación:")
    parametros = (
        estacion[["identificador", "ds_identificador", "unidad"]]
        .drop_duplicates()
        .sort_values(["identificador", "ds_identificador"])
    )
    print(parametros.to_string(index=False))

    fechas = pd.to_datetime(
        estacion["fecha"].astype(str).str.strip()
        + " "
        + estacion["hora"].astype(str).str.strip(),
        errors="coerce",
        dayfirst=True,
    )
    print("\nRango temporal encontrado:")
    print(f"Desde: {fechas.min()}")
    print(f"Hasta: {fechas.max()}")

    print(
        "\nNOTA: estos datos oficiales son provisionales. "
        "Este script solo descarga e inspecciona; todavía no sustituye "
        "los archivos que usa el modelo."
    )


def main():
    descargar()
    datos = leer_csv()
    inspeccionar(datos)


if __name__ == "__main__":
    main()
