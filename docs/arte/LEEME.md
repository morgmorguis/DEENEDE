# Fondos e iconos con la IA local (ComfyUI / Imagia)

Desde la 0.24.0 todo el arte de la app sale de la IA local del PC (RTX 5070 Ti, ComfyUI en `127.0.0.1:8188`, el
mismo motor que usa Imagia), con el estilo de las dos referencias elegidas por el usuario:

- **Modelo**: Z-Image Turbo (`z_image_turbo_int8_convrot`, texto `qwen_3_4b_fp8_mixed` tipo lumina2, VAE `ae`),
  12 pasos, cfg 1.5, `res_multistep`/`simple`, shift 3, EasyCache. Unos 6 s por imagen.
- **Pixel** (y Retro 16-bit): con la LoRA `z-image-pixel-hard_000002400` a 1.0.
- **Pintado**: sin LoRA («1990s fantasy book cover painting, oil and airbrush…»).

## Qué hay

| Carpeta | Qué es |
|---|---|
| `public/fondos/pintado/*.webp` | Estilo **Pintado**: 1344×768 (`-h`) y 768×1344 (`-v`) |
| `public/fondos/pixel/*.png` | Estilo **Pixel**: rejilla limpia a 1/4 (336×192), 48 colores, se ve con `image-rendering: pixelated` |
| `public/fondos/retro/*.png` | Estilo **Retro 16-bit**: a 1/8 (168×96), 24 colores y tramado |
| `public/iconos/*.png` | Iconos de la barra inferior, rejilla de 32×32 con contorno |
| `public/icon-*.png`, `favicon.png`, mipmaps de Android, `build/icons/*.ico` | Icono de la app (y del servidor, con insignia de conexión) |

Cada paleta de color (`basic`, `green`, `gray`, `blue`, `red`, `purple`, `orange`, `ice`) tiene su escena, y hay
15 escenas de combate (`combate-01`…`combate-15`): el preludio de una batalla, con pocas figuras y a veces un
monstruo. El servidor elige una al empezar cada combate (`pickCombatScene` en `src/party/protocol.ts`) y todos los
de la partida ven la misma, cada uno en su estilo. Los textos de cada escena están en `scripts/arte/escenas.py`.

`-v` se usa en pantallas verticales (móvil) y `-h` en las horizontales (Windows, tablets, móvil girado), con
`@media (min-aspect-ratio: 1/1)` en `src/index.css`.

## Regenerar

Con ComfyUI abierto (o Imagia, que lo arranca), desde la carpeta del repositorio y con el Python de ComfyUI portable
(`"D:\IA COSAS\ComfyUI_windows_portable\python_embeded\python.exe"`, que ya trae Pillow y numpy):

```
python scripts/arte/generar.py                 # genera lo que falte → scripts/arte/salida (no se sube a git)
python scripts/arte/generar.py --rehacer red   # repite una escena con otra semilla (también: pixel, combate-03, red-v…)
python scripts/arte/procesar.py                # salida → public/fondos (o solo: procesar.py red combate-03)
python scripts/arte/iconos.py --n=4            # 4 candidatos de cada icono (o: iconos.py combat app)
python scripts/arte/iconos_procesar.py sheet=2 combat=1 app=3   # elige candidato → public/iconos y el icono de la app
```

Las semillas de cada imagen quedan en `scripts/arte/salida/semillas.json`. Para añadir una paleta: su escena en
`PALETAS` (escenas.py), sus colores en `src/index.css` (`:root[data-theme="…"]`), su id en `Theme` (`src/store.ts`) y
en `THEMES` (`src/components/Settings.tsx`). Para más escenas de combate: añádelas a `COMBATE` y sube
`COMBAT_SCENES` en `src/party/protocol.ts`.
