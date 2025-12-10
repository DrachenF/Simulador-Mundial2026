"""Servidor web minimalista para visualizar y editar grupos.

- Lee la información desde ResultadoGrupos.csv (o grupos.csv si no existe).
- Expone endpoints JSON para consultar y actualizar datos de cada grupo.
- Sirve una interfaz estática moderna y minimalista en ``/`` y ``/grupo.html``.

Ejecuta:
    python web_app.py
"""
from __future__ import annotations

import csv
import json
import os
from functools import partial
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Dict, List, Tuple

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
GRUPOS_CSV = BASE_DIR / "grupos.csv"
RESULTADO_CSV = BASE_DIR / "ResultadoGrupos.csv"

CSV_FIELDS = [
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
    "puesto",
]


def _leer_csv_activo() -> Path:
    """Devuelve el archivo de datos a usar, priorizando ResultadoGrupos.csv."""
    return RESULTADO_CSV if RESULTADO_CSV.exists() else GRUPOS_CSV


def _cargar_grupos_desde(ruta: Path) -> Dict[str, List[dict]]:
    """Carga grupos desde una ruta específica."""
    grupos: Dict[str, List[dict]] = {}
    with ruta.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            grupo = row["grupo"].strip()
            # Normalizar valores numéricos; si no están presentes, caer a cero.
            numeric_fields = {k: int(row.get(k, 0) or 0) for k in ["pj", "w", "d", "l", "GF", "GC", "DG", "pts", "puesto"]}
            equipo = {
                "grupo": grupo,
                "pais": row["pais"].strip(),
                **numeric_fields,
            }
            grupos.setdefault(grupo, []).append(equipo)
    return grupos


def cargar_grupos() -> Dict[str, List[dict]]:
    """Carga los grupos desde el CSV activo (ResultadoGrupos o grupos)."""
    ruta = _leer_csv_activo()
    return _cargar_grupos_desde(ruta)


def _ordenar_grupo(equipos: List[dict]) -> List[dict]:
    """Ordena un grupo por puntos, DG, GF y nombre de país."""
    return sorted(
        equipos,
        key=lambda e: (
            -int(e.get("pts", 0)),
            -int(e.get("DG", 0)),
            -int(e.get("GF", 0)),
            e.get("pais", ""),
        ),
    )


def recalcular_grupo(equipos: List[dict], mantener_orden: bool = False) -> List[dict]:
    """Recalcula DG, pts y puesto de un grupo.

    Si ``mantener_orden`` es ``True`` devuelve los equipos en el mismo orden en el
    que llegan, pero asignando el puesto según los criterios de desempate.
    """

    actualizados: List[dict] = []
    for eq in equipos:
        w = int(eq.get("w", 0))
        d = int(eq.get("d", 0))
        l = int(eq.get("l", 0))
        gf = int(eq.get("GF", 0))
        gc = int(eq.get("GC", 0))
        pj = int(eq.get("pj", 0)) or (w + d + l)
        dg = gf - gc
        pts = w * 3 + d
        actualizados.append({
            **eq,
            "pj": pj,
            "w": w,
            "d": d,
            "l": l,
            "GF": gf,
            "GC": gc,
            "DG": dg,
            "pts": pts,
        })

    ranking = _ordenar_grupo(actualizados)
    puestos = {eq["pais"]: idx for idx, eq in enumerate(ranking, start=1)}

    if mantener_orden:
        salida: List[dict] = []
        for eq in equipos:
            calculado = next((e for e in actualizados if e["pais"] == eq["pais"]), eq)
            calculado["puesto"] = puestos.get(calculado["pais"], 0)
            salida.append(calculado)
        return salida

    for eq in ranking:
        eq["puesto"] = puestos.get(eq["pais"], 0)
    return ranking


