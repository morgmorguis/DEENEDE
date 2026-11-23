# Mapa del código de Di en Di

GENERADO por `scripts/mapa.mjs` (se actualiza solo con `npm run build`, o con `npm run mapa`): no lo edites a mano.
Una línea por archivo: tamaño, para qué sirve (su primer comentario) y qué exporta. ⚠️ = más de 40 KB: busca con
`rg -n` y lee solo el trozo que necesites.

## scripts/

- `build-spells.cjs` 6 KB — Genera src/rules/spellsGen.ts con los conjuros del SRD 5.2 y del Player’s Handbook 2024 que no están escritos a mano en src/rules/spells.ts (uso: node…
- `copy-guide.mjs` 1 KB — Copia la guía ilustrada (docs/guia) a public/guia para abrirla dentro de la app (Ajustes → Manual).
- `copy-ocr-assets.mjs` 1 KB — Copia el motor de OCR (Tesseract.js) y los idiomas a public/ocr para que funcione sin internet.
- `mapa.mjs` 4 KB — Genera docs/MAPA.md: una línea por archivo de código con su tamaño, para qué sirve (el comentario de la primera línea) y lo que exporta. Sirve a los agentes…

## scripts/arte/

- `emojis.py` 19 KB
- `emojis_estilos.py` 5 KB
- `emojis_fuente.py` 6 KB
- `escenas.py` 6 KB
- `generar.py` 6 KB
- `iconos.py` 4 KB
- `iconos_procesar.py` 8 KB
- `procesar.py` 3 KB

## scripts/posters/

- `lib.cjs` 13 KB — Utilidades para pintar los pósteres de fondo (fantasía oscura de los 90) en SVG. Las texturas salen de filtros SVG (ruido fractal + iluminación), así no…
- `posters.cjs` 34 KB — Ocho pósteres de fantasía oscura para los fondos de la app y del retrato.
- `render.cjs` 1 KB — Pinta los pósteres a JPEG en public/posters (uso: node scripts/posters/render.cjs [nombre…]) Necesita Playwright con Chromium; los JPEG resultantes se…

## server/

- `app.ts` 3 KB — «Di en Di» para Windows (jugadores): sirve la app solo para este PC y la abre en una ventana propia (Microsoft Edge en modo aplicación). Las fichas se…
- `index.ts` 40 KB — Servidor de partida de «Di en Di»: se ejecuta en el PC del DM (una partida) o en la nube (la principal y las que piden los PC). Sirve la app web y mantiene…
- `relay.ts` 12 KB — Puente con la nube: el servidor del PC del DM se conecta al de la nube (RelayHost) y la nube (RelayHub) le pasa los jugadores que entran con su código. · exporta: HostState, RelayStatus, RelayHub, CloudConfig, RelayPeer, resolveCloud, RelayHost

## server/nube/

- `hosting.mjs` 4 KB — Dirección corta en Firebase Hosting (https://PROYECTO.web.app) para el servidor de Cloud Run. Hosting no deja pasar el WebSocket de la partida, así que solo…

## src/

- `App.tsx` 13 KB · exporta: App
- `ai.ts` 23 KB — Integración opcional con Claude: interpretar frases libres, convertir transcripciones en crónica e importar fichas desde fotos o documentos. La clave la… · exporta: describeError, interpretWithClaude, narrateWithClaude, narrateCombatWithClaude, narrateOffline, SHEET_SCHEMA, ImportedSheet, ImportBlock, importWithClaude, translateLongTexts
- `backup.ts` 8 KB — Archivo de guardado: fichas (con sus notas, categorías, objetos y monedas), su historial, las plantillas de objetos y los botines preparados del DM, en un… · exporta: BACKUP_KIND, BackupExtras, BackupFile, platformName, buildBackup, parseBackup, APP_VERSION, newerThanApp, mergeCharacters, backupFileName, saveBackupFile, exportEverything
- `config.ts` 1 KB · exporta: DEFAULT_MODEL
- `features.ts` 1 KB — Interruptores de funciones. El editor de aspecto (retrato dibujado) está oculto por defecto mientras se rehace; se puede mostrar desde Ajustes → «Editor de… · exporta: FEATURES, useAvatarEditor
- `i18n.ts` 1 KB — Idioma de la interfaz. Se guarda en un módulo para que el motor de reglas y los componentes lo lean sin pasarlo por parámetros; App lo sincroniza con los… · exporta: Lang, Tr, setLang, getLang, L, T, locale
- `imageCategories.ts` 1 KB — Categorías de las imágenes que comparte el DM (mapas, personajes, lugares…): nombre e icono en los dos idiomas. · exporta: categoryIcon, categoryName, categoryLabel
- `imageUtil.ts` 2 KB — Reducir imágenes en el navegador (para enviarlas al servidor o guardarlas en las notas sin ocupar mucho). · exporta: squareThumb, compressImage
- `importer.ts` 16 KB — Prepara fotos, PDF y Word para que Claude lea la ficha, y convierte el resultado en un personaje. · exporta: imageFileToBase64, filesToBlocks, sheetToCharacter, sheetSummary, OfflineMethod, importOffline
- `main.tsx` 1 KB
- `scenes.ts` 3 KB — Fondo de cada paleta según el estilo (Pixel, Retro 16-bit o Pintado) y fondo común durante un combate. Las imágenes salen de la IA local (scripts/arte) y… · exporta: POSTERS, PosterId, posterUrl, combatSceneName, sceneUrl, applyScene, setDmIcon
- `sharedImages.ts` 1 KB — Imágenes que el DM comparte contigo (mapas, retratos…): el archivo completo se guarda en este dispositivo (IndexedDB, sin el límite de la ficha) y la nota… · exporta: sharedImageKey, stripDataUrl, storeSharedImage, loadSharedImage, sharedImageBase64, removeSharedImage
- `speech.ts` 5 KB — Reconocimiento de voz continuo: plugin nativo en Android, Web Speech API en navegador. · exporta: Recorder, startRecording
- `store.ts` 18 KB · exporta: Theme, Settings, Design, LootBundle, ToastAction, speechLangFor, useStore, useChar
- `types.ts` 10 KB · exporta: Ability, DamageType, ConditionId, ProfLevel, RollScope, EffectMods, Effect, Attack, Spell, Resource, Recharge, Feature… (+15)

## src/components/

- `Assistant.tsx` 5 KB · exporta: AssistantTab
- `Available.tsx` 10 KB — Lista de lo que tu personaje puede añadir sin tener que escribirlo: conjuros de las listas de sus clases y de un nivel que pueda lanzar (más los de su… · exporta: AvailablePicker, FeatureCounter
- `Avatar.tsx` 10 KB — Editor de personaje: cara, cuerpo, pelo, ropaje de su clase y fondo, cada uno con sus colores. Dibuja al personaje de cuerpo entero estilo fantasía oscura… · exporta: AvatarTab
- `Backup.tsx` 9 KB — Ajustes → Copia de seguridad: exportar fichas y notas a un archivo y recuperarlas más tarde. · exporta: BackupSection
- `Combat.tsx` 12 KB · exporta: CombatTab
- `CombatActions.tsx` 20 KB — Turno en el combate compartido con las acciones de las reglas 2024: atacar (con arma, sin armas, agarrar, empujar), magia, correr, destrabarse, esquivar,… · exporta: TURN_ACTIONS, REACTIONS, actionName, TargetChip, TurnPanel
- `Confirm.tsx` 4 KB — Diálogos propios («¿Seguro que quieres borrar…?», «Nombre de la carpeta») con el estilo de la app. No usamos confirm()/prompt() del navegador: en el WebView… · exporta: useConfirm, askOk, askText, confirmDelete, ConfirmHost
- `Consumables.tsx` 7 KB — Munición y consumibles: en la hoja se gestionan las cantidades; en combate se marca lo que gastas y al terminar se recupera lo que permiten las reglas. · exporta: Consumables
- `DmBackup.tsx` 10 KB — Copia de la campaña del DM: personajes preparados, encuentros, entregas, registro de combate, crónicas, imágenes (con los archivos dentro) y ajustes de la… · exporta: CampaignFile, parseCampaign, DmBackupSection
- `DmGroup.tsx` 6 KB — Pestaña «Grupo» del DM: el estado de cada jugador siempre a la vista, dentro y fuera de combate: vida, CA, condiciones, oro, dados de golpe, espacios de… · exporta: DmGroupTab
- `DmNotes.tsx` 4 KB — DM: escribir notas (cartas, pistas, secretos) a un jugador, a varios o a todo el grupo; llegan a su grimorio, en «Compartido conmigo». · exporta: DmNotes
- `DmRoster.tsx` 23 KB — Pestaña «Personajes» del DM: aliados y enemigos preparados con su nivel y datos básicos para tenerlos a mano y meterlos en el combate. Se guardan en el… · exporta: DmRosterTab
- `DoodleViewer.tsx` 7 KB — Imagen a pantalla completa con zoom y garabatos propios (pluma con tres colores): lo que dibujas solo lo ves tú y se guarda en este dispositivo. · exporta: DoodleViewer
- `Editor.tsx` 6 KB · exporta: Editor
- `ErrorBoundary.tsx` 2 KB — Si una pantalla falla, en vez de quedarse en negro muestra el error y deja volver o copiarlo para avisar. · exporta: ErrorBoundary
- `Flags.tsx` 3 KB — Panel de avisos de la ficha: cada aviso explica el motivo y se puede ignorar para siempre. · exporta: FlagList, FlagsPanel
- `Hp.tsx` 12 KB · exporta: HpBar, HpModal
- `Identity.tsx` 13 KB — Cabecera de la hoja: selectores de clase, subclase (según la clase), multiclase, especie y linaje. · exporta: ClassField, SubclassField, SpeciesField, BackgroundField
- `Images.tsx` 12 KB — Imágenes de la mesa: el DM las arrastra (o las elige), decide cuándo y con quién compartirlas, y a los jugadores les llegan como un aviso con la imagen;… · exporta: useImageUrl, ImageViewer, DmImages, SharedGallery, ImageNotifier
- `Import.tsx` 10 KB · exporta: ImportModal
- `InfoBubble.tsx` 6 KB — Burbuja de información: mantén pulsado algo de la ficha 1,5 s para ver qué hace y qué te limita ahora. · exporta: LONG_PRESS_MS, useBubble, longPress, InfoBubble, ExplainModal
- `Initiative.tsx` 20 KB · exporta: InitiativePrompt, entryHp, InitiativeTracker, TurnPanel
- `LevelUp.tsx` 30 KB — Pantalla «Subir de nivel»: muestra lo que ganas según tu clase, te deja elegir las opciones que permiten las reglas (explicadas) y al pulsar LVL UP… · exporta: LevelUpPage
- `Manual.tsx` 1 KB — Manual de la app (la guía ilustrada) dentro de una ventana a pantalla completa. · exporta: ManualViewer
- `Notes.tsx` 29 KB · exporta: openNotesAt, NotesDrawer
- `OriginPicker.tsx` 12 KB — «Origen y habilidades»: elecciones de nivel 1 según trasfondo, clase y especie. Solo muestra lo que se puede escoger, avisa cuando dos fuentes dan la misma… · exporta: OriginPicker
- `Party.tsx` 91 KB ⚠️ — Pestaña «Partida»: unirse a la partida del DM, ver la party, jugar el combate compartido por turnos, consultar el registro y (si eres el DM) organizarlo… · exporta: ENEMY_COLORS, StateBadge, isDmEntry, DmLogin, logLine, combatReport, saveCombatReport, CombatReportModal, TurnBanner, setPrepFocus, EncounterInvite, DmCombatTab… (+2)
- `Rules.tsx` 6 KB · exporta: RulesTab
- `Settings.tsx` 19 KB · exporta: SettingsTab
- `Sheet.tsx` 69 KB ⚠️ · exporta: SheetTab, PartsList, SpellComp, EffectPicker
- `SheetPdf.tsx` 6 KB — Exportar la ficha: en PDF sobre la hoja oficial de 2024 (el jugador elige el PDF una vez y se guarda en el dispositivo), en Excel o en Markdown. · exporta: SheetPdfModal
- `Suggest.tsx` 2 KB — Campo de texto con sugerencias (texto predictivo) que aparecen al escribir. · exporta: SuggestItem, SuggestInput
- `Transition.tsx` 5 KB — Transiciones a pantalla completa al estilo de un encuentro de los RPG de los 90: destellos, barras que cierran la pantalla, el fondo se difumina y aparece… · exporta: FxKind, useFx, TransitionFx
- `Treasure.tsx` 52 KB ⚠️ — Tesoro: catálogo de objetos, plantilla para crear objetos propios, la caja «Objetos» de la ficha y la pestaña «Tesoro» del DM para dar oro y objetos a un… · exporta: RarityTag, effectsText, ItemForm, ItemPicker, ItemsBox, CoinsTotal, CoinLabel, CoinInfoModal, Loot, LootEditor, BundleList, setGiveFocus… (+4)
- `common.tsx` 6 KB · exporta: Modal, Section, Pips, Toast, useRoll, critDice, useDamageRoll, NumberInput, pickFiles, GearPlus

## src/export/

- `dmExport.ts` 12 KB — Listas del DM en Excel (.xlsx) o Markdown: personajes preparados, lugares y encuentros, tesoro de cada enemigo y de cada grupo, botín pendiente, entregas y… · exporta: DmLists, lootValue, rosterRows, lootPerEnemyRows, lootPerGroupRows, pendingLootRows, giftRows, logRows, dmWorkbook, mdTable, dmMarkdown, characterRows… (+2)
- `notesExport.ts` 5 KB — Exporta el diario (notas, crónicas e imágenes del DM) a Markdown o a un PDF propio, por carpetas y en orden de fecha. · exporta: groupNotes, notesMarkdown, notesPdf, exportFileName
- `sheetPdf.ts` 18 KB — Exporta la ficha a PDF rellenando la hoja oficial de 2024 (2 páginas, sin campos de formulario): se escribe el texto encima. Las posiciones están medidas… · exporta: SheetFields, sheetFields, pdfSafe, buildSheetPdf
- `templateStore.ts` 2 KB — Archivos grandes guardados en este dispositivo (IndexedDB): la hoja oficial en PDF que el jugador elige una vez. · exporta: saveFile, loadFile, removeFile, SHEET_TEMPLATE
- `xlsx.ts` 8 KB — Escribe libros de Excel (.xlsx) sin dependencias: un ZIP sin comprimir con hojas de celdas de texto y números. · exporta: Cell, XlsxSheet, crc32, zipStored, buildXlsx, XLSX_MIME

## src/offline/

- `ocr.ts` 14 KB — OCR sin conexión con Tesseract.js (licencia Apache 2.0). El motor y los idiomas van dentro de la app (public/ocr), así que funciona sin internet y sin… · exporta: OcrWord, OcrPage, recognizeImages, parseOcrPages
- `pdfForm.ts` 18 KB — Lectura sin IA de PDF rellenables: identifica cada campo del formulario por su posición en la hoja oficial de 2024, o por su nombre en hojas que usan… · exporta: FormField, looksLikeOfficial2024, mapOfficial2024, mapByFieldNames, readFormFields
- `sheetUtils.ts` 3 KB · exporta: emptySheet, parseInt0, parseAttackBonus, parseDamageCell, parseDamageType, parseHitDie, setSkill
- `textParse.ts` 13 KB — Lectura sin IA de fichas escritas como texto (Word, texto pegado o texto reconocido por OCR). · exporta: findClass, parseSheetText

## src/party/

- `client.ts` 35 KB — Conexión de la app con el servidor de partida: estado en tiempo real, reconexión automática, envío del resumen de tu ficha y aplicación en tu ficha de lo… · exporta: PartyConn, wsUrl, httpBase, ERRORS, applyGift, receiveGift, giftLines, summaryOf, addSharedNotes, useParty, resolveServer, DEFAULT_SERVER… (+7)
- `difficulty.ts` 2 KB — Dificultad del encuentro (Dungeon Master’s Guide 2024): presupuesto de PX por personaje según su nivel (baja, moderada, alta) frente a la suma de PX de los… · exporta: xpForCr, Difficulty, encounterDifficulty
- `encounterImport.ts` 16 KB — Listas de enemigos del DM desde Excel (.xlsx), CSV o texto pegado de una hoja de cálculo, plantilla para rellenarlas y exportación a CSV. · exporta: parseDelimited, readXlsx, parseItems, rowsToEncounters, importEncounterFile, encountersRows, encountersToCsv, encounterTemplateCsv, splitLoot, mergeLoot
- `lanCode.ts` 3 KB — Código de una partida «en casa»: 8 letras que llevan dentro la dirección del PC del DM en la Wi-Fi (IP privada y puerto) y una parte al azar. Así la app… · exporta: LAN_CODE_LENGTH, isLanIp, lanCode, lanAddress
- `monsters.ts` 13 KB — Monstruos habituales del System Reference Document 5.2 (CC-BY-4.0) para que el DM los añada al combate. Solo lo necesario para llevar el combate: CA, PG… · exporta: MonsterInfo, MONSTERS, searchMonsters
- `myGames.ts` 5 KB — «Mis partidas»: las que el DM crea en la nube desde la app (su clave queda en este dispositivo) y la copia automática de cada una, para restaurarla si la… · exporta: MyGame, EXPIRE_DAYS, myGames, rememberGame, patchGame, forgetGame, isMyGame, NewGameError, createGame, gameExists, loadBackup, scheduleBackup… (+1)
- `narrative.ts` 8 KB — Resumen narrativo de un combate a partir de su registro: sin IA (frases generadas aquí) o con IA (se prepara el registro en texto para que Claude lo cuente… · exporta: lastCombat, combatTranscript, localNarrative
- `phrases.ts` 5 KB — Frases para el aviso de «¡Comienza un encuentro!»: sale una al azar cada vez que el DM lanza un combate. · exporta: COMBAT_PHRASES, randomCombatPhrase
- `protocol.ts` 17 KB — Protocolo de la partida compartida (modo party): tipos que comparten la app y el servidor. · exporta: Role, CombatantKind, PcSummary, IMAGE_CATEGORIES, ImageCategory, isImageCategory, SharedImage, Chronicle, RoomSettings, TimedCondition, Counter, Member… (+24)
- `room.ts` 47 KB ⚠️ — Lógica de la partida compartida. Funciones puras: el servidor guarda una `Room`, le aplica los comandos de cada cliente y envía a cada uno solo lo que puede… · exporta: StoredMember, Room, Effect, Result, cleanMods, cleanGift, cleanLoot, rid, newCode, enterError, canEnter, createRoom… (+14)

## src/rules/

- `avatar.ts` 65 KB ⚠️ — Personaje de cuerpo entero al estilo de la fantasía oscura de los 90: línea fina oscura, volumen con luz lateral, textura pintada y grano, delante de uno de… · exporta: AvatarLook, SKINS, HAIR_COLORS, EYE_COLORS, CLOTH_COLORS, FACES, BODIES, HAIRS, BEARDS, OutfitDef, OUTFITS, outfitsFor… (+10)
- `bonuses.ts` 20 KB — Bonificadores y ventajas que dan las reglas 2024 a las pruebas d20 (habilidades, pruebas de característica, salvaciones, iniciativa) según la clase, la… · exporta: RollTarget, RuleMod, adjKey, adjValue, adjText, ruleMods, activeRules, rulesBonus
- `calc.ts` 21 KB · exporta: mod, fmt, profBonus, abilityMods, RollResult, rollExpr, isDiceExpr, armorClass, speed, maxHp, maxHpParts, Part… (+23)
- `classFit.ts` 7 KB — Rasgos y conjuros que encajan con la clase del personaje: límites de lo que se elige (estilos de combate, metamagia, invocaciones, opciones de clase,… · exporta: FeatureLimit, featureLimits, groupFull, pruneForClass, removedBetween, pruneSummary
- `consumables.ts` 4 KB — Munición y consumibles: detectar en el texto del equipo, gastar en combate y recuperar al acabar. Reglas 2024 (propiedad Munición): tras el combate puedes… · exporta: detectConsumables, recoverAfterCombat
- `engine.ts` 30 KB · exporta: Command, ApplyResult, makeEffectFromPreset, findResource, applyDamage, applyHeal, applyRest, nextRound, deathSave, applyCommand, runQuickRoll, SELF_ID… (+1)
- `explain.ts` 16 KB — Explicaciones breves para la burbuja de información (mantener pulsado): qué hace algo y qué te limita ahora mismo. · exporta: InfoTarget, Limit, Explanation, explain
- `factory.ts` 11 KB · exporta: uid, NewCharacterInput, defaultFolders, blankCharacter, normalizeCharacter, createCharacter, levelUp, sampleCharacter
- `flags.ts` 21 KB — Avisos de la ficha: datos que deberían estar y no están, o cosas que no cuadran con las reglas de 2024. Cada aviso tiene un id estable para poder ignorarlo… · exporta: FlagSeverity, Flag, XP_TABLE, validate, activeFlags
- `gear.ts` 10 KB — Equipo y rasgos con efectos numéricos: armadura y escudo equipados, objetos mágicos (protección, guanteletes, diademas…), armas mágicas, y dotes o rasgos… · exporta: Source, activeGear, needsAttunement, abilityScores, wornArmor, acFromGear, hpExtras, speedExtras, attackExtras, attackFromItem, armorTrained, setEquipped
- `glossary.ts` 22 KB — Glosario inglés ↔ español de términos de D&D 2024 para traducir los datos de una ficha importada (equipo, competencias, idiomas, rasgos, nombres de conjuros… · exporta: GlossaryDomain, translateTerms, spellName, translateCharacter
- `itemTypes.ts` 2 KB — Tipos de objetos y monedas (sin dependencias: los usa también el servidor de la partida). · exporta: Rarity, ItemType, ItemData, Coins5, AbilityKey, ItemMods
- `items.ts` 31 KB — Objetos y monedas (reglas 2024): catálogo de los más comunes para que el DM los reparta, plantilla para crear objetos propios y utilidades de valor y… · exporta: NO_COINS, COIN_KEYS, coinLabel, coinName, coinsInGold, hasCoins, coinsText, COIN_IN_CP, COIN_INFO, coinsWeight, exchangeCoins, payCoins… (+15)
- `levelup.ts` 13 KB — Aplica una subida de nivel con las elecciones del jugador: PG, rasgos nuevos, subclase, mejoras de característica o dotes, estilos, pericias, metamagia,… · exporta: AsiChoice, LevelUpChoices, averageHitDie, maxSpellLevel, newSpellAllowance, addDbSpell, applyLevelUp, LevelUpDiff, levelUpDiff
- `multiclass.ts` 7 KB — Multiclase (reglas 2024): niveles por clase, espacios de conjuro combinados y requisitos. · exporta: ClassEntry, classLevels, classLevelOf, isMulticlass, classSummary, spellSlotsFor, MULTICLASS_REQ, meetsReq, reqText, applyClass, hitDiceText
- `origins.ts` 8 KB — Elecciones de origen (nivel 1, reglas 2024): trasfondos con sus habilidades, herramienta, dote y características; habilidades que puede elegir cada clase;… · exporta: BackgroundInfo, BACKGROUNDS, findBackground, CLASS_SKILLS, SPECIES_SKILLS, ALL_SKILLS, ClassPick, LEVEL1_PICKS
- `parser.ts` 21 KB — Intérprete local (sin IA) de frases sobre lo que le pasa al personaje, en español e inglés. · exporta: norm, ParseResult, parseInput, lookupTopic, examplePhrases
- `progression.ts` 68 KB ⚠️ · exporta: Gain, Option, Choice, LevelEntry, SUBCLASSES, FEATS, BOONS, FIGHTING_STYLES, METAMAGIC, INVOCATIONS, levelEntry, spellCounts… (+7)
- `species.ts` 16 KB — Especies de D&D 2024 (SRD 5.2) con sus linajes o ascendencias: alto elfo, drow, dracónido de cada color, gigante de cada tipo para los goliat, legado… · exporta: Trait, Lineage, SpeciesInfo, SPECIES_INFO, findSpecies, speciesLabel, applySpecies
- `spellLimits.ts` 7 KB — Cuántos trucos y conjuros preparados puede tener un personaje (tablas de clase de 2024) y cuántas veces puede lanzar cada conjuro (a voluntad, espacios de… · exporta: SpellLimits, spellLimits, speciesSpellNames, isFreeSpell, spellCounts, SpellUse, spellUse
- `spells.ts` 34 KB — Conjuros de las reglas 2024: los más habituales escritos a mano con un resumen (aquí) y el resto del SRD 5.2 (CC-BY-4.0) y del Player’s Handbook 2024… · exporta: SpellInfo, SPELLS, findSpell, spellComponents
- `spellsGen.ts` 313 KB ⚠️ — GENERADO por scripts/build-spells.cjs: no editar a mano. Conjuros del SRD 5.2 (CC BY 4.0, Wizards of the Coast) y del Player’s Handbook 2024 (resumen… · exporta: GEN_SPELLS, GEN_LISTS
- `srd.ts` 68 KB ⚠️ — Datos de reglas basados en el System Reference Document 5.2 (reglas de D&D 2024), publicado por Wizards of the Coast bajo licencia CC-BY-4.0. Textos… · exporta: ABILITIES, abilityName, abilityShort, SkillInfo, SKILLS, skillName, ConditionInfo, CONDITIONS, conditionName, EXHAUSTION_INFO, DAMAGE_TYPES, damageTypeName… (+28)
- `stash.ts` 5 KB — Dónde va en la ficha lo que te dan (el DM o un compañero): munición y consumibles a su lista, y armas, armaduras y escudos reconocidos por el nombre (aunque… · exporta: consumableKind, gearByName, Placement, placeReceived, wearable
- `suggest.ts` 7 KB — Texto predictivo al escribir a mano un conjuro o un rasgo: solo propone lo que el personaje puede tener ahora según sus clases (y multiclase), nivel,… · exporta: SpellSuggestion, unlockLevel, spellSuggestions, FeatureGroup, FeatureSuggestion, featureSuggestions
- `weapons.ts` 26 KB — Armas del Player’s Handbook 2024 (SRD 5.2) con sus propiedades, maestría y lo que permiten o no (ataques no letales, dos armas, recarga…), y reglas de «qué… · exporta: WeaponProp, WEAPON_PROPS, WeaponInfo, WEAPONS, weaponLines, OTHER_ATTACKS, CAN_DO

## Tests

- `src/__tests__/backup.test.ts`
- `src/__tests__/speech.test.ts`
- `src/export/__tests__/dmExport.test.ts`
- `src/export/__tests__/notesExport.test.ts`
- `src/export/__tests__/sheetPdf.test.ts`
- `src/offline/__tests__/offline.test.ts`
- `src/party/__tests__/address.test.ts`
- `src/party/__tests__/encounterImport.test.ts`
- `src/party/__tests__/gifts.test.ts`
- `src/party/__tests__/lanCode.test.ts`
- `src/party/__tests__/narrative.test.ts`
- `src/party/__tests__/room.test.ts`
- `src/rules/__tests__/bonuses.test.ts`
- `src/rules/__tests__/character-build.test.ts`
- `src/rules/__tests__/flags.test.ts`
- `src/rules/__tests__/gear.test.ts`
- `src/rules/__tests__/glossary.test.ts`
- `src/rules/__tests__/levelup.test.ts`
- `src/rules/__tests__/origins-avatar.test.ts`
- `src/rules/__tests__/profs.test.ts`
- `src/rules/__tests__/rules.test.ts`
- `src/rules/__tests__/stash.test.ts`
- `src/rules/__tests__/weapons.test.ts`
