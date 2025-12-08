"""Simulador de fase de grupos para un Mundial 2026.

El programa procesa resultados de partidos por grupo usando archivos CSV
para recalcular estadísticas en la tabla general de grupos.
"""

import csv
import os
from typing import Dict, List

# Campos esperados en el archivo grupos.csv
COLUMNAS_GRUPOS = [
    "grupo",
    "pais",
    "pj",
    "w",
    "d",
    "l",
    "GF",
    "GC",
    "DG",
    "pts",
]


def _a_entero(valor: str) -> int:
    """Convierte un valor de texto a entero con 0 como valor por defecto."""

    try:
        return int(valor)
    except (TypeError, ValueError):
        return 0


def cargar_grupos(ruta_grupos: str) -> List[Dict[str, object]]:
    """Carga el archivo grupos.csv y devuelve una lista de diccionarios.

    Cada fila se convierte en un diccionario con claves según COLUMNAS_GRUPOS.
    Los campos numéricos se transforman a enteros para facilitar cálculos.
    """

    grupos: List[Dict[str, object]] = []
    with open(ruta_grupos, newline="", encoding="utf-8") as archivo:
        lector = csv.DictReader(archivo)
        if lector.fieldnames is None:
            raise ValueError("El archivo de grupos no tiene encabezados válidos.")
        for fila in lector:
            registro: Dict[str, object] = {"grupo": fila.get("grupo", "").strip().upper()}
            registro["pais"] = fila.get("pais", "").strip()
            for campo in COLUMNAS_GRUPOS[2:]:
                registro[campo] = _a_entero(fila.get(campo, "0"))
            grupos.append(registro)
    return grupos


def imprimir_grupos(grupos: List[Dict[str, object]]) -> None:
    """Muestra en consola el contenido cargado de grupos.csv."""

    if not grupos:
        print("No hay información de grupos para mostrar.")
        return

    print("Contenido leído de grupos.csv:")
    print("grupo,pais,pj,w,d,l,GF,GC,DG,pts")
    for registro in sorted(grupos, key=lambda fila: (fila["grupo"], fila["pais"])):
        print(
            f"{registro['grupo']},{registro['pais']},{registro['pj']},{registro['w']},"
            f"{registro['d']},{registro['l']},{registro['GF']},{registro['GC']},"
            f"{registro['DG']},{registro['pts']}"
        )


def guardar_grupos(ruta_grupos: str, datos: List[Dict[str, object]]) -> None:
    """Escribe los datos actualizados en el archivo grupos.csv.

    Se conservan las columnas en el orden definido por COLUMNAS_GRUPOS.
    """

    with open(ruta_grupos, "w", newline="", encoding="utf-8") as archivo:
        escritor = csv.DictWriter(archivo, fieldnames=COLUMNAS_GRUPOS)
        escritor.writeheader()
        for registro in datos:
            fila = {clave: registro.get(clave, "") for clave in COLUMNAS_GRUPOS}
            escritor.writerow(fila)


def _reiniciar_estadisticas(equipo: Dict[str, object]) -> None:
    """Coloca en cero los campos estadísticos de un equipo."""

    for campo in COLUMNAS_GRUPOS[2:]:
        equipo[campo] = 0


def _procesar_partido(equipo1: Dict[str, object], equipo2: Dict[str, object], goles1: int, goles2: int) -> None:
    """Actualiza estadísticas de dos equipos en un partido."""

    equipo1["pj"] += 1
    equipo2["pj"] += 1

    equipo1["GF"] += goles1
    equipo1["GC"] += goles2
    equipo2["GF"] += goles2
    equipo2["GC"] += goles1

    if goles1 > goles2:
        equipo1["w"] += 1
        equipo2["l"] += 1
        equipo1["pts"] += 3
    elif goles2 > goles1:
        equipo2["w"] += 1
        equipo1["l"] += 1
        equipo2["pts"] += 3
    else:
        equipo1["d"] += 1
        equipo2["d"] += 1
        equipo1["pts"] += 1
        equipo2["pts"] += 1


