# Grimorio D&D

Hoja de personaje interactiva para Android con las reglas de D&D 2024 (SRD 5.2), en español e inglés.

## Qué hace

- **Hoja de personaje con el diseño de la hoja oficial 2024** (dos páginas, editable directamente): cabecera con nivel/PX, CA con escudo, PG, dados de golpe y salvaciones contra la muerte; características con sus salvaciones y habilidades debajo; armas y trucos de daño; rasgos de clase, atributos de especie y dotes; entrenamiento con equipo; aptitud mágica, espacios de conjuro y tabla de conjuros (C/R/M); aspecto con **imagen del personaje**, historia, alineamiento, idiomas, equipo, sintonización y monedas.
- **Habilidades explicadas**: al tocar una característica, salvación o habilidad ves qué cubre, cómo se calcula tu bonificador y las *limitaciones actuales* (p. ej. desventaja por Envenenado, fallo automático por Cegado, penalización por agotamiento). Tirar el dado al tocar es opcional (Ajustes → «Tirar dados al tocar una estadística», desactivado por defecto).
- **Español / inglés**: toda la app (interfaz, reglas, avisos del motor, asistente y textos de IA) cambia de idioma desde Ajustes.
- **Importar una hoja real, gratis y sin conexión**: desde un PDF rellenable de la hoja oficial 2024 (cada campo se identifica por su posición; prácticamente perfecto), un Word (.docx) o texto (intérprete de etiquetas como «FUE 15», «CA 14», «Clase: Pícaro»), o una foto / PDF escaneado con **OCR dentro del móvil** (Tesseract.js). Siempre ves una vista previa antes de crear el personaje o reemplazar el actual. Opcionalmente, con tu clave de Claude, las fotos se leen con más precisión.
- **Temas de color**: Básico, Verdoso, Grises y Azules (Ajustes → Colores).
- **Pensada también para tablets** (hasta 16"): navegación lateral, diario como panel lateral, combate y reglas a dos o tres columnas, y en pantallas muy anchas las dos páginas de la hoja lado a lado.
- **Asistente en lenguaje natural** (funciona sin internet). Escribe o dicta frases como:
  - «Un goblin me ha atacado y me ha hecho 7 de daño cortante»
  - «El orco saca 15 para impactar y me hace 9» (compara con tu CA)
  - «Me lanzan bendición», «entro en furia», «se acaba la bendición»
  - «Estoy envenenado», «ya no estoy derribado», «me levanto»
  - «Me bebo una poción de curación», «gano 5 PG temporales»
  - «Tiro percepción», «salvación de destreza», «tira 2d6+3»
  - «¿Qué hace derribado?», «qué es sigilo»
  - «Descanso corto gastando 2 dados», «descanso largo», «fin de turno»

  El daño se aplica en el orden de las reglas 2024: inmunidad → resistencia → vulnerabilidad → PG temporales → PG. Avisa de la salvación de concentración (CD 10 o mitad del daño, máx. 30) y la tira por ti, gestiona caer a 0 PG, muerte instantánea, salvaciones contra la muerte y fallos por recibir daño a 0 PG. Cada cambio se puede **deshacer**.
- **Beneficios y perjuicios**: Bendición, Perdición, Escudo de la fe, Escudo, Celeridad, Lentitud, Furia, Esquivar, Armadura de mago, Piel robliza… con duración en rondas que baja sola al pasar turno, más efectos personalizados.
- **Modo combate**: ronda e iniciativa, casillas de acción / acción adicional / reacción, movimiento restante, ataques con alcance, bonificador y maestría de arma, tiradas de ataque y daño (crítico incluido, bonus de Furia solo en ataques de FUE), conjuros con alcance y espacios, recursos, efectos activos y una chuleta de todas las acciones 2024.
- **Bloc de notas abatible** (botón 📜, disponible en todas las pantallas) con **carpetas** (Nombres, Lugares, Misiones, Objetos, Crónicas y las que crees): notas rápidas y un botón para **grabar la sesión**. La transcripción se convierte en una crónica escrita como un relato (con Claude) y se guarda en «Crónicas».
- **Reglas consultables**: condiciones, habilidades (con tu bonificador), acciones, reglas clave (ventaja, crítico, concentración, descansos, cobertura, agarre…), maestrías de armas y efectos, con buscador.
- Varios personajes, creación guiada por clase (PG, salvaciones, espacios y recursos automáticos), subir de nivel, exportar/importar.

## Inteligencia artificial (opcional)

En **Ajustes** puedes poner una clave de API de Anthropic (console.anthropic.com). Con ella:

- El asistente entiende frases que el intérprete local no reconoce.
- Las grabaciones del diario se reescriben como capítulos de una historia, con una lista final de nombres, pistas y misiones.
- Las fotos de fichas se leen con más precisión que con el OCR sin conexión (incluidas las casillas marcadas).

La clave se guarda solo en el móvil y se envía únicamente a la API de Anthropic. Modelo por defecto: `claude-opus-5-5` (se puede cambiar en Ajustes). Sin clave, todo lo demás funciona sin conexión.

## Desarrollo

```bash
npm install
npm run dev        # versión web en http://localhost:5173
npm test           # pruebas del motor de reglas
```

## Generar el APK

### Opción A: GitHub Actions (sin instalar nada)

Sube el proyecto a un repositorio de GitHub. El workflow `.github/workflows/android.yml` compila el APK en cada push a `main` (o a mano desde la pestaña *Actions*). Descárgalo desde los *Artifacts* de la ejecución, pásalo al móvil e instálalo (permite «instalar apps de origen desconocido»).

### Opción B: en tu ordenador

Necesitas Node 22, JDK 21 y Android Studio (con el SDK de Android 35).

```bash
npm install
npm run android    # compila la web, sincroniza y abre Android Studio
```

En Android Studio pulsa ▶ con el móvil conectado (depuración USB activada), o usa `npm run apk` para generar `android/app/build/outputs/apk/debug/app-debug.apk`.

El reconocimiento de voz usa el servicio del sistema de Android (Google). Para grabar sesiones largas la app reinicia la escucha automáticamente tras cada pausa.

## Estructura

- `src/rules/srd.ts`: datos de reglas 2024 (habilidades, condiciones, acciones, clases, espacios de conjuro, efectos).
- `src/rules/calc.ts`: cálculos derivados (CA, velocidad, bonificadores, ventaja/desventaja según condiciones, tiradas).
- `src/rules/engine.ts`: aplicación de daño, curación, descansos, rondas, salvaciones contra la muerte…
- `src/rules/parser.ts`: intérprete de frases en español e inglés.
- `src/i18n.ts`: idioma de la app (`T('texto', 'text')`).
- `src/importer.ts`: importación de fichas (pdf.js para PDF, mammoth para Word).
- `src/offline/`: importación sin IA: `pdfForm.ts` (formularios PDF por posición), `textParse.ts` (texto libre), `ocr.ts` (OCR con Tesseract.js). El script `scripts/copy-ocr-assets.mjs` copia el motor y los idiomas a `public/ocr` al compilar, para que funcione sin internet.
- `src/ai.ts`: integración opcional con Claude.
- `src/speech.ts`: reconocimiento de voz (plugin nativo / Web Speech API).
- `src/components/`: pantallas.

## Licencias

Código de terceros incluido: Tesseract.js y sus modelos de idioma (Apache 2.0), pdf.js (Apache 2.0), mammoth (BSD-2). La plantilla PDF oficial de la hoja de personaje es de Wizards of the Coast y no se incluye: la app solo lee la copia que tenga cada usuario.

## Licencia de contenido

Los textos de reglas se basan en el System Reference Document 5.2 de Wizards of the Coast LLC, disponible bajo licencia [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/legalcode), traducidos y resumidos. Esta app no está afiliada ni respaldada por Wizards of the Coast.
