# Changelog de Di en Di

Todos los cambios de la app, del más reciente al más antiguo. Las versiones siguen el orden en que se
publicaron los APK en GitHub Actions.

## 0.22.1 · 7 nov 2026 — Puerto libre automático en el servidor

- Si el puerto 3000 ya lo usa otro programa del PC (por ejemplo una IA local), el servidor busca solo el siguiente libre (3001, 3002…) y publica en Internet **ese** puerto. Así el túnel de Tailscale nunca expone otro programa por error.
- Con `--port` se respeta el puerto pedido; si está ocupado, la ventana avisa de cómo abrirlo con otro y no se cierra de golpe.
- La ventana del servidor muestra el puerto que está usando.

## 0.22.0 · 7 nov 2026 — Partida en Internet, Grupo e imágenes del DM y estilo Retro 16-bit

**Servidor**
- **Publicación automática en Internet** al abrir el servidor, con dirección fija y HTTPS y sin Cloudflare: Tailscale Funnel si está instalado (por defecto) o ngrok con dominio fijo gratuito. La red local sigue funcionando. Configuración en `di-en-di-servidor.json`; explicación y alternativas (DuckDNS, playit.gg, zrok…) en `PUBLICAR.txt`. `--no-publish` para no publicar.
- El código de la partida ya no se ve en `/api/info` sin la clave del DM (importante ahora que el servidor está en Internet).
- **Iconos en Windows**: «Di en Di.exe» con el goblin y «Di en Di - Servidor.exe» con el goblin y un icono de conexión (wifi) en la esquina, con nombre y versión en las propiedades.

**Para el DM**
- Pestaña **👥 Grupo**: estado de cada jugador siempre a la vista (vida, temporales, CA, pasiva, velocidad, oro, dados de golpe, espacios, recursos, condiciones, concentración, inspiración, agotamiento, objetos) y totales del grupo.
- **📨 Invitar jugadores**: enlaces de Internet y de la red local con el código, para copiar.
- **🖼️ Imágenes para la mesa**: arrastrar y soltar, compartir con todos o con algunos, dejar de compartir, renombrar y borrar. Se guardan en el servidor (`di-en-di-imagenes`) y solo las descarga quien puede verlas.
- Los **botines preparados** se ven en Tesoro aunque aún no haya jugadores conectados.

**Para los jugadores**
- **Conexión discreta**: al unirte fuera de combate vuelves a tu ficha; la app solo te interrumpe si el DM hace algo.
- Las **imágenes del DM** llegan como aviso y quedan en Partida → Imágenes del DM. La tele muestra la última compartida.
- El oro, los objetos y los recursos de los compañeros son privados (solo los ve el DM).

**Estilo visual**
- Nuevo estilo **Retro 16-bit** (Ajustes → Estilo visual), sin quitar el **Clásico**: fondos pixel art con las mismas escenas, transiciones de RPG clásico para combate y subida de nivel, botones más cuadrados e icono pixel. Botones para probar las transiciones.
- Herramientas para tu IA local: `scripts/retro/comfy_generar.py` (genera todas las imágenes en ComfyUI con FLUX + LoRAs de pixel art o de fantasía 80-90) e `import-ai-art.cjs` (las pixela e incorpora). Guía en `docs/arte-retro/LEEME.md`.

## 0.21.1 · 6 nov 2026 — Monedas explicadas

- En el recuadro **Monedas**, cada casilla lleva su nombre (cobre, plata, electro, oro, platino) y al tocar la abreviatura (PC, PP, PE, PO, PPT) o «ℹ️ ¿Qué vale cada moneda?» se abre la explicación: qué es cada pieza, cuánto vale, ejemplos de lo que se compra con ella (una antorcha 1 pc, raciones 5 pp, espada larga 15 po…), la tabla de equivalencias y el peso (50 monedas = 1 libra).
- **Cambiar monedas** sin comisión (p. ej. 200 pc → 2 po), solo cuando sale exacto.
- Junto al total en oro se muestra cuánto pesan tus monedas.
- En Reglas, nueva entrada «Monedas y dinero».

