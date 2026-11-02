// Fondo de cada paleta: un póster de fantasía oscura de los 90 pintado de antemano
// (scripts/posters genera los JPEG de public/posters).
import type { Theme } from './store';

export const POSTERS = ['ocaso', 'bosque', 'cumbres', 'abismo', 'mar', 'mazmorra', 'ciudadela', 'cripta'] as const;
export type PosterId = (typeof POSTERS)[number];

const BY_THEME: Record<Theme, PosterId> = { basic: 'ocaso', green: 'bosque', gray: 'cumbres', blue: 'abismo' };

/** Ruta del póster (relativa, funciona en la web, en Android y en Windows) */
export const posterUrl = (id: PosterId) => `posters/${id}.jpg`;

/** Aplica el póster de la paleta como fondo */
export function applyScene(theme: Theme) {
  const id = BY_THEME[theme] ?? 'ocaso';
  // URL absoluta: si fuera relativa, el CSS la resolvería respecto a su propia carpeta (assets/)
  document.documentElement.style.setProperty('--poster', `url("${new URL(posterUrl(id), document.baseURI).href}")`);
}
