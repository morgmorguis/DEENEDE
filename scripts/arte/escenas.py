"""Escenas de los fondos de la app: una por paleta de color y 15 de combate (preludio de la batalla).

Lo usan scripts/arte/generar.py (prompts para la IA local) y scripts/arte/procesar.py (nombres de archivo).
Los ids de paleta y el orden de COMBATE deben coincidir con src/scenes.ts.
"""

# Estilo común de las dos referencias del usuario (Z-Image Turbo, 16 nov 2026)
ESTILO = ('1990s fantasy book cover painting, oil and airbrush, painterly, dramatic lighting, rich saturated colors, '
          'subtle film grain, highly detailed, no text, no letters, no logo, no border, no frame')

# id de paleta (src/store.ts → Theme): (escena, colores dominantes)
PALETAS = {
    'basic': ('a grand fantasy citadel with tall towers on a cliff at golden dusk, warm lantern light in the windows, '
              'a winding road leading up to the gates, a lone rider on the road',
              'warm gold, amber and deep brown'),
    'green': ('ancient elven ruins overgrown in a deep enchanted forest, a mossy stone arch, shafts of green light '
              'through giant trees, fireflies, a small cloaked ranger walking on the path',
              'emerald and moss green with deep dark shadows'),
    'gray': ('a ruined stone watchtower in a misty mountain pass, snow and drifting fog, silhouettes of pine trees, '
             'a lone traveler with a lantern on the path',
             'monochrome grays, silver and charcoal, desaturated'),
    'blue': ('a moonlit fortress on sea cliffs above a stormy ocean, a lighthouse beam, a sailing ship in the waves, '
             'a hooded figure on the cliff path',
             'deep navy and cobalt blue with pale moonlight'),
    'red': ("a lone necromancer's gothic tower on a jagged cliff at blood-red sunset, twisted dead trees, crows, "
            'a dragon silhouette in the clouds, a hooded wanderer on the path below, ominous',
            'blood red, crimson and black'),
    'purple': ("a wizard's floating tower among violet clouds and glowing arcane crystals, starry night sky with "
               'magic runes, a stone bridge with a small robed mage',
               'violet, purple and magenta with deep indigo'),
    'orange': ('a cozy fantasy village at golden autumn sunset, a warm glowing tavern with lanterns and smoking '
               'chimney, adventurers arriving on the cobbled road, a castle on the hill behind, falling orange leaves',
               'burnt orange, copper and warm brown'),
    'ice': ('a colossal dwarven gate carved into a frozen mountain, aurora in the night sky, a frozen waterfall, '
            'snow drifting, two small travelers in fur cloaks approaching',
            'icy cyan, pale teal and white with dark slate'),
}

# Combate: el momento justo antes de la batalla. Pocas figuras, como mucho un monstruo.
COMBATE = [
    'two armies facing each other across a misty battlefield at dawn, banners in the wind, the moment before the charge, '
    'seen from behind a lone knight on a hill',
    "the entrance of a dragon's lair in a volcanic mountain, smoke and glowing embers, a pile of gold and bones, "
    'the horned head of a huge red dragon emerging from the darkness of the cave, a small adventurer holding a torch',
    'a ruined stone bridge over a deep chasm at night, distant torches of an orc warband approaching on the other side, '
    'two adventurers waiting with drawn swords',
    'a burning village at night, smoke and flying embers, the shadow of a giant among the flames, '
    'a lone warrior standing in the road',
    'a haunted graveyard under a full moon, thick fog, skeletal hands rising from the graves, '
    'a paladin raising a glowing holy symbol',
    'a dark forest clearing at night, a ring of glowing wolf eyes between the trees, a dying campfire, '
    'three adventurers back to back',
    'a circle of ancient standing stones under a violent thunderstorm, lightning, a hooded cultist summoning '
    'an ominous glowing portal',
    'a besieged medieval castle wall at dusk, huge wooden medieval siege towers covered in hides rolling closer, '
    'flaming catapult stones arcing through the sky, a few defenders with bows on the battlements',
    'a frozen mountain pass in a blizzard, the colossal silhouette of a frost giant emerging from the snow, '
    'only three small adventurers in fur cloaks',
    'a misty swamp at twilight, dead trees, the shadow of a many-headed hydra rising from the black water, '
    'an adventurer on a rotten wooden walkway',
    'desert temple ruins in a sandstorm, the silhouette of a giant scorpion on the dunes, '
    'a lone warrior with a curved sword',
    'the colossal gates of a necropolis, green ghostly fire in braziers, shapes of an undead army in the fog '
    'behind the gates, two adventurers approaching',
    'a vast dark throne room with tall pillars, a horned demon lord seated on the throne in red light, '
    'adventurers entering through the great doors',
    'a stormy rocky coast at night, giant kraken tentacles rising from huge crashing waves around a sinking wooden '
    'sailing ship, lightning, a sailor holding a harpoon on the rocks in the foreground, full bleed scene',
    'a giant spider lair in a dark cave, thick webs and cocoons, many glowing eyes in the darkness, '
    'an adventurer holding a torch',
]

# Estilos de la app: 'pixel' = estilo «Pixel» (y Retro 16-bit), 'pintado' = estilo «Pintado»
ESTILOS = ('pixel', 'pintado')

# Formatos: vertical para móviles, horizontal para Windows, tablets y móviles girados
FORMATOS = {'v': (768, 1344), 'h': (1344, 768)}