## 0.21.0 · 6 nov 2026 — Vida máxima temporal, todo explicado y reglas de armas

**Vida máxima temporal**
- Tocando la vida → «Vida máxima temporal»: sube (Ayuda nivel 2/3/4, Banquete de héroes 2d10) o baja (Drenaje de vida y otros daños necróticos) los PG máximos, con su origen y duración (hasta descanso largo o hasta que lo quites). Ayuda sube también los PG actuales; si el máximo llega a 0, mueres (reglas 2024).
- El máximo de la barra de vida sale en verde o rojo cuando está cambiado.

**Cada modificador explicado**
- Al tocar PG máximos, velocidad, bonificador de competencia, percepción pasiva, CD y ataque de conjuros o un arma se ve cada sumando con su origen: característica (y el objeto que la cambia), competencia, rasgos ✦, objetos + azul, efectos ✨ (Bendición, Perdición… que se tiran aparte) y agotamiento.
- Salvaciones, habilidades e iniciativa muestran también los dados de efectos y el agotamiento.
- Percepción pasiva con ventaja (+5) o desventaja (−5) según las reglas 2024.

**Reglas**
- **Armas**: las 38 armas de 2024 con daño, propiedades, maestría, si permiten **ataques no letales** (solo cuerpo a cuerpo), dos armas, bajo el agua y límites; con tu ficha, si tienes competencia y si tendrías desventaja por ser Pesada. Ataque sin armas y armas improvisadas.
- **Puedes / no puedes**: qué cabe en el turno, un espacio de conjuro por turno, conjuros con armadura sin entrenamiento, componentes, ataques de oportunidad, moverse entre criaturas, esconderse, ataques en situaciones especiales, objetos y armaduras, saltos, respiración, caídas, descansos, visión y sorpresa.
- **Propiedades de armas** explicadas una a una.

## 0.20.0 · 6 nov 2026 — Equipo, intercambios y archivo de guardado

**Equipar objetos**
- En **Objetos**, toca un objeto y pulsa **🛡️ Equipar**: armaduras (CA según tipo y DES, requisito de Fuerza, desventaja en Sigilo, desventaja sin entrenamiento), escudos, capa y anillo de protección, piedra de la suerte, brazales de defensa, guanteletes de poder de ogro, diadema del intelecto, amuleto de salud (sube los PG)… Los que requieren sintonización solo funcionan sintonizados.
- Lo que cambia un objeto se marca con un **+ azul** en CA, características, salvaciones, habilidades, velocidad, PG y ataques, con el objeto que lo da.
- Al equipar un arma se crea su fila de ataque (daño, tipo, alcance y maestría); las **armas +1/+2/+3** suman a la fila que elijas.
- **⚙️ Efectos al equipar** en la plantilla de objetos (también para el DM): armadura base, CA, salvaciones, pruebas, característica fija o sumada, velocidad, ataque y daño. Nuevas armaduras en el catálogo (acolchada, pieles, escamas, semiplacas, anillas, bandas) y armadura +1/+2.

**Dotes y rasgos con números**
- Se suman solos (con un + dorado): **Duro** (+2 PG por nivel), **Dureza enana** (+1 PG por nivel), **Veloz** (+10 pies), estilo **Defensa** (+1 CA con armadura), **Tiro con arco** (+2 a distancia) y Maestro en armaduras intermedias. Si ya estaban sumados a mano, se desmarcan tocando el + de los PG o la velocidad.

**Partida**
- **La vida de los compañeros está oculta por defecto**: cada jugador ve su vida y, de los demás, solo su estado. El DM puede mostrarla con una casilla.
- **Intercambio entre jugadores**, dentro o fuera de combate: «🤝 Dar a un compañero» quita monedas u objetos de tu ficha y los suma a la del otro (aunque esté desconectado). El DM lo ve en su registro.
- **Botines preparados del DM**: se preparan sin conexión (Partida → Prepara el botín) y luego se usan en Tesoro con un toque; también «💾 Guardar para luego».

