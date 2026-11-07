# Di en Di — guía para agentes

Hoja de personaje interactiva de **D&D 2024 (SRD 5.2)** para Android, Windows y navegador, en español e inglés.
Repositorio: https://github.com/morgmorguis/DEENEDE (rama `main`). Lo que hace la app está en `README.md`, y
cada versión, en `CHANGELOG.md`. Léelos antes de tocar una función que no conozcas.

## Stack

- React 19 + TypeScript 5.8 + Vite 6. Estado con **zustand** (`src/store.ts`). Validación con zod.
- Android con **Capacitor 7** (`android/`, appId `com.grimorio.dndcompanion`, minSdk 23, compile/target 35,
  Gradle 8.11.1, AGP 8.7.2). Requisitos: **Node 22** y **JDK 21** (como en la CI).
- Tests con **vitest** (`src/**/__tests__/*.test.ts`). Lint con ESLint 9.
- IA opcional con la API de Claude (`src/ai.ts`, `@anthropic-ai/sdk`). Cada usuario pone su clave en Ajustes,
  y todo lo básico funciona sin conexión.

## Comandos

```bash
npm ci                 # dependencias (la primera vez o si cambia package-lock.json)
npm test               # tests (vitest run): pásalos SIEMPRE antes de dar algo por terminado
npm run lint
npm run build          # tsc -b + vite build → dist/ (antes copia los recursos de OCR y la guía)
npm run dev            # app en el navegador para probar la interfaz
npm run apk            # build + cap sync + gradlew assembleDebug → android/app/build/outputs/apk/debug/
npm run server -- --port 3100   # servidor de partida del DM (por defecto usa el 3000, que en este PC ya está ocupado)
```

En Windows, para el APK a mano: `npm run build`, después `npx cap sync android`, y después
`cd android; .\gradlew.bat assembleDebug`. No uses `npx cap open android`: abre Android Studio y se queda esperando.

## Estructura

| Carpeta / archivo | Qué hay |
|---|---|
| `src/rules/` | **Motor de reglas puro** (sin React): cálculo de la hoja (`calc.ts`), daño, efectos y comandos (`engine.ts`), bonificadores (`bonuses.ts`), subida de nivel y progresión, multiclase, especies y orígenes, armas, objetos y equipo, conjuros (`spells*.ts`), avisos de la ficha (`flags.ts`), explicación de cada número (`explain.ts`) y el intérprete de frases del asistente (`parser.ts`). Todo con tests. |
| `src/components/` | Pantallas y piezas de la interfaz: `Sheet.tsx` (hoja de dos páginas), `Combat.tsx`, `Initiative.tsx`, `Assistant.tsx`, `Rules.tsx`, `LevelUp.tsx`, `Treasure.tsx`, `Import.tsx`, `Settings.tsx`, `InfoBubble.tsx` (pulsación larga)… |
| `src/offline/` | Importación sin conexión: PDF rellenable oficial (`pdfForm.ts`), texto (`textParse.ts`), OCR con Tesseract (`ocr.ts`). |
| `src/party/` | Partida compartida por WebSocket con el DM: protocolo, sala, cliente, monstruos y dificultad. |
| `src/i18n.ts` | Idioma: `T('texto es', 'text en')` para la interfaz y `L({es, en})` para datos. |
| `data/` + `scripts/build-spells.cjs` | Conjuros (SRD 5.2 + traducciones) que generan `src/rules/spellsGen.ts`. |
| `server/` | Servidor de partida del DM (Node + ws). Se empaqueta como `.exe` en la CI. |
| `docs/guia/index.html` | Manual ilustrado del usuario, que se copia a `public/guia` al compilar. |
| `.github/workflows/android.yml` | Con cada push a `main`: tests, build, APK de depuración y apps de Windows. |

## Normas del proyecto

- **Todo texto visible, en los dos idiomas** con `T()`/`L()`. Nunca dejes un texto solo en español o solo en inglés.
- **Reglas de 2024** (SRD 5.2 / Manual del Jugador 2024). Si una regla de 2014 es distinta, manda la de 2024.
  La lógica de reglas va en `src/rules/`, no en los componentes.
- Cada cambio de reglas lleva su test en `src/rules/__tests__/`.
- Español de España en textos, comentarios y commits.
- **Al publicar una versión** (como en los commits anteriores):
  1. Sube la versión en `package.json` y en `versionName` de `android/app/build.gradle`. El `versionCode` lo pone la CI.
  2. Añade la entrada arriba del todo en `CHANGELOG.md`: `## X.Y.Z · día mes año — Título`, seguido de viñetas
     que expliquen el cambio para el jugador.
  3. Actualiza `docs/guia/index.html`: la versión en la línea «MANUAL DEL AVENTURERO · vX.Y.Z» y la sección que corresponda.
  4. Commit con el mensaje `X.Y.Z: resumen corto en minúsculas` y push a `main`. La CI genera el APK.
- Cambios pequeños y completos: nada de TODOs a medias. Antes de terminar: `npm test`, `npm run lint` y `npm run build`.

## Estado

- Versión **0.21.1** (6 nov 2026): monedas explicadas y cambio de monedas.
- Lo que hay y lo que se ha ido añadiendo está en `CHANGELOG.md`. Las ideas o tareas pendientes se apuntan en esta sección.
