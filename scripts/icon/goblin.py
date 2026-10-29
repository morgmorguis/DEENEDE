"""Icono pixel art: un goblin lanzando un dado de 20 caras.

Genera los iconos de Android (normales, redondos y adaptativos) y los de la web a partir
de una cuadrícula de 32×32 píxeles. Uso: python3 scripts/icon/goblin.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]

PALETTE = {
    '.': None,
    'K': (24, 20, 28),      # contorno
    'G': (96, 168, 72),     # piel
    'g': (62, 120, 52),     # piel en sombra
    'L': (150, 210, 110),   # piel iluminada
    'Y': (250, 214, 64),    # ojos
    'W': (244, 240, 228),   # dientes / dado
    'w': (196, 190, 176),   # dado en sombra
    'R': (176, 44, 36),     # números del dado
    'B': (120, 76, 44),     # túnica
    'b': (84, 52, 32),      # túnica en sombra
    'S': (70, 70, 84),      # cinturón
    'M': (255, 236, 160),   # estela del lanzamiento
    'P': (214, 110, 120),   # boca
}

# 32×32. El goblin mira a la derecha y lanza el dado con la mano levantada.
ART = """
........................K.......
......................KKWKK.....
....................KKwWWWwKK...
................M..KWwWWRWWwWK..
.................M.KWwWRWRWwWK..
...................KWwRRRRRwWK..
..........M.M..M...KwwwwwwwwwK..
...........M.M..M...KKWwwwWKK...
..KK........M....M....KKWKK.....
..KLK...KKKKKK..........K..KK...
..KLGK.KGGGGGGKK..........KGK...
...KGGKGLLGGGGGGK.........KGK...
...KgGGLLGGGGGGGGK.......KGGK...
....KgGLGGKKGGKKGK......KGGK....
....KgGGGKYKGKYKGGKK...KGGK.....
.....KgGGKKKGKKKGGLLK.KGGK......
.....KgGGGGGGGGGGGGGKKGGK.......
......KgGGKWKWKWKGGGGGGK........
......KgGGKPPPPPKGGGGGK.........
.......KgGGKKKKKGGGGKK..........
........KggGGGGGGgK.............
.........KKgggggKK..............
........KBBKKKKKBBK.............
.......KBBBBBBBBBBBK............
......KgKBBBBBBBBBKgK...........
......KGKBBbBBBbBBKGK...........
......KGKSSSSSSSSSKKK...........
.......KKBBBBbBBBBK.............
........KBBbKKbBBK..............
........KggK..KggK..............
.......KgggK..KgggK.............
.......KKKKK..KKKKK.............
"""


def grid():
    rows = [r for r in ART.strip('\n').split('\n')]
    assert len(rows) == 32, len(rows)
    for r in rows:
        assert len(r) == 32, (len(r), r)
    return rows


def render(size: int, pad: float, bg=None, round_mask=False) -> Image.Image:
    """Dibuja el arte escalado con vecino más cercano y un margen (fracción del lado)."""
    rows = grid()
    inner = int(size * (1 - 2 * pad))
    cell = max(1, inner // 32)
    art = Image.new('RGBA', (32 * cell, 32 * cell), (0, 0, 0, 0))
    d = ImageDraw.Draw(art)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            col = PALETTE[ch]
            if col:
                d.rectangle([x * cell, y * cell, (x + 1) * cell - 1, (y + 1) * cell - 1], fill=col + (255,))
    img = Image.new('RGBA', (size, size), bg + (255,) if bg else (0, 0, 0, 0))
    off = (size - art.width) // 2
    img.alpha_composite(art, (off, off))
    if round_mask:
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
        out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        return out
    return img


BG = (43, 30, 46)  # morado oscuro de mazmorra

def main():
    res = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
    densities = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
    for name, k in densities.items():
        folder = res / f'mipmap-{name}'
        folder.mkdir(parents=True, exist_ok=True)
        legacy = int(48 * k)
        render(legacy, 0.06, BG).save(folder / 'ic_launcher.png')
        render(legacy, 0.12, BG, round_mask=True).save(folder / 'ic_launcher_round.png')
        # Icono adaptativo: 108dp con la zona segura de 66dp en el centro
        render(int(108 * k), 0.2).save(folder / 'ic_launcher_foreground.png')
    # Fondo del icono adaptativo
    values = res / 'values'
    (values / 'ic_launcher_background.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        f'    <color name="ic_launcher_background">#{BG[0]:02X}{BG[1]:02X}{BG[2]:02X}</color>\n</resources>\n'
    )
    public = ROOT / 'public'
    render(192, 0.06, BG).save(public / 'icon-192.png')
    render(512, 0.06, BG).save(public / 'icon-512.png')
    render(64, 0.0).save(public / 'favicon.png')
    print('Iconos generados')


if __name__ == '__main__':
    main()