**Notas y guardado**
- Al escribir una nota eliges su **categoría** o creas una nueva; los diálogos para crear y renombrar ya no usan las ventanas del navegador (que no funcionaban en Android).
- El borrador de la nota se guarda en el dispositivo aunque se cierre la app.
- **Archivo de guardado multiplataforma**: el mismo `.json` en Android, Windows y el navegador, con fichas, notas y categorías, historial, plantillas de objetos y botines. Botón **💾 Guardar archivo** también en el diario.

**Arreglos**
- **Pantalla en negro al entrar en combate en Android**: la transición «¡COMBATE!» ya no usa el desenfoque que fallaba en algunos móviles, y se cierra sola en 4 segundos como mucho.
- Si una pantalla falla, ahora se muestra el error con un botón para volver y otro para copiarlo, en vez de quedarse en negro.
- Todos los «¿Seguro?» usan el diálogo propio de la app.

## 0.19.0 · 4 nov 2026 — Bonificadores de clase, especie y dotes

**Habilidades, salvaciones e iniciativa con las reglas 2024**
- Además de competencia o pericia, se suman solos los rasgos de tu clase, subclase, especie y dotes (marcados con ✦ en la hoja):
  - **Clérigo Taumaturgo**: + SAB (mín. +1) a Arcanos y Religión. **Druida Mago**: + SAB a Arcanos y Naturaleza.
  - **Bardo 2** Aprendiz de todo: + mitad de la competencia en habilidades sin competencia.
  - **Paladín 6** Aura de protección: + CAR a las salvaciones. **Monje 14** y **pícaro 15**: competencia en salvaciones.
  - **Errante feérico**: + SAB a las pruebas de Carisma. **Acechador en la penumbra**: + SAB a la iniciativa. Dote **Alerta**: + competencia a la iniciativa.
  - **Ventaja**: Sentido del peligro (bárbaro 2), Instinto salvaje (bárbaro 7), Atleta excepcional (Campeón), Asesinar (Asesino), Astucia gnoma, Conocimiento primigenio en Furia.
  - Al tirar: **Talento fiable** (pícaro 7: un 9 o menos cuenta como 10), **Suerte del mediano** (repite los 1) y **Poder indomable** (bárbaro 18).
  - Recordatorios de lo que depende de la situación: Valiente, Linaje feérico, Resistencia enana, Constitución poderosa, Mente táctica, Indomable, Afortunado, Lanzador de guerra, Mente sobrenatural, Presagio, Mareas del caos…
- Al tocar una habilidad, salvación, característica o la iniciativa se ve el cálculo completo. Cada regla se puede **desmarcar**, y **＋ Añadir otro bonificador** suma un número y/o el modificador de una característica (p. ej. «+ SAB») con una nota.
- Las pruebas de característica sin habilidad y la iniciativa (también en la partida compartida) usan estos bonificadores.
- La especie se reconoce también en femenino («Enana», «Alta elfa», «Mediana»…).

## 0.18.0 · 3 nov 2026 — Tesoro: el DM reparte oro y objetos

**Para el DM (pestaña 💰 Tesoro)**
- **Dar oro y objetos a un jugador concreto**: monedas (ppt, po, pe, pp, pc) con atajos +10/+25/+50/+100/+250 po, objetos y una nota.
- **Catálogo** con los objetos más comunes: pociones de curación (todas), pociones y pergaminos de conjuro, armas, escudos y munición +1/+2/+3, bolsa de contención, capas, anillos, botas, varitas, piedras de mensaje, gemas y objetos de arte, armas, armaduras y equipo con los precios del Player’s Handbook 2024. Buscador en español e inglés y filtro por rareza.
- **Plantilla para crear objetos**: nombre, rareza, tipo, valor, peso, cantidad, sintonización y descripción, con el precio orientativo de la DMG 2024 por rareza (consumibles a mitad). Se pueden guardar en **Mis plantillas** para reutilizarlos.
- **Registro de entregas** guardado en el servidor: qué se dio, a quién y cuándo, si ya está en su ficha o pendiente (lo pendiente se puede anular) y el total por jugador (monedas, objetos y valor aproximado en oro).

