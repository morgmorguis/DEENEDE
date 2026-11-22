"""Emojis propios de la app: pixel art de estilo «grimorio iluminado» (medieval, tonos de tinta y pan de oro), con la IA local.

Uso (con ComfyUI abierto y su Python):
  python scripts/arte/emojis.py [nombre…] [--n=2]        → candidatos en scripts/arte/salida/emojis/<nombre>-<k>.png
                                                          (sin nombres: los que aún no tienen candidatos)
  python scripts/arte/emojis.py --procesar [nombre=k …]  → design/emoji/<código>.png (32×32) y hojas de muestra
                                                          scripts/arte/salida/emojis/muestra-<n>.png
  python scripts/arte/emojis.py --simbolos               → los símbolos sencillos (✅ ➕ flechas, puntos de color) dibujados
                                                          a mano en la misma rejilla
El candidato elegido de cada uno se apunta en scripts/arte/emojis-elegidos.json (por defecto, el 1).
Los objetos son de época: nada de disquetes, cohetes ni bombillas (💾 es un cofre con candado, 🚀 un cuerno de guerra…).
Las cosas muy claras (pergamino, plumas, nubes) pierden relleno al quitar el fondo blanco: mejor en tonos medios.
"""
import json, os, random, sys, time, urllib.parse

sys.path.insert(0, os.path.dirname(__file__))
from generar import SALIDA, api, flujo  # noqa: E402

RAIZ = os.path.join(os.path.dirname(__file__), '..', '..')
CAND = os.path.join(SALIDA, 'emojis')
DEST = os.path.join(RAIZ, 'design', 'emoji')
ELEGIDOS = os.path.join(os.path.dirname(__file__), 'emojis-elegidos.json')

ESTILO = 'medieval illuminated manuscript miniature, gold leaf highlights, muted earthy ink colors, aged hand-painted look, pixel art'
AISLADO = 'single isolated object, centered, filling half of the frame, flat pure white background, nothing else, no text, no letters'

