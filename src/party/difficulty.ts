// Dificultad del encuentro (Dungeon Master’s Guide 2024): presupuesto de PX por personaje según su
// nivel (baja, moderada, alta) frente a la suma de PX de los monstruos según su VD.
const BUDGET: [number, number, number][] = [
  [50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100], [600, 1000, 1400], [750, 1300, 1700],
  [1000, 1700, 2100], [1300, 2000, 2600], [1600, 2300, 3100], [1900, 2900, 4100], [2200, 3700, 4700], [2600, 4200, 5400],
  [2900, 4900, 6200], [3300, 5400, 7800], [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200], [5500, 10700, 17200],
  [6400, 13200, 22000],
];

const XP_BY_CR: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900,
  '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000,
  '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000,
  '29': 135000, '30': 155000,
};

export const xpForCr = (cr?: string) => (cr ? XP_BY_CR[cr.trim()] ?? 0 : 0);

export type Difficulty = 'trivial' | 'low' | 'moderate' | 'high' | 'deadly';

export function encounterDifficulty(levels: number[], crs: (string | undefined)[]) {
  const budget = levels.reduce((acc, l) => {
    const b = BUDGET[Math.max(1, Math.min(20, l)) - 1];
    return [acc[0] + b[0], acc[1] + b[1], acc[2] + b[2]] as [number, number, number];
  }, [0, 0, 0] as [number, number, number]);
  const xp = crs.reduce((s, cr) => s + xpForCr(cr), 0);
  const unknown = crs.filter((cr) => !cr || !(cr.trim() in XP_BY_CR)).length;
  const level: Difficulty = !levels.length || !xp ? 'trivial' : xp > budget[2] * 1.5 ? 'deadly' : xp > budget[1] ? 'high' : xp > budget[0] ? 'moderate' : xp >= budget[0] * 0.5 ? 'low' : 'trivial';
  return { xp, budget, level, unknown };
}