**Para los jugadores**
- Lo que da el DM llega solo a la ficha con un aviso: **las monedas se suman al total** y los objetos aparecen en la nueva lista **Objetos** del recuadro Equipo. Si estabas desconectado, te llega al volver; nunca se suma dos veces.
- **Objetos** en la hoja: rareza con color, cantidad, valor, descripción, editar y borrar, y **sintonizarse** (máximo 3, reglas 2024). También se pueden añadir desde el catálogo o la plantilla sin estar en una partida.
- Valor total de tus monedas en oro bajo el recuadro Monedas.
- En **Partida**, «Lo que te ha dado el DM».

## 0.17.0 · 3 nov 2026 — Todos los conjuros, rasgos según la clase y mejor importación

**Conjuros**
- **Base completa**: los 339 conjuros del SRD 5.2 y los del Player’s Handbook 2024 que no están en él (castigos, Hex, Armadura de Agathys, invocaciones de criaturas…): 392 en total, con las listas de cada clase. Nombre y resumen en español; en inglés, el texto oficial del SRD.
- Cada clase tiene todos sus trucos de 2024 (bardo 13, clérigo 9, druida 13, hechicero 20, brujo 11, mago 20).

**Rasgos de clase**
- **Al cambiar de clase** (o quitar una de la multiclase) se quitan solos los rasgos y conjuros que ya no te corresponden, con un aviso de lo que se ha quitado. Lo escrito a mano que la app no reconoce se conserva.
- **Límites con contador**: Estilo de combate, Invocaciones, Metamagia, opciones de clase, Subclase y Dotes («1/2»), en la hoja y en «Disponibles», que ya no deja pasar del máximo.

**Subir de nivel**
- Botón **ℹ️** en cada apartado y en cada rasgo nuevo que explica la regla: de dónde salen los PG, por qué ganas ese rasgo, las mejoras de característica, la subclase, los estilos, la metamagia, las invocaciones y los conjuros nuevos.

**Importar fichas**
- Texto y Word: nombre sin etiqueta («Ficha de Thalia»), subclase entre paréntesis, especie en la línea de clase, salvaciones y habilidades sin «:», **armas** («Hacha de batalla +6, 1d8+3 cortante»), **conjuros por nivel con sus espacios**, rasgos y **monedas**.
- PDF con texto (Word, D&D Beyond…): se lee directamente sin OCR.
- PDF rellenable de 2014: clase y subclase, competencias deducidas de los bonificadores y conjuros.
- Fotos: la imagen se amplía y se le sube el contraste antes del OCR, se toleran letras mal leídas en los títulos y se leen mejor el nombre, la clase, el dado de golpe y la tabla de armas.

**Ajustes**
- Interruptor **🎨 Editor de aspecto (experimental)** para mostrar la pestaña oculta.

## 0.16.1 · 3 nov 2026 — Trucos de 2024 y editor de aspecto oculto

- **Trucos de 2024 que faltaban**: Elementalismo, Resistencia, Destello estelar, Látigo de espinas y Palmada atronadora (druida), Estallido hechicero, Astilla mental, Toque de difuntos, Impacto certero, Protección contra armas, Amistad, Luces danzantes y Palabra radiante, cada uno en las listas de sus clases. Con esto, cada clase ya tiene todos sus trucos de 2024 en «Disponibles».
- El **editor de aspecto** (pestaña 🎨 Aspecto) queda **oculto** mientras se rehace; el código se conserva. Los retratos que ya hubieras puesto en la hoja se mantienen y puedes seguir subiendo una imagen propia.

