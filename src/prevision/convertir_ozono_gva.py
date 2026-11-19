
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
ZIP = ROOT / "data/raw/mediciones_gva_2026_10.zip"
SALIDA = ROOT / "data/raw/ozono_gandia_2026_10.csv"

ESTACION = "46131002"


def main():
    with ZipFile(ZIP) as archivo:
        csvs = [n for n in archivo.namelist() if n.lower().endswith(".csv")]
        if not csvs:
            raise ValueError("El ZIP no contiene CSV.")

        datos = pd.read_csv(
            BytesIO(archivo.read(csvs[0])),
            sep=None,
            engine="python",
            encoding="latin-1",
            dtype={"cd_estacion": str},
        )

    datos.columns = [c.strip().lower() for c in datos.columns]
    datos["cd_estacion"] = (
        datos["cd_estacion"].astype(str).str.strip()
        .str.replace(r"\.0$", "", regex=True)
    )

    datos = datos[
        (datos["cd_estacion"] == ESTACION)
        & (datos["identificador"].astype(str).str.strip().str.upper() == "O3")
    ].copy()

    if datos.empty:
        raise ValueError("No hay mediciones O3 para Gandia.")

    datos["fecha_hora"] = pd.to_datetime(
        datos["fecha"].astype(str).str.strip()
        + " "
        + datos["hora"].astype(str).str.strip(),
        dayfirst=True,
        errors="coerce",
    )

    datos["O3"] = pd.to_numeric(
        datos["valor"].astype(str).str.replace(",", ".", regex=False),
        errors="coerce",
    )

    datos = datos.dropna(subset=["fecha_hora", "O3"])
    datos = datos[datos["O3"] >= 0]
    datos = datos.sort_values("fecha_hora")
    datos = datos.drop_duplicates("fecha_hora", keep="last")

    resultado = datos[["fecha_hora", "O3"]].rename(
        columns={"fecha_hora": "date"}
    )

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    resultado.to_csv(SALIDA, index=False)

    print(f"Archivo generado: {SALIDA}")
    print(f"Mediciones de ozono: {len(resultado)}")
    print(f"Desde: {resultado['date'].min()}")
    print(f"Hasta: {resultado['date'].max()}")
    print(f"Unidad publicada: {datos['unidad'].dropna().unique().tolist()}")


if __name__ == "__main__":
    main()