def _generar_partidos(paises: List[str]) -> List[dict]:
    """Devuelve los 6 partidos distribuidos en tres jornadas según el orden CSV."""

    if len(paises) != 4:
        raise ValueError("Se requieren exactamente 4 equipos para generar el calendario")

    cabeza, segundo, tercero, cuarto = paises
    return [
        {
            "jornada": 1,
            "partidos": [
                (cabeza, segundo),
                (tercero, cuarto),
            ],
        },
        {
            "jornada": 2,
            "partidos": [
                (cabeza, tercero),
                (segundo, cuarto),
            ],
        },
        {
            "jornada": 3,
            "partidos": [
                (cabeza, cuarto),
                (segundo, tercero),
            ],
        },
    ]


def guardar_grupos(grupos: Dict[str, List[dict]]) -> None:
    """Guarda todos los grupos en ResultadoGrupos.csv con los puestos recalculados."""
    # Recalcular y aplanar en orden alfabético de grupo
    todas_filas: List[dict] = []
    for grupo in sorted(grupos):
        filas = recalcular_grupo(grupos[grupo], mantener_orden=True)
        for fila in filas:
            todas_filas.append({campo: fila.get(campo, 0) if campo != "pais" and campo != "grupo" else fila.get(campo, "") for campo in CSV_FIELDS})

    with RESULTADO_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(todas_filas)


def sincronizar_desde_grupos() -> Dict[str, List[dict]]:
    """Copia grupos.csv a ResultadoGrupos.csv recalculando estadísticas y puestos."""

    if not GRUPOS_CSV.exists():
        raise FileNotFoundError("No existe grupos.csv para sincronizar")

    grupos = _cargar_grupos_desde(GRUPOS_CSV)
    guardar_grupos(grupos)
    return grupos


def calcular_desde_partidos(
    grupo_id: str, partidos: List[dict], grupos_actuales: Dict[str, List[dict]]
) -> List[dict]:
    """Calcula estadísticas del grupo a partir de una lista de partidos."""

    equipos = {
        e["pais"]: {
            "grupo": grupo_id,
            "pais": e["pais"],
            "pj": 0,
            "w": 0,
            "d": 0,
            "l": 0,
            "GF": 0,
            "GC": 0,
        }
        for e in grupos_actuales[grupo_id]
    }

    for partido in partidos:
        eq1 = (partido.get("equipo1") or "").strip()
        eq2 = (partido.get("equipo2") or "").strip()
        if eq1 not in equipos or eq2 not in equipos:
            raise ValueError(f"Partido con equipo desconocido: {eq1} vs {eq2}")
        if eq1 == eq2:
            raise ValueError("Un partido no puede enfrentar al mismo equipo")

        g1 = int(partido.get("goles1", 0) or 0)
        g2 = int(partido.get("goles2", 0) or 0)

        equipos[eq1]["pj"] += 1
        equipos[eq2]["pj"] += 1
        equipos[eq1]["GF"] += g1
        equipos[eq1]["GC"] += g2
        equipos[eq2]["GF"] += g2
        equipos[eq2]["GC"] += g1

        if g1 > g2:
            equipos[eq1]["w"] += 1
            equipos[eq2]["l"] += 1
        elif g1 < g2:
            equipos[eq2]["w"] += 1
            equipos[eq1]["l"] += 1
        else:
            equipos[eq1]["d"] += 1
            equipos[eq2]["d"] += 1

    return recalcular_grupo(list(equipos.values()), mantener_orden=True)