# nombre: (emoji, qué se dibuja). El archivo final se llama por el código del emoji (2694.png para ⚔️)
EMOJIS = {
    'aviso': ('⚠️', 'a triangular wooden sign with a red painted exclamation mark, iron nails'),
    'espadas': ('⚔️', 'two crossed medieval longswords with leather-wrapped hilts'),
    'prohibido': ('⛔', 'a round red enamel shield sign with a horizontal cream bar across the middle'),
    'trato': ('🤝', 'two hands shaking, a handshake, leather bracers'),
    'dado': ('🎲', 'a red twenty-sided die, d20, with golden numbers'),
    'chispas': ('✨', 'three golden four-pointed magic sparkle stars'),
    'regalo': ('🎁', 'a small iron-bound wooden chest tied with a red cloth ribbon'),
    'calavera_tibias': ('☠️', 'a skull with two crossed bones behind it, ivory bone color'),
    'libro': ('📖', 'an open book seen from above at an angle, two curved tan pages with lines of text, brown leather cover, red ribbon bookmark'),
    'guardar': ('💾', 'a small iron-bound strongbox with a brass padlock'),
    'escudo': ('🛡️', 'a heater shield painted red with a golden cross, iron rim'),
    'corazon': ('❤️', 'a red heart'),
    'reloj_arena': ('⏳', 'an hourglass with a wooden frame, sand falling'),
    'candado': ('🔒', 'an old iron padlock, closed'),
    'papelera': ('🗑️', 'an old wooden bucket with iron bands, a yellow banana peel hanging over the rim'),
    'monedas': ('💰', 'a brown leather coin pouch tied with string, gold coins spilling out'),
    'calavera': ('💀', 'a skull, ivory bone color'),
    'hoja': ('📄', 'a single sheet of aged tan parchment with a few lines of ink writing, slightly curled corner'),
    'pagar': ('💸', 'three gold coins with small white wings flying'),
    'nota': ('📝', 'a parchment sheet with a feather quill writing on it'),
    'monstruo': ('👹', 'the head of a snarling green goblin with pointed ears and yellow eyes'),
    'cuadro': ('🖼️', 'a small landscape painting in an ornate gilded frame'),
    'cerebro': ('🧠', 'a pink brain'),
    'grupo': ('👥', 'two hooded adventurers seen from the chest up, side by side, brown and green hoods'),
    'luna': ('🌙', 'a pale golden crescent moon'),
    'silueta': ('👤', 'a dark hooded figure seen from the chest up, face hidden in shadow'),
    'lapiz': ('✏️', 'a wooden carpenter pencil, diagonal'),
    'carta': ('✉️', 'a folded tan letter closed with a red wax seal'),
    'oculto': ('🙈', 'a closed painted eye with long lashes, peaceful'),
    'mochila': ('🎒', 'a leather adventurer backpack with a rolled bedroll on top'),
    'pergamino': ('📜', 'a rolled tan parchment scroll tied with a red ribbon and a wax seal'),
    'nube': ('☁️', 'a puffy blue-grey cloud'),
    'arco': ('🏹', 'a thick dark brown wooden recurve bow with a bold string and an arrow with red fletching, diagonal'),
    'repetir': ('🔁', 'two curved golden arrows forming a circle'),
    'herramientas': ('🛠️', 'a crossed blacksmith hammer and iron tongs'),
    'esfera': ('🌐', 'a brass armillary sphere with rings'),
    'tienda': ('⛺', 'a canvas camping tent with a wooden pole and a small pennant'),
    'castillo': ('🏰', 'a small stone castle with two towers and red flags'),
    'enviar': ('📤', 'an open wooden box with a rolled scroll flying up out of it'),
    'recibir': ('📥', 'a wooden tray with a rolled scroll dropping into it'),
    'corazon_verde': ('💚', 'a green heart'),
    'pocion': ('🧪', 'a round glass potion flask with red liquid and a cork'),
    'saludo': ('👋', 'an open hand waving, leather fingerless glove'),
    'daga': ('🗡️', 'a steel dagger with a leather-wrapped hilt, diagonal'),
    'ojo': ('👁️', 'a single open painted eye with a brown iris'),
    'tablilla': ('📋', 'a wooden writing board with a parchment sheet pinned by a brass clip'),
    'lupa': ('🔎', 'a brass magnifying glass with a wooden handle'),
    'infinito': ('♾️', 'an ornate golden infinity symbol'),
    'bocadillo': ('💬', 'a speech bubble made of tan parchment with a dark outline'),
    'bandera': ('🏁', 'a black and white checkered pennant flag on a wooden pole'),
    'reciclar': ('♻️', 'three green arrows chasing each other in a triangle'),
    'correr': ('🏃', 'a running adventurer in a green tunic and brown boots, side view'),
    'golpe': ('💥', 'an orange and yellow explosion burst'),
    'abaco': ('📊', 'a wooden abacus with red and gold beads'),
    'chincheta': ('📌', 'a pin with a round red head'),
    'estrella': ('⭐', 'a golden five-pointed star'),
    'sangre': ('🩸', 'a single drop of dark red blood'),
    'automata': ('🤖', 'the head of a brass clockwork automaton with glowing blue eyes'),
    'cuerno_voz': ('🎙️', 'a brass speaking horn trumpet'),
    'carpeta_abierta': ('📂', 'an open leather folio with parchment sheets inside'),
    'mago': ('🧙', 'a bearded wizard with a tall pointy blue hat, from the chest up'),
    'corazon_negro': ('🖤', 'a dark charcoal grey heart'),
    'birrete': ('🎓', 'a black square scholar cap with a golden tassel'),
    'engranaje': ('⚙️', 'an ornate bronze cogwheel gear'),
    'ojos': ('👀', 'two separate large round eyes with brown irises looking to the left, only the eyes, no face, no skin'),
    'carta_llega': ('📨', 'a folded letter with a red wax seal flying, small motion lines'),
    'mundo': ('🌍', 'an old world globe on a wooden stand with a brass ring'),
    'casa': ('🏠', 'a small medieval cottage with a thatched roof and a wooden door'),
    'paleta': ('🎨', "a wooden painter's palette with paint blobs and a brush"),
    'mapa': ('🗺️', 'an old unrolled map on dark aged brown parchment with a red X'),
    'gema': ('💎', 'a cut blue sapphire gem'),
    'viento': ('💨', 'a gust of wind, curling blue-grey swirls'),
    'puerta': ('🚪', 'an arched wooden door with iron hinges'),
    'huellas': ('👣', 'two dark brown footprints'),
    'rayo': ('⚡', 'a yellow lightning bolt'),
    'agotado': ('😩', 'the face of a weary exhausted adventurer, sweating, eyes half closed'),
    'pluma': ('✒️', 'a feather quill pen dipped in a small ink pot'),
    'balanza': ('⚖️', 'brass balance scales'),
    'libros': ('📚', 'a stack of three old leather books'),
    'cadena': ('🔗', 'two linked iron chain links'),
    'llave': ('🔑', 'an old ornate iron key'),
    'bola_cristal': ('🔮', 'a purple crystal ball on a small golden stand'),
    'persona': ('🧑', 'an adventurer with short brown hair, from the chest up, green tunic'),
    'vara_medir': ('📏', 'a wooden measuring rod with notches, diagonal'),
    'furia': ('😡', 'the angry red face of a shouting barbarian'),
    'hablar': ('🗣️', 'a head in profile shouting, sound lines coming out of the mouth'),
    'caja_herramientas': ('🧰', 'a wooden toolbox with a hammer and a saw sticking out'),
    'lucha': ('🤼', 'two wrestlers grappling each other'),
    'de_pie': ('🧍', 'an adventurer standing straight, full body, green tunic'),
    'remolino': ('🌀', 'a blue magic swirl vortex'),
    'pulgar': ('👍', 'a hand in a leather glove giving a thumbs up'),
    'camara': ('📷', 'a wooden box camera obscura with a brass lens'),
    'sin_conexion': ('📴', 'a snuffed-out candle with a thin trail of smoke'),
    'esconderse': ('🫥', 'a hooded figure fading into shadow, dotted outline'),
    'inexpresivo': ('😶', 'a calm face with no mouth, blank expression'),
    'carpeta': ('📁', 'a closed leather folio tied with a cord'),
    'pluma_suelta': ('🪶', 'a single brown and tan striped feather'),
    'mascara': ('🎬', 'a golden theater comedy mask'),
    'mana': ('🔋', 'a glass vial filled with glowing blue mana'),
    'cuerno_guerra': ('🚀', 'a curved war horn made of ivory with brass bands'),
    'tapiz': ('📺', 'a hanging tapestry on a wooden rod showing a painted battle scene'),
    'vela': ('💡', 'a lit candle on a brass holder'),
    'caja': ('📦', 'a closed wooden crate'),
    'reloj_vacio': ('⌛', 'an hourglass with all the sand at the bottom'),
    'martillo': ('🔧', 'a blacksmith hammer'),
    'paloma': ('🕊️', 'a flying dove with light grey feathers'),
    'esponja': ('🧽', 'a yellow sea sponge'),
    'medalla': ('🎖️', 'a golden medal hanging from a red ribbon'),
    'cambiar': ('🔄', 'two curved golden arrows chasing each other in a circle'),
}

