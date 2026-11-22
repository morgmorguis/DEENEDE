"""Fuente de emojis de la app: los PNG de 32×32 de design/emoji pasan a una fuente de color (COLR v0 + CPAL) hecha de
cuadrados de píxel, para que cada emoji que aparece en un texto (botones, avisos, títulos, listas…) se vea con el dibujo
propio sin tocar el código. La app la pone la primera en todas las familias de letra, pero solo para esos caracteres
(unicode-range), así que el resto del texto no cambia.

Uso (Python con fonttools y brotli):  python scripts/arte/emojis_fuente.py
  → src/assets/di-emoji.woff2 y src/emoji.css (@font-face con la lista de caracteres)
"""
import os, sys
import numpy as np
from PIL import Image
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.colorLib.builder import buildCOLR, buildCPAL
from fontTools.ttLib import TTFont

RAIZ = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(RAIZ, 'design', 'emoji')
WOFF2 = os.path.join(RAIZ, 'src', 'assets', 'di-emoji.woff2')
CSS = os.path.join(RAIZ, 'src', 'emoji.css')
FAMILIA = 'Di Emoji'

# Caracteres que usan el dibujo de otro (la lupa hacia la izquierda y hacia la derecha son la misma)
ALIAS = {0x1F50D: 0x1F50E}

EM = 1024
G = 32
PX = 38                # un píxel del dibujo = 38 unidades: el emoji mide 1,2 veces la letra, como los de sistema
LADO = 1               # margen a cada lado, en píxeles
ABAJO = -200           # el emoji baja un poco de la línea base
ARRIBA = ABAJO + G * PX
# Métricas de línea normales: el dibujo puede sobresalir un poco sin que la línea crezca
ASC, DESC = 900, -220


def rectangulos(mask):
    """Rectángulos que cubren la máscara: tramos por fila, unidos con los de la fila siguiente si coinciden"""
    abiertos, out = {}, []
    for y in range(mask.shape[0] + 1):
        tramos = set()
        if y < mask.shape[0]:
            fila = mask[y]
            x = 0
            while x < len(fila):
                if fila[x]:
                    x0 = x
                    while x < len(fila) and fila[x]:
                        x += 1
                    tramos.add((x0, x))
                else:
                    x += 1
        for t in list(abiertos):
            if t not in tramos:
                out.append((t[0], abiertos.pop(t), t[1], y))
        for t in tramos:
            abiertos.setdefault(t, y)
    return out


def glifo(rects):
    pen = TTGlyphPen(None)
    for x0, y0, x1, y1 in rects:
        X0, X1 = (x0 + LADO) * PX, (x1 + LADO) * PX
        Y0, Y1 = ARRIBA - y1 * PX, ARRIBA - y0 * PX
        pen.moveTo((X0, Y0)); pen.lineTo((X0, Y1)); pen.lineTo((X1, Y1)); pen.lineTo((X1, Y0)); pen.closePath()
    return pen.glyph()


def main():
    archivos = sorted(f for f in os.listdir(SRC) if f.endswith('.png') and '-' not in f)
    if not archivos:
        sys.exit('No hay emojis en design/emoji')
    orden, glifos, cmap, capas, paleta, idx = ['.notdef', 'vs16'], {}, {}, {}, [], {}
    vacio = TTGlyphPen(None).glyph()
    glifos['.notdef'] = vacio
    glifos['vs16'] = vacio
    cmap[0xFE0F] = 'vs16'
    for f in archivos:
        cp = int(f[:-4], 16)
        a = np.asarray(Image.open(os.path.join(SRC, f)).convert('RGBA').resize((G, G), Image.Resampling.NEAREST))
        base = f'u{cp:X}'
        orden.append(base)
        glifos[base] = vacio
        cmap[cp] = base
        lista = []
        visible = a[..., 3] > 127
        colores = {tuple(int(v) for v in a[y, x, :3]) for y, x in zip(*np.nonzero(visible))}
        for n, col in enumerate(sorted(colores)):
            mask = visible & np.all(a[..., :3] == col, axis=-1)
            nombre = f'{base}.c{n}'
            orden.append(nombre)
            glifos[nombre] = glifo(rectangulos(mask))
            if col not in idx:
                idx[col] = len(paleta)
                paleta.append((col[0] / 255, col[1] / 255, col[2] / 255, 1.0))
            lista.append((nombre, idx[col]))
        capas[base] = lista
    for a, b in ALIAS.items():
        if f'u{b:X}' in glifos:
            cmap[a] = f'u{b:X}'
    ancho = (G + 2 * LADO) * PX
    fb = FontBuilder(EM, isTTF=True)
    fb.setupGlyphOrder(orden)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glifos)
    metricas = {}
    for n in orden:
        g = glifos[n]
        g.recalcBounds(fb.font['glyf']) if hasattr(g, 'recalcBounds') else None
        metricas[n] = (0 if n == 'vs16' else ancho, getattr(g, 'xMin', 0) or 0)
    fb.setupHorizontalMetrics(metricas)
    fb.setupHorizontalHeader(ascent=ASC, descent=DESC)
    fb.setupNameTable({'familyName': FAMILIA, 'styleName': 'Regular'})
    fb.setupOS2(sTypoAscender=ASC, sTypoDescender=DESC, usWinAscent=ASC, usWinDescent=-DESC)
    fb.setupPost()
    fb.font['COLR'] = buildCOLR(capas, version=0)
    fb.font['CPAL'] = buildCPAL([paleta])
    os.makedirs(os.path.dirname(WOFF2), exist_ok=True)
    fb.font.flavor = 'woff2'
    fb.font.save(WOFF2)
    # Comprobación: se vuelve a abrir
    TTFont(WOFF2)
    rangos = ', '.join(f'U+{c:X}' for c in sorted(cmap))
    open(CSS, 'w', encoding='utf-8').write(
        '/* Generado por scripts/arte/emojis_fuente.py: emojis propios (pixel, estilo grimorio). No editar a mano. */\n'
        '@font-face {\n'
        f"  font-family: '{FAMILIA}';\n"
        "  src: url('./assets/di-emoji.woff2') format('woff2');\n"
        '  font-display: block;\n'
        f'  unicode-range: {rangos};\n'
        '}\n')
    print(f'{len(archivos)} emojis, {len(paleta)} colores, {len(orden)} glifos -> {os.path.relpath(WOFF2, RAIZ)} '
          f'({os.path.getsize(WOFF2) // 1024} KB) y {os.path.relpath(CSS, RAIZ)}')


if __name__ == '__main__':
    main()
