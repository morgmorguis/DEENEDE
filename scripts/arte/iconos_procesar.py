"""Convierte los candidatos de scripts/arte/iconos.py en los iconos de la app.

Uso: python scripts/arte/iconos_procesar.py sheet=2 combat=1 … app=3
- Iconos de la barra: quita el fondo blanco (relleno desde los bordes), recorta y reduce a una rejilla de 32×32
  con 20 colores → public/iconos/<id>.png (se ve con image-rendering: pixelated).
- app: icono de la app → public/icon-512.png, icon-192.png, favicon.png, design/retro/icon-*.png, mipmaps de Android
  y build/icons/app.ico.
- dm: icono del DM → public/icon-dm-512.png, icon-dm-192.png, favicon-dm.png (enlace /dm y modo DM) y
  build/icons/server.ico (el .exe del servidor de Windows).
"""
import os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from procesar import kmeans  # noqa: E402

AQUI = os.path.dirname(__file__)
RAIZ = os.path.join(AQUI, '..', '..')
CAND = os.path.join(AQUI, 'salida', 'iconos')
GRID = 32


def sin_fondo(im, tol=60):
    """Máscara del objeto: todo lo que no se alcanza desde el borde por píxeles casi blancos"""
    a = np.asarray(im.convert('RGB')).astype(int)
    h, w, _ = a.shape
    claro = (255 - a).max(-1) < tol
    fondo = np.zeros((h, w), bool)
    q = deque([(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)])
    while q:
        y, x = q.popleft()
        if 0 <= y < h and 0 <= x < w and not fondo[y, x] and claro[y, x]:
            fondo[y, x] = True
            q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    # Huecos cerrados (el centro de un engranaje, el asa de un cofre): zonas blancas grandes que no tocan el borde
    visto = fondo.copy()
    for y0, x0 in zip(*np.nonzero(claro & ~fondo)):
        if visto[y0, x0]:
            continue
        zona, q = [], deque([(y0, x0)])
        visto[y0, x0] = True
        while q:
            y, x = q.popleft()
            zona.append((y, x))
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and not visto[yy, xx] and claro[yy, xx]:
                    visto[yy, xx] = True
                    q.append((yy, xx))
        if len(zona) > h * w * 0.002:
            ys, xs = zip(*zona)
            fondo[list(ys), list(xs)] = True
    return ~fondo