## 0.16.0 · 3 nov 2026 — Pósteres de fantasía oscura, retrato de busto y límite de conjuros

**Conjuros**
- **Límite de trucos y conjuros preparados** según las tablas de clase de 2024 (también multiclase, caballero arcano y embaucador arcano, y opciones que dan trucos extra como Taumaturgo o Guerrero bendito). Debajo de la tabla: «Trucos 3/3 · Preparados 4/6». En «Disponibles» no se puede pasar del máximo y la hoja avisa si ya tenías de más. Los de la especie y los marcados como «siempre preparado» no cuentan.
- **Icono de usos** en cada conjuro: ♾️ a voluntad, ✨ espacios que te quedan de su nivel con 🌙 (descanso largo) o ⛺ (descanso corto, brujo), 1×🌙 para los de la especie; en rojo si no te quedan espacios.

**Hoja**
- Los textos largos (atributos de especie, dotes, equipo, historia, idiomas…) tienen un botón **⤢** para abrirlos **a pantalla completa**.
- En móviles estrechos se oculta la columna «Tiempo» de los conjuros para que el nombre se lea entero.

**Fondos**
- Adiós al pixel: cada paleta tiene ahora un **póster de fantasía oscura de los 90** pintado de antemano (sin títulos): ocaso de sangre con la torre del nigromante, ruinas del bosque con un druida, la puerta de los reyes enanos y el abismo estelar con su catedral. Hay cuatro más (mar del kraken, mazmorra, ciudadela del desierto y cripta) para el retrato.

**Personaje**
- Nuevo estilo de **fantasía oscura**: línea fina, luz lateral cálida, sombras profundas, textura pintada y grano, con uno de los pósteres de fondo.
- **El retrato de la hoja es solo el busto** (cabeza, hombros y pecho); en el editor se sigue viendo el cuerpo entero.
- Se quita el «toque pixel».

## 0.15.0 · 3 nov 2026 — Retrato de cuerpo entero estilo años 70 y conjuros futuros

**Editor de aspecto**
- Nuevo **retrato de cuerpo entero** al estilo de las ilustraciones de fantasía de los 70 (tinta marrón, colores planos con sombra, cielos por bandas, soles a rayas), con un **toque pixel** leve que se puede quitar o marcar más.
- **10 rostros**, **10 complexiones**, **10 peinados**, 6 barbas y **10 ropajes por clase** (120 en total), cada uno con su arma y su tocado.
- Colores cambiables: piel o escamas, ojos, pelo y tres colores del ropaje (principal, capa y pantalón, detalles), con muestras y un selector libre.
- 8 fondos: atardecer, castillo, bosque, lunas gemelas, mar, mazmorra, desierto y cosmos.
- Rasgos de especie: orejas puntiagudas, cuernos, colmillos, cabeza de dragón y aureola; los pequeños se ven más bajos.
- «Usar como retrato» pone la ilustración en la hoja y **su cara** en la barra de arriba.

**Conjuros disponibles**
- Salen también los que hayas quitado de la hoja, y con «Ver también los que conseguirás al subir de nivel» aparecen los de niveles más altos con 🔒 y el nivel de clase al que se desbloquean (lanzadores completos, medios, brujo y caballero arcano o embaucador arcano). La lista crece sola al subir de nivel.

**Estilo**
- **Fondos de la app al estilo de los 70**: atardecer con castillo de agujas y cipreses (Básico), bosque de árboles-seta con torre del mago (Verdoso), cordillera nevada con aurora y ciudadela (Grises) y mar nocturno con faro y velero (Azules).

## 0.14.2 · 2 nov 2026 — Conjuros y rasgos disponibles sin escribir

