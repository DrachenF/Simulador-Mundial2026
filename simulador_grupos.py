"""Simulador de fase de grupos para un Mundial 2026.

El programa procesa resultados de partidos por grupo usando archivos CSV
para recalcular estadísticas en la tabla general de grupos.
"""

import csv
import os
from typing import Dict, List

RUTA_RESULTADOS = "ResulatoGrupos.csv"

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


def _imprimir_tabla_grupo(
    grupos: List[Dict[str, object]], nombre_grupo: str
) -> None:
    """Imprime la tabla de un grupo ordenada por criterios de desempate."""

    filtro = [g for g in grupos if g["grupo"] == nombre_grupo]
    if not filtro:
        print(f"No hay equipos cargados para el grupo {nombre_grupo}.")
        return

    ordenados = sorted(
        filtro,
        key=lambda fila: (
            -fila["pts"],
            -fila["DG"],
            -fila["GF"],
            fila["pais"],
        ),
    )

    print(f"Tabla del grupo {nombre_grupo} (ordenada por pts, DG, GF):")
    print("puesto,pais,pj,w,d,l,GF,GC,DG,pts")
    for puesto, equipo in enumerate(ordenados, start=1):
        print(
            f"{puesto},{equipo['pais']},{equipo['pj']},{equipo['w']},{equipo['d']},{equipo['l']},"
            f"{equipo['GF']},{equipo['GC']},{equipo['DG']},{equipo['pts']}"
        )


def _generar_resultado_final(grupos: List[Dict[str, object]]) -> List[Dict[str, object]]:
    """Genera una lista con puesto asignado para cada grupo ordenado."""

    agrupados: Dict[str, List[Dict[str, object]]] = {}
    for equipo in grupos:
        agrupados.setdefault(equipo["grupo"], []).append(equipo)

    resultado: List[Dict[str, object]] = []
    for nombre_grupo in sorted(agrupados.keys()):
        ordenados = sorted(
            agrupados[nombre_grupo],
            key=lambda fila: (
                -fila["pts"],
                -fila["DG"],
                -fila["GF"],
                fila["pais"],
            ),
        )
        for puesto, equipo in enumerate(ordenados, start=1):
            fila = dict(equipo)
            fila["puesto"] = puesto
            resultado.append(fila)
    return resultado


def guardar_resultados_finales(ruta: str, grupos: List[Dict[str, object]]) -> None:
    """Guarda el archivo final con el puesto 1-4 por grupo."""

    columnas = COLUMNAS_GRUPOS + ["puesto"]
    with open(ruta, "w", newline="", encoding="utf-8") as archivo:
        escritor = csv.DictWriter(archivo, fieldnames=columnas)
        escritor.writeheader()
        for registro in grupos:
            fila = {clave: registro.get(clave, "") for clave in columnas}
            escritor.writerow(fila)


def imprimir_resultados_finales(grupos: List[Dict[str, object]]) -> None:
    """Imprime en consola el archivo final con puestos."""

    if not grupos:
        print("No hay datos para generar el archivo final.")
        return

    print("Contenido de ResulatoGrupos.csv:")
    print("grupo,pais,pj,w,d,l,GF,GC,DG,pts,puesto")
    for registro in grupos:
        print(
            f"{registro['grupo']},{registro['pais']},{registro['pj']},{registro['w']},{registro['d']},"
            f"{registro['l']},{registro['GF']},{registro['GC']},{registro['DG']},{registro['pts']},{registro['puesto']}"
        )


def main() -> None:
    """Punto de entrada del programa.

    Carga los grupos y permite actualizar múltiples grupos de manera interactiva
    hasta que el usuario escriba "parar". Tras procesar cada grupo, se muestra
    la tabla ordenada por criterios de desempate.
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

    grupos_disponibles = sorted({registro["grupo"] for registro in datos_grupos})
    if not grupos_disponibles:
        print("No se detectaron grupos para procesar en grupos.csv.")
        return

    while True:
        seleccion = input(
            "¿Qué grupo deseas actualizar (A-L)? Escribe 'parar' para terminar: "
        ).strip()

        if seleccion.lower() == "parar":
            print("Proceso finalizado por el usuario.")
            datos_finales = _generar_resultado_final(cargar_grupos(ruta_grupos))
            guardar_resultados_finales(RUTA_RESULTADOS, datos_finales)
            imprimir_resultados_finales(datos_finales)
            break

        if not seleccion:
            print("No ingresaste un grupo. Intenta de nuevo o escribe 'parar' para salir.")
            continue

        seleccion = seleccion.upper()
        if seleccion not in grupos_disponibles:
            print(
                f"El grupo {seleccion} no está registrado en grupos.csv."
                f" Grupos disponibles: {', '.join(grupos_disponibles)}"
            )
            continue

        datos_grupos = procesar_grupo(seleccion, ruta_grupos)
        _imprimir_tabla_grupo(datos_grupos, seleccion)
        print(f"Actualización completada para el grupo {seleccion}.")


if __name__ == "__main__":
    main()
