// Fondo de cada paleta según el estilo (Pixel, Retro 16-bit o Pintado) y fondo común durante un combate.
// Las imágenes salen de la IA local (scripts/arte) y hay una vertical (móvil) y otra horizontal (Windows, tablet).
import type { Design, Theme } from './store';
import { COMBAT_SCENES } from './party/protocol';

export const POSTERS = ['ocaso', 'bosque', 'cumbres', 'abismo', 'mar', 'mazmorra', 'ciudadela', 'cripta'] as const;
export type PosterId = (typeof POSTERS)[number];

/** Pósteres pintados en SVG (scripts/posters): ahora solo se usan de fondo del retrato del personaje */
export const posterUrl = (id: PosterId) => `posters/${id}.jpg`;

type ArtStyle = 'pixel' | 'retro' | 'pintado';
const STYLE: Record<Design, ArtStyle> = { classic: 'pixel', retro: 'retro', poster: 'pintado' };
const EXT: Record<ArtStyle, string> = { pixel: 'png', retro: 'png', pintado: 'webp' };

/** Nombre del fondo de combate n (combate-01…combate-15) */
export const combatSceneName = (n: number) => `combate-${String((((n % COMBAT_SCENES) + COMBAT_SCENES) % COMBAT_SCENES) + 1).padStart(2, '0')}`;

/** Ruta del fondo (relativa: funciona en la web, en Android y en Windows). fmt: v = vertical, h = horizontal */
export const sceneUrl = (design: Design, name: string, fmt: 'v' | 'h' = 'h') => {
  const st = STYLE[design] ?? 'pixel';
  return `fondos/${st}/${name}-${fmt}.${EXT[st]}`;
};

/** Aplica el fondo de la paleta según el estilo; durante un combate, el de la escena de combate */
export function applyScene(theme: Theme, design: Design = 'classic', combatScene: number | null = null) {
  const name = combatScene == null ? theme : combatSceneName(combatScene);
  const root = document.documentElement;
  root.dataset.design = design;
  if (combatScene == null) delete root.dataset.combatScene;
  else root.dataset.combatScene = '';
  // URL absoluta: si fuera relativa, el CSS la resolvería respecto a su propia carpeta (assets/)
  const abs = (rel: string) => `url("${new URL(rel, document.baseURI).href}")`;
  root.style.setProperty('--poster', abs(sceneUrl(design, name, 'v')));
  root.style.setProperty('--poster-wide', abs(sceneUrl(design, name, 'h')));
  // Icono de la pestaña del navegador según el estilo
  document.querySelector('link[rel="icon"]')?.setAttribute('href', new URL(design === 'retro' ? 'design/retro/icon-64.png' : 'favicon.png', document.baseURI).href);
}
