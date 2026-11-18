# Di en Di — guía para agentes (Codex, Claude Code…)

Hoja de personaje interactiva de **D&D 2024 (SRD 5.2)** para Android, Windows y navegador, en español e inglés,
con partida compartida por WebSocket con el DM. Repositorio: https://github.com/morgmorguis/DEENEDE (rama `main`).

## Cómo conseguir contexto sin gastar tokens

Este archivo ya tiene lo necesario para empezar. **No leas el repositorio entero ni archivos enteros "por si acaso".**

1. **Para saber dónde tocar: `docs/MAPA.md`** (una línea por archivo: para qué sirve y qué exporta). Busca en él con
   `rg -n "palabra" docs/MAPA.md` antes de abrirlo entero.
2. **Después busca, no leas:** `rg -n "nombreFuncion" src/` y abre solo el trozo con su rango de líneas
   (`sed -n '120,200p' archivo`). Los archivos marcados ⚠️ en el mapa pasan de 40 KB: nunca los abras enteros.
3. **Nunca los abras** (busca dentro con `rg` si hace falta): `src/rules/spellsGen.ts` (generado, 316 KB),
   `data/*.json`, `package-lock.json`, `docs/guia/index.html` (67 KB), `public/`, `dist/`, `server/build/`,
   `android/app/build/`, `node_modules/`.
4. **`README.md` y `CHANGELOG.md` no se leen enteros.** Para la última versión: `head -40 CHANGELOG.md`. Para saber
   cuándo cambió algo: `rg -n "palabra" CHANGELOG.md`. Para la historia de un archivo: `git log --oneline -8 -- archivo`.
5. Para los tests de una zona, ejecuta solo ese archivo (`npx vitest run src/rules/__tests__/levelup.test.ts`) mientras
   trabajas, y la batería completa al final.

## Stack

- React 19 + TypeScript 5.8 + Vite 6. Estado con **zustand** (`src/store.ts`). Validación con zod.
- Android con **Capacitor 7** (`android/`, appId `com.grimorio.dndcompanion`, minSdk 23, compile/target 35,
  Gradle 8.11.1, AGP 8.7.2). Requisitos: **Node 22** y **JDK 21** (como en la CI).
- Tests con **vitest** (`src/**/__tests__/*.test.ts`). Lint con ESLint 9 (hay avisos antiguos; errores, ninguno).
- IA opcional con la API de Claude (`src/ai.ts`). Cada usuario pone su clave en Ajustes; lo básico funciona sin conexión.

## Comandos

```bash
npm ci                 # dependencias (la primera vez o si cambia package-lock.json)
npm test               # tests (vitest run): pásalos SIEMPRE antes de dar algo por terminado
npm run lint
npm run build          # tsc -b + vite build → dist/ (antes copia OCR y guía, y regenera docs/MAPA.md)
npm run dev            # app en el navegador para probar la interfaz
npm run apk            # build + cap sync + gradlew assembleDebug → android/app/build/outputs/apk/debug/
npm run server -- --port 3100   # servidor del DM (el 3000 del PC del usuario lo ocupa su IA local)
docker build --target apps --output salida-docker .   # APK + .exe de Windows sin Node/JDK/SDK (o --target apk / windows)
docker compose up -d   # servidor del DM en contenedor (puerto 3100, volumen «partida», IP_PC=… para la dirección)
```

En Windows, APK a mano: `npm run build`, `npx cap sync android`, `cd android; .\gradlew.bat assembleDebug`.
No uses `npx cap open android`: abre Android Studio y se queda esperando.

## Estructura (detalle por archivo en `docs/MAPA.md`)

| Dónde | Qué hay |
|---|---|
| `src/rules/` | **Motor de reglas puro** (sin React), todo con tests: hoja (`calc.ts`), daño/efectos/comandos (`engine.ts`), bonificadores, subida de nivel y progresión, multiclase, especies y orígenes, armas, objetos, conjuros (`spells*.ts`), avisos (`flags.ts`), explicaciones (`explain.ts`), intérprete de frases (`parser.ts`). |
| `src/components/` | Interfaz: `Sheet.tsx` (hoja), `Combat.tsx`, `CombatActions.tsx`, `Party.tsx`, `Dm*.tsx`, `LevelUp.tsx`, `Treasure.tsx`, `Settings.tsx`… |
| `src/party/` | Partida compartida: `protocol.ts` (tipos), `room.ts` (lógica pura del servidor), `client.ts`, monstruos, dificultad, `narrative.ts`. |
| `src/offline/` | Importar fichas sin conexión: PDF rellenable, texto, OCR con Tesseract. |
| `src/i18n.ts` | `T('texto es', 'text en')` para la interfaz y `L({es, en})` para datos. |
| `data/` + `scripts/build-spells.cjs` | Conjuros (SRD 5.2 + traducciones) que generan `src/rules/spellsGen.ts`. |
| `server/` | Servidor de partida (`index.ts`, Node + ws), app de Windows (`app.ts`), publicación en Internet (`publish.ts`). La CI los empaqueta como `.exe`. |
| `docs/guia/index.html` | Manual ilustrado del usuario (se copia a `public/guia`). |
| `Dockerfile`, `docker-compose.yml` | Compilación en Docker y servidor del DM en contenedor. Si cambian los pasos de la CI, cámbialos también aquí. |
| `.github/workflows/android.yml` | Con cada push a `main`: tests, build, APK, `.exe` de Windows y, si la versión es nueva, release `vX.Y.Z`. |

