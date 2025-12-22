#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME_DEFAULT="mundial2026_android"
APP_NAME="Mundial 2026"
APP_ID="com.drachenf.mundial2026"
WEB_DIR="www"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="${BASE_DIR:-$SCRIPT_DIR}"

if [[ "$(basename "$SCRIPT_DIR")" == "$PROJECT_NAME_DEFAULT" ]]; then
  PROJECT_DIR_DEFAULT="$SCRIPT_DIR"
else
  PROJECT_DIR_DEFAULT="$BASE_DIR/$PROJECT_NAME_DEFAULT"
fi

PROJECT_DIR="${PROJECT_DIR:-$PROJECT_DIR_DEFAULT}"

INDEX_SRC="${INDEX_SRC:-$SCRIPT_DIR/../static/index.html}"
GRUPOS_SRC="${GRUPOS_SRC:-$SCRIPT_DIR/../grupos.csv}"
COMBINACIONES_SRC="${COMBINACIONES_SRC:-$SCRIPT_DIR/../Combinaciones.csv}"

pick_project_dir() {
  local target="$1"
  if [[ -d "$target" ]]; then
    if [[ "$target" == "$SCRIPT_DIR" ]]; then
      echo "$target"
      return
    fi
    local i=2
    while [[ -d "${target}_${i}" ]]; do
      i=$((i+1))
    done
    echo "${target}_${i}"
    return
  fi
  echo "$target"
}

PROJECT_DIR="$(pick_project_dir "$PROJECT_DIR")"

mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

if [[ ! -f package.json ]]; then
  npm init -y
fi

npm install @capacitor/core @capacitor/cli @capacitor/android

npx cap init "$APP_NAME" "$APP_ID" --web-dir "$WEB_DIR"

mkdir -p "$WEB_DIR"

cp "$INDEX_SRC" "$WEB_DIR/index.html"
cp "$GRUPOS_SRC" "$WEB_DIR/grupos.csv"
cp "$COMBINACIONES_SRC" "$WEB_DIR/Combinaciones.csv"

python <<'PY'
import re
from pathlib import Path

index_path = Path("www/index.html")
content = index_path.read_text(encoding="utf-8")

pattern = re.compile(r"fetch\(\s*(['"])\/([^'\"]+)\1\s*\)")

changes = []

def repl(match):
    before = match.group(0)
    path = match.group(2)
    after = f"fetch('{path}')"
    changes.append((before, after))
    return after

new_content = pattern.sub(repl, content)

if new_content != content:
    index_path.write_text(new_content, encoding="utf-8")

print("[Validación de rutas] Cambios realizados:")
if changes:
    for before, after in changes:
        print(f"- {before} -> {after}")
else:
    print("- No se encontraron fetch() con rutas absolutas.")

cdn_hits = re.findall(r"https?://[^'\"\s>]+", new_content)
if cdn_hits:
    print("[Aviso] Se detectaron referencias externas (no offline):")
    for hit in sorted(set(cdn_hits)):
        print(f"- {hit}")
PY

node <<'NODE'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts = pkg.scripts || {};
pkg.scripts['android:sync'] = 'npx cap sync android';
pkg.scripts['android:open'] = 'npx cap open android';
pkg.scripts['android:run'] = 'npx cap run android';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
NODE

npx cap add android
npx cap sync android

if [[ ! -f android/gradlew ]]; then
  echo "ERROR: No se encontró android/gradlew" >&2
  exit 1
fi

if [[ ! -f android/app/src/main/AndroidManifest.xml ]]; then
  echo "ERROR: No se encontró android/app/src/main/AndroidManifest.xml" >&2
  exit 1
fi

echo "Proyecto listo en: $PROJECT_DIR"
