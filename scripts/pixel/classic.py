"""Fondos pixel art del estilo «Clásico» a partir de los pósteres pintados (public/posters).

Cada póster se reduce con nitidez, se le da una paleta limitada propia (k-medias), se trama con
una matriz de Bayer suave y se marcan los contornos oscuros, como un fondo de RPG de 16 bits cuidado.
Uso: python scripts/pixel/classic.py [tamaño=288] [colores=40] [carpeta=public/design/clasico]
"""
import sys, os
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np

SIZE = int(sys.argv[1]) if len(sys.argv) > 1 else 288
COLORS = int(sys.argv[2]) if len(sys.argv) > 2 else 40
OUT = sys.argv[3] if len(sys.argv) > 3 else 'public/design/clasico'
DITHER = float(sys.argv[4]) if len(sys.argv) > 4 else 0.10
NAMES = ['ocaso', 'bosque', 'cumbres', 'abismo', 'mar', 'mazmorra', 'ciudadela', 'cripta']
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 - 0.5


def kmeans(px, k, iters=12, seed=7):
    rng = np.random.default_rng(seed)
    # Semillas repartidas por luminosidad para no perder sombras ni brillos
    lum = px @ np.array([0.3, 0.59, 0.11])
    order = np.argsort(lum)
    centers = px[order[np.linspace(0, len(px) - 1, k).astype(int)]].astype(float)
    sample = px[rng.choice(len(px), min(len(px), 40000), replace=False)].astype(float)
    for _ in range(iters):
        d = ((sample[:, None, :] - centers[None, :, :]) ** 2).sum(-1)
        lab = d.argmin(1)
        for i in range(k):
            m = sample[lab == i]
            if len(m):
                centers[i] = m.mean(0)
    return centers


def pixelate(src):
    im = Image.open(src).convert('RGB')
    # Contraste y saturación algo más vivos: el pixel art pierde matices al reducirse
    im = ImageEnhance.Contrast(im).enhance(1.12)
    im = ImageEnhance.Color(im).enhance(1.18)
    im = im.filter(ImageFilter.UnsharpMask(radius=4, percent=140, threshold=2))
    # Quita el grano del póster: zonas de color limpias, como pintadas píxel a píxel
    mid = im.resize((SIZE * 2, SIZE * 2), Image.Resampling.LANCZOS).filter(ImageFilter.ModeFilter(3)).filter(ImageFilter.MedianFilter(3))
    small = mid.resize((SIZE, SIZE), Image.Resampling.BOX)
    a = np.asarray(small).astype(float)
    centers = kmeans(a.reshape(-1, 3), COLORS)
    # Tramado ordenado: desplaza cada píxel según la matriz antes de elegir color
    h, w, _ = a.shape
    spread = 255 * DITHER
    t = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w][..., None]
    a2 = np.clip(a + t * spread, 0, 255)
    d = ((a2[:, :, None, :] - centers[None, None, :, :]) ** 2).sum(-1)
    q = centers[d.argmin(-1)]
    # Contornos: oscurece los bordes con mucho salto de luz (silueta marcada, estilo sprite)
    lum = q @ np.array([0.3, 0.59, 0.11])
    gy = np.abs(np.diff(lum, axis=0, prepend=lum[:1]))
    gx = np.abs(np.diff(lum, axis=1, prepend=lum[:, :1]))
    edge = (np.maximum(gx, gy) > 70) & (lum < np.roll(lum, 1, 0)) & (lum < 120)
    q[edge] = q[edge] * 0.55
    return Image.fromarray(q.astype(np.uint8))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for n in NAMES:
        out = pixelate(f'public/posters/{n}.jpg')
        out.save(f'{OUT}/{n}.png', optimize=True)
        print(n, f'{OUT}/{n}.png')