## Normas del proyecto

- **Todo texto visible, en los dos idiomas** con `T()`/`L()`. Nunca dejes un texto solo en español o solo en inglés.
- **Reglas de 2024** (SRD 5.2 / Manual del Jugador 2024). Si una regla de 2014 es distinta, manda la de 2024.
  La lógica de reglas va en `src/rules/`, no en los componentes. Cada cambio de reglas lleva su test en `src/rules/__tests__/`.
- La lógica de la partida va en `src/party/room.ts` (pura, con tests); el servidor solo la aplica y la guarda.
- Español de España en textos, comentarios y commits.
- Cambios pequeños y completos: nada de TODOs a medias. Antes de terminar: `npm test`, `npm run lint` y `npm run build`.
- Archivo nuevo de código: empieza con un comentario de una línea que diga para qué sirve (lo usa `docs/MAPA.md`).
- **Al publicar una versión:**
  1. Sube la versión en `package.json` y en `versionName` de `android/app/build.gradle` (el `versionCode` lo pone la CI).
  2. Entrada arriba del todo en `CHANGELOG.md`: `## X.Y.Z · día mes año — Título` y viñetas para el jugador.
  3. `docs/guia/index.html`: la versión en «MANUAL DEL AVENTURERO · vX.Y.Z» y la sección que corresponda.
  4. Commit `X.Y.Z: resumen corto en minúsculas` y push a `main`. La CI genera el APK y los `.exe` y crea la release
     `vX.Y.Z` con las notas de esa entrada del CHANGELOG. Si la versión no cambia, no hay release.

## Estado y notas que no se ven en el código

- Versión **0.27.0** (18 nov 2026). Lo que hace cada versión está en `CHANGELOG.md` (lee solo la entrada que necesites).
- Turnos: el servidor solo acepta `act` en tu turno o como reacción (una por ronda); `nextTurn`, solo el DM o el dueño del turno.
- Fases del combate compartido (`Encounter.phase`): `prep` (el DM prepara a solas; `viewFor` se lo oculta a los demás y no se anotan
  las entradas en el registro), `setup` (lanzado con `launch`: aviso que el jugador acepta con `accept` y antesala con «Listo»; empieza
  cuando están listos todos los jugadores conectados, el DM no cuenta) y `running`. `start` (apps antiguas) = preparar + lanzar.
  Lo que llevan los enemigos (`Combatant.loot`, solo el DM) pasa a `room.loot` al terminar; el DM lo reparte con `give` y lo quita con `lootDone`.
  Los jugadores solo ven de un monstruo su nombre y si ha caído (`state` 'unknown' o 'down'), salvo `showHp`.
- Crear la partida: `Room.open` (una partida nueva empieza cerrada; las guardadas antes se normalizan a abiertas). `openGame` = código nuevo
  y abierta (conserva un combate en `prep`; opcionalmente saca jugadores y borra el registro), `closeGame` = nadie nuevo entra con el código
  (opcionalmente saca a los jugadores). Con la partida cerrada `hello` con código da `game-closed` (`enterError`). Tras cualquier comando,
  el servidor cierra (`session-reset`) los sockets de miembros que ya no están.
- Partida del PC por la nube (`server/relay.ts`): con la clave del DM de la nube guardada en el PC (`di-en-di-nube.json` junto a la
  partida, comando `cloudLink` que atiende `server/index.ts`, no `apply`), el servidor del PC abre un WebSocket a `/relay` de la nube
  (`RelayHost`) mientras la partida está abierta (y 10 min después de cerrarla si queda alguien). La nube (`RelayHub`) manda a ese PC a
  quien dice «hola» con su código, su token o su clave de DM (le envía `{code, open, keys}`), contesta `/api/info?check=` por él y le pide
  `/img/…` y `/api/sheet`. En el PC cada jugador de la nube es un `Peer` más (igual que un WebSocket). El DM ve `RoomView.cloud`.
  Prueba de punta a punta: dos servidores (uno con `K_SERVICE`) y jugadores con `ws`; el túnel se reenlaza solo si la nube se reinicia.
