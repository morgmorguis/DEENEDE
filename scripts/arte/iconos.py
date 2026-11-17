"""Iconos pixel art de la app con la IA local (mismo flujo que generar.py, con la LoRA pixel).

Uso: python scripts/arte/iconos.py [id…] [--n=3]   (ids: los de la barra, app y dm)   → scripts/arte/salida/iconos/<id>-<k>.png (varios candidatos)
Después: python scripts/arte/iconos_procesar.py <id>=<k> …   (elige el candidato y lo deja en public/iconos)
"""
import os, random, sys, time, urllib.parse

sys.path.insert(0, os.path.dirname(__file__))
from generar import SALIDA, api, flujo  # noqa: E402

FONDO = ('single isolated game item icon, centered, small object filling half of the frame, bold dark outline, '
         'flat pure white background, nothing else, no shadow on the background, 16-bit RPG inventory icon, '
         'no text, no letters')

# id: objeto (los de la barra inferior y el de la app)
ICONOS = {
    'sheet': 'an old rolled parchment character sheet scroll with a red wax seal and a feather quill',
    'avatar': "a wooden painter's palette with colorful paint blobs and a brush",
    'combat': 'two crossed steel longswords with golden hilts',
    'party': 'a red twenty-sided die, d20, gemstone dice with golden numbers',
    'assistant': 'a glowing blue crystal ball on a golden claw stand, magical sparkles',
    'rules': 'a thick closed ancient spellbook tome with brass corners and a red leather cover',
    'settings': 'an ornate bronze cogwheel gear',
    'group': 'three medieval helmets side by side: a knight helm, a horned helm and a hood',
    'roster': 'an open ledger book with a feather quill and an ink pot',
    'treasure': 'an open wooden treasure chest overflowing with gold coins and gems',
}
# Icono de la app (jugadores): el goblin de los primeros iconos lanzando dados, con el estilo de 0.24
APP = ('app icon, portrait of a cheeky green goblin with big pointed ears, yellow eyes and a toothy grin, throwing three '
       'red six-sided dice toward the viewer, blood-red full moon behind him, dark navy night sky, ornate gold square '
       'frame, centered, pixel art, 1990s fantasy book cover style, rich saturated colors, no text, no letters')
# Icono del DM (servidor de Windows y enlace /dm): el mismo goblin tras una pantalla de master de cuatro paneles
DM = ('app icon, a sly green goblin game master with big pointed ears and yellow eyes peeking over a tall folding '
      'four-panel game master screen made of dark red leather panels with gold trim and painted dragon emblems, holding '
      'a red twenty-sided die, candle light, blood-red full moon behind, dark navy night sky, ornate gold square frame, '
      'centered, pixel art, 1990s fantasy book cover style, rich saturated colors, no text, no letters')


def main(args):
    n = next((int(a[4:]) for a in args if a.startswith('--n=')), 3)
    ids = [a for a in args if not a.startswith('--')] or [*ICONOS, 'app']
    cola = []
    for i in ids:
        prompt = APP if i == 'app' else DM if i == 'dm' else f'{ICONOS[i]}, {FONDO}'
        for k in range(1, n + 1):
            dest = os.path.join(SALIDA, 'iconos', f'{i}-{k}.png')
            pid = api('/prompt', {'prompt': flujo(prompt, 1024, 1024, random.randrange(2**32), True)})['prompt_id']
            cola.append((pid, dest))
    print(f'{len(cola)} iconos en cola', flush=True)
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


if __name__ == '__main__':
    main(sys.argv[1:])
