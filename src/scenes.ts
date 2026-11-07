// Fondo de cada paleta según el estilo: pixel art detallado (clásico), pixel 16 bits (retro) o el póster
// de fantasía oscura pintado de antemano (scripts/posters genera los JPEG de public/posters).
import type { Design, Theme } from './store';

export const POSTERS = ['ocaso', 'bosque', 'cumbres', 'abismo', 'mar', 'mazmorra', 'ciudadela', 'cripta'] as const;
export type PosterId = (typeof POSTERS)[number];

const BY_THEME: Record<Theme, PosterId> = { basic: 'ocaso', green: 'bosque', gray: 'cumbres', blue: 'abismo' };

/** Ruta del póster (relativa, funciona en la web, en Android y en Windows) */
export const posterUrl = (id: PosterId) => `posters/${id}.jpg`;

/** Fondo pixel art del estilo retro (public/design/retro; se pueden sustituir por imágenes de IA) */
export const retroUrl = (id: PosterId) => `design/retro/${id}.png`;

/** Fondo pixel art detallado del estilo clásico (public/design/clasico, scripts/pixel/classic.py) */
export const classicUrl = (id: PosterId) => `design/clasico/${id}.png`;

/** Aplica el fondo de la paleta según el estilo visual elegido */
export function applyScene(theme: Theme, design: Design = 'classic') {
  const id = BY_THEME[theme] ?? 'ocaso';
  const rel = design === 'retro' ? retroUrl(id) : design === 'poster' ? posterUrl(id) : classicUrl(id);
  document.documentElement.dataset.design = design;
  // URL absoluta: si fuera relativa, el CSS la resolvería respecto a su propia carpeta (assets/)
  document.documentElement.style.setProperty('--poster', `url("${new URL(rel, document.baseURI).href}")`);
  // Icono de la pestaña del navegador según el estilo
  document.querySelector('link[rel="icon"]')?.setAttribute('href', new URL(design === 'retro' ? 'design/retro/icon-64.png' : 'favicon.png', document.baseURI).href);
}
