"""Genera los fondos de la app con la IA local (ComfyUI + Z-Image Turbo, el mismo flujo que Imagia).

Uso (con ComfyUI abierto en 127.0.0.1:8188; vale el Python de ComfyUI portable):
  python scripts/arte/generar.py                      # todo lo que falte (paletas y combate, los dos estilos)
  python scripts/arte/generar.py pintado red combate-03 # solo esos estilos / nombres
  python scripts/arte/generar.py --rehacer red          # vuelve a generar aunque exista (semilla nueva)
Salida: scripts/arte/salida/<estilo>/<nombre>-<v|h>.png (sin procesar; procesar.py los pasa a public/fondos).
"""
import json, os, random, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from escenas import COMBATE, ESTILO, ESTILOS, FORMATOS, PALETAS  # noqa: E402

COMFY = os.environ.get('COMFY', 'http://127.0.0.1:8188')
SALIDA = os.path.join(os.path.dirname(__file__), 'salida')
UNET = 'z_image_turbo_int8_convrot.safetensors'
TE = 'qwen_3_4b_fp8_mixed.safetensors'
VAE = 'ae.safetensors'
LORA_PIXEL = 'z-image-pixel-hard_000002400.safetensors'
NEG = ('worst quality, low quality, lowres, blurry, out of focus, jpeg artifacts, smudge, smeared, overexposed, '
       'washed out colors, deformed, disfigured, bad anatomy, extra limbs, watermark, signature, username, text, '
       'letters, title, logo, border, frame, white margins, picture frame, ui, crowd, modern, industrial')


def trabajos():
    """(estilo, nombre, formato, prompt) de todo lo que hay que generar"""
    escenas = [(k, f'{v[0]}, color palette dominated by {v[1]}') for k, v in PALETAS.items()]
    escenas += [(f'combate-{i + 1:02d}', f'{s}, tense calm before the battle, ominous dark atmosphere')
                for i, s in enumerate(COMBATE)]
    out = []
    for estilo in ESTILOS:
        for nombre, escena in escenas:
            for fmt in FORMATOS:
                lay = ('vertical composition, main subject in the center of the frame' if fmt == 'v'
                       else 'wide panoramic composition, main subject in the center of the frame')
                out.append((estilo, nombre, fmt, f'{lay}, {escena}, {ESTILO}'))
    return out


def flujo(prompt, w, h, seed, pixel):
    wf = {
        '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': UNET, 'weight_dtype': 'default'}},
        '9': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': TE, 'type': 'lumina2'}},
        '10': {'class_type': 'VAELoader', 'inputs': {'vae_name': VAE}},
        '11': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['1', 0], 'shift': 3.0}},
        '4': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': w, 'height': h, 'batch_size': 1}},
        '6': {'class_type': 'VAEDecode', 'inputs': {'samples': ['5', 0], 'vae': ['10', 0]}},
        '7': {'class_type': 'SaveImage', 'inputs': {'images': ['6', 0], 'filename_prefix': 'dienedi/fondo'}},
    }
    model, clip = ['11', 0], ['9', 0]
    if pixel:
        wf['20'] = {'class_type': 'LoraLoader', 'inputs': {'model': model, 'clip': clip, 'lora_name': LORA_PIXEL,
                                                           'strength_model': 1.0, 'strength_clip': 1.0}}
        model, clip = ['20', 0], ['20', 1]
    wf['18'] = {'class_type': 'EasyCache', 'inputs': {'model': model, 'reuse_threshold': 0.2, 'start_percent': 0.15,
                                                      'end_percent': 0.95, 'verbose': False}}
    wf['2'] = {'class_type': 'CLIPTextEncode', 'inputs': {'text': prompt, 'clip': clip}}
    wf['3'] = {'class_type': 'CLIPTextEncode', 'inputs': {'text': NEG, 'clip': clip}}
    wf['5'] = {'class_type': 'KSampler', 'inputs': {
        'model': ['18', 0], 'positive': ['2', 0], 'negative': ['3', 0], 'latent_image': ['4', 0], 'seed': seed,
        'steps': 12, 'cfg': 1.5, 'sampler_name': 'res_multistep', 'scheduler': 'simple', 'denoise': 1.0}}
    return wf


def api(path, data=None):
    req = urllib.request.Request(COMFY + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read() if path.startswith('/view') else json.loads(r.read() or b'{}')


def main(args):
    rehacer = '--rehacer' in args
    filtros = [a for a in args if not a.startswith('--')]
    semillas_f = os.path.join(SALIDA, 'semillas.json')
    semillas = json.load(open(semillas_f, encoding='utf-8')) if os.path.exists(semillas_f) else {}
    cola = []
    for estilo, nombre, fmt, prompt in trabajos():
        if filtros and not any(f in (estilo, nombre, fmt, f'{nombre}-{fmt}') for f in filtros):
            continue
        dest = os.path.join(SALIDA, estilo, f'{nombre}-{fmt}.png')
        if os.path.exists(dest) and not rehacer:
            continue
        w, h = FORMATOS[fmt]
        seed = random.randrange(2**32)
        pid = api('/prompt', {'prompt': flujo(prompt, w, h, seed, estilo == 'pixel')})['prompt_id']
        cola.append((pid, dest, seed))
    print(f'{len(cola)} imágenes en cola', flush=True)
    t0 = time.time()
    for i, (pid, dest, seed) in enumerate(cola):
        while True:
            h = api('/history/' + pid).get(pid)
            if h and h.get('status', {}).get('completed') is not None:
                break
            time.sleep(1)
        imgs = [f for o in h['outputs'].values() for f in o.get('images', [])]
        if not imgs:
            print('  ERROR', dest, h.get('status'), flush=True)
            continue
        f = imgs[0]
        q = urllib.parse.urlencode({'filename': f['filename'], 'subfolder': f['subfolder'], 'type': f['type']})
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        open(dest, 'wb').write(api('/view?' + q))
        semillas[os.path.relpath(dest, SALIDA).replace('\\', '/')] = seed
        json.dump(semillas, open(semillas_f, 'w', encoding='utf-8'), indent=1, sort_keys=True)
        print(f'  {i + 1}/{len(cola)} {os.path.relpath(dest, SALIDA)} ({time.time() - t0:.0f} s)', flush=True)


if __name__ == '__main__':
    main(sys.argv[1:])
