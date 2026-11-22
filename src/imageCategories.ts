// Categorías de las imágenes que comparte el DM (mapas, personajes, lugares…): nombre e icono en los dos idiomas.
import type { ImageCategory } from './party/protocol';
import { IMAGE_CATEGORIES } from './party/protocol';
import { T } from './i18n';

export { IMAGE_CATEGORIES };
export const categoryIcon: Record<ImageCategory, string> = { map: '🗺️', character: '🧑', place: '🏰', clue: '🔎', item: '💎', other: '🖼️' };
export const categoryName = (c: ImageCategory) => ({
  map: T('Mapas', 'Maps'), character: T('Personajes', 'Characters'), place: T('Lugares', 'Places'),
  clue: T('Pistas', 'Clues'), item: T('Objetos', 'Items'), other: T('Otros', 'Other'),
}[c]);
export const categoryLabel = (c: ImageCategory) => `${categoryIcon[c]} ${categoryName(c)}`;
