"""Icono pixel art: un goblin mirando a cámara que lanza dados rojos hacia el espectador.

Se dibuja por capas en una cuadrícula de 40×40 (cada objeto con su propio contorno) y se escala
sin suavizado. Genera los iconos de Android (normal, redondo y adaptativo), la pantalla de carga
y los iconos web. Uso: python3 scripts/icon/goblin.py [--preview ruta.png]
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
N = 40

C = {
    'K': (22, 16, 24),       # contorno
    'G': (104, 176, 72),     # piel
    'g': (66, 122, 50),      # piel en sombra
    'L': (164, 220, 112),    # brillo de la piel
    'Y': (255, 218, 62),     # ojos
    'W': (248, 244, 232),    # dientes / puntos del dado
    'P': (140, 40, 52),      # boca
    'B': (122, 78, 46),      # túnica
    'b': (86, 54, 34),       # túnica en sombra
    'R': (214, 40, 44),      # dado
    'r': (246, 96, 88),      # cara superior del dado
    'D': (150, 22, 34),      # lateral del dado
    'M': (255, 205, 196),    # estela
}
BG = (43, 30, 46)


class Layer:
    """Capa de N×N con un carácter de color por píxel."""

    def __init__(self):
        self.px = [[None] * N for _ in range(N)]

    def set(self, x, y, ch):
        if 0 <= x < N and 0 <= y < N:
            self.px[y][x] = ch

    def ellipse(self, x0, y0, x1, y1, ch, cond=None):
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        rx, ry = (x1 - x0) / 2 + 0.5, (y1 - y0) / 2 + 0.5
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 and (cond is None or cond(x, y)):
                    self.set(x, y, ch)

    def rect(self, x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, ch)

    def polygon(self, pts, ch):
        img = Image.new('L', (N, N), 0)
        ImageDraw.Draw(img).polygon(pts, fill=1)
        for y in range(N):
            for x in range(N):
                if img.getpixel((x, y)):
                    self.set(x, y, ch)

    def recolor(self, ch, cond):
        for y in range(N):
            for x in range(N):
                if self.px[y][x] and cond(x, y):
                    self.px[y][x] = ch

    def shifted(self, dx, dy):
        out = Layer()
        for y in range(N):
            for x in range(N):
                if self.px[y][x]:
                    out.set(x + dx, y + dy, self.px[y][x])
        return out

    def outlined(self):
        """Añade un contorno de 1 píxel alrededor de lo dibujado."""
        out = Layer()
        for y in range(N):
            for x in range(N):
                out.px[y][x] = self.px[y][x]
        for y in range(N):
            for x in range(N):
                if self.px[y][x]:
                    continue
                if any(0 <= x + dx < N and 0 <= y + dy < N and self.px[y + dy][x + dx]
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    out.px[y][x] = 'K'
        return out


def compose(layers):
    canvas = [[None] * N for _ in range(N)]
    for layer in layers:
        for y in range(N):
            for x in range(N):
                if layer.px[y][x]:
                    canvas[y][x] = layer.px[y][x]
    return canvas


def goblin_layers():
    body = Layer()
    body.ellipse(7, 18, 32, 44, 'B')
    body.recolor('b', lambda x, y: x > 26 or y > 31)
    body.rect(18, 17, 22, 20, 'g')  # cuello

    head = Layer()
    # Orejas largas y puntiagudas hacia los lados
    head.polygon([(13, 10), (1, 4), (4, 9), (12, 15)], 'G')
    head.polygon([(27, 10), (39, 4), (36, 9), (28, 15)], 'G')
    head.ellipse(10, 3, 30, 22, 'G')
    head.recolor('g', lambda x, y: y >= 18 or x <= 11 or (x >= 4 and x <= 8 and y >= 9) or (x >= 32 and y >= 9))
    head.recolor('L', lambda x, y: (y in (5, 6) and 14 <= x <= 17) or (y == 7 and 13 <= x <= 14) or (y == 6 and x in (3, 4)))
    # Ojos amarillos con pupila y cejas pobladas
    for ex in (14, 23):
        head.rect(ex, 10, ex + 3, 12, 'Y')
        head.rect(ex + 1, 11, ex + 2, 12, 'K')
    head.rect(13, 8, 17, 8, 'K')
    head.rect(23, 8, 27, 8, 'K')
    head.set(17, 9, 'K')
    head.set(23, 9, 'K')
    # Nariz ganchuda
    head.rect(19, 13, 21, 15, 'g')
    head.set(20, 12, 'L')
    # Sonrisa con colmillos
    head.rect(14, 17, 26, 19, 'P')
    head.rect(14, 17, 26, 17, 'K')
    for tx in (15, 17, 23, 25):
        head.set(tx, 18, 'W')
    head.set(16, 18, 'W')
    head.set(24, 18, 'W')
    head.rect(15, 20, 25, 20, 'K')
    head.set(14, 19, 'K')
    head.set(26, 19, 'K')

    arm = Layer()
    # Brazo derecho hacia delante y mano abierta, palma abajo, soltando los dados
    arm.polygon([(29, 19), (35, 22), (29, 28), (25, 24)], 'G')
    arm.ellipse(20, 21, 29, 27, 'G')
    for fx in (20, 23, 26):
        arm.rect(fx, 27, fx + 1, 30, 'G')
        arm.set(fx, 30, 'g')
        arm.set(fx + 1, 30, 'g')
    arm.rect(29, 24, 30, 26, 'G')  # pulgar
    arm.recolor('g', lambda x, y: (y == 26 and x not in (20, 21, 23, 24, 26, 27)) or x >= 32)
    arm.recolor('L', lambda x, y: y == 22 and 22 <= x <= 26)
    return [body.outlined(), head.shifted(0, -2).outlined(), arm.outlined()]


PIPS = {
    1: [(0.5, 0.5)],
    2: [(0.25, 0.25), (0.75, 0.75)],
    3: [(0.25, 0.25), (0.5, 0.5), (0.75, 0.75)],
    4: [(0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)],
    5: [(0.25, 0.25), (0.75, 0.25), (0.5, 0.5), (0.25, 0.75), (0.75, 0.75)],
    6: [(0.25, 0.2), (0.75, 0.2), (0.25, 0.5), (0.75, 0.5), (0.25, 0.8), (0.75, 0.8)],
}


def die(x, y, s, value, top_pips=0):
    """Dado de seis caras en perspectiva: cara frontal, superior y lateral."""
    d = Layer()
    depth = max(2, s // 3)
    d.rect(x, y + depth, x + s - 1, y + depth + s - 1, 'R')
    d.polygon([(x, y + depth), (x + depth, y), (x + depth + s - 1, y), (x + s - 1, y + depth)], 'r')
    d.polygon([(x + s - 1, y + depth), (x + depth + s - 1, y), (x + depth + s - 1, y + s - 1), (x + s - 1, y + depth + s - 1)], 'D')
    for px, py in PIPS[value]:
        cx = x + round(px * (s - 1))
        cy = y + depth + round(py * (s - 1))
        d.set(cx, cy, 'W')
        if s >= 10:
            d.set(cx + 1, cy, 'W')
            d.set(cx, cy + 1, 'W')
            d.set(cx + 1, cy + 1, 'W')
    if top_pips:
        d.set(x + depth + s // 2 - 1, y + depth // 2, 'W')
    return d.outlined()


def trail(points):
    t = Layer()
    for x, y in points:
        t.set(x, y, 'M')
    return t


def art():
    layers = goblin_layers()
    layers.append(trail([(19, 32), (18, 33), (28, 32), (29, 33), (17, 29), (16, 30)]))
    layers.append(die(21, 33, 4, 3))          # el pequeño, recién soltado
    layers.append(die(31, 28, 6, 5, 1))       # el mediano, a la derecha
    layers.append(die(3, 24, 11, 6, 1))       # el grande, casi encima de la cámara
    return compose(layers)


def render(size: int, pad: float, bg=None, round_mask=False) -> Image.Image:
    grid = art()
    inner = int(size * (1 - 2 * pad))
    cell = max(1, inner // N)
    sprite = Image.new('RGBA', (N * cell, N * cell), (0, 0, 0, 0))
    d = ImageDraw.Draw(sprite)
    for y in range(N):
        for x in range(N):
            ch = grid[y][x]
            if ch:
                d.rectangle([x * cell, y * cell, (x + 1) * cell - 1, (y + 1) * cell - 1], fill=C[ch] + (255,))
    img = Image.new('RGBA', (size, size), bg + (255,) if bg else (0, 0, 0, 0))
    off = (size - sprite.width) // 2
    img.alpha_composite(sprite, (off, off))
    if round_mask:
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
        out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        return out
    return img


def main():
    if '--preview' in sys.argv:
        render(520, 0.04, BG).save(sys.argv[sys.argv.index('--preview') + 1])
        return
    res = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
    densities = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
    for name, k in densities.items():
        folder = res / f'mipmap-{name}'
        folder.mkdir(parents=True, exist_ok=True)
        legacy = int(48 * k)
        render(legacy, 0.04, BG).save(folder / 'ic_launcher.png')
        render(legacy, 0.12, BG, round_mask=True).save(folder / 'ic_launcher_round.png')
        # Icono adaptativo: 108dp con la zona segura de 66dp en el centro
        render(int(108 * k), 0.2).save(folder / 'ic_launcher_foreground.png')
    (res / 'values' / 'ic_launcher_background.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        f'    <color name="ic_launcher_background">#{BG[0]:02X}{BG[1]:02X}{BG[2]:02X}</color>\n</resources>\n'
    )
    # Pantallas de carga con el goblin centrado
    for f in res.glob('drawable*/splash.png'):
        w, h = Image.open(f).size
        sprite = render(int(min(w, h) * 0.5), 0)
        img = Image.new('RGBA', (w, h), BG + (255,))
        img.alpha_composite(sprite, ((w - sprite.width) // 2, (h - sprite.height) // 2))
        img.convert('RGB').save(f)
    public = ROOT / 'public'
    render(192, 0.04, BG).save(public / 'icon-192.png')
    render(512, 0.04, BG).save(public / 'icon-512.png')
    render(64, 0.0).save(public / 'favicon.png')
    print('Iconos generados')


if __name__ == '__main__':
    main()
