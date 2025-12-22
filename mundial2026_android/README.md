# Mundial 2026 (Capacitor Android Offline)

Este proyecto empaqueta el sitio estático (`index.html` + CSVs) como app Android **offline** usando Capacitor.

## Requisitos
- Node.js 18+
- npm
- Android Studio + SDK

## Setup automático
Ejecuta uno de los scripts según tu sistema:

**macOS / Linux**
```bash
./setup.sh
```

**Windows (PowerShell)**
```powershell
./setup.ps1
```

Los scripts:
- Inicializan npm y Capacitor.
- Copian `index.html`, `grupos.csv`, `Combinaciones.csv` a `/www`.
- Ajustan rutas absolutas en `fetch("/archivo")` a rutas relativas.
- Generan el proyecto Android en `/android`.
- Verifican que existan `android/gradlew` y `android/app/src/main/AndroidManifest.xml`.

## Uso en Android Studio
1. Abre la carpeta `android/` en Android Studio.
2. Espera a que Gradle sincronice.
3. Ejecuta la app con **Run**.

## Comandos útiles
```bash
npm install
npm run android:open
npm run android:run
```

> **Importante:** Después de editar `www/index.html` o los CSVs, ejecuta:
```bash
npm run android:sync
```

## Generar APK Debug (rápido para instalar)
```bash
cd android
./gradlew assembleDebug
```

El APK queda en:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

## Generar APK Release firmado
1. Configura un keystore en `android/gradle.properties`.
2. Ejecuta:
```bash
cd android
./gradlew assembleRelease
```

## Generar AAB (Play Store)
```bash
cd android
./gradlew bundleRelease
```

El AAB queda en:
```
android/app/build/outputs/bundle/release/app-release.aab
```

## Verificación offline
El proyecto no usa host ni servicios externos. Si detectas URLs externas (CDN), el script las reportará durante el setup.

## Estructura final esperada
```
mundial2026_android/
├─ android/
├─ www/
│  ├─ index.html
│  ├─ grupos.csv
│  └─ Combinaciones.csv
├─ package.json
├─ setup.sh
├─ setup.ps1
└─ README.md
```