- Botón **📖 Disponibles** en «Trucos y conjuros preparados»: lista todos los conjuros que puedes tener según tus clases (y multiclase), tu nivel, tu subclase y tu especie o linaje, con filtro por nivel y por nombre. Toca uno para leerlo y **+ Añadir** para ponerlo en la hoja; los que ya tienes salen marcados.
- El mismo botón en «Rasgos de clase»: rasgos de tus clases hasta tu nivel, opciones a elegir (estilos de combate, invocaciones, metamagia…), subclases, rasgos de especie y dotes, agrupados por origen.

## 0.14.1 · 2 nov 2026 — Actualizar sin desinstalar

- Los APK se firman ahora siempre con la misma clave: a partir de esta versión, las siguientes se **instalan encima** sin desinstalar y sin perder los datos (esta todavía necesita desinstalar la anterior una última vez).
- Cada APK tiene un número de versión mayor que el anterior, para que Android lo acepte como actualización.
- **Ajustes → Acerca de** muestra la versión, el commit y la fecha de compilación, para comprobar qué versión tienes instalada.

## 0.14.0 · 2 nov 2026 — Origen al crear el personaje, editor de aspecto y paisajes nuevos

**Creación del personaje (nivel 1)**
- Botón **🎓 Origen y habilidades** en la hoja (resaltado a nivel 1): eliges el **trasfondo** (16 de las reglas 2024, con sus habilidades, herramienta, dote de origen y características) y solo ves las **habilidades que puedes escoger** según tu clase, en el número correcto, más las de tu especie (elfo y humano), la dote *Habilidoso*, la pericia del pícaro, el estilo de combate del guerrero y las órdenes del clérigo y del druida.
- **Conflictos**: si una habilidad ya te la da otra fuente aparece tachada con el motivo y tienes que elegir otra; las duplicadas se marcan en rojo en «⚠️ Conflictos».
- El trasfondo de la cabecera es ahora un selector (o texto libre).

**Editor de aspecto (pestaña 🎨 Aspecto)**
- Piel o escamas, ojos, orejas, cuernos, colmillos, hocico, aureola, cicatriz, parche, pintura de guerra, pecas, peinado y color, barba, ropa y color, tocado y fondo.
- Genera un **retrato pixel art** al momento; empieza según tu especie y tiene 🎲 Aleatorio.
- **Usar como retrato** lo pone en la hoja y arriba junto al nombre.
- Datos físicos (edad, altura, peso, ojos, pelo, piel) y descripción libre; salen en el recuadro «Aspecto» de la hoja.

**Hoja**
- **Papelera** en cada rasgo, arma y conjuro, con el aviso «¿Seguro que quieres borrar…?» (también al borrar munición y desde las ventanas de edición).
- **Munición y consumibles**: la lista se ve limpia; con **✏️ Editar** sumas, restas, añades y borras, y **✓ Listo** lo guarda y cierra.

**Ajustes**
- **📖 Manual**: la guía ilustrada se abre dentro de la app, también sin internet.

**Estilo**
- **Paisajes nuevos** más detallados, estilo RPG de los 90 con el cielo por bandas: castillo con banderas, torre del mago y dragón (Básico); cabaña de bruja, círculo de piedras y setas que brillan (Verdoso); aurora y puerta enana iluminada (Grises); faro, barco de vela, torre élfica y estrella fugaz (Azules).
- La barra inferior admite 7 pestañas en móviles estrechos (en pantallas pequeñas «Asistente» se acorta a «Chat»).

## 0.13.0 · 2 nov 2026 — Hoja a mano con ayudas, multiclase y mejoras del DM