# Símbolos sencillos: mejor nítidos y dibujados a mano en la rejilla de 32×32 (ver simbolos())
SIMBOLOS = ['✅', '❌', '➕', '➖', '⬆️', '⬇️', '🟢', '🟡', '🔴', '⚪', '🟤', '🟨', '⬜', '▫️', '⏩', '⏭️', '⏺', '⏹',
            '↩️', '↕️', '⤵️', 'ℹ️']


def codigo(e):
    """Nombre del archivo: código del emoji sin el selector de variante (⚔️ → 2694)"""
    return '-'.join(f'{ord(c):x}' for c in e if ord(c) != 0xFE0F)


def generar(args):
    n = next((int(a[4:]) for a in args if a.startswith('--n=')), 2)
    nombres = [a for a in args if not a.startswith('--')]
    if not nombres:
        nombres = [k for k in EMOJIS if not os.path.exists(os.path.join(CAND, f'{k}-1.png'))]
    cola = []
    for nom in nombres:
        prompt = f'{EMOJIS[nom][1]}, {ESTILO}, {AISLADO}'
        for k in range(1, n + 1):
            pid = api('/prompt', {'prompt': flujo(prompt, 1024, 1024, random.randrange(2**32), True)})['prompt_id']
            cola.append((pid, os.path.join(CAND, f'{nom}-{k}.png')))
    print(f'{len(cola)} emojis en cola', flush=True)
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
        print('  ' + os.path.relpath(dest, SALIDA), flush=True)


def elegidos():
    try:
        return json.load(open(ELEGIDOS, encoding='utf-8'))
    except OSError:
        return {}


