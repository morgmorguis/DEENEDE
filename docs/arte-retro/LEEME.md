# Arte del estilo «Retro 16-bit» con tu IA local (ComfyUI)

La app trae dos estilos visuales que se eligen en **Ajustes → Estilo visual**:

- **Clásico**: los pósteres de fantasía oscura y las transiciones de siempre (no se ha quitado nada).
- **Retro 16-bit**: fondos pixel art, transiciones de RPG clásico y un icono pixel (un d20).

Los fondos retro que trae la app ahora son **provisionales** (generados por código). Puedes sustituirlos por imágenes
hechas con tu IA en el PC (RTX 5070 Ti + ComfyUI) manteniendo las mismas ideas de escena.

## 1. Modelos y LoRAs recomendados (gratis)

Elige **un estilo**. Descarga los archivos en las carpetas de ComfyUI indicadas.

### Pixel art (16-bit, tipo SNES)

| Qué | Dónde se descarga | Carpeta de ComfyUI |
|---|---|---|
| FLUX.1 dev (el que ya tienes) | — | `models/unet` (o `diffusion_models`) |
| LoRA **Modern Pixel art** para FLUX.1 dev | https://huggingface.co/UmeAiRT/FLUX.1-dev-LoRA-Modern_Pixel_art | `models/loras` |
| *Alternativa*: LoRA **pixelartdotfluxlora** (FLUX.1 dev, uso no comercial) | https://huggingface.co/deAPI-ai/pixelartdotfluxlora | `models/loras` |
| *Alternativa SDXL, la más «SNES»*: LoRA **pixel-art-16bit** (palabra clave `p1x3l16`) + un checkpoint SDXL | https://huggingface.co/strkyyy/pixel-art-16bit | `models/loras` y `models/checkpoints` |

### Fantasía pintada de los 80-90

| Qué | Dónde se descarga | Carpeta |
|---|---|---|
| LoRA **dark-fantasy-illustration-flux** (FLUX.1 dev, fuerza ~1.2, sin palabra clave, licencia MIT) | https://huggingface.co/nerijs/dark-fantasy-illustration-flux | `models/loras` |
| *Alternativa*: **dark-fantasy-movie-flux** (estilo fotograma de película de los 80) | https://huggingface.co/nerijs/dark-fantasy-movie-flux | `models/loras` |

> Comprueba en cada página la licencia y si pide una palabra clave (*trigger*). Si la pide, ponla en `TRIGGERS`
> dentro del script.

## 2. Generar todas las imágenes de una vez

1. Abre ComfyUI (`run_nvidia_gpu.bat` en la versión portable).
2. Abre `scripts/retro/comfy_generar.py` con el Bloc de notas y revisa la parte **CONFIGURACIÓN**:
   los nombres de tus archivos (`FLUX_UNET`, `FLUX_CLIP_T5`, `FLUX_CLIP_L`, `FLUX_VAE`) y del LoRA (`LORAS`)
   deben ser **exactamente** los que salen en los desplegables de ComfyUI.
3. En una ventana de comandos, dentro de la carpeta del repositorio:

   ```
   python scripts/retro/comfy_generar.py            (pixel art)
   python scripts/retro/comfy_generar.py fantasia   (fantasía 80-90)
   python scripts/retro/comfy_generar.py pixel ocaso cripta   (solo esas)
   ```

   Si usas el Python de ComfyUI portable: `..\python_embeded\python.exe scripts\retro\comfy_generar.py`.
4. Las imágenes quedan en `scripts/retro/salida/` (y también en la carpeta `output/dienedi` de ComfyUI).
   Repite las que no te gusten: cada vez sale una distinta (semilla aleatoria).

Imágenes que genera (mismas ideas que los pósteres):

| Archivo | Escena |
|---|---|
| ocaso | castillo en una colina al atardecer |
| bosque | bosque de pinos encantado a la luz de la luna, luciérnagas |
| cumbres | cumbres nevadas con aurora y una fortaleza |
| abismo | caverna con cristales brillantes sobre un abismo |
| mar | mar a la luz de la luna con un barco |
| mazmorra | pasillo de mazmorra con antorchas y una puerta de hierro |
| ciudadela | ciudadela con torres y estandartes al anochecer |
| cripta | cementerio con niebla, árbol muerto y luna llena |
| fx-combat | ilustración vertical para la transición «¡COMBATE!» |
| fx-levelup | ilustración vertical para «¡SUBES DE NIVEL!» |
| icon | icono (un goblin con dados) |

## 3. Meterlas en la app

Con Node y ImageMagick instalados:

```
node scripts/retro/import-ai-art.cjs scripts/retro/salida
```

Recorta cada imagen, la reduce a resolución de pixel art con paleta limitada (48 colores; cámbialo con
`--colores 32`) y la guarda en `public/design/retro/`. Para el estilo fantasía 80-90 sin pixelar usa
`--sin-pixelar`. Después `npm run build` (o súbelas y que se compile la APK).

**Sin instalar nada más**: sube las imágenes al repositorio en `incoming/retro/` y pídeme que las importe.