def procesar_grupo(nombre_grupo: str, ruta_grupos: str) -> List[Dict[str, object]]:
    """Procesa un grupo específico usando su archivo de partidos.

    Lee grupos.csv, procesa el archivo de partidos del grupo y vuelve a escribir
    el archivo de grupos con las estadísticas recalculadas.
    """

    grupo_objetivo = nombre_grupo.strip().upper()
    archivo_partidos = f"partidos_{grupo_objetivo}.csv"

    if not os.path.exists(archivo_partidos):
        print(f"No se encontró el archivo de partidos: {archivo_partidos}")
        return cargar_grupos(ruta_grupos)

    grupos = cargar_grupos(ruta_grupos)
    equipos_grupo = [equipo for equipo in grupos if equipo["grupo"] == grupo_objetivo]

    if not equipos_grupo:
        print(f"No hay equipos registrados para el grupo {grupo_objetivo} en {ruta_grupos}.")
        return grupos

    for equipo in equipos_grupo:
        _reiniciar_estadisticas(equipo)

    with open(archivo_partidos, newline="", encoding="utf-8") as archivo:
        lector = csv.DictReader(archivo)
        if lector.fieldnames is None:
            print(f"El archivo {archivo_partidos} no tiene encabezados válidos.")
            return grupos

        mapa_equipos = {equipo["pais"]: equipo for equipo in equipos_grupo}
        for linea, fila in enumerate(lector, start=2):
            equipo1_nombre = fila.get("equipo1", "").strip()
            equipo2_nombre = fila.get("equipo2", "").strip()
            try:
                goles1 = _a_entero(fila.get("goles1", "0"))
                goles2 = _a_entero(fila.get("goles2", "0"))
            except ValueError:
                print(f"Línea {linea}: goles inválidos en {archivo_partidos}")
                continue

            equipo1 = mapa_equipos.get(equipo1_nombre)
            equipo2 = mapa_equipos.get(equipo2_nombre)
            if equipo1 is None or equipo2 is None:
                print(
                    f"Línea {linea}: alguno de los equipos ({equipo1_nombre}, {equipo2_nombre})"
                    " no existe en grupos.csv"
                )
                continue

            _procesar_partido(equipo1, equipo2, goles1, goles2)

    for equipo in equipos_grupo:
        equipo["DG"] = equipo["GF"] - equipo["GC"]

    guardar_grupos(ruta_grupos, grupos)
    return grupos


def _seleccionar_grupos() -> List[str]:
    """Obtiene automáticamente los grupos disponibles en grupos.csv."""

    # El recorrido del archivo de grupos ya se hizo en main, pero dejamos esta
    # función por compatibilidad de firmas y claridad de responsabilidades.
    try:
        datos = cargar_grupos("grupos.csv")
    except FileNotFoundError:
        return []

    grupos_unicos = []
    vistos = set()
    for registro in datos:
        grupo = str(registro.get("grupo", "")).upper()
        if grupo and grupo not in vistos:
            grupos_unicos.append(grupo)
            vistos.add(grupo)

    return grupos_unicos


def main() -> None:
    """Punto de entrada del programa.

    Carga los grupos, detecta automáticamente los grupos a procesar, procesa
    cada uno y finalmente escribe el archivo grupos.csv actualizado.
    """

    ruta_grupos = "grupos.csv"
    try:
        datos_grupos = cargar_grupos(ruta_grupos)
    except FileNotFoundError:
        print("No se encontró el archivo grupos.csv en el directorio actual.")
        return
    except ValueError as error:
        print(f"Error al leer grupos.csv: {error}")
        return

    imprimir_grupos(datos_grupos)

    grupos_a_procesar = _seleccionar_grupos()
    if not grupos_a_procesar:
        print("No se detectaron grupos para procesar en grupos.csv.")
        return

    for grupo in grupos_a_procesar:
        datos_grupos = procesar_grupo(grupo, ruta_grupos)

    # Guardar nuevamente para asegurar que cualquier cambio quede persistido.
    guardar_grupos(ruta_grupos, datos_grupos)
    imprimir_grupos(datos_grupos)
    print("Actualización completada para todos los grupos detectados.")


if __name__ == "__main__":
    main()
