"""Utilidades para generar llaves a partir de los terceros lugares.

Flujo principal:
- Lee `ResultadoGrupos.csv` para obtener la clasificación completa de grupos.
- Calcula la cadena de los últimos cuatro terceros lugares.
- Busca en `Combinaciones.csv` la fila cuya columna ``Cadena`` coincida con
  la cadena calculada y almacena esa fila en ``TERCERLUGAR``.
- Construye el archivo ``LLaves16.csv`` con los emparejamientos definidos,
  utilizando las posiciones de cada grupo y la combinación seleccionada para
  identificar qué terceros lugares completan cada llave.
- Muestra en consola los terceros lugares ordenados y el contenido final de
  ``LLaves16.csv``.
"""

import csv
from typing import Dict, List, Tuple

RUTA_RESULTADOS = "ResultadoGrupos.csv"
RUTA_COMBINACIONES = "Combinaciones.csv"
RUTA_LLAVES = "LLaves16.csv"


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


def agrupar_y_ordenar(datos: List[Dict[str, object]]) -> Dict[str, List[Dict[str, object]]]:
    """Agrupa por grupo y devuelve las tablas ordenadas por criterios de desempate."""

    grupos: Dict[str, List[Dict[str, object]]] = {}
    for fila in datos:
        grupo = fila.get("grupo", "").upper()
        grupos.setdefault(grupo, []).append(fila)

    for grupo, equipos in grupos.items():
        equipos.sort(
            key=lambda fila: (
                -fila["pts"],
                -fila["DG"],
                -fila["GF"],
                fila["pais"],
            )
        )
    return grupos


def _obtener_equipo_por_posicion(
    tabla: Dict[str, List[Dict[str, object]]], grupo: str, posicion: int
) -> str:
    """Devuelve el nombre del equipo en la posición solicitada (1-indexada)."""

    equipos = tabla.get(grupo.upper(), [])
    if posicion <= 0 or posicion > len(equipos):
        raise ValueError(f"No hay equipo en la posición {posicion} del grupo {grupo}.")
    return equipos[posicion - 1]["pais"]


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


def cargar_combinaciones(ruta: str = RUTA_COMBINACIONES) -> List[Dict[str, str]]:
    """Lee el archivo de combinaciones y devuelve sus filas como diccionarios."""

    combinaciones: List[Dict[str, str]] = []
    with open(ruta, newline="", encoding="utf-8") as archivo:
        lector = csv.DictReader(archivo)
        if lector.fieldnames is None:
            raise ValueError("El archivo de combinaciones no tiene encabezados válidos.")
        for fila in lector:
            combinaciones.append({clave: valor.strip() for clave, valor in fila.items()})
    return combinaciones


def buscar_combinacion(cadena: str, combinaciones: List[Dict[str, str]]) -> Dict[str, str]:
    """Devuelve la fila cuya columna Cadena coincida con la cadena recibida."""

    for fila in combinaciones:
        if fila.get("Cadena", "") == cadena:
            return fila
    raise ValueError(f"No se encontró una combinación para la cadena '{cadena}'.")


def _equipo_tercero_por_clave(
    tabla: Dict[str, List[Dict[str, object]]], valor: str
) -> str:
    """Obtiene el país que ocupó el tercer lugar del grupo indicado en la clave."""

    if not valor or len(valor) < 2:
        raise ValueError("Valor de combinación inválido para un tercero lugar.")
    grupo = valor[-1].upper()
    return _obtener_equipo_por_posicion(tabla, grupo, 3)


