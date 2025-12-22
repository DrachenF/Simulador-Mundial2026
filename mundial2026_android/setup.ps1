$ErrorActionPreference = "Stop"

$ProjectNameDefault = "mundial2026_android"
$AppName = "Mundial 2026"
$AppId = "com.drachenf.mundial2026"
$WebDir = "www"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = $env:BASE_DIR
if (-not $BaseDir) { $BaseDir = $ScriptDir }

if ((Split-Path -Leaf $ScriptDir) -eq $ProjectNameDefault) {
  $ProjectDirDefault = $ScriptDir
} else {
  $ProjectDirDefault = Join-Path $BaseDir $ProjectNameDefault
}

$ProjectDir = $env:PROJECT_DIR
if (-not $ProjectDir) { $ProjectDir = $ProjectDirDefault }

$IndexSrc = $env:INDEX_SRC
if (-not $IndexSrc) { $IndexSrc = Join-Path $ScriptDir "..\static\index.html" }
$GruposSrc = $env:GRUPOS_SRC
if (-not $GruposSrc) { $GruposSrc = Join-Path $ScriptDir "..\grupos.csv" }
$CombinacionesSrc = $env:COMBINACIONES_SRC
if (-not $CombinacionesSrc) { $CombinacionesSrc = Join-Path $ScriptDir "..\Combinaciones.csv" }

function Pick-ProjectDir([string]$Target) {
  if (Test-Path $Target) {
    if ($Target -eq $ScriptDir) {
      return $Target
    }
    $i = 2
    while (Test-Path "${Target}_$i") { $i++ }
    return "${Target}_$i"
  }
  return $Target
}

$ProjectDir = Pick-ProjectDir $ProjectDir

New-Item -ItemType Directory -Force -Path $ProjectDir | Out-Null
Set-Location $ProjectDir

if (-not (Test-Path "package.json")) {
  npm init -y | Out-Null
}

npm install @capacitor/core @capacitor/cli @capacitor/android

npx cap init "$AppName" "$AppId" --web-dir $WebDir

New-Item -ItemType Directory -Force -Path $WebDir | Out-Null
Copy-Item $IndexSrc (Join-Path $WebDir "index.html") -Force
Copy-Item $GruposSrc (Join-Path $WebDir "grupos.csv") -Force
Copy-Item $CombinacionesSrc (Join-Path $WebDir "Combinaciones.csv") -Force

python - <<'PY'
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

node - <<'NODE'
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

if (-not (Test-Path "android/gradlew")) {
  throw "ERROR: No se encontró android/gradlew"
}

if (-not (Test-Path "android/app/src/main/AndroidManifest.xml")) {
  throw "ERROR: No se encontró android/app/src/main/AndroidManifest.xml"
}

Write-Host "Proyecto listo en: $ProjectDir"
