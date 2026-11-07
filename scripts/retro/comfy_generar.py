# -*- coding: utf-8 -*-
"""
Genera con ComfyUI (en tu PC) todas las imágenes del estilo «Retro» de Di en Di:
8 fondos (mismos nombres que los pósteres), 2 ilustraciones de transición y el icono.

Uso (con ComfyUI abierto):
    python comfy_generar.py              -> estilo pixel art (por defecto)
    python comfy_generar.py fantasia     -> estilo fantasía pintada de los 80-90
    python comfy_generar.py pixel ocaso  -> solo una imagen

Las imágenes quedan en la carpeta «salida» junto a este script. Después:
    node scripts/retro/import-ai-art.cjs scripts/retro/salida
(o súbelas al repositorio en incoming/retro/ y se importan desde allí).

Solo usa la biblioteca estándar de Python (no hay que instalar nada).
"""
import json
import os
import random
import sys
import time
import urllib.parse
import urllib.request

# ---------------------------------------------------------------- CONFIGURACIÓN
COMFY = "http://127.0.0.1:8188"

# Motor: "flux" (FLUX.1 dev con sus archivos sueltos), "flux_ckpt" (FLUX en un único .safetensors fp8)
#        o "sdxl" (un checkpoint SDXL, p. ej. para el LoRA pixel-art-16bit)
MOTOR = "flux"

# Nombres EXACTOS de tus archivos (tal como aparecen en los desplegables de ComfyUI)
FLUX_UNET = "flux1-dev.safetensors"            # models/unet (o diffusion_models)
FLUX_UNET_DTYPE = "fp8_e4m3fn"                 # "default" si tienes VRAM de sobra
FLUX_CLIP_T5 = "t5xxl_fp8_e4m3fn.safetensors"  # models/clip (o text_encoders)
FLUX_CLIP_L = "clip_l.safetensors"
FLUX_VAE = "ae.safetensors"                    # models/vae
FLUX_CKPT = "flux1-dev-fp8.safetensors"        # solo para MOTOR = "flux_ckpt" (models/checkpoints)
SDXL_CKPT = "sd_xl_base_1.0.safetensors"       # solo para MOTOR = "sdxl"

# LoRAs (models/loras). Pon None para no usar ninguno en ese estilo.
LORAS = {
    # Pixel art: p. ej. FLUX.1-dev-LoRA-Modern_Pixel_art (UmeAiRT) o pixelartdotfluxlora (deAPI)
    "pixel": ("pixel_art_flux.safetensors", 1.0),
    # Fantasía 80-90: p. ej. dark-fantasy-illustration-flux o dark-fantasy-movie-flux (nerijs)
    "fantasia": ("dark_fantasy_illustration_flux.safetensors", 1.1),
}
# Palabra clave del LoRA (si la pide su página); se añade al principio del prompt
TRIGGERS = {"pixel": "", "fantasia": ""}

PASOS = 28
GUIA = 3.5          # FluxGuidance (FLUX) o CFG (SDXL ~ 6)
SEMILLA = None      # None = aleatoria; pon un número para repetir resultados
# -------------------------------------------------------------------------------

ESTILO = {
    "pixel": "16-bit pixel art, SNES-era fantasy RPG background, limited color palette, ordered dithering, crisp chunky pixels, no anti-aliasing, detailed retro game scene",
    "fantasia": "1980s dark fantasy illustration, retro fantasy paperback cover painting, airbrush and oil paint, film grain, dramatic lighting, rich saturated colors",
}
NEGATIVO = "text, title, letters, logo, watermark, signature, frame, border, blurry, modern, photo, 3d render"

# Mismas ideas que los pósteres de la app (nombre de archivo -> escena)
TRABAJOS = {
    "ocaso": ("a lonely stone castle on a hill at sunset, huge orange sun on the horizon, layered purple mountains, embers in the air", 1024, 1024),
    "bosque": ("an enchanted moonlit pine forest, crescent moon, glowing fireflies, mossy path between giant trees", 1024, 1024),
    "cumbres": ("snowy mountain peaks under a green aurora, a lone mountain fortress with lit windows, starry night", 1024, 1024),
    "abismo": ("an underground cavern over a dark chasm, glowing blue and violet crystals, mist, tiny adventurers on a ledge", 1024, 1024),
    "mar": ("a moonlit sea, a sailing ship silhouette, gentle waves reflecting the full moon, distant cliffs", 1024, 1024),
    "mazmorra": ("a stone dungeon corridor, two burning torches beside a heavy iron-bound door, skulls and chains", 1024, 1024),
    "ciudadela": ("a fantasy citadel with tall towers and banners at dusk, warm lit windows, red sky", 1024, 1024),
    "cripta": ("a foggy graveyard with leaning tombstones, a dead twisted tree, full moon, crypt entrance", 1024, 1024),
    "fx-combat": ("a party of adventurers facing a roaring red dragon, dramatic battle, sparks and fire, vertical composition", 832, 1472),
    "fx-levelup": ("a hero raising a glowing sword, golden light rays and sparkles around, triumphant, vertical composition", 832, 1472),
    "icon": ("a single cute green goblin holding red dice, centered, simple dark purple background, game icon, bold outlines", 1024, 1024),
}


