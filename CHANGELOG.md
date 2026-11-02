# Changelog de Di en Di

Todos los cambios de la app, del más reciente al más antiguo. Las versiones siguen el orden en que se
publicaron los APK en GitHub Actions.

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
