import { describe, expect, it } from 'vitest';
import { translateTerms, translateCharacter } from '../glossary';
import { blankCharacter } from '../factory';

describe('glosario', () => {
  it('traduce equipo y competencias EN→ES', () => {
    expect(translateTerms('ShortSword, 2 Daggers, Explorer’s Pack, Thieves’ Tools', 'es')).toBe('Espada corta, 2 Dagas, Equipo de explorador, Herramientas de ladrón');
    expect(translateTerms('Simple weapons, Martial weapons', 'es')).toBe('Armas sencillas, Armas marciales');
    expect(translateTerms('Common, Common sign, Goblin', 'es', 'language')).toBe('Común, Lengua de signos común, Goblin');
    expect(translateTerms('Lawful Good', 'es', 'alignment')).toBe('Legal bueno');
    expect(translateTerms('Halfling', 'es', 'species')).toBe('Mediano');
  });
  it('traduce ES→EN', () => {
    expect(translateTerms('Hacha a dos manos y espada corta', 'en')).toBe('Greataxe y shortsword');
    expect(translateTerms('Mediano', 'en', 'size')).toBe('Medium');
    expect(translateTerms('Caótica buena', 'en', 'alignment')).toBe('Chaotic Good');
    expect(translateTerms('Furia', 'en', 'feature')).toBe('Rage');
  });
  it('traduce una ficha y completa conjuros', () => {
    const c = blankCharacter();
    c.classId = 'mago'; c.className = 'Wizard'; c.species = 'Wood Elf';
    c.spells = [{ id: '1', name: 'Fire Bolt', level: 0, prepared: true, castingTime: '', range: '', concentration: false }];
    const t = translateCharacter(c, 'es');
    expect(t.className).toBe('Mago');
    expect(t.species).toBe('Elfo de los bosques');
    expect(t.spells[0].name).toBe('Descarga de fuego');
    expect(t.spells[0].range).toBe('120 pies');
  });
});