def procesar(args):
    from PIL import Image, ImageDraw, ImageFont
    from iconos_procesar import icono
    sel = elegidos()
    sel.update(dict(a.split('=') for a in args if '=' in a))
    json.dump(dict(sorted(sel.items())), open(ELEGIDOS, 'w', encoding='utf-8'), indent=1)
    hechos = []
    for nom, (e, _) in EMOJIS.items():
        k = str(sel.get(nom, '1'))
        src = os.path.join(CAND, f'{nom}-{k}.png')
        if not os.path.exists(src):
            continue
        dest = os.path.join(DEST, f'{codigo(e)}.png')
        icono(src, dest)
        hechos.append((nom, e, k, dest, sorted(p for p in os.listdir(CAND) if p.rsplit('-', 1)[0] == nom)))
    print(f'{len(hechos)} emojis → design/emoji')
    # Hojas de muestra (20 por hoja): el emoji de siempre, el nuevo a 20 px y ×3, y todos los candidatos
    try:
        f_emo = ImageFont.truetype('seguiemj.ttf', 36)
        f_txt = ImageFont.truetype('segoeui.ttf', 16)
    except OSError:
        f_emo = f_txt = ImageFont.load_default()
    fila, por = 92, 20
    for p in range(0, len(hechos), por):
        trozo = hechos[p:p + por]
        hoja = Image.new('RGB', (760, 10 + fila * len(trozo)), (28, 22, 18))
        d = ImageDraw.Draw(hoja)
        for i, (nom, e, k, dest, cands) in enumerate(trozo):
            y = 10 + i * fila
            d.text((12, y + 18), e, font=f_emo, embedded_color=True)
            ic = Image.open(dest).convert('RGBA')
            s = ic.resize((20, 20), Image.Resampling.BOX)
            hoja.paste(s, (78, y + 30), s)
            big = ic.resize((80, 80), Image.Resampling.NEAREST)
            hoja.paste(big, (110, y + 4), big)
            for j, c in enumerate(cands[:4]):
                im = Image.open(os.path.join(CAND, c)).convert('RGB').resize((80, 80))
                hoja.paste(im, (210 + j * 88, y + 4))
                n = c.rsplit('-', 1)[1][:-4]
                d.text((212 + j * 88, y + 62), n, fill=(255, 220, 0) if n == k else (150, 150, 150), font=f_txt)
            d.text((570, y + 30), nom, fill=(230, 220, 200), font=f_txt)
        out = os.path.join(CAND, f'muestra-{p // por + 1}.png')
        hoja.save(out)
        print('Muestra:', os.path.abspath(out))