def icono(src, dest):
    im = Image.open(src).convert('RGB')
    m = sin_fondo(im.resize((512, 512), Image.Resampling.BOX))
    m = np.asarray(Image.fromarray(m).resize(im.size, Image.Resampling.NEAREST))
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    lado = int(max(y1 - y0, x1 - x0) * 1.06)
    cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    caja = (cx - lado // 2, cy - lado // 2, cx - lado // 2 + lado, cy - lado // 2 + lado)
    rgba = im.convert('RGBA')
    rgba.putalpha(Image.fromarray((m * 255).astype(np.uint8)))
    rgba = rgba.crop(caja)
    # Reducción a la rejilla: color por moda en un paso intermedio y alfa por mayoría
    mid = rgba.resize((GRID * 4, GRID * 4), Image.Resampling.BOX)
    rgb = mid.convert('RGB').filter(ImageFilter.ModeFilter(3)).resize((GRID, GRID), Image.Resampling.BOX)
    alpha = np.asarray(mid.getchannel('A').resize((GRID, GRID), Image.Resampling.BOX)) > 110
    a = np.asarray(rgb).astype(float)
    centers = kmeans(a[alpha], 20)
    lab = ((a.reshape(-1, 1, 3) - centers[None]) ** 2).sum(-1).argmin(1)
    out = np.dstack([centers[lab].reshape(GRID, GRID, 3).clip(0, 255), alpha * 255]).astype(np.uint8)
    # Contorno oscuro de 1 píxel alrededor, como los iconos de inventario de los 16 bits
    al = out[..., 3] > 0
    borde = np.zeros_like(al)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        borde |= np.roll(al, (dy, dx), (0, 1))
    borde &= ~al
    out[borde] = (16, 10, 12, 255)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    Image.fromarray(out).save(dest, optimize=True)


def insignia(size):
    """Ondas de conexión pixel art (esquina del icono del servidor)"""
    u = size / 16
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((u, u, 15 * u, 15 * u), fill='#0e2a1a', outline='#000', width=max(1, int(u)))
    for r in (7, 4.6, 2.3):
        for g in range(30, 151, 4):
            x = round(8 + np.cos(np.radians(g)) * r)
            y = round(12 - np.sin(np.radians(g)) * r)
            d.rectangle((x * u, y * u, (x + 1) * u - 1, (y + 1) * u - 1), fill='#7ef0a0')
    d.rectangle((7 * u, 11 * u, 9 * u - 1, 13 * u - 1), fill='#7ef0a0')
    return im


def pixelar(src):
    """Rejilla pixel limpia (128 celdas, 40 colores) a 512 px"""
    im = Image.open(src).convert('RGB')
    lado = min(im.size)
    im = im.crop(((im.width - lado) // 2, (im.height - lado) // 2, (im.width + lado) // 2, (im.height + lado) // 2))
    # Rejilla pixel limpia (128 celdas) y después cada tamaño
    a = np.asarray(im.resize((256, 256), Image.Resampling.BOX).filter(ImageFilter.ModeFilter(3))
                   .resize((128, 128), Image.Resampling.BOX)).astype(float)
    centers = kmeans(a.reshape(-1, 3), 40)
    base = Image.fromarray(centers[((a.reshape(-1, 1, 3) - centers[None]) ** 2).sum(-1).argmin(1)]
                           .reshape(128, 128, 3).clip(0, 255).astype(np.uint8))
    return base, base.resize((512, 512), Image.Resampling.NEAREST)


def tam(big, n):
    return big.resize((n, n), Image.Resampling.LANCZOS if n < 128 else Image.Resampling.NEAREST)


ICO = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def dm(src):
    _, big = pixelar(src)
    pub = os.path.join(RAIZ, 'public')
    big.save(os.path.join(pub, 'icon-dm-512.png'))
    tam(big, 192).save(os.path.join(pub, 'icon-dm-192.png'))
    tam(big, 64).save(os.path.join(pub, 'favicon-dm.png'))
    ico = os.path.join(RAIZ, 'build', 'icons')
    big.save(os.path.join(ico, 'server-512.png'))
    big.save(os.path.join(ico, 'server.ico'), sizes=ICO)


def app(src):
    base, big = pixelar(src)
    sz = lambda n: tam(big, n)
    pub = os.path.join(RAIZ, 'public')
    big.save(os.path.join(pub, 'icon-512.png'))
    sz(192).save(os.path.join(pub, 'icon-192.png'))
    sz(64).save(os.path.join(pub, 'favicon.png'))
    for n in (512, 192, 64):
        sz(n).save(os.path.join(pub, 'design', 'retro', f'icon-{n}.png'))
    # Android: icono normal, redondo y primer plano adaptable (a sangre: el sistema recorta el centro)
    res = os.path.join(RAIZ, 'android', 'app', 'src', 'main', 'res')
    for dens, n, fg in (('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)):
        d = os.path.join(res, f'mipmap-{dens}')
        sz(n).save(os.path.join(d, 'ic_launcher.png'))
        r = sz(n).convert('RGBA')
        mask = Image.new('L', (n * 4, n * 4), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, n * 4 - 1, n * 4 - 1), fill=255)
        r.putalpha(mask.resize((n, n), Image.Resampling.LANCZOS))
        r.save(os.path.join(d, 'ic_launcher_round.png'))
        # El primer plano mide 108 dp y se ven unos 72: se amplía para que el emblema llene la zona visible
        f = big.resize((round(fg * 1.25), round(fg * 1.25)), Image.Resampling.LANCZOS)
        o = (f.width - fg) // 2
        f.crop((o, o, o + fg, o + fg)).save(os.path.join(d, 'ic_launcher_foreground.png'))
    # Pantalla de arranque de Android: el emblema en el centro sobre fondo oscuro, en cada densidad y orientación
    for carpeta in os.listdir(res):
        f = os.path.join(res, carpeta, 'splash.png')
        if carpeta.startswith('drawable') and os.path.exists(f):
            w, h = Image.open(f).size
            n = min(w, h) // 3 // 128 * 128 or 128
            splash = Image.new('RGB', (w, h), (18, 10, 12))
            splash.paste(base.resize((n, n), Image.Resampling.NEAREST), ((w - n) // 2, (h - n) // 2))
            splash.save(f)
    # Windows: .ico con varios tamaños (el del servidor es el del DM: ver dm())
    ico = os.path.join(RAIZ, 'build', 'icons')
    big.save(os.path.join(ico, 'app-512.png'))
    big.save(os.path.join(ico, 'app.ico'), sizes=ICO)


def main(args):
    for a in args:
        i, k = a.split('=')
        src = os.path.join(CAND, f'{i}-{k}.png')
        if i == 'app':
            app(src)
        elif i == 'dm':
            dm(src)
        else:
            icono(src, os.path.join(RAIZ, 'public', 'iconos', f'{i}.png'))
        print('ok', a)


if __name__ == '__main__':
    main(sys.argv[1:])
