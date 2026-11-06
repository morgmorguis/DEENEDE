import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../../i18n';
import { blankCharacter } from '../factory';
import { abilityMods, armorClass, maxHp, rollContext, saveBonus, skillBonus, speed, weaponAttack, weaponDamageFlat } from '../calc';
import { ITEM_CATALOG, fromCatalog } from '../items';
import { attackFromItem } from '../gear';
import type { Character, OwnedItem } from '../../types';
import { cleanMods } from '../../party/room';

beforeAll(() => setLang('es'));

const item = (id: string, patch: Partial<OwnedItem> = {}): OwnedItem => ({ ...fromCatalog(ITEM_CATALOG.find((x) => x.id === id)!), id, equipped: true, ...patch });
function pc(patch: Partial<Character> = {}): Character {
  const c = blankCharacter();
  return { ...c, level: 4, baseAc: 12, abilities: { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, armorTraining: { light: true, medium: true, heavy: true, shields: true }, ...patch };
}

describe('equipo', () => {
  it('armadura, escudo y capa de protección (con sintonización)', () => {
    const cloak = item('cloak-of-protection');
    const c = pc({ items: [item('chain-mail'), item('shield'), cloak] });
    // La capa requiere sintonización: aún no cuenta
    expect(armorClass(c).value).toBe(16 + 2);
    const tuned = { ...c, attunement: [cloak.name, '', ''] };
    expect(armorClass(tuned).value).toBe(16 + 2 + 1);
    expect(saveBonus(tuned, 'wis')).toBe(1 + 1);
    expect(armorClass(tuned).gear.length).toBeGreaterThan(0);
    // Sin equipar no cuenta
    expect(armorClass(pc({ items: [item('chain-mail', { equipped: false })] })).value).toBe(12);
  });

  it('armadura intermedia limita la Destreza a +2', () => {
    expect(armorClass(pc({ abilities: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 }, items: [item('breastplate')] })).value).toBe(14 + 2);
    expect(armorClass(pc({ abilities: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 }, items: [item('studded-leather')] })).value).toBe(12 + 4);
  });

  it('guanteletes de poder de ogro: FUE 19 solo si es mayor', () => {
    const g = item('gauntlets-ogre-power');
    const c = pc({ items: [g], attunement: [g.name, '', ''] });
    expect(abilityMods(c).str).toBe(4);
    expect(skillBonus(c, 'atletismo')).toBe(4);
    expect(abilityMods(pc({ items: [g], attunement: [g.name, '', ''], abilities: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } })).str).toBe(5);
  });

  it('amuleto de salud sube los PG por el cambio de CON', () => {
    const a = item('amulet-of-health');
    const c = pc({ items: [a], attunement: [a.name, '', ''] });
    expect(maxHp(c)).toBe(c.hp.max + (4 - 2) * 4);
  });

  it('Sigilo con armadura pesada y armadura sin entrenamiento', () => {
    const c = pc({ items: [item('plate-armor')] });
    expect(rollContext(c, { kind: 'check', ability: 'dex', skill: 'sigilo' }).disadvantage.length).toBe(1);
    const untrained = pc({ items: [item('plate-armor')], armorTraining: { light: true, medium: false, heavy: false, shields: false } });
    expect(rollContext(untrained, { kind: 'attack' }).disadvantage.length).toBe(1);
    expect(rollContext(untrained, { kind: 'save', ability: 'wis' }).disadvantage.length).toBe(0);
    // Fuerza 15 requerida: −10 pies
    expect(speed(c).value).toBe(c.speed - 10);
  });

  it('arma equipada crea su fila de ataque; arma +1 suma a ataque y daño', () => {
    const sword = item('longsword');
    const c = pc({ items: [sword] });
    const atk = attackFromItem(c, sword)!;
    expect(atk).toMatchObject({ damage: '1d8', damageType: 'cortante', ability: 'str', mastery: 'sap', itemId: sword.id });
    const plus = item('weapon-1', { attackId: atk.id });
    const c2 = { ...c, attacks: [atk], items: [sword, plus] };
    expect(weaponAttack(c2, atk)).toBe(1 + 2 + 1);
    expect(weaponDamageFlat(c2, atk)).toBe(1 + 1);
  });

  it('dotes: Duro suma 2 PG por nivel, Veloz 10 pies; se pueden desactivar', () => {
    const c = pc({ feats: 'Duro\nVeloz' });
    expect(maxHp(c)).toBe(c.hp.max + 8);
    expect(speed(c).value).toBe(c.speed + 10);
    expect(maxHp({ ...c, rulesOff: ['tough'] })).toBe(c.hp.max);
    expect(maxHp(pc({ species: 'Enana' }))).toBe(pc().hp.max + 4);
  });

  it('el servidor limpia los efectos que llegan', () => {
    expect(cleanMods({ ac: 1.6, saves: '2', evil: 5, armor: { base: 16, kind: 'heavy', dexMax: 0, str: 13 } })).toEqual({ ac: 2, saves: 2, armor: { base: 16, kind: 'heavy', dexMax: 0, str: 13 } });
    expect(cleanMods({ weapon: { dice: 'rm -rf', type: 'x' } })).toBeUndefined();
  });
});