def post(path, data):
    req = urllib.request.Request(COMFY + path, data=json.dumps(data).encode("utf-8"), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def get(path):
    with urllib.request.urlopen(COMFY + path, timeout=60) as r:
        return r.read()


def workflow(prompt, w, h, estilo, nombre):
    seed = SEMILLA if SEMILLA is not None else random.randint(1, 2**31)
    lora = LORAS.get(estilo)
    texto = ", ".join(x for x in [TRIGGERS.get(estilo, ""), ESTILO[estilo], prompt] if x)
    g = {}
    if MOTOR == "sdxl":
        g["1"] = {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": SDXL_CKPT}}
        model, clip, vae = ["1", 0], ["1", 1], ["1", 2]
        if lora:
            g["2"] = {"class_type": "LoraLoader", "inputs": {"model": model, "clip": clip, "lora_name": lora[0], "strength_model": lora[1], "strength_clip": lora[1]}}
            model, clip = ["2", 0], ["2", 1]
        g["3"] = {"class_type": "CLIPTextEncode", "inputs": {"text": texto, "clip": clip}}
        g["4"] = {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVO, "clip": clip}}
        g["5"] = {"class_type": "EmptyLatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}}
        g["6"] = {"class_type": "KSampler", "inputs": {"model": model, "seed": seed, "steps": PASOS, "cfg": 6.0, "sampler_name": "dpmpp_2m", "scheduler": "karras", "positive": ["3", 0], "negative": ["4", 0], "latent_image": ["5", 0], "denoise": 1.0}}
    else:
        if MOTOR == "flux_ckpt":
            g["1"] = {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": FLUX_CKPT}}
            model, clip, vae = ["1", 0], ["1", 1], ["1", 2]
        else:
            g["1"] = {"class_type": "UNETLoader", "inputs": {"unet_name": FLUX_UNET, "weight_dtype": FLUX_UNET_DTYPE}}
            g["8"] = {"class_type": "DualCLIPLoader", "inputs": {"clip_name1": FLUX_CLIP_T5, "clip_name2": FLUX_CLIP_L, "type": "flux"}}
            g["9"] = {"class_type": "VAELoader", "inputs": {"vae_name": FLUX_VAE}}
            model, clip, vae = ["1", 0], ["8", 0], ["9", 0]
        if lora:
            g["2"] = {"class_type": "LoraLoaderModelOnly", "inputs": {"model": model, "lora_name": lora[0], "strength_model": lora[1]}}
            model = ["2", 0]
        g["3"] = {"class_type": "CLIPTextEncode", "inputs": {"text": texto, "clip": clip}}
        g["10"] = {"class_type": "FluxGuidance", "inputs": {"conditioning": ["3", 0], "guidance": GUIA}}
        g["4"] = {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": clip}}
        g["5"] = {"class_type": "EmptySD3LatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}}
        g["6"] = {"class_type": "KSampler", "inputs": {"model": model, "seed": seed, "steps": PASOS, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "positive": ["10", 0], "negative": ["4", 0], "latent_image": ["5", 0], "denoise": 1.0}}
    g["7"] = {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": vae}}
    g["11"] = {"class_type": "SaveImage", "inputs": {"images": ["7", 0], "filename_prefix": "dienedi/" + nombre}}
    return g


def generar(estilo, nombres):
    salida = os.path.join(os.path.dirname(os.path.abspath(__file__)), "salida")
    os.makedirs(salida, exist_ok=True)
    for nombre in nombres:
        prompt, w, h = TRABAJOS[nombre]
        print(f"→ {nombre} ({estilo}, {w}×{h})…", flush=True)
        pid = post("/prompt", {"prompt": workflow(prompt, w, h, estilo, nombre)})["prompt_id"]
        while True:
            time.sleep(2)
            hist = json.loads(get(f"/history/{pid}").decode("utf-8"))
            if pid in hist and hist[pid].get("outputs"):
                break
        for nodo in hist[pid]["outputs"].values():
            for img in nodo.get("images", []):
                q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img.get("type", "output")})
                destino = os.path.join(salida, f"{nombre}.png")
                with open(destino, "wb") as f:
                    f.write(get(f"/view?{q}"))
                print(f"   guardado {destino}", flush=True)


if __name__ == "__main__":
    args = sys.argv[1:]
    estilo = args.pop(0) if args and args[0] in ESTILO else "pixel"
    nombres = [a for a in args if a in TRABAJOS] or list(TRABAJOS)
    try:
        get("/system_stats")
    except Exception as e:  # noqa: BLE001
        sys.exit(f"No encuentro ComfyUI en {COMFY}: ábrelo primero ({e})")
    generar(estilo, nombres)
    print("Listo. Ahora: node scripts/retro/import-ai-art.cjs scripts/retro/salida")