- Unirse solo con el código: `findServer` (client.ts) prueba la página actual, el último servidor (`di-en-di-last-server`) y
  `DEFAULT_SERVER` (https://di-en-di.web.app) con `/api/info?check=CÓDIGO` → `{match, closed}`; los servidores antiguos no traen `match`.
- Compartido conmigo (jugador): `addSharedNotes` (client.ts) guarda en la carpeta `shared` del diario imágenes (`img:`), crónicas
  (`chr:`), entregas (`gift:`) e informes de combate (`cmb:`, `saveCombatReport` al terminar). La imagen completa va a IndexedDB
  (`src/sharedImages.ts`, `Note.imageKey`) y en la nota solo una miniatura: la ficha vive en localStorage (~5 MB) y no debe llenarse.
- Exportar: `src/export/xlsx.ts` (escritor .xlsx propio, ZIP sin comprimir) y `src/export/dmExport.ts` (listas del DM y ficha en Excel/Markdown).
- Sesiones: `newCode` (código nuevo, los miembros siguen) y `newSession` (código nuevo, sin combate, opcionalmente sin jugadores
  y sin registro). Se entra con el código, la clave del DM o el token de un miembro (`canEnter`): así se reconecta quien ya
  estaba aunque cambie el código. A los sockets de miembros quitados el servidor les manda `session-reset` y los cierra.
- Enlaces: jugadores `/?join=CÓDIGO`, DM `/dm?dm=CLAVE` (la app detecta la ruta `/dm` y muestra `DmLogin`; el servidor redirige `/dm/` a `/dm`).
- Encuentros desde Excel/CSV: `src/party/encounterImport.ts` (lector de .xlsx propio con `DecompressionStream`, sin dependencias).
- Ficha en PDF: `src/export/sheetPdf.ts` escribe con pdf-lib encima de la hoja oficial de 2024 en español (603×774 pt, sin campos):
  posiciones en px a escala 2 medidas sobre la maqueta. **La hoja oficial (© WotC) no va en el repositorio** (es público y su licencia
  solo permite fotocopiarla): el jugador la elige una vez y se guarda en IndexedDB (`src/export/templateStore.ts`).
- Iconos: app = goblin (`iconos.py app`), DM = goblin tras la pantalla (`iconos.py dm` → `icon-dm-*.png`, `favicon-dm.png` y
  `build/icons/server.ico`). `scenes.ts` → `setDmIcon` pone el del DM en `/dm` y en modo DM.
- Puerto del servidor: busca uno libre desde el 3000 y comprueba con `/api/info?probe=` que responde él en 127.0.0.1
  (en el PC del DM una IA local escucha en 127.0.0.1:3000 y Windows no da error al compartir puerto). En Docker, `DI_EN_DI_IP`.
- Imágenes del DM: en disco junto a la partida (`di-en-di-imagenes/`). Copia de campaña: `/api/export` y `/api/import` con `?dm=`.
- Estilos visuales: Pixel (`classic`), Retro 16-bit (`retro`) y Pintado (`poster`); 8 paletas, cada una con su fondo vertical y
  horizontal en `public/fondos/<pixel|retro|pintado>`, y 15 fondos de combate (el servidor elige uno en `start`, `encounter.scene`).
  Todo se genera con la IA local: `scripts/arte/` (guía en `docs/arte/LEEME.md`). Los pósteres SVG de `public/posters` ya solo son el fondo del retrato.
- Iconos: barra inferior en `public/iconos` (32×32), icono de la app en `public/icon-*.png`, mipmaps de Android y `build/icons/*.ico`
  (todos con `scripts/arte/iconos_procesar.py`), aplicados a los `.exe` con resedit en la CI.
- Servidor en la nube (rama `nube`, en prueba): el mismo `server/index.ts` en Google Cloud Run (etapa `nube` del Dockerfile),
  con `/datos` montado desde un depósito de Cloud Storage. Despliegue con `server/nube/desplegar.ps1`; guía en `server/NUBE.txt`.
  En Cloud Run (`K_SERVICE`) la dirección pública sale de la petición (o de `DI_EN_DI_URL`) y no hay red local. Una sola instancia.
  Dirección corta `PROYECTO.web.app`: Firebase Hosting (`server/nube/hosting.mjs`, API REST con el token de gcloud) sirve `/servidor.json`
  con la URL real y un `index.html` que redirige; Hosting no pasa WebSocket, por eso la app lo resuelve (`resolveServer` en `client.ts`).
- Sincronizar fichas: el DM manda `syncSheets`; cada jugador sube su ficha completa (`sheetUpload`, archivo de copia) y el servidor
  la guarda en `di-en-di-fichas/<id>.json` junto a la partida. `/api/sheet?token=` (la tuya) y `/api/sheets?dm=` (todas).
- Ideas o tareas pendientes: apúntalas aquí.
