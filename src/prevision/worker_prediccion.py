
"""Proceso persistente de predicción para el servidor Express."""

import json
import sys

from predecir_ozono import cargar_recursos
from servicio_prediccion_api import (
    obtener_historial_simulado,
    generar_respuesta,
    clasificar_nivel,
    ARCHIVO_MODELO,
)

# Cargar recursos una sola vez al iniciar el proceso.
print("Cargando modelo...", file=sys.stderr)
DATOS, MODELO = cargar_recursos()
print("Modelo cargado.", file=sys.stderr)


def predecir():
    # Reutilizar los recursos cargados en memoria.
    historial = obtener_historial_simulado(DATOS)

    from predecir_ozono import generar_prediccion

    resultado, ultima_fecha, antiguedad = generar_prediccion(
        historial, MODELO
    )

    predicciones = [
        {
            "fecha_hora": fila["fecha_hora"].isoformat(),
            "ozono_predicho": round(float(fila["O3_predicho"]), 2),
            "nivel": clasificar_nivel(float(fila["O3_predicho"])),
        }
        for _, fila in resultado.iterrows()
    ]

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
        "advertencia": (
            "Datos históricos desplazados temporalmente para pruebas. "
            "No es una previsión basada en mediciones actuales."
        ),
    }


# Leer una petición JSON por línea y responder con un JSON por línea.
for linea in sys.stdin:
    try:
        peticion = json.loads(linea)

        if peticion.get("accion") != "predecir":
            raise ValueError("Acción no reconocida.")

        respuesta = predecir()
        print(json.dumps(respuesta, ensure_ascii=False), flush=True)

    except Exception as error:
        print(json.dumps({"error": str(error)}), flush=True)
