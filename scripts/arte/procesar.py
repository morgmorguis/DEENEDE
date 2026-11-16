"""Pasa las imágenes de scripts/arte/salida a los fondos de la app (public/fondos/<estilo>/<nombre>-<v|h>.<ext>).

- pintado → WebP de 1344×768 / 768×1344 (calidad 74)
- pixel   → rejilla de pixel art limpia a 1/4 (336×192 / 192×336), 48 colores, PNG (se ve con image-rendering: pixelated)
- retro   → de las mismas imágenes pixel a 1/8 (168×96 / 96×168), 24 colores con tramado ordenado, PNG
Uso: python scripts/arte/procesar.py [nombre…]   (necesita Pillow y numpy; vale el Python de ComfyUI portable)
"""
import os, sys
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

AQUI = os.path.dirname(__file__)
SALIDA = os.path.join(AQUI, 'salida')
DEST = os.path.join(AQUI, '..', '..', 'public', 'fondos')
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 - 0.5


def kmeans(px, k, iters=12, seed=7):
    """Paleta limitada propia de cada imagen; semillas repartidas por luminosidad para no perder sombras ni brillos"""
    rng = np.random.default_rng(seed)
    order = np.argsort(px @ np.array([0.3, 0.59, 0.11]))
    centers = px[order[np.linspace(0, len(px) - 1, k).astype(int)]].astype(float)
    sample = px[rng.choice(len(px), min(len(px), 30000), replace=False)].astype(float)
    for _ in range(iters):
        lab = ((sample[:, None, :] - centers[None, :, :]) ** 2).sum(-1).argmin(1)
        for i in range(k):
            m = sample[lab == i]
            if len(m):
                centers[i] = m.mean(0)
    return centers


def pixel_art(im, factor, colors, dither):
    w, h = im.width // factor, im.height // factor
    im = ImageEnhance.Contrast(im).enhance(1.06)
    # Quita el ruido del modelo: zonas de color limpias antes de reducir
    mid = im.resize((w * 2, h * 2), Image.Resampling.BOX).filter(ImageFilter.ModeFilter(3))
    a = np.asarray(mid.resize((w, h), Image.Resampling.BOX)).astype(float)
    centers = kmeans(a.reshape(-1, 3), colors)
    if dither:
        t = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w][..., None]
        a = a + t * 255 * dither
    lab = ((a.reshape(-1, 1, 3) - centers[None]) ** 2).sum(-1).argmin(1)
    return Image.fromarray(centers[lab].reshape(h, w, 3).clip(0, 255).astype(np.uint8))


def main(filtros):
    hechos = 0
    for estilo in ('pintado', 'pixel'):
        carpeta = os.path.join(SALIDA, estilo)
        if not os.path.isdir(carpeta):
            continue
        for f in sorted(os.listdir(carpeta)):
            nombre = f[:-4]
            if not f.endswith('.png') or (filtros and not any(x in nombre for x in filtros)):
                continue
            im = Image.open(os.path.join(carpeta, f)).convert('RGB')
            if estilo == 'pintado':
                os.makedirs(os.path.join(DEST, 'pintado'), exist_ok=True)
                im.save(os.path.join(DEST, 'pintado', nombre + '.webp'), quality=74, method=6)
            else:
                for sub, factor, colors, dither in (('pixel', 4, 48, 0), ('retro', 8, 24, 0.06)):
                    os.makedirs(os.path.join(DEST, sub), exist_ok=True)
                    pixel_art(im, factor, colors, dither).save(os.path.join(DEST, sub, nombre + '.png'), optimize=True)
            hechos += 1
    print(f'{hechos} imágenes procesadas en public/fondos')


if __name__ == '__main__':
    main(sys.argv[1:])
