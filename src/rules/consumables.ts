// Munición y consumibles: detectar en el texto del equipo, gastar en combate y recuperar al acabar.
// Reglas 2024 (propiedad Munición): tras el combate puedes dedicar 1 minuto a recuperar la mitad
// (redondeando abajo) de la munición que hayas usado. Las armas arrojadizas se recogen; las pociones no.
import type { Character, Consumable } from '../types';
import { T } from '../i18n';
import { uid } from './factory';

const PATTERNS: { re: RegExp; kind: Consumable['kind']; es: string; en: string }[] = [
  { re: /(\d+)\s*(?:x\s*)?(?:flechas?|arrows?)/i, kind: 'ammo', es: 'Flechas', en: 'Arrows' },
  { re: /(\d+)\s*(?:x\s*)?(?:virotes?|(?:crossbow\s+)?bolts?)/i, kind: 'ammo', es: 'Virotes', en: 'Bolts' },
  { re: /(\d+)\s*(?:x\s*)?(?:balas?(?: de honda)?|(?:sling\s+)?bullets?)/i, kind: 'ammo', es: 'Balas de honda', en: 'Sling bullets' },
  { re: /(\d+)\s*(?:x\s*)?(?:agujas?(?: de cerbatana)?|(?:blowgun\s+)?needles?)/i, kind: 'ammo', es: 'Agujas de cerbatana', en: 'Blowgun needles' },
  { re: /(\d+)\s*(?:x\s*)?(?:munici[oó]n|ammo)/i, kind: 'ammo', es: 'Munición', en: 'Ammunition' },
  { re: /(\d+)\s*(?:x\s*)?(?:dardos?|darts?)/i, kind: 'thrown', es: 'Dardos', en: 'Darts' },
  { re: /(\d+)\s*(?:x\s*)?(?:jabalinas?|javelins?)/i, kind: 'thrown', es: 'Jabalinas', en: 'Javelins' },
  { re: /(\d+)\s*(?:x\s*)?(?:dagas?|daggers?)/i, kind: 'thrown', es: 'Dagas', en: 'Daggers' },
  { re: /(\d+)\s*(?:x\s*)?(?:hachas? de mano|handaxes?)/i, kind: 'thrown', es: 'Hachas de mano', en: 'Handaxes' },
  { re: /(\d+)\s*(?:x\s*)?(?:pociones? de curaci[oó]n|(?:healing )?potions?(?: of healing)?)/i, kind: 'item', es: 'Pociones de curación', en: 'Potions of Healing' },
  { re: /(\d+)\s*(?:x\s*)?(?:fuegos? de alquimista|alchemist'?s fire)/i, kind: 'item', es: 'Fuego de alquimista', en: 'Alchemist’s Fire' },
  { re: /(\d+)\s*(?:x\s*)?(?:aguas? benditas?|(?:flasks? of )?holy water)/i, kind: 'item', es: 'Agua bendita', en: 'Holy Water' },
  { re: /(\d+)\s*(?:x\s*)?(?:antorchas?|torch(?:es)?)/i, kind: 'item', es: 'Antorchas', en: 'Torches' },
  { re: /(\d+)\s*(?:x\s*)?(?:raciones?|rations?)/i, kind: 'item', es: 'Raciones', en: 'Rations' },
];

/** Busca munición y consumibles con cantidad en el texto del equipo («Carcaj con 20 flechas, 2 pociones…») */
export function detectConsumables(inventory: string, existing: Consumable[]): Consumable[] {
  const found: Consumable[] = [];
  for (const p of PATTERNS) {
    const m = inventory.match(p.re);
    if (!m) continue;
    const name = T(p.es, p.en);
    if (existing.some((e) => e.name.toLowerCase() === name.toLowerCase()) || found.some((f) => f.name === name)) continue;
    found.push({ id: uid(), name, qty: Number(m[1]), kind: p.kind, used: 0 });
  }
  return found;
}

/** Recuperación al acabar el combate. Devuelve la ficha nueva y las líneas para el aviso. */
export function recoverAfterCombat(c: Character): { char: Character; lines: string[] } {
  const lines: string[] = [];
  const consumables = (c.consumables ?? []).map((x) => {
    if (!x.used) return x;
    if (x.kind === 'ammo') {
      const back = Math.floor(x.used / 2);
      lines.push(T(`🏹 ${x.name}: usaste ${x.used}, recuperas ${back} (la mitad) → te quedan ${x.qty + back}.`, `🏹 ${x.name}: used ${x.used}, you recover ${back} (half) → ${x.qty + back} left.`));
      return { ...x, qty: x.qty + back, used: 0 };
    }
    if (x.kind === 'thrown') {
      lines.push(T(`🗡️ ${x.name}: recoges las ${x.used} que lanzaste → ${x.qty + x.used}.`, `🗡️ ${x.name}: you pick up the ${x.used} you threw → ${x.qty + x.used}.`));
      return { ...x, qty: x.qty + x.used, used: 0 };
    }
    lines.push(T(`🧪 ${x.name}: gastaste ${x.used} → te quedan ${x.qty}.`, `🧪 ${x.name}: used ${x.used} → ${x.qty} left.`));
    return { ...x, used: 0 };
  });
  return { char: { ...c, consumables }, lines };
}