class GruposHandler(SimpleHTTPRequestHandler):
    """Manejador HTTP con endpoints API y contenido estático."""

    def do_GET(self):  # noqa: N802 - API http
        if self.path.startswith("/api/groups"):
            return self._handle_api_get()
        if self.path == "/":
            self.path = "/index.html"
        if self.path in {"/grupos.csv", "/ResultadoGrupos.csv"}:
            return self._serve_csv(Path(self.path.lstrip("/")))
        return super().do_GET()

    def do_POST(self):  # noqa: N802 - API http
        if self.path.startswith("/api/groups/"):
            return self._handle_api_post()
        if self.path == "/api/reset":
            return self._handle_reset()
        self.send_error(HTTPStatus.NOT_FOUND, "Ruta no encontrada")

    def _handle_api_get(self):
        grupos = cargar_grupos()
        # Detalle de un grupo: /api/groups/A
        partes = self.path.split("/")
        if len(partes) >= 4 and partes[3]:
            grupo_id = partes[3].upper()
            data = grupos.get(grupo_id)
            if data is None:
                return self._send_json({"error": "Grupo no encontrado"}, status=HTTPStatus.NOT_FOUND)
            data = recalcular_grupo(data, mantener_orden=True)
            partidos = _generar_partidos([e["pais"] for e in data])
            return self._send_json(
                {
                    "grupo": grupo_id,
                    "equipos": data,
                    "gruposDisponibles": sorted(grupos),
                    "partidos": partidos,
                }
            )

        # Listado completo
        payload = {g: recalcular_grupo(eq, mantener_orden=True) for g, eq in grupos.items()}
        return self._send_json({"grupos": payload, "gruposDisponibles": sorted(grupos)})

    def _handle_api_post(self):
        grupo_id = self.path.rsplit("/", 1)[-1].upper()
        longitud = int(self.headers.get("Content-Length", 0))
        cuerpo = self.rfile.read(longitud) if longitud else b""
        try:
            data = json.loads(cuerpo.decode("utf-8"))
        except json.JSONDecodeError:
            return self._send_json({"error": "JSON inválido"}, status=HTTPStatus.BAD_REQUEST)

        grupos = cargar_grupos()
        if grupo_id not in grupos:
            return self._send_json({"error": "Grupo no encontrado"}, status=HTTPStatus.NOT_FOUND)

        partidos = data.get("partidos")
        if partidos is not None:
            if not isinstance(partidos, list):
                return self._send_json({"error": "Formato de partidos inválido"}, status=HTTPStatus.BAD_REQUEST)
            try:
                actualizados = calcular_desde_partidos(grupo_id, partidos, grupos)
            except ValueError as exc:  # errores de validación
                return self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
        else:
            equipos = data.get("equipos")
            if not isinstance(equipos, list):
                return self._send_json({"error": "Formato de equipos inválido"}, status=HTTPStatus.BAD_REQUEST)

            actualizados = []
            paises_validos = {e["pais"] for e in grupos[grupo_id]}
            for entrada in equipos:
                pais = entrada.get("pais", "").strip()
                if pais not in paises_validos:
                    return self._send_json({"error": f"Equipo desconocido: {pais}"}, status=HTTPStatus.BAD_REQUEST)
                actualizados.append(
                    {
                        "grupo": grupo_id,
                        "pais": pais,
                        "pj": int(entrada.get("pj", 0)),
                        "w": int(entrada.get("w", 0)),
                        "d": int(entrada.get("d", 0)),
                        "l": int(entrada.get("l", 0)),
                        "GF": int(entrada.get("GF", 0)),
                        "GC": int(entrada.get("GC", 0)),
                    }
                )

        grupos[grupo_id] = actualizados
        guardar_grupos(grupos)
        return self._send_json({"ok": True, "grupo": grupo_id, "equipos": recalcular_grupo(actualizados)})

    def _handle_reset(self):
        try:
            grupos = sincronizar_desde_grupos()
        except FileNotFoundError as exc:
            return self._send_json({"error": str(exc)}, status=HTTPStatus.NOT_FOUND)
        return self._send_json({"ok": True, "grupos": {g: recalcular_grupo(eq) for g, eq in grupos.items()}})

    def _send_json(self, data, status: HTTPStatus = HTTPStatus.OK):
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _serve_csv(self, path: Path):
        """Sirve un CSV aun cuando no viva en el directorio estático."""

        target = BASE_DIR / path
        if not target.exists():
            self.send_error(HTTPStatus.NOT_FOUND, "CSV no encontrado")
            return

        contenido = target.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Length", str(len(contenido)))
        self.end_headers()
        self.wfile.write(contenido)



def run_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    handler = partial(GruposHandler, directory=str(STATIC_DIR))
    with ThreadingHTTPServer((host, port), handler) as httpd:
        print(f"Servidor iniciado en http://{host}:{port}")
        print("Interfaz principal en / y API en /api/groups")
        httpd.serve_forever()


if __name__ == "__main__":
    run_server()
