// Interruptores de funciones. El editor de aspecto (retrato dibujado) está oculto por defecto mientras se
// rehace; se puede mostrar desde Ajustes → «Editor de aspecto (experimental)». El código sigue en
// src/components/Avatar.tsx y src/rules/avatar.ts.
import { useStore } from './store';

export const FEATURES = {
  avatarEditor: false,
};

/** ¿Se ve la pestaña del editor de aspecto? */
export const useAvatarEditor = () => useStore((s) => FEATURES.avatarEditor || !!s.settings.avatarEditor);