**Hoja de personaje**
- Selector de **clase**: al elegirla se aplican su dado de golpe, salvaciones, competencias, recursos, espacios de conjuro y rasgos (lo añadido a mano se conserva).
- Selector de **subclase** con las de tu clase; se puede escribir otra a mano.
- **Multiclase**: clases adicionales con su nivel y subclase. Los espacios de conjuro se calculan con la tabla de multiclase y los dados de golpe se muestran mezclados («3d12 + 2d6»).
- Selector de **especie y linaje**: alto elfo, drow, elfo de los bosques, dracónido de cada color, gnomo de los bosques o de las rocas, ascendencia gigante del goliat y legado infernal del tiefling. Pone velocidad, tamaño, resistencias, rasgos y trucos.
- **Texto predictivo** al escribir conjuros y rasgos: solo sugiere lo que tu personaje puede tener según clases, nivel, subclase, especie y dotes.
- **Munición y consumibles** con cantidad; se detectan en el texto del equipo («20 flechas, 2 pociones»).

**Subir de nivel**
- Eliges en qué clase subes o empiezas una nueva, con el aviso de los requisitos de multiclase (13 en la característica principal).

**Combate**
- «Usar 1» para munición y consumibles. Al terminar se recupera la mitad de la munición gastada, se recogen las armas arrojadizas y los consumibles se descuentan.

**Partida compartida (DM)**
- Condiciones y efectos con **duración en rondas** por criatura; bajan solas al acabar su turno.
- **Contadores**: acciones legendarias (vuelven en su turno), resistencias legendarias u otros.
- **Dificultad del encuentro** con el presupuesto de PX de 2024.
- **Daño en área** a varios objetivos, con «mitad» para quien supera la salvación.
- Se ve quién se está **concentrando** y las **salvaciones contra la muerte** de cada jugador.
- **Vista para la tele** (`?view=CÓDIGO`): orden de turnos, estados y últimos sucesos, sin nada oculto.

**Arreglos**
- Al cambiar de clase se quita la subclase anterior.

## 0.12.0 · 1 nov 2026 — Paisajes pixel y kill count
- Arreglado el menú lateral en PC: los botones se colocaban en horizontal encima de la hoja. Revisado de 360 a 1920 px que nada se solape.
- Cada paleta de colores tiene su **paisaje pixel art**: bosque otoñal con castillo (Básico), bosque encantado con luciérnagas (Verdoso), montañas nevadas (Grises) y lago nocturno con luna (Azules).
- **Kill count** en el diario: se apunta el golpe final de tu personaje en el combate local y en la partida compartida, y se quita si el DM deshace el turno.

## 0.11.0 · 1 nov 2026 — DM en el móvil, «Listo» y estilo retro
- El DM puede entrar desde el móvil o la tablet con su clave: **modo DM sin ficha**, con las pestañas Partida y **Personajes** (aliados y enemigos preparados con nivel, vida, CA, iniciativa y notas).
- **Preparación del combate**: cada jugador introduce iniciativa y vida, ve las de sus aliados y pulsa **Listo** (se puede quitar). Empieza cuando están todos y el DM.
- **Transiciones** a pantalla completa estilo encuentro retro: «¡COMBATE!», «¡A LUCHAR!», «¡SUBES DE NIVEL!», «¡NIVEL N!».
- **Estilo D&D noventero**: paneles con esquinas doradas, fuente pixel incluida en la app.
- **App para Windows** (`Di en Di.exe`) para jugar sin ser el DM.

## 0.10.0 · 1 nov 2026 — Partida compartida
- **Servidor para Windows** (`Di en Di - Servidor.exe`) que corre en el PC del DM y guarda la partida.
- Conexión por la Wi-Fi de casa o a distancia con **Tailscale Funnel** (sin Cloudflare).
- **Party** con el resumen de cada ficha y **combate por turnos compartido** en tiempo real.
- Monstruos con vida «?» y estado visible (**Ileso, Herido, Ensangrentado, Derrotado**); el DM ve la vida exacta.
- Cada jugador anota daño, curación, daño recibido u otras acciones; el daño recibido se aplica en su ficha con sus resistencias.
- **Deshacer último turno**, que también revierte las fichas.
- **Pantalla del DM**: monstruos del SRD 5.2, grupos, ocultos y revelar, PNJ, notas privadas, iniciativa.
- **Registro del combate** exportable al diario.

