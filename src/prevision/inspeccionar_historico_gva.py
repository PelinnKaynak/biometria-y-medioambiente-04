"""Descarga e inspecciona el ZIP mensual de octubre de 2026 de la GVA.

No modifica los CSV históricos ni los datos procesados del proyecto.
Utiliza truststore para validar TLS con el almacén de certificados de Windows.
"""

from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile
from io import BytesIO
import ssl

import pandas as pd
import truststore

ROOT = Path(__file__).resolve().parents[2]
CARPETA_RAW = ROOT / "data" / "raw"
ARCHIVO_ZIP = CARPETA_RAW / "mediciones_gva_2026_10.zip"

URL = (
    "https://dadesobertes.gva.es/dataset/"
    "a6cb2dcf-7c08-42b1-957f-0ec7cdd16ab4/resource/"
    "908d4d4c-363c-4af4-ad3e-c4e873cd8e02/download/"
    "medidas-de-contaminacion-por-horas_csv.zip"
)

CODIGO_ESTACION = "46131002"


def descargar():
    CARPETA_RAW.mkdir(parents=True, exist_ok=True)
    solicitud = Request(
        URL,
        headers={"User-Agent": "AERIS-proyecto-academico/1.0"},
    )
    contexto_ssl = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)

    with urlopen(solicitud, timeout=60, context=contexto_ssl) as respuesta:
        contenido = respuesta.read()

    if not contenido:
        raise ValueError("La Generalitat ha devuelto un ZIP vacío.")

    if not contenido.startswith(b"PK"):
        muestra = contenido[:200].decode("utf-8", errors="replace")
        raise ValueError(
            "La descarga no parece ser un ZIP. Inicio de la respuesta: "
            + muestra
        )

    ARCHIVO_ZIP.write_bytes(contenido)
    print(f"ZIP descargado: {ARCHIVO_ZIP}")
    print(f"Tamaño: {len(contenido):,} bytes")


def cargar_csv_del_zip():
    with ZipFile(ARCHIVO_ZIP) as archivo_zip:
        nombres = [
            nombre for nombre in archivo_zip.namelist()
            if nombre.lower().endswith(".csv")
        ]
        if not nombres:
            raise ValueError(
                "El ZIP no contiene ningún CSV. Contenido: "
                + ", ".join(archivo_zip.namelist())
            )

        print("\nArchivos incluidos en el ZIP:")
        for nombre in nombres:
            print(f"- {nombre}")

        nombre_csv = nombres[0]
        contenido_csv = archivo_zip.read(nombre_csv)

    errores = []
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            datos = pd.read_csv(
                BytesIO(contenido_csv),
                sep=None,
                engine="python",
                encoding=encoding,
                dtype={"cd_estacion": str},
            )
            return datos
        except Exception as error:
            errores.append(f"{encoding}: {error}")

    raise ValueError("No se pudo leer el CSV: " + " | ".join(errores))


def inspeccionar(datos):
    datos.columns = [str(col).strip().lower() for col in datos.columns]

    necesarias = {
        "cd_estacion", "ds_estacion", "fecha", "hora",
        "identificador", "ds_identificador", "unidad", "valor",
    }
    faltan = necesarias.difference(datos.columns)
    if faltan:
        raise ValueError(
            f"Formato inesperado. Columnas: {list(datos.columns)}. "
            f"Faltan: {sorted(faltan)}"
        )

    datos["cd_estacion"] = (
        datos["cd_estacion"].astype(str).str.strip()
        .str.replace(r"\.0$", "", regex=True)
    )
    estacion = datos[datos["cd_estacion"] == CODIGO_ESTACION].copy()

    print(f"\nFilas totales del mes: {len(datos):,}")
    print(f"Filas de Gandia ({CODIGO_ESTACION}): {len(estacion):,}")

    if estacion.empty:
        print("\nNo hay filas de Gandia en este archivo mensual.")
        print("Estaciones encontradas (muestra):")
        print(
            datos[["cd_estacion", "ds_estacion"]]
            .drop_duplicates()
            .head(30)
            .to_string(index=False)
        )
        return

    print("\nEstación:")
    print(estacion["ds_estacion"].dropna().drop_duplicates().to_string(index=False))

    print("\nParámetros disponibles en Gandia:")
    parametros = (
        estacion[["identificador", "ds_identificador", "unidad"]]
        .drop_duplicates()
        .sort_values(["identificador", "ds_identificador"])
    )
    print(parametros.to_string(index=False))

    fecha_hora = pd.to_datetime(
        estacion["fecha"].astype(str).str.strip()
        + " "
        + estacion["hora"].astype(str).str.strip(),
        errors="coerce",
        dayfirst=True,
    )
    print("\nCobertura temporal de Gandia:")
    print(f"Desde: {fecha_hora.min()}")
    print(f"Hasta: {fecha_hora.max()}")
    print(f"Marcas horarias distintas: {fecha_hora.nunique()}")

    print("\nNúmero de mediciones por parámetro:")
    print(
        estacion.groupby("identificador")["valor"]
        .count()
        .sort_values(ascending=False)
        .to_string()
    )

    print(
        "\nNOTA: los datos publicados por la GVA son provisionales "
        "y pendientes de validación. Este script solo descarga e inspecciona."
    )


def main():
    descargar()
    datos = cargar_csv_del_zip()
    inspeccionar(datos)


if __name__ == "__main__":
    main()
