"""Utilidades para generar llaves a partir de los terceros lugares.

Lee `ResultadoGrupos.csv`, filtra los equipos en puesto 3, los ordena por
criterios de desempate y muestra los grupos de los cuatro equipos ubicados
más abajo en esa lista.
"""

import csv
from typing import Dict, List

RUTA_RESULTADOS = "ResultadoGrupos.csv"


def _a_entero(valor: str) -> int:
    """Convierte texto a entero, devolviendo 0 ante errores."""

    try:
        return int(valor)
    except (TypeError, ValueError):
        return 0


def cargar_resultados(ruta: str = RUTA_RESULTADOS) -> List[Dict[str, object]]:
    """Carga el archivo final de grupos con columna puesto."""

    datos: List[Dict[str, object]] = []
    with open(ruta, newline="", encoding="utf-8") as archivo:
        lector = csv.DictReader(archivo)
        if lector.fieldnames is None:
            raise ValueError("El archivo no tiene encabezados válidos.")
        for fila in lector:
            registro: Dict[str, object] = {
                "grupo": fila.get("grupo", "").strip().upper(),
                "pais": fila.get("pais", "").strip(),
                "pj": _a_entero(fila.get("pj", "0")),
                "w": _a_entero(fila.get("w", "0")),
                "d": _a_entero(fila.get("d", "0")),
                "l": _a_entero(fila.get("l", "0")),
                "GF": _a_entero(fila.get("GF", "0")),
                "GC": _a_entero(fila.get("GC", "0")),
                "DG": _a_entero(fila.get("DG", "0")),
                "pts": _a_entero(fila.get("pts", "0")),
                "puesto": _a_entero(fila.get("puesto", "0")),
            }
            datos.append(registro)
    return datos


def listar_terceros(datos: List[Dict[str, object]]) -> List[Dict[str, object]]:
    """Devuelve los equipos ubicados en puesto 3 ordenados por desempate."""

    terceros = [fila for fila in datos if fila.get("puesto") == 3]
    return sorted(
        terceros,
        key=lambda fila: (
            -fila["pts"],
            -fila["DG"],
            -fila["GF"],
            fila["pais"],
        ),
    )


def imprimir_terceros(terceros: List[Dict[str, object]]) -> None:
    """Imprime la lista ordenada de terceros lugares."""

    if not terceros:
        print("No se encontraron equipos en puesto 3.")
        return

    print("Equipos en puesto 3 (ordenados por pts, DG, GF):")
    print("grupo,pais,pts,DG,GF")
    for fila in terceros:
        print(f"{fila['grupo']},{fila['pais']},{fila['pts']},{fila['DG']},{fila['GF']}")


def grupos_eliminados(terceros: List[Dict[str, object]]) -> str:
    """Obtiene la cadena con los grupos de los últimos 4 terceros lugares."""

    if not terceros:
        return ""

    ultimos = terceros[-4:]
    grupos_ordenados = "".join(sorted(fila["grupo"] for fila in ultimos))
    print("Grupos de los últimos 4 terceros (ordenados alfabéticamente):")
    for grupo in sorted(fila["grupo"] for fila in ultimos):
        print(grupo)
    print("Cadena:", grupos_ordenados)
    return grupos_ordenados


def main() -> None:
    """Punto de entrada para generar la cadena desde terceros lugares."""

    try:
        resultados = cargar_resultados()
    except FileNotFoundError:
        print(
            "No se encontró el archivo ResultadoGrupos.csv en el directorio actual."
        )
        return
    except ValueError as error:
        print(f"Error al leer el archivo: {error}")
        return

    terceros = listar_terceros(resultados)
    imprimir_terceros(terceros)
    grupos_eliminados(terceros)


if __name__ == "__main__":
    main()
