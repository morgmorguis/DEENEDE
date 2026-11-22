"""Prueba de estilos medievales para los emojis: los mismos objetos en tres estilos, para elegir antes de hacerlos todos.

Uso (con ComfyUI abierto y su Python):
  python scripts/arte/emojis_estilos.py [--n=2]     → candidatos en scripts/arte/salida/emojis-estilos/<estilo>/<nombre>-<k>.png
  python scripts/arte/emojis_estilos.py --hoja      → scripts/arte/salida/emojis-estilos/estilos.png (comparación)
"""
import os, random, sys, time, urllib.parse

sys.path.insert(0, os.path.dirname(__file__))
from generar import SALIDA, api, flujo  # noqa: E402

CAND = os.path.join(SALIDA, 'emojis-estilos')

# Objetos de época (nada de cajas de regalo ni papeleras modernas)
OBJETOS = {
    'espadas': ('⚔️', 'two crossed medieval longswords with leather-wrapped hilts'),
    'regalo': ('🎁', 'a small iron-bound wooden chest tied with a red cloth ribbon'),
    'corazon': ('❤️', 'a red heart'),
    'papelera': ('🗑️', 'an old wooden bucket with iron bands'),
    'aviso': ('⚠️', 'a triangular wooden sign with a red painted exclamation mark, iron nails'),
    'pluma': ('✒️', 'a feather quill pen dipped in a small ink pot'),
    'mapa': ('🗺️', 'an old unrolled map on dark aged brown parchment with a red X'),
}

AISLADO = 'single isolated object, centered, filling half of the frame, flat pure white background, nothing else, no text, no letters'
ESTILOS = {
    'grimorio': ('Grimorio iluminado', 'medieval illuminated manuscript miniature, gold leaf highlights, muted earthy ink colors, aged hand-painted look, pixel art'),
    'oscuro': ('Inventario oscuro', '1990s dark fantasy RPG inventory icon, worn weathered materials, rusty iron, dark desaturated earthy palette, gritty pixel art'),
    'heraldico': ('Heráldico', 'medieval heraldry charge, bold flat heraldic colors (deep red, royal blue, gold, silver), thick black outline, coat of arms style, pixel art'),
}


def generar(n):
    cola = []
    for est, (_, estilo) in ESTILOS.items():
        for nom, (_, obj) in OBJETOS.items():
            for k in range(1, n + 1):
                prompt = f'{obj}, {estilo}, {AISLADO}'
                pid = api('/prompt', {'prompt': flujo(prompt, 1024, 1024, random.randrange(2**32), True)})['prompt_id']
                cola.append((pid, os.path.join(CAND, est, f'{nom}-{k}.png')))
    print(f'{len(cola)} en cola', flush=True)
    for pid, dest in cola:
        while True:
            h = api('/history/' + pid).get(pid)
            if h and h.get('status', {}).get('completed') is not None:
                break
            time.sleep(1)
        f = [f for o in h['outputs'].values() for f in o.get('images', [])][0]
        q = urllib.parse.urlencode({'filename': f['filename'], 'subfolder': f['subfolder'], 'type': f['type']})
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        open(dest, 'wb').write(api('/view?' + q))
        print('  ' + os.path.relpath(dest, CAND), flush=True)


def hoja():
    """Cada fila un objeto; cada columna un estilo: a 20 px (tamaño real) y ×3, del mejor candidato y del otro"""
    from PIL import Image, ImageDraw, ImageFont
    from iconos_procesar import icono
    try:
        f_emo = ImageFont.truetype('seguiemj.ttf', 36)
        f_txt = ImageFont.truetype('segoeui.ttf', 17)
    except OSError:
        f_emo = f_txt = ImageFont.load_default()
    col, fila, izq = 290, 96, 90
    im = Image.new('RGB', (izq + col * len(ESTILOS), 44 + fila * len(OBJETOS)), (28, 22, 18))
    d = ImageDraw.Draw(im)
    for j, (est, (titulo, _)) in enumerate(ESTILOS.items()):
        d.text((izq + j * col + 8, 10), f'{chr(65 + j)}. {titulo}', fill=(230, 200, 140), font=f_txt)
    for i, (nom, (e, _)) in enumerate(OBJETOS.items()):
        y = 44 + i * fila
        d.text((20, y + 20), e, font=f_emo, embedded_color=True)
        for j, est in enumerate(ESTILOS):
            x = izq + j * col
            for k in (1, 2):
                src = os.path.join(CAND, est, f'{nom}-{k}.png')
                if not os.path.exists(src):
                    continue
                png = os.path.join(CAND, est, 'px', f'{nom}-{k}.png')
                icono(src, png)
                ic = Image.open(png).convert('RGBA')
                small = ic.resize((20, 20), Image.Resampling.BOX)
                big = ic.resize((84, 84), Image.Resampling.NEAREST)
                ox = x + (k - 1) * 140
                im.paste(small, (ox + 4, y + 36), small)
                im.paste(big, (ox + 34, y + 6), big)
    out = os.path.join(CAND, 'estilos.png')
    im.save(out)
    print('Hoja:', os.path.abspath(out))


if __name__ == '__main__':
    if '--hoja' in sys.argv:
        hoja()
    else:
        generar(next((int(a[4:]) for a in sys.argv[1:] if a.startswith('--n=')), 2))
