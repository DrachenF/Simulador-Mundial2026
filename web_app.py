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
from typing import Dict, List

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


def cargar_grupos() -> Dict[str, List[dict]]:
    """Carga los grupos desde el CSV disponible y devuelve un diccionario por grupo."""
    ruta = _leer_csv_activo()
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


def recalcular_grupo(equipos: List[dict]) -> List[dict]:
    """Recalcula DG, pts y puesto de un grupo y devuelve una nueva lista ordenada."""
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

    ordenados = _ordenar_grupo(actualizados)
    for idx, eq in enumerate(ordenados, start=1):
        eq["puesto"] = idx
    return ordenados


def guardar_grupos(grupos: Dict[str, List[dict]]) -> None:
    """Guarda todos los grupos en ResultadoGrupos.csv con los puestos recalculados."""
    # Recalcular y aplanar en orden alfabético de grupo
    todas_filas: List[dict] = []
    for grupo in sorted(grupos):
        filas = recalcular_grupo(grupos[grupo])
        for fila in filas:
            todas_filas.append({campo: fila.get(campo, 0) if campo != "pais" and campo != "grupo" else fila.get(campo, "") for campo in CSV_FIELDS})

    with RESULTADO_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(todas_filas)


class GruposHandler(SimpleHTTPRequestHandler):
    """Manejador HTTP con endpoints API y contenido estático."""

    def do_GET(self):  # noqa: N802 - API http
        if self.path.startswith("/api/groups"):
            return self._handle_api_get()
        if self.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):  # noqa: N802 - API http
        if self.path.startswith("/api/groups/"):
            return self._handle_api_post()
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
            data = recalcular_grupo(data)
            return self._send_json({"grupo": grupo_id, "equipos": data, "gruposDisponibles": sorted(grupos)})

        # Listado completo
        payload = {g: recalcular_grupo(eq) for g, eq in grupos.items()}
        return self._send_json({"grupos": payload, "gruposDisponibles": sorted(grupos)})

    def _handle_api_post(self):
        grupo_id = self.path.rsplit("/", 1)[-1].upper()
        longitud = int(self.headers.get("Content-Length", 0))
        cuerpo = self.rfile.read(longitud) if longitud else b""
        try:
            data = json.loads(cuerpo.decode("utf-8"))
        except json.JSONDecodeError:
            return self._send_json({"error": "JSON inválido"}, status=HTTPStatus.BAD_REQUEST)

        equipos = data.get("equipos")
        if not isinstance(equipos, list):
            return self._send_json({"error": "Formato de equipos inválido"}, status=HTTPStatus.BAD_REQUEST)

        grupos = cargar_grupos()
        if grupo_id not in grupos:
            return self._send_json({"error": "Grupo no encontrado"}, status=HTTPStatus.NOT_FOUND)

        # Mantener cuatro equipos, emparejando por nombre de país.
        actualizados: List[dict] = []
        paises_validos = {e["pais"] for e in grupos[grupo_id]}
        for entrada in equipos:
            pais = entrada.get("pais", "").strip()
            if pais not in paises_validos:
                return self._send_json({"error": f"Equipo desconocido: {pais}"}, status=HTTPStatus.BAD_REQUEST)
            actualizados.append({
                "grupo": grupo_id,
                "pais": pais,
                "pj": int(entrada.get("pj", 0)),
                "w": int(entrada.get("w", 0)),
                "d": int(entrada.get("d", 0)),
                "l": int(entrada.get("l", 0)),
                "GF": int(entrada.get("GF", 0)),
                "GC": int(entrada.get("GC", 0)),
            })

        grupos[grupo_id] = actualizados
        guardar_grupos(grupos)
        return self._send_json({"ok": True, "grupo": grupo_id, "equipos": recalcular_grupo(actualizados)})

    def _send_json(self, data, status: HTTPStatus = HTTPStatus.OK):
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)



def run_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    handler = partial(GruposHandler, directory=str(STATIC_DIR))
    with ThreadingHTTPServer((host, port), handler) as httpd:
        print(f"Servidor iniciado en http://{host}:{port}")
        print("Interfaz principal en / y API en /api/groups")
        httpd.serve_forever()


if __name__ == "__main__":
    run_server()
