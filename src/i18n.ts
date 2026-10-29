// Idioma de la interfaz. Se guarda en un módulo para que el motor de reglas y los
// componentes lo lean sin pasarlo por parámetros; App lo sincroniza con los ajustes.
export type Lang = 'es' | 'en';

/** Texto en los dos idiomas */
export interface Tr {
  es: string;
  en: string;
}

let current: Lang = 'es';

export const setLang = (l: Lang) => {
  current = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
};
export const getLang = () => current;

/** Devuelve el texto en el idioma activo */
export const L = (x: Tr | string): string => (typeof x === 'string' ? x : x[current]);

/** Atajo para textos de interfaz: T('Hoja', 'Sheet') */
export const T = (es: string, en: string): string => (current === 'es' ? es : en);

export const locale = () => (current === 'es' ? 'es-ES' : 'en-US');
