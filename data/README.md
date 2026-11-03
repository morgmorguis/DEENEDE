# Datos de reglas

- `srd-5.2-spells.json`: conjuros del System Reference Document 5.2 (Wizards of the Coast LLC, licencia
  Creative Commons Attribution 4.0 International), en el formato del proyecto 5e-bits/5e-database (MIT).
- `spells-es-1.json`, `spells-es-2.json`: nombre en español y resumen propio de cada conjuro del SRD que
  no estaba en `src/rules/spells.ts`.
- `spells-phb-extra.json`: conjuros del Player’s Handbook 2024 que no están en el SRD, con un resumen
  propio (no es el texto oficial).

`node scripts/build-spells.cjs` genera `src/rules/spellsGen.ts` a partir de estos ficheros.