def simbolos():
    """✅ ➕ flechas, puntos de color…: dibujados a mano en 32×32 con el contorno oscuro y los tonos del grimorio"""
    import numpy as np
    from PIL import Image, ImageDraw
    G = 32
    TINTA = (16, 10, 12, 255)
    ORO, ORO2 = (214, 168, 74, 255), (150, 104, 40, 255)
    ROJO, ROJO2 = (178, 44, 36, 255), (110, 24, 22, 255)
    VERDE, VERDE2 = (86, 150, 64, 255), (44, 90, 36, 255)
    PERG, PERG2 = (226, 204, 150, 255), (170, 140, 92, 255)
    AZUL, AZUL2 = (60, 96, 170, 255), (32, 52, 104, 255)

    def lienzo():
        return Image.new('RGBA', (G, G), (0, 0, 0, 0))

    def contorno(im):
        a = np.array(im)
        al = a[..., 3] > 0
        b = np.zeros_like(al)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            b |= np.roll(al, (dy, dx), (0, 1))
        b &= ~al
        a[b] = TINTA
        return Image.fromarray(a)

    def placa(fill, sombra, redonda=False):
        im = lienzo()
        d = ImageDraw.Draw(im)
        (d.ellipse if redonda else d.rounded_rectangle)((4, 4, 27, 27), fill=sombra, **({} if redonda else {'radius': 4}))
        (d.ellipse if redonda else d.rounded_rectangle)((4, 4, 27, 25), fill=fill, **({} if redonda else {'radius': 4}))
        return im, d

    def gema(fill, sombra):
        im, d = placa(fill, sombra, True)
        d.ellipse((9, 8, 14, 12), fill=(255, 255, 255, 170))
        return contorno(im)

    def flecha(d, puntos, color):
        d.polygon(puntos, fill=color)

    out = {}
    im, d = placa(VERDE, VERDE2)
    d.line((9, 16, 14, 21, 23, 10), fill=PERG, width=4)
    out['✅'] = contorno(im)
    im, d = placa(ROJO, ROJO2)
    d.line((10, 10, 21, 21), fill=PERG, width=4)
    d.line((21, 10, 10, 21), fill=PERG, width=4)
    out['❌'] = contorno(im)
    im = lienzo(); d = ImageDraw.Draw(im)
    d.rectangle((13, 5, 18, 26), fill=ORO); d.rectangle((5, 13, 26, 18), fill=ORO)
    d.rectangle((13, 17, 18, 26), fill=ORO2); d.rectangle((5, 17, 26, 18), fill=ORO2)
    out['➕'] = contorno(im)
    im = lienzo(); d = ImageDraw.Draw(im)
    d.rectangle((5, 13, 26, 18), fill=ORO); d.rectangle((5, 17, 26, 18), fill=ORO2)
    out['➖'] = contorno(im)
    im = lienzo(); d = ImageDraw.Draw(im)
    flecha(d, [(16, 3), (28, 16), (20, 16), (20, 28), (12, 28), (12, 16), (4, 16)], ORO)
    d.rectangle((17, 16, 19, 27), fill=ORO2)
    out['⬆️'] = contorno(im)
    out['⬇️'] = out['⬆️'].transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    out['🟢'] = gema(VERDE, VERDE2)
    out['🟡'] = gema(ORO, ORO2)
    out['🔴'] = gema(ROJO, ROJO2)
    out['⚪'] = gema(PERG, PERG2)
    out['🟤'] = gema((140, 86, 48, 255), (86, 50, 26, 255))
    im, d = placa(ORO, ORO2)
    out['🟨'] = contorno(im)
    im, d = placa(PERG, PERG2)
    out['⬜'] = contorno(im)
    im = lienzo(); d = ImageDraw.Draw(im)
    d.rectangle((10, 10, 21, 21), fill=PERG); d.rectangle((10, 19, 21, 21), fill=PERG2)
    out['▫️'] = contorno(im)
    im = lienzo(); d = ImageDraw.Draw(im)
    flecha(d, [(3, 6), (15, 16), (3, 26)], ORO); flecha(d, [(15, 6), (27, 16), (15, 26)], ORO)
    out['⏩'] = contorno(im)
    im = lienzo(); d = ImageDraw.Draw(im)
    flecha(d, [(3, 6), (15, 16), (3, 26)], ORO); flecha(d, [(13, 6), (24, 16), (13, 26)], ORO); d.rectangle((25, 6, 28, 26), fill=ORO)
    out['⏭️'] = contorno(im)
    im, d = placa(PERG2, (110, 86, 52, 255))
    d.ellipse((10, 9, 21, 20), fill=ROJO)
    out['⏺'] = contorno(im)
    im, d = placa(PERG2, (110, 86, 52, 255))
    d.rectangle((10, 9, 21, 20), fill=TINTA)
    out['⏹'] = contorno(im)
    im = lienzo(); d = ImageDraw.Draw(im)
    d.arc((6, 6, 27, 27), 270, 90, fill=ORO, width=5)
    d.rectangle((14, 6, 17, 10), fill=ORO)
    flecha(d, [(4, 8), (14, 1), (14, 15)], ORO)
    out['↩️'] = contorno(im)
    im = lienzo(); d = ImageDraw.Draw(im)
    d.rectangle((13, 8, 18, 23), fill=ORO)
    flecha(d, [(16, 1), (25, 10), (7, 10)], ORO); flecha(d, [(16, 30), (25, 21), (7, 21)], ORO)
    out['↕️'] = contorno(im)
    im = lienzo(); d = ImageDraw.Draw(im)
    d.arc((4, 2, 26, 24), 300, 90, fill=ORO, width=5)
    flecha(d, [(6, 18), (18, 18), (12, 29)], ORO)
    out['⤵️'] = contorno(im)
    im, d = placa(AZUL, AZUL2, True)
    d.rectangle((14, 7, 17, 10), fill=PERG); d.rectangle((14, 13, 17, 23), fill=PERG)
    out['ℹ️'] = contorno(im)
    os.makedirs(DEST, exist_ok=True)
    for e, im in out.items():
        im.save(os.path.join(DEST, f'{codigo(e)}.png'), optimize=True)
    print(f'{len(out)} símbolos → design/emoji')


if __name__ == '__main__':
    if '--simbolos' in sys.argv:
        simbolos()
    elif '--procesar' in sys.argv:
        procesar([a for a in sys.argv[1:] if a != '--procesar'])
    else:
        generar(sys.argv[1:])