def construir_llaves(
    tabla: Dict[str, List[Dict[str, object]]], combinacion: Dict[str, str]
) -> List[Tuple[int, str, str]]:
    """Genera la lista de llaves con los emparejamientos del formato solicitado."""

    llaves: List[Tuple[int, str, str]] = []

    llaves.append(
        (
            1,
            _obtener_equipo_por_posicion(tabla, "E", 1),
            _equipo_tercero_por_clave(tabla, combinacion.get("1E", "")),
        )
    )
    llaves.append(
        (
            2,
            _obtener_equipo_por_posicion(tabla, "I", 1),
            _equipo_tercero_por_clave(tabla, combinacion.get("1I", "")),
        )
    )
    llaves.append(
        (3, _obtener_equipo_por_posicion(tabla, "A", 2), _obtener_equipo_por_posicion(tabla, "B", 2))
    )
    llaves.append(
        (4, _obtener_equipo_por_posicion(tabla, "F", 1), _obtener_equipo_por_posicion(tabla, "C", 2))
    )
    llaves.append(
        (5, _obtener_equipo_por_posicion(tabla, "K", 2), _obtener_equipo_por_posicion(tabla, "L", 2))
    )
    llaves.append(
        (6, _obtener_equipo_por_posicion(tabla, "H", 1), _obtener_equipo_por_posicion(tabla, "J", 2))
    )
    llaves.append(
        (
            7,
            _obtener_equipo_por_posicion(tabla, "D", 1),
            _equipo_tercero_por_clave(tabla, combinacion.get("1D", "")),
        )
    )
    llaves.append(
        (
            8,
            _obtener_equipo_por_posicion(tabla, "G", 1),
            _equipo_tercero_por_clave(tabla, combinacion.get("1G", "")),
        )
    )
    llaves.append(
        (9, _obtener_equipo_por_posicion(tabla, "C", 1), _obtener_equipo_por_posicion(tabla, "F", 2))
    )
    llaves.append(
        (10, _obtener_equipo_por_posicion(tabla, "E", 2), _obtener_equipo_por_posicion(tabla, "I", 2))
    )
    llaves.append(
        (
            11,
            _obtener_equipo_por_posicion(tabla, "A", 1),
            _equipo_tercero_por_clave(tabla, combinacion.get("1A", "")),
        )
    )
    llaves.append(
        (
            12,
            _obtener_equipo_por_posicion(tabla, "L", 1),
            _equipo_tercero_por_clave(tabla, combinacion.get("1L", "")),
        )
    )
    llaves.append(
        (13, _obtener_equipo_por_posicion(tabla, "J", 1), _obtener_equipo_por_posicion(tabla, "H", 2))
    )
    llaves.append(
        (14, _obtener_equipo_por_posicion(tabla, "D", 2), _obtener_equipo_por_posicion(tabla, "G", 2))
    )
    llaves.append(
        (
            15,
            _obtener_equipo_por_posicion(tabla, "B", 1),
            _equipo_tercero_por_clave(tabla, combinacion.get("1B", "")),
        )
    )
    llaves.append(
        (
            16,
            _obtener_equipo_por_posicion(tabla, "K", 1),
            _equipo_tercero_por_clave(tabla, combinacion.get("1K", "")),
        )
    )
    return llaves


def guardar_llaves(llaves: List[Tuple[int, str, str]], ruta: str = RUTA_LLAVES) -> None:
    """Escribe el archivo LLaves16.csv con el contenido generado."""

    with open(ruta, "w", newline="", encoding="utf-8") as archivo:
        campos = ["llave", "Equipo1", "Equipo2"]
        escritor = csv.DictWriter(archivo, fieldnames=campos)
        escritor.writeheader()
        for llave, equipo1, equipo2 in llaves:
            escritor.writerow({"llave": llave, "Equipo1": equipo1, "Equipo2": equipo2})


def imprimir_llaves(llaves: List[Tuple[int, str, str]]) -> None:
    """Muestra en consola las llaves generadas."""

    print("Contenido de LLaves16.csv:")
    print("llave,Equipo1,Equipo2")
    for llave, equipo1, equipo2 in llaves:
        print(f"{llave},{equipo1},{equipo2}")


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
    cadena = grupos_eliminados(terceros)

    try:
        combinaciones = cargar_combinaciones()
        combinacion_elegida = buscar_combinacion(cadena, combinaciones)
    except FileNotFoundError:
        print("No se encontró el archivo Combinaciones.csv en el directorio actual.")
        return
    except ValueError as error:
        print(f"Error al leer el archivo de combinaciones: {error}")
        return

    TERCERLUGAR: List[Dict[str, str]] = [combinacion_elegida]
    print("Combinación seleccionada para la cadena:", combinacion_elegida)
    tabla = agrupar_y_ordenar(resultados)

    try:
        llaves = construir_llaves(tabla, combinacion_elegida)
    except ValueError as error:
        print(f"Error al construir las llaves: {error}")
        return

    try:
        guardar_llaves(llaves)
    except OSError as error:
        print(f"No se pudo escribir {RUTA_LLAVES}: {error}")
        return

    imprimir_llaves(llaves)

    # Uso explícito de la variable para cumplir con la especificación y evitar advertencias.
    _ = TERCERLUGAR


if __name__ == "__main__":
    main()