## 0.9.0 · 31 oct 2026 — Resumen al subir de nivel y competencias
- Resumen de cómo quedará la ficha antes de pulsar LVL UP.
- Rasgos marcados con su **recarga** (descanso corto, largo, espacio de conjuro o a voluntad).
- Conjuros con sus **componentes V, S, M** y marcas de concentración y ritual.
- Conjuros que un rasgo da siempre preparados (Castigo divino, Encontrar corcel, Encontrar familiar).
- Avisos de **competencias de clase** (armaduras, armas, herramientas, salvaciones, habilidades) con botón **Corregir**.
- Combate: «Otra acción» (hablar, moverse, esquivar…) y últimas acciones en el panel del turno.

## 0.8.0 · 31 oct 2026 — Subir de nivel guiado
- Botón **Subir de nivel** con la progresión 2024 de cada clase (1-20): rasgos explicados, subclases, mejoras de característica y dotes, dones épicos, estilos de combate, pericias, metamagia, invocaciones y conjuros nuevos.
- **PG temporales** sumados a la vida mostrada.
- Tocar un conjuro o un rasgo muestra qué hace, con botón para editarlo.
- Combate sin la sección de armas: vida de compañeros y enemigos y acciones por turno sin dados (tiradas a mano opcionales).

## 0.7.0 · 30 oct 2026 — Copia de seguridad
- Exportar todas las fichas (con progreso, notas y crónicas) o solo la actual a un archivo, y restaurarlas añadiendo o reemplazando.

## 0.6.0 · 30 oct 2026 — Traducción, burbuja de información y avisos
- Al importar una ficha se traducen equipo, armas, idiomas, competencias, especie, conjuros y rasgos; Claude traduce los textos largos si hay clave.
- **Mantener pulsado 1,5 s** cualquier habilidad, conjuro, arma o rasgo muestra qué hace y qué te limita ahora.
- **Avisos de la ficha** con su motivo y opción de ignorarlos.

## 0.5.0 · 29 oct 2026 — Di en Di
- La app pasa a llamarse **Di en Di**.
- Voz: el botón de parar responde y la escucha sobrevive a los silencios.

## 0.4.0 · 29 oct 2026 — Icono e iniciativa
- Icono de **goblin pixel art** lanzando dados hacia la cámara.
- Orden de iniciativa con **burbujas** que se reordenan arrastrando, compañeros y enemigos; la app pregunta la iniciativa en vez de tirarla sola.

## 0.3.0 · 29 oct 2026 — Importar sin IA, temas y tablet
- Importar fichas **sin conexión**: PDF rellenable de la hoja oficial, Word, texto y fotos con OCR en el móvil.
- **Temas de color**: Básico, Verdoso, Grises y Azules.
- Diseño para **tablets** de hasta 16".

## 0.2.0 · 29 oct 2026 — Hoja oficial e inglés
- Hoja con el diseño de la **hoja oficial 2024**, retrato del personaje.
- **Español / inglés** en toda la app.
- **Importar ficha** desde foto, PDF o Word (con Claude).
- **Carpetas** en el diario (Nombres, Lugares, Misiones, Objetos, Crónicas).
- Tirar dados al tocar una estadística pasa a ser opcional (desactivado por defecto).

## 0.1.0 · 29 oct 2026 — Primera versión
- Hoja de personaje interactiva para D&D 2024 con habilidades explicadas y limitaciones actuales.
- **Asistente** en lenguaje natural: «un goblin me hace 7 de daño cortante» aplica resistencias, PG temporales, concentración y muerte.
- Beneficios y perjuicios con duración en rondas.
- **Diario** abatible con grabación de voz convertida en crónica.
- **Modo combate** con acción, acción adicional, reacción y movimiento.
- APK generado en GitHub Actions.
