
import pandas as pd
import pytest

import sys
from pathlib import Path

# Permite importar el módulo de previsión.
RUTA_PREVISION = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RUTA_PREVISION))

import preparar_datos as prep


def test_cargar_ozono_limpia_datos(monkeypatch):
    bruto = pd.DataFrame({
        "date": [
            "2025-01-01 00:00",
            "2025-01-01 01:00",
            "2025-01-01 01:00",
            "fecha_invalida",
            "2025-01-01 03:00",
            "2025-01-01 04:00",
        ],
        "O3": [50, 60, 70, 80, None, -5],
    })

    monkeypatch.setattr(pd, "read_csv", lambda *args, **kwargs: bruto)

    datos, control, horas_sin_fila = prep.cargar_ozono()

    assert len(datos) == 2
    assert datos["O3"].tolist() == [50, 60]
    assert datos["estacion_ozono"].eq("46131002").all()
    assert control["fechas_invalidas"] == 1
    assert control["duplicados_fecha"] == 1
    assert control["ozono_ausente_o_no_numerico"] == 1
    assert control["ozono_negativo"] == 1


def test_cargar_ozono_detecta_columnas_ausentes(monkeypatch):
    bruto = pd.DataFrame({"date": ["2025-01-01 00:00"]})

    monkeypatch.setattr(pd, "read_csv", lambda *args, **kwargs: bruto)

    with pytest.raises(ValueError, match="date.*O3"):
        prep.cargar_ozono()


def test_rangos_meteorologicos():
    assert prep.RANGOS_METEO["temperatura"] == (-90, 60)
    assert prep.RANGOS_METEO["humedad_relativa"] == (0, 100)
    assert prep.RANGOS_METEO["velocidad_viento"] == (0, 400)
    assert prep.RANGOS_METEO["radiacion_solar"] == (0, 1500)


def test_cargar_meteorologia_detecta_columnas_ausentes(
    monkeypatch, tmp_path
):
    archivo = tmp_path / "meteorologia.csv"
    archivo.write_text("metadato 1\nmetadato 2\nmetadato 3\ntime\n")

    monkeypatch.setattr(prep, "ARCHIVO_METEO", archivo)

    with pytest.raises(ValueError, match="Faltan columnas"):
        prep.cargar_meteorologia()
