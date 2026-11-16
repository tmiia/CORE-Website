# Référence CORE.FM : porter le design de l'installation sur le site souvenir

Snapshot du 2026-11-13. Source : repo `something.fm` (installation), branche `v2`, commit `7129c50` + modifs non commitées.

- GitHub : `martin-ctny/something.fm` (branche `v2`)
- Local : `/Users/mxtwin/Projects_2026/something.fm` → dans Claude Code : `/add-dir /Users/mxtwin/Projects_2026/something.fm`
- Les chemins `client/...` ci-dessous sont relatifs à ce repo source.

Ce doc dit **quoi** porter et **avec quels réglages**. Pour le **code**, lire les fichiers sources (via `add-dir` ou GitHub), ne pas réécrire de mémoire.

---

## 1. Contexte

Installation radio interactive. Le visiteur cale une radio sur un genre musical en deux étapes :

1. **Fréquence** (potard rotatif) → TV1 affiche un **oscilloscope** (shader de vagues). Loin de la cible : lignes éclatées, bruitées, déchirées. Sur la cible : une seule sinusoïde propre.
2. **Equalizer** (3 potards HIGH/MID/LOW) → TV1 affiche le **modèle 3D du genre** (glb) rendu en **ASCII**. Chaque bande déforme le rendu.

Fin d'émission → photobooth → **ticket imprimé avec un QR code vers ce site**.

⚠️ L'URL du QR est gravée sur les tickets déjà imprimés : `https://core-fm.netlify.app/` (`client/shared/thermalPrinter.ts`, `QR_URL`). Le site doit rester joignable à cette URL, ou y rediriger.

---

## 2. Identité visuelle de l'installation

### Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `--blue` | `#1c19e0` | Fond écran / HUD, texte inversé |
| ASCII bg | `#1500B2` | Fond du champ ASCII WebGL (légèrement plus sombre que `--blue`) |
| `--fg` | `#ffffff` | Texte, bordures, glyphes ASCII |
| `--alarm` | `#e94251` | Alarmes, fenêtres d'erreur |
| error red | `#C8001E` | Flash rouge du champ ASCII (mauvaise réponse) |
| ghost red | `#ff0026` | Ombre rouge décalée sur le HUD (glitch erreur) |
| hint | `#fff759` | Mots-clés en gras dans les consignes |
| fond hors écran | `#000` | Marges |

### Typo

- **VCR OSD Mono** (`public/vcr/VCR_OSD_MONO.ttf`) : tout le HUD, les titres. `text-transform: uppercase`, `letter-spacing: 0.06–0.08em`, souvent `font-weight: 700`.
- **Anonymous Pro** (Regular/Bold) : logs, texte courant. **Déjà présente dans ce repo** (`public/assets/fonts/`).
- Fallback : `"Courier New", monospace`.
- Glyphes ASCII WebGL : `monospace` bold (police système, pas VCR).

### Motifs UI (`client/tv1/hud.css`, `client/tv2/styles.css`)

- **Box** : `border: 1px solid #fff`, pas de radius, pas de fond.
- **Barre de titre inversée** : fond blanc, texte bleu, `padding: .4em .8em`.
- **Séparateur pointillé** : `border-top: 5px dotted rgba(255,255,255,.7)`.
- **Crosshair** plein écran : lignes 1px `rgba(255,255,255,.45)` au centre.
- **Steps** : carrés `border: 3px solid #fff`, remplis quand validés.
- **Clignotement consigne** : `1.6s steps(1) infinite`, opacité 1 de 0 à 70 %, 0.4 ensuite.
- **Alarme** : `0.5s steps(1) infinite`, alterne fond `--alarm` / fond blanc + texte `--alarm`.
- **Fenêtre d'erreur** : box bleue, barre `--alarm`, `box-shadow: 5px 5px 0 rgba(0,0,0,.6)`.
- **Glitch erreur HUD** : `filter: drop-shadow(6px 0 0 #ff0026) drop-shadow(-4px 0 0 rgba(255,0,38,.6))` en `steps(1)` sur 0.45 s.
- **Modal** : fond blanc, texte noir VCR bold, révélée par `clip-path: inset(0 100% 0 0)` → `inset(0)`.
- **Scramble text** (`client/tv1/hud/scramble.ts`) : chaque caractère apparaît en fondu (stagger 0.03 s, fondu 0.2 s), puis passe par 4 glyphes ASCII aléatoires (33–126, 0.05 s chacun) avant de se fixer. Les espaces ne sont pas brouillés. Dépend de **gsap**.

### Direction du site souvenir (refonte, branche `redesign`)

L'ancien site était orange (`#EB5D10` → `#FC401A`) avec Monigue et des stickers. La refonte **ne reprend pas le bleu** de l'installation : site **noir et blanc**, fond noir, et quelques éléments de la DA de l'installation (wave, champ ASCII, rappels radio/gameplay). Mobile first : l'essentiel du trafic arrive par le QR du ticket.

---

## 3. Architecture du rendu WebGL

Le "look" de l'installation, c'est **une scène three.js ordinaire passée dans un post-process ASCII**. La vague et le modèle 3D sont rendus normalement, puis convertis en glyphes.

```
RenderPass(scene, camera)
  → EffectPass[ AsciiPostFx ]          // scène → grille de glyphes
  → EffectPass[ Bloom, Vignette ]      // agit sur le résultat ASCII
```

Plomberie générique (`client/three/core/`, vanilla, sans dépendance au jeu) :

| Fichier | Rôle |
|---|---|
| `Viewport.ts` | Taille + DPR (cap `maxPixelRatio`, défaut 2), window ou élément via ResizeObserver |
| `Renderer.ts` | Wrapper `WebGLRenderer`, synchro Viewport |
| `PostFx.ts` | `EffectComposer` (lib `postprocessing`), un `EffectPass` par groupe d'effets |
| `RenderLoop.ts` | rAF + `Clock`, `(dt, elapsed)` |
| `Stage.ts` | Assemble le tout + `SceneManager` |
| `../scene/Scene.ts` | Classe abstraite : `build`, `postFx()`, `update`, `onResize`, `dispose` |

Config TV1 (`client/tv1/main.ts`) : `toneMapping: ACESFilmicToneMapping`, `toneMappingExposure: 1.5`, `antialias: false`.

---

## 4. Inventaire : quoi porter

Deps source : `three@^0.171.0`, `@types/three@^0.171.0`, `postprocessing@^6.39.1`, `gsap@^3.15` (scramble seulement). Garder les mêmes versions pour que les APIs correspondent.

### Copier tel quel

| Fichier source | Contenu | Deps |
|---|---|---|
| `client/lib/ascii/AsciiPostFx.ts` | **Le cœur du look.** Effet `postprocessing` : grille de glyphes, blur/qualité, weight, jitter, warp/tear, reveal diagonal, static no-signal | three, postprocessing |
| `client/lib/ascii/charAtlas.ts` | Atlas de glyphes triés par densité (canvas 2D) | three, `document` |
| `client/lib/ascii/RevealController.ts` | Tween de `revealProgress` + pulse glitch | aucune |
| `client/tv1/visuals/wave.ts` | **Shader oscilloscope** (vertex + fragment, chaînes GLSL) | `noise.ts` |
| `client/shared/glsl/noise.ts` | Simplex noise 2D (GLSL) | aucune |
| `client/tv1/visuals/ModelLayer.ts` | Chargement glb normalisé (taille 2.5), éclairage key/fill/rim + PMREM RoomEnvironment, rotation Y 0.3 rad/s | three (GLTFLoader, RoomEnvironment) |

### Adapter

| Fichier source | Pourquoi |
|---|---|
| `client/tv1/visuals/WaveLayer.ts` | Couplé au réglage (potard → `setTuning`), au type `Layer`/`Viewport`, et lit `window` dans le constructeur (SSR). Garder les uniforms + `update()`, remplacer la source du chaos (§7) |
| `client/tv1/transition/ModelControls.ts` | Mapping EQ → ASCII. Dépend du type `EqValues` (`shared/types.ts`) et des potards. Garder le mapping si le site anime l'equalizer |
| `client/tv1/visuals/tuningFx.ts` | Garder `ease()`, `distanceNorm()`, et les valeurs `FREQ_FX`/`EQ_FX` si on simule le réglage |
| `client/three/core/*` | Réutilisable, mais à envelopper dans un hook React (§6) |
| `client/tv1/hud/scramble.ts` | gsap. Ajouter gsap ou réécrire (framer-motion déjà présent) |

### Référence seulement (ne pas copier)

- `client/tv1/Tv1Scene.ts` : composition, tons ASCII, bloom/vignette, glitch erreur. Lire pour les constantes.
- `client/tv1/transition/PhaseMachine.ts`, `revealStyles.ts` : enchaînement vague ↔ modèle, styles de reveal.

### Ne pas porter

`PhaseMachine` (logique de jeu), `NoSignal*`, `ErrorCascade`, sons, WebSocket, `AsciiPane` (debug tweakpane), `SplashSystem`, `BlurEffect` (non utilisés pour ce look).

---

## 5. Réglages de référence (pour un rendu identique)

### Caméra + post

- `PerspectiveCamera(75, aspect, 0.1, 1000)`, `z = 3`
- Bloom : `intensity 0.5`, `luminanceThreshold 0.8`, `luminanceSmoothing 0.3`, `KernelSize.MEDIUM`
- Vignette : `offset 0.3`, `darkness 0.5`

### AsciiPostFx (base TV1)

```ts
{ cellSize: 10, bgColor: "#1500B2", contrast: 1, jitter: 4, jitterSpeed: 5,
  speedVariance: 0.6, bgFloor: 0.1 }
// défauts restants : color #fff, monochrome, fontFamily "monospace", bold, weight 0.5
```

Ton par visuel (appliqué par-dessus) :

```ts
// vague (étape fréquence)
SPIRAL_TONE = { quality: 1, detail: 0.565, weight: 0.5, contrast: 1.2, threshold: 0,
                warpX: 0, warpY: 0, tear: 0 }
// modèle 3D (étape equalizer)
MODEL_TONE  = { contrast: 1, weight: 0.66, threshold: 0, detail: 1 }
```

Vague : jitter ASCII piloté par l'énergie, `jitter` 1.5 → 9, `jitterSpeed` 3 → 16 (de "sur la cible" à "loin").

### Vague (`DEFAULT_WAVE_PARAMS`, `WaveLayer.ts`)

```ts
{ layers: 4, freq: 2.5, freqVar: 0.35, amp: 0.15, ampVar: 1, speed: 1.3, speedVar: 2,
  transSpeed: 0.45, ampSpeed: 1.5, ampMod: 0.2, phaseSpread: 1.0,
  thickness: 0.006, glow: 1.6, zoom: 0.7, colorA: white, colorB: white }
```

- Loin de la cible, multiplicateurs `FAR = { amp: 2.6, thickness: 3, freq: 3.2 }`.
- Uniforms de chaos : `uChaos` (0..1), `uKick` (pic après un mouvement), `uConverge` 1, `uDistort` 0.22, `uTear` 0.35, `uScroll`.
- **Pour une vague calme et "réussie"** : `uChaos = uKick = 0` → toutes les lignes convergent sur une sinusoïde.

### Modèle 3D + equalizer (`ModelControls.ts`, `EQ_FX`)

Chaque bande pilote une déformation ASCII, proportionnelle à sa distance à la cible (0..1) :

| Bande | Paramètre ASCII | Max |
|---|---|---|
| LOW | `warpX` (ondulation horizontale lente) + `weight` 0.72 → 0.4 | 0.08 |
| MID | `warpY` (ondulation verticale) | 0.06 |
| HIGH | `tear` (lignes décalées) + `quality` 1 → 0 (flou + bruit) | 0.12 |

Kick : `kickPerUnit 0.5`, `kickDecay 4/s`, `kickGain 0.7`. Lissage `smooth 6/s`.

### Reveal (`revealStyles.ts`)

```ts
STYLE_A = { revealSkew: 0.5, revealNoise: 0.25, revealSoft: 0.06, stagger: 0.4 } // diagonal, dissous
STYLE_B = { revealSkew: 0.0, revealNoise: 0.08, revealSoft: 0.03, stagger: 0.15 } // vertical, net
DUR = { forward: 1.2, reverse: 0.5 }
```

### Modèles 3D (`public/models/` du repo source)

| id | Genre | Année, lieu | Fichier | Taille |
|---|---|---|---|---|
| `rap` | Rap | 1973, Bronx, New York | `radio.glb` | 2.2 MB |
| `techno` | Techno | 1988, Detroit, Michigan | `ford.glb` | 1.2 MB |
| `bouyon` | Bouyon | 1988, Dominique | `sound_system.glb` | 2.8 MB |
| `baile-funk` | Baile Funk | 1989, Rio de Janeiro | `paredao.glb` | 4.5 MB |

Source : `content/genres.json` (champ `model`). Le schéma Sanity `genre` de ce site n'a ni id ni modèle (§7).

---

## 6. Contraintes d'intégration (Next 16 / React 19)

- **Lire `node_modules/next/dist/docs/` avant de coder** (voir `AGENTS.md`).
- **Client only** : `AsciiPostFx`/`charAtlas` utilisent `document`, `WaveLayer` utilise `window` dès le constructeur. Composant `"use client"` + instanciation dans `useEffect`, jamais au niveau module. Vérifier dans la doc Next locale la bonne façon de désactiver le SSR d'un composant.
- **Cycle de vie** : créer le `Stage` dans `useEffect`, `dispose()` complet au démontage (renderer, composer, géométries, matériaux, atlas, PMREM). StrictMode monte deux fois en dev, donc le dispose doit être idempotent, sinon fuite de contextes WebGL (le navigateur en limite le nombre).
- **Perf mobile** : le blur ASCII fait 25 lectures de texture par pixel. Baisser `maxPixelRatio` sur mobile (1–1.5), mettre la boucle en pause hors écran (IntersectionObserver) et quand `document.hidden`.
- **`prefers-reduced-motion`** : rendre une frame fixe (`jitter 0`, pas de tear/kick), comme le fait déjà `IntroLoader`.
- **Atlas + police** : si on change `fontFamily` de l'ASCII (ex. VCR), attendre `document.fonts.load(...)` avant `buildAtlas`, sinon l'atlas est dessiné avec la police de secours.
- **glb** : 1–4.5 MB chacun, lourd en mobile. Compression à envisager (gltf-transform, meshopt/draco) + chargement à la demande.
- **Tailwind v4** : les tokens vont dans `@theme` de `styles/globals.css` (le site y déclare déjà les couleurs orange et les polices).
- **VCR** : copier le ttf dans `public/assets/fonts/` et le charger via `next/font/local` (comme Monigue dans `app/(site)/layout.tsx`).

---

## 7. Concept de la refonte

D'après le premier croquis (2026-11-13, à affiner) :

- Header : logo CORE centré, menu burger à droite. Switch **Slider / List** sous le header.
- **Fond** : la wave de l'installation en très grand, rendue en ASCII comme sur l'écran fréquence, qui bouge toute seule.
- **Slider 3D en panorama** : une carte par genre, avec la vidéo de l'émission, posée sur l'intérieur d'un anneau (caméra au centre). La carte active fait presque la largeur du téléphone, les voisines dépassent sur les côtés. Boucle infinie.
- Un swipe fait tourner l'anneau ; la wave glisse légèrement dans le sens du swipe (`WaveLayer.nudge()`).
- Sous la carte, un cadran / vumètre en rappel du gameplay.
- Un tap sur une carte ouvre la page du genre (contenu Sanity).

### Décisions prises

- Noir et blanc, fond noir, pas de bleu.
- Fond = wave rendue en ASCII + champ ASCII (comme l'écran fréquence).
- Vanilla three, classes copiées dans `lib/core-fm/` (en tête de chaque fichier : `something.fm@<commit> <chemin>`), montées par un composant client. Pas de React Three Fiber.
- Carrousel : vue intérieure (panorama), boucle infinie, **geste codé à la main** (angle continu, index = modulo), pas d'Embla. Lien DOM sur la carte active pour l'accessibilité ; la vue List sert de solution de secours.
- Panneau tweakpane derrière `?debug`.
- **Sanity reste la source du contenu.**
- Vidéos : celles de `clip/` du repo source (`clip/bouyon/…` ; rap et techno à venir). À recompresser pour le mobile (le clip bouyon fait 80 MB).

### Encore ouvert

1. Carrousel en arc (cartes espacées de 25–35°, boucle par index) ou cercle complet avec cartes dupliquées ? Avec 4 genres, un vrai cercle met 90° entre les cartes et les voisines ne dépassent plus. Reco : arc.
2. Une wave plein écran derrière la carte, ou deux bandes (haut / bas) comme sur le croquis ?
3. Vumètre décoratif ou cadran de fréquence (règle qui défile au swipe, chaque genre sur sa fréquence de l'installation : rap 197.3, techno 92.4, bouyon 68.5, baile funk 245.5) ?
4. Transition carte → page détail : animée (le canvas doit vivre dans le layout) ou navigation simple ?
5. Composition WebGL : les vidéos ne doivent pas passer dans l'ASCII. Piste : un seul composer, `RenderPass(fond) → ASCII → RenderPass(cartes, sans clear)`.
6. Données genre : ajouter au schéma Sanity `genre` un `slug` (= id de `genres.json`) et la vidéo, ou une map statique côté code ?
7. Polices : garder Monigue, ou seulement VCR + Anonymous Pro ?

---

## 8. Avancement

### Étape 1 : fond noir + ASCII (2026-11-14)

- Deps : `three@0.171.0`, `postprocessing@6.39.1`, `tweakpane@4.0.5`, `@types/three@0.171.0`.
- `lib/core-fm/ascii/` : `AsciiPostFx.ts`, `charAtlas.ts` (copiés tels quels).
- `lib/core-fm/wave/` : `wave.ts`, `noise.ts` (copiés), `WaveLayer.ts` (adapté : `chaos` de base + `nudge()` à la place du réglage par potard).
- `lib/core-fm/BackgroundStage.ts` : renderer + composer (`RenderPass → ASCII → bloom/vignette`), resize via ResizeObserver, plafond de densité de pixels à 2, `cellSize` en px CSS × densité, pause quand l'onglet est caché, image fixe en `reduced-motion`, dispose idempotent avec `forceContextLoss`.
- `lib/core-fm/debugPane.ts` : wave, effets wave/swipe (boutons de swipe simulé), ASCII, bloom, vignette, bouton « Copy config (JSON) ».
- `components/AsciiBackground.tsx` : canvas fixe `100lvh` derrière le contenu, three chargé en import dynamique dans `useEffect`.
- Site : fond noir (`--page`), texte blanc (`--foreground`), intro en noir, logo inversé. Les autres composants n'ont pas été touchés.
- Réglage de départ différent de l'installation : `cellCss 5`.

### Étape 1b : accordeur fantôme (2026-11-14)

- `lib/core-fm/wave/GhostTuner.ts` : rejoue tout seul le gameplay fréquence, **en continu** (une première version par crans, comme le vrai potard, était trop saccadée en fond). Un ressort amorti ramène la fréquence virtuelle sur la cible. Raideur 0.9 à 1.4 rad/s et amortissement 0.45 à 0.9, retirés à chaque recherche : certaines approches dépassent la cible puis reviennent, d'autres arrivent en douceur. Calé quand la distance est sous la tolérance et la vitesse sous 0.4 unité/s. Reste calé 2 à 4 s, puis décroche (ressort critique vers ±20 à 40 unités, 1.8 s) et repart en recherche avec la vitesse acquise. La distance passe par `setDistance()` (courbe de l'installation : `reach 40`, `curve 0.5`, tolérance 0.5), la vitesse par `setMotion()`. Recherche simulée : 5.6 s en moyenne (3.4 à 9.6 s).
- `WaveLayer` : chaos lissé vers la distance (`smooth 2`, installation 6), `WAVE_FX.chaos` devient un plancher. L'agitation et le glissement viennent de la vitesse (`motionKick`, `motionScroll`) et des impulsions `nudge()`, à travers une montée (4/s) et une descente (2/s) progressives. Variation max de l'agitation : 0.027 par image (avant : +0.15 d'un coup à chaque cran). `converge` revient à 1 : une seule ligne quand c'est calé.
- Effets plus doux que l'installation : `tear` 0.08 (0.35), `farFreq` 1.6 (3.2), scintillement des glyphes [1.5, 4] à [3, 8] changements/s ([1.5, 9] à [3, 16]). `farAmp` 2.6 et `farThickness` 3 inchangés.
- `bgFloor` 0.1 → 0.015. La sortie passe du linéaire au sRGB, donc 0.04 donne déjà un gris à environ 22 % sur le noir.
- `reduced-motion` : l'accordeur démarre calé, image fixe.
- Panneau (étape 1b) : compteur FPS, section « Accordeur fantôme » (phase, graphes de la distance et de la vitesse, bouton « Décrocher maintenant », réglages du ressort), multiplicateurs « loin » et vitesses de montée et de descente dans « Wave FX ».

### Étape 2 : la home devient une expérience (2026-11-14)

Nouvelle direction : la home est une expérience sur un seul écran, sans scroll, la « fin du journal de bord » de la radio. Le carrousel 3D est en suspens. Le menu remplit le même rôle (aller vers les pages des genres). Sélectionner un genre ne recale **pas** la wave (idée écartée). L'accordeur fantôme reste en fond.

- Layout `(site)` : Header, IntroLoader et symbole de bas de page démontés (fichiers gardés pour l'instant). La police VCR est ajoutée (`font-vcr`, `public/assets/fonts/VCR_OSD_MONO.ttf`).
- `components/home/HomeExperience.tsx` : phase intro → menu, bouton « PASSER ▸ », `?nointro` pour aller directement au menu.
- `components/home/IntroSubtitles.tsx` : sous-titres tapés au centre, une ligne à la fois, fond noir par ligne (`box-decoration-clone`), curseur █ qui clignote. Animation calée sur une horloge (plus tard le `currentTime` de la voix). Les lecteurs d'écran reçoivent les lignes entières.
- `lib/experience/introScript.ts` : **texte provisoire** (FR, « tu », majuscules). Timing calculé depuis la longueur du texte (15 car./s, 1.2 s de maintien). Avec la voix enregistrée, `start`/`end` viendront de l'enregistrement (export WebVTT par exemple).
- `components/home/GenreMenu.tsx` : version minimaliste du menu TV1 (`GenreSelect`). Barre de titre inversée « CHOISIS UN GENRE », marqueur ▮ et ligne inversée sur le genre survolé, « année · lieu » en dessous. Déchiffrage à l'apparition, au survol ou au focus, et au clic (450 ms, puis navigation). Cmd/Ctrl+clic ouvre un nouvel onglet normalement.
- `lib/experience/scramble.ts` : déchiffrage de l'installation réécrit sans gsap (mêmes valeurs par défaut).
- Données du menu : stories Sanity (`/stories/<path>`). Sans `.env.local` : les 4 genres de l'installation, et leurs pages renvoient une 404.

À venir : la voix. Il faudra un écran de démarrage (le navigateur bloque le son sans geste de l'utilisateur), un bouton muet, et l'audio comme horloge des sous-titres.

### Étape 3 : logo 3D en chrome (2026-11-14)

- Modèle : `public/assets/models/core-logo.glb` (460 KB, courbe Blender extrudée, 10.8k sommets). Exporté **à plat** (plan XZ du glTF) et seulement 5 % d'épaisseur. Le matériau d'origine est un gris mat.
- `lib/core-fm/logo/LogoLayer.ts` : charge le glb, remplace le matériau par un chrome (`MeshStandardMaterial`, métal 1, rugosité 0.08), redresse le logo face caméra (`rotation.x = π/2`), le centre, le normalise et épaissit l'extrusion (×2.5). Centré, largeur 62 % de l'écran (plafonnée à 28 % de la hauteur), apparition en fondu sur 0.8 s. Modes : `tilt` (balancement lent en 8, ±24° / ±8°, par défaut, le logo reste lisible) ou `spin` (rotation continue). `reduced-motion` : pose de trois-quarts fixe.
- `lib/core-fm/logo/studioEnv.ts` : environnement de reflets généré dans le code, sans fichier HDRI. Bande de ciel claire, ligne d'horizon très brillante, sol gris, bandes verticales, contre-jour. Préfiltré par PMREM. Noir et blanc, cohérent avec la DA.
- Pipeline : `RenderPass(wave) → ASCII → RenderPass(logo, efface seulement la profondeur) → bloom/vignette`. Le chrome reste net par-dessus l'ASCII, et le bloom fait briller ses reflets. `LOGO_FX.ascii` fait passer le logo dans l'ASCII (option du panneau). Caméra passée à 35° (la wave ne dépend pas de la caméra).
- Sous-titres de l'intro déplacés à 66 % de la hauteur, sous le logo.
- Panneau : section « Logo » (visible, mode, passage en ASCII, taille, décalage, épaisseur, mouvement, chrome).

### Étape 3b : apparition du logo et menu agrandi (2026-11-14)

- Le logo n'existe qu'à la fin de l'intro (ou quand on la passe) : `HomeExperience` appelle `setLogoShown(true)` en phase menu, et `false` au démontage. Lien page → scène : `lib/core-fm/stageCues.ts`, un objet lu à chaque image, avec des écouteurs pour redessiner en `reduced-motion`.
- Apparition (`LogoLayer`, `LOGO_FX`, réglable) :
  1. 0 à 0.7 s : la silhouette blanche du logo apparaît dans la scène de la wave et devient des glyphes ASCII ;
  2. 0.45 à 1.35 s : le chrome se dessine par-dessus, de gauche à droite (plan de coupe, comme la modale TV1) ;
  3. 1.35 à 1.85 s : la silhouette s'efface.
  En parallèle, le logo part tourné de 0.9 rad et rejoint le balancement en 1.8 s, avec un léger grossissement (0.94 → 1). Disparition : fondu de 0.35 s. Deux copies partagent la géométrie : `chromeRoot` (par-dessus l'ASCII) et `asciiRoot` (dans la scène de la wave).
- Portrait : le logo est remonté (`yPortrait` 0.12) pour laisser la place au menu.
- Menu (`GenreMenu`) : toute la largeur en bas sur mobile, 30rem en bas à gauche sur ordi. Genres à `clamp(1.6rem, 8.5vw, 2.8rem)`, lignes d'au moins 44 px. Arrive 0.8 s après le début de l'apparition du logo.
- Panneau : « Rejouer l'apparition », réglages de l'apparition, décalage vertical en portrait.

### Étape 4 : header REC et menu hamburger (2026-11-14)

- `components/header/SiteHeader.tsx`, dans le layout `(site)` (présent sur toutes les pages, reste monté quand on navigue).
- `RecIndicator` : `● REC 00:00:05:24`. Point rouge `#ff2b2b` qui clignote par à-coups (1.2 s, `steps(1)`), timecode SMPTE à 25 images/s comme le `VHSFeed` de TV2, compté depuis l'arrivée sur le site (remis à zéro au rechargement). Le texte est écrit directement dans le DOM, sans rendu React à chaque image. Masqué aux lecteurs d'écran (décoratif).
- Hamburger : 3 barres qui se changent en ✕, zone de clic de 44 px, `aria-expanded`/`aria-controls`. Il ouvre `NavOverlay` : menu plein écran (fond noir à 90 %), même style que le menu des genres (barre « MENU », ligne inversée + ▮, déchiffrage à l'ouverture et au survol). Échap ou ✕ ferme le menu et rend le focus au bouton. Il se ferme aussi quand on change de page.
- Liens : `lib/experience/nav.ts`. **Provisoires** : ACCUEIL, LE PROJET (`/projet`) et CRÉDITS (`/credits`), ces deux pages n'existent pas encore.

### Étape 5 : loader, HOLD et forge du logo (2026-11-14)

Parcours de la home (`HomeExperience`) : `loading → hold → forged → intro → menu`. Il ne joue qu'une fois par visite : revenir sur la home mène directement au menu. Pour l'instant, les phases s'enchaînent en coupe franche (transitions animées à venir).

- **Réglages** : `lib/experience/config.ts` (`EXPERIENCE`). Chargement minimum 3 s (`minLoadingMs`), abandon à 20 s, hold 2.5 s, vidange 0.9 s si on relâche, chrome affiché 2.4 s puis fondu de 0.9 s, menu décalé de 0.8 s.
- **Loader** (`components/home/Loader.tsx`, en DOM) : barre « RÉCEPTION DU SIGNAL », 10 carrés (comme le loader de TV1), gros compteur `000%` en bas à gauche. Une seule courbe continue : une horloge qui ralentit progressivement sur `minLoadingMs` (`loaderCurve` 3 : 50 % ≈ 0.9 s, 80 % ≈ 1.5 s, puis les 20 derniers pour cent sur environ 1.5 s). Le vrai chargement ne peut freiner que la partie au-dessus de `realFrom` (80 %). L'affichage suit en douceur (`loaderFollow` 4/s), sans changement brusque de vitesse, et ne finit jamais avant `minLoadingMs`.
- **Progression réelle** (`lib/core-fm/loadProgress.ts`, sans three) : polices 10 %, code 3D 30 % (`AsciiBackground`), logo 40 % (octets du glb), scène 20 % (compilation des shaders + première image). En cas d'échec (pas de WebGL), tout est marqué terminé pour ne jamais bloquer.
- **HOLD** (`components/home/HoldButton.tsx`) : centré, sous le logo (68 % de la hauteur). Doigt, souris ou espace/entrée maintenue. Le remplissage est un découpage (comme la modale TV1), le bouton tremble de plus en plus, la progression redescend si on relâche. Clic droit et menu de l'appui long désactivés.
  - Bourdonnement (`lib/experience/hum.ts`) : Web Audio sans fichier. Onde en dents de scie dans un filtre passe-bas résonant, plus des parasites en bande passante. La hauteur (55 → 110 Hz), la brillance et le volume montent avec la progression, et un pic marque la fin. Le contexte audio, créé pendant le geste, sera réutilisé pour la voix (`audioContext()`).
  - Haptique (`lib/experience/haptics.ts`) : Vibration API sur Android, de plus en plus rapprochée (220 → 60 ms). Sur iPhone, astuce iOS 18+ (interrupteur caché qu'on bascule), non officielle et **à tester sur un vrai appareil**.
- **Forge** (`LogoLayer`, signal `forge` + progression du hold) : scène noire (`setStageDark`, la wave et le champ de glyphes s'effacent). La silhouette ASCII démarre à ×2.4, se resserre jusqu'à sa taille finale en tremblant et s'intensifie. Le scintillement des glyphes passe de chaotique à calme ([9, 1.5]), le halo monte (+2.2). À 100 % (`forged`), le chrome se dessine par balayage par-dessus avec un flash de halo, puis le logo se met à basculer. Il disparaît ensuite en fondu, l'intro démarre et la wave apparaît (`presenceRate`).
- **Fin de l'intro** : le logo revient avec l'apparition chronométrée de l'étape 3b.
- Panneau : section « forge (HOLD) » (taille de départ, tremblement, balancement, halo, flash).

### Étape 6 : transitions de l'ouverture et header en attente (2026-11-14)

Phases : `loading → hold → forged → dissolve → intro → menu` (`HomeExperience`, table `STAGE`). `dissolve` : le logo se fond dans l'ASCII pendant que le fond se forme, et l'intro démarre après `dissolveMs` (1.6 s).

- **Header en attente** (`stageCues.live`) : pendant le chargement, le hold et la forge, le REC est grisé, figé à `00:00:00:00`, point éteint, et le hamburger est invisible et inactif (`inert`). Tout passe en direct au `dissolve`, quand la wave apparaît : point rouge qui clignote, compteur qui part de zéro (puis continue sur les autres pages), hamburger en fondu. Au premier chargement de `/`, `dark` et `live` sont déjà initialisés au chargement du module, pour éviter qu'un REC actif s'affiche brièvement avant que la page ne prenne la main.
- **Dissolution** (signal `hidden`, `LOGO_FX.hide` 1.4 s) : le chrome s'efface (easeInOut) en rétrécissant à ×0.82, et sa silhouette ASCII remonte (sin, ×0.6) puis se fond dans le champ. En même temps, le champ de glyphes apparaît en scintillant (`formingJitter`) et la wave sort d'une ligne plate (amplitude × smoothstep de son fondu).
- **Retour à la fin de l'intro** (signal `shown`) : fondu (1 s) et grossissement de ×0.82 à 1, rotation de départ 0.4 rad, flash de halo, et reflet qui glisse : rotation de l'environnement (`envMapRotation.y`) de −1.4 rad à 0 en 1.6 s. Le reflet glissant s'applique aussi au chrome forgé.
- **Son** : le premier appui à la souris ou au clavier démarre le bourdonnement (l'annulation de l'appui empêchait le navigateur de le compter comme interaction). Au doigt, le navigateur n'accorde le droit au son qu'au **relâcher** : le premier hold tactile reste muet. `installAudioUnlock()` reprend le contexte audio au premier geste accepté, n'importe où, donc la voix de l'intro aura toujours le son.
- Panneau : « transitions (s) » (forgé, reflet, dissolution, retour) ; vitesse d'apparition du fond et scintillement de formation dans « forge (HOLD) ».

### Étape 7 : apparition du menu des genres (2026-11-14)

En environ 0.3 s, quand le menu apparaît (`GenreMenu`, classes CSS dans `globals.css`) :
- barre blanche du titre : balayage de gauche à droite (`wipe-x`, 0.22 s) ;
- texte du titre : glitch (`glitch-in`, 0.28 s, `steps(1)` : scintillement par à-coups, petits décalages, inclinaison, fantôme rouge `#ff0026` comme le glitch d'erreur de TV1) + déchiffrage accéléré, à 0.08 s ;
- cadre de la liste : ouverture de haut en bas (`wipe-y`, 0.25 s) ;
- genres : `glitch-in` + déchiffrage accéléré, en **cascade dans un ordre aléatoire** (tirage à chaque affichage), le premier à 0.06 s puis un toutes les 45 ms ;
- ligne année · lieu : `glitch-in` après la dernière ligne.
`reduced-motion` : aucune de ces animations.

### Tester sur téléphone (dev)

Next 16 bloque par défaut les ressources de dev (morceaux JS, rechargement à chaud) pour toute adresse autre que `localhost`. Ouvert depuis un téléphone via `http://<IP réseau>:3000`, le site reçoit le HTML mais React ne démarre jamais : le loader reste figé à 0 %. `next.config.ts` autorise donc les adresses IPv4 réseau de la machine (`allowedDevOrigins`, lues au démarrage). Après un changement de réseau, redémarrer `npm run dev`. N'a aucun effet en production.

### Étape 8 : home figée et vrais liens des genres (2026-11-14)

- **Scroll** : sur mobile, `min-h-screen` (100vh) est plus haut que l'écran visible (barre d'adresse), donc la page défilait un peu et le texte de l'intro bougeait avec. Corrections : layout en `min-h-dvh`, home en `fixed inset-0`, sous-titres en `fixed`, et tant que la home est affichée, `overflow: hidden` + `overscroll-behavior: none` sur `html`/`body` (pas de défilement, pas de rebond).
- **Liens des genres** (`buildMenu`, `lib/experience/genres.ts`) : le menu garde les 4 genres de l'installation dans leur ordre. Chacun est relié à sa story Sanity si le slug, le titre ou le nom du genre lié (`genreName`, ajouté à `allStoriesQuery`) correspond, sans tenir compte des accents, de la casse ni de la ponctuation. Année · lieu : valeurs Sanity d'abord, celles de l'installation sinon. Un genre sans story (bouyon pour l'instant) reste dans le menu, grisé, avec « BIENTÔT », non cliquable (bouton `aria-disabled`, déchiffré au survol). Les stories Sanity qui ne correspondent à aucun genre de l'installation sont ajoutées à la fin.
- Il faut un `.env.local` (`NEXT_PUBLIC_SANITY_PROJECT_ID`, …) pour lire Sanity. Sans lui, les 4 genres sont en « BIENTÔT ».

### Étape 9 : pages genre (2026-11-14)

Les pages `/stories/<slug>` passent à la DA de la refonte : noir et blanc, VCR pour les titres et le HUD, Anonymous Pro pour le texte courant, motifs de l'installation (barres de titre inversées, boîtes à bord blanc, séparateurs pointillés, ▮). Monigue n'y est plus utilisée.

- **Fond** : le champ de glyphes ASCII reste, la wave s'efface (`stageCues.genre`, mélange `page` dans `BackgroundStage`, `GENRE_FX.pageRate`). Le changement de page anime la transition : wave et logo se dissolvent pendant que le modèle apparaît.
- **Héros** (`components/genre/GenreHero.tsx`) : le modèle 3D du genre (l'étape égaliseur de TV1) tourne sur lui-même dans une zone du héros, rendu en ASCII par la scène fixe du layout. La scène relit la position de cette zone à chaque image, donc le modèle défile avec la page. Sous le titre : barre « FRÉQUENCE 197.3 », titre déchiffré, année · lieu, description, panneau ÉGALISEUR (AIGUS / MÉDIUMS / GRAVES, jauge + fenêtre de tolérance, statut RÉGLAGE / RÉGLÉ / DÉRÉGLÉ comme sur TV1).
- **Modèles** : `public/assets/models/genres/<id>.glb`, copies de `radio.glb` (rap), `ford.glb` (techno), `sound_system.glb` (bouyon), `paredao.glb` (baile funk). Données de l'installation (fréquence, réglages EQ, tolérance, modèle) dans `INSTALLATION_GENRES` (`lib/experience/genres.ts`), reliées à la story par `findInstallationGenre()`.
- **`lib/core-fm/genre/GenreModelLayer.ts`** : adapté de `ModelLayer` (mêmes lumières + RoomEnvironment, rotation 0.3 rad/s). Normalisé sur l'empreinte au sol et la hauteur, ajusté à la zone en tenant compte de l'inclinaison et de la perspective (le côté proche paraît plus gros), penché vers la caméra selon l'angle de vue. Apparition par la lumière (1.4 s) : un modèle éteint ne donne aucun glyphe. Modèles chargés gardés en mémoire (retour instantané). `paredao.glb` utilise `KHR_materials_pbrSpecularGlossiness`, que three r171 ne lit plus (bloc blanc saturé) : converti en matière standard (diffuse → couleur, brillance → 1 − rugosité).
- **`lib/core-fm/genre/GhostEq.ts`** : l'étape égaliseur rejouée par une main fantôme, sans three. Un potard à la fois, ressort amorti tiré à chaque fois, arrêt quelque part dans la tolérance, pause, puis « réglé » 2.5 à 4.5 s, puis 1 à 3 potards déréglés ensemble. Mapping de TV1 (`ModelControls`) : GRAVES → ondulation X + épaisseur de l'encre, MÉDIUMS → ondulation Y, AIGUS → lignes déchirées + flou. Chaque mouvement donne un à-coup à sa bande. Le héros fait tourner l'égaliseur (le panneau marche donc sans WebGL), la scène ne lit que la déformation.
- **Ton ASCII sur les pages genre** (`GENRE_FX`) : `detail` 0.8 (glyphes plus fins que sur la home, 0.565), `contrast` 1, poids et qualité pilotés par l'égaliseur. Écrit seulement sur une page genre (ou pendant la sortie), la home et le panneau gardent leurs valeurs.
- **Sections** : 01 TRANSMISSION (le texte de la story en sous-titres VCR sur fond noir, curseur █), 02 LE CONTEXTE (historique du genre), 03 FICHE SIGNAL (origine, naissance, fréquence, réglages EQ, notions clés), 04 ARCHIVES (images en niveaux de gris, lignes de balayage, étiquette « ▶ ARCH. 01 », lien source), 05 POUR ALLER PLUS LOIN (lignes inversées au survol), puis CHANGER DE FRÉQUENCE (les autres genres, comme le menu de la home) et FIN DE TRANSMISSION. Les titres de section se déchiffrent quand ils entrent à l'écran. Numérotation automatique selon les sections présentes.
- **Header** : un dégradé noir apparaît derrière REC et le burger dès que la page défile.
- `reduced-motion` : égaliseur réglé, pose fixe, la scène redessine au défilement.
- Panneau : section « Page genre » (dérégler, taille, rotation, inclinaison, lumière, ton ASCII, déformation, égaliseur fantôme).

À faire : compresser les glb (1.2 à 4.5 MB ; radio et sound system sont surtout des textures, inutiles à cette résolution ASCII ; le paredão fait 121k sommets). Pistes : gltf-transform (textures 512 px, meshopt).

### Étape 10 : HOLD plus bas, choix du son (2026-11-14)

- Bouton HOLD moins haut (`leading-none`, `py-3`) : 53 px sur mobile au lieu d'environ 72.
- Sous la consigne, deux boutons discrets « AVEC SON » / « SANS SON » (`aria-pressed`, ▮ sur le choix actif). Choix mémorisé sur l'appareil (`localStorage`, clé `corefm-sound`, **sans son par défaut** depuis l'étape 15) : `lib/experience/sound.ts`.
- Tout l'audio passe par une sortie commune (`audioOutput()` dans `lib/experience/hum.ts`), coupée en fondu de 50 ms quand le son est désactivé. La voix de l'intro devra s'y brancher aussi.
- Choisir « AVEC SON » est un geste : il débloque l'audio (`unlockAudio()`), donc le premier hold au doigt a déjà son bourdonnement (avant, il restait muet, voir étape 6).

### Étape 11 : texte de l'intro (2026-11-14)

- `lib/experience/introScript.ts` : le texte provisoire est remplacé par la narration définitive, au tutoiement comme le reste du site, découpée en 8 sous-titres aux pauses naturelles (réduite à 2 à l'étape 15) (39 à 76 caractères, 3 lignes au plus sur téléphone).
- Durée avec le timing automatique (15 car./s) : environ 41 s. Avec la voix enregistrée, les temps viendront de l'enregistrement.

### Étape 12 : performances mobile (2026-11-14)

Objectif : 60 images/s sur téléphone (95 % du trafic). Le coût était presque entièrement côté GPU, calculé par pixel d'écran (≈ 1,4 million de pixels sur un iPhone en densité 2) alors que l'ASCII n'affiche qu'un caractère par cellule (≈ 4 000 cellules).

- **ASCII en deux passes** (`AsciiPostFx`) : une passe par cellule (lecture de la scène, flou, ton, bruit, apparition, statique, scintillement → indices des deux caractères dans une petite texture, un texel par cellule), puis une passe plein écran qui ne fait que dessiner les caractères (2 lectures de l'atlas par pixel). Mêmes calculs, mêmes graines par cellule, rendu identique. Avant : 25 lectures de la scène par pixel. `colorMode: "scene"` n'est plus géré (le site est monochrome).
- **Scène en basse résolution** (`BackgroundStage`) : la wave et les modèles sont rendus dans un buffer de `STAGE_FX.sceneSamples` (3) pixels par cellule de base, plus à la résolution de l'écran (la wave calculait 8 bruits par pixel). Même format que les buffers du composer (8 bits, stockage sRGB).
- **Bloom à demi-résolution** (`LiteBloomEffect`, `STAGE_FX.bloomScale` 0.5) : le flou mipmap de postprocessing ignore `resolutionScale` et partait de la pleine résolution (≈ 4/5 du temps GPU restant). Un niveau de flou en moins pour garder la même portée. Écart mesuré sur une image figée : 2,3/255 en moyenne.
- **Passe du logo chromé** désactivée quand il n'est pas affiché.
- **Qualité adaptative** : sous 50 images/s pendant 2 s (après 3 s de démarrage), le bloom est coupé en premier (les caractères restent nets), puis la densité de pixels baisse d'un cran à chaque fois (2 → 1,5 → 1). Ça ne remonte jamais. Couper le bloom le retire de la passe (`setBloomEnabled`) : avec un simple mélange `SKIP`, son flou continuait d'être calculé à chaque image. Sans bloom, le chrome et la wave brillent moins, et le halo de la forge disparaît. `STAGE_FX.adaptiveBloom` pour désactiver cette étape. Si, une fois tout en bas, les images/s n'ont pas monté d'au moins 15 % (`adaptiveGain`), ce n'est pas le GPU qui limite : Safari plafonne lui-même à 30 images/s en mode économie d'énergie. La qualité maximale revient alors (environ 11 s après le démarrage) et la surveillance s'arrête. Panneau : ligne « qualité » dans « Performance ».
- **Page genre** : la position du héros n'est plus relue à chaque image (`getBoundingClientRect` forçait une mise en page complète, le panneau EQ modifiant le DOM à chaque image) ; mesurée sur `ResizeObserver`, déplacée par le scroll. Les jauges EQ bougent par `transform` (plus de mise en page).
- **Ford** : la transmission (verre) est désactivée au chargement, elle faisait re-rendre la scène une seconde fois par image.
- **Préchargement** : la home passe à la scène les modèles des genres qui ont une page (`setStagePreload`, `menuModels`). Ils se chargent pendant le loader (poids `genres` dans `loadProgress`), puis sont préchauffés : shaders compilés, géométrie et textures envoyées au GPU (`GenreModelLayer.warmUp`, une image en taille sub-pixel). Ouvrir une page genre ne provoque plus d'à-coup. Arrivé sur la home depuis une page genre : chargement en arrière-plan.
- **Mesures** (Chrome, GPU du Mac) : en 2560×1600 densité 2, home 23,5 → 66 images/s, page rap 46 → 83 ; à taille téléphone (build de production), 3,7 → 1,9 ms par image. Le JavaScript par image est négligeable (≈ 2 % du temps CPU).
- Panneau `?debug` : section « Performance » (densité actuelle, échantillons de scène, résolution du bloom, seuils adaptatifs). `window.__coreStage` en `?debug` pour profiler.
- Panneau, en haut : état de la boucle (`animée`, `en pause`, `figée (réduire les animations)`) et fps moyen en chiffres. Avec « Réduire les animations » activé sur le téléphone, la scène ne dessine que des images fixes, donc le graphe des fps reste à 0 : ce n'est pas une mesure de lenteur.

**Compression des modèles** (`npm run models`, `scripts/optimize-models.sh`) : sources dans `models-src/` (logo + `genres/<id>.glb`), sortie dans `public/assets/models/`. spec/gloss → metal/rough, puis `gltf-transform optimize` : géométrie meshopt (décodeur branché dans `lib/core-fm/gltfLoader.ts`), textures WebP ≤ 512 px, maillages fusionnés. Pour remplacer un modèle (techno, funk) : déposer le nouveau fichier dans `models-src/` sous le même nom et relancer.

### Étape 13 : page genre éditoriale (2026-11-14)

Direction : le site est un site souvenir pour **aller plus loin** (sources, recherches, textes plus longs), il ne rejoue pas l'installation. CORE.FM est devenue une installation sonore : on vient écouter une émission. La créativité passe par la mise en page et le rythme du scroll. Le héros (modèle ASCII + égaliseur fantôme) ne change pas.

Ordre de la page : héros → 01 LE CONTEXTE → 02 NOTIONS CLÉS → 03 POUR ALLER PLUS LOIN → CHANGER DE FRÉQUENCE. Retirées : FICHE SIGNAL (fréquence et réglages EQ, déjà dans le héros), ARCHIVES (déplacées dans le contexte) et TRANSMISSION (le texte de l'énigme V1 n'existe plus ; le champ `content` de la story est marqué obsolète dans Sanity et n'est plus lu).

- **Grille** : 4 colonnes sur téléphone (gouttière 12 px), 12 sur ordinateur. Les blocs alternent leur colonne de départ, la colonne 1 sert de marge (numéros, étiquettes).
- **01 Contexte** (`components/genre/ContextSection.tsx`) : section épinglée (cadre `sticky` dans un conteneur haut, `calc(100svh + N svh)`). Le texte (description + histoire du genre), **centré dans la hauteur**, s'écrit **au rythme du scroll** et s'efface en remontant ; le curseur est le caractère suivant en inversé (même largeur, pas de reflow) ; lignes sur fond noir comme les sous-titres de l'intro. Puis les archives se **posent** une à une par-dessus, comme des tirages : bord blanc, légende dans la marge, ombre dure de la fenêtre d'erreur TV1, légère inclinaison ; le texte passe à 45 %. Budget de scroll (`BUDGET`) : 0,25 svh par caractère (60 à 200), 45 svh par archive, 35 svh de pause finale. Les tirages forment **une pile sur le texte** : chacun est centré sur le bloc de texte (à 62 % de sa largeur sur ordinateur), puis décalé et incliné (`POSES` : décalage en % de sa propre taille), et recouvre une bonne partie du précédent ; le dernier posé est au-dessus. Texte complet pour les lecteurs d'écran. `reduced-motion` : pas d'épinglage, texte affiché, tirages dans le flux. Repère : un chapô de 600 caractères max tient sur un écran de téléphone.
- **Archives image ou vidéo** : le champ `archiveImages` de la story accepte maintenant une vidéo (extrait court, sans son, en boucle ; image facultative = affiche). Nom du champ inchangé (données existantes valides). Les vidéos ne jouent que posées et à l'écran. Les images et extraits utilisés dans les clips vont ici.
- **02 Notions clés** (`NotionsSheet.tsx`) : une feuille noire opaque qui glisse par-dessus la composition du contexte (`StickyUnder.tsx` : la section précédente reste en place une fois son bas atteint). Au moins un écran de haut pour la couvrir ; la fin vide est réglée de lignes discrètes, comme une fiche. Lignes : ORIGINE, NAISSANCE, puis les notions Sanity ; « A - B - C » devient un nom par ligne.
- **Renvois vers les sources** : dans Sanity, l'histoire du genre a une annotation « Source » (`sourceRef` : URL, titre facultatif). Sélectionner le passage → Source → coller l'URL. Sur le site, un petit numéro inversé en exposant suit le passage cité ; il apparaît quand l'écriture le dépasse (caché et non focalisable avant). Il prend le numéro de la ressource de la story qui a la même URL (sans protocole, `www` ni `/` final) ; une URL absente des ressources est ajoutée à la liste (groupe LIENS, titre = titre de l'annotation ou domaine). Un tap mène à la ligne de la source (`#source-04`), qui clignote en inversé.
- **03 Pour aller plus loin** : index numéroté groupé par type (VIDÉOS, ARTICLES, LIVRES…), numéro dans la marge ; puis CRÉDITS DES ARCHIVES (légende + source).

Structure retenue. À venir : entre NOTIONS CLÉS et POUR ALLER PLUS LOIN, une section ÉMISSION (la vidéo du genre et son script), quand elles seront prêtes.

Dev : après une écriture ratée (disque plein), le serveur de dev a plusieurs fois gardé une ancienne version de `globals.css`. Si un style ne s'applique pas, modifier le fichier à nouveau ou relancer `npm run dev`.

### Étape 14 : page projet (2026-11-14)

Route `/projet` (`app/(site)/projet/page.tsx`), liée depuis le menu burger. Première version, **texte à relire par l'équipe** : tout le contenu est dans `lib/experience/project.ts` (comme le script de l'intro), à passer dans Sanity une fois validé. (Nouveau texte, contenu dans Sanity et grille revue : étape 17.)

Ordre : héros → 01 POURQUOI → 02 LE CONSTAT → 03 SE RAPPELER → 04 L'INSTALLATION → 05 PROCHAINE DIFFUSION → CHOISIS UN GENRE → fin.

- **Héros** (`components/project/ProjectHero.tsx`) : la vague de la scène en haut, « INSTALLATION SONORE INTERACTIVE », titre CORE.FM déchiffré, chapô, puis la prochaine diffusion (dates · ville). La vague appartient au héros : quand moins de 40 % du héros est à l'écran, la page envoie à la scène un repère genre sans modèle (`QUIET`), donc la vague s'efface comme sur une page genre ; elle revient en remontant.
- **Chapitres** (`CHAPTERS`) : barre de titre, phrase-clé en grand déchiffrée à l'arrivée à l'écran (`components/project/Statement.tsx`, VCR monospace donc pas de reflow), puis le texte sur la grille (colonnes alternées).
- **02 Le constat** : encart `SignalMixup` façon panneau HUD, « IDENTIFICATION DU GENRE » : SHATTA se déchiffre puis est barré (✕ NON), puis BOUYON se déchiffre (▮ OUI), avec sa fréquence, son lieu et son année tirés de l'installation. Joue une fois ; sans JS ou en `reduced-motion`, état final.
- **03 Se rappeler** : le manifeste, même mécanique que le contexte des pages genre (`ContextSection`, variante `statement` : VCR en grand), épinglé et tapé au scroll.
- **04 L'installation** : le cartel de l'œuvre, sur la feuille qui glisse par-dessus le manifeste (`NotionsSheet` avec `label` et `intro`). Étiquette « TITRE » et non « ŒUVRE » : la police VCR n'a pas le glyphe Œ.
- **05 Prochaine diffusion** : Recto VRso, Le Quarante, Laval, du 19 au 22 novembre 2026. Le titre et la phrase suivent la date (heure de Paris) : PROCHAINE DIFFUSION / EN DIRECT / DIFFUSÉ, « sera exposée / est exposée en ce moment / a été exposée ». Horaires (10 h – 17 h) et entrée libre : fiche Laval Tourisme, à vérifier sur le programme du festival.
- **Images** : chaque chapitre (`images`) et le manifeste (`REMEMBER.images`) acceptent des photos, posées comme les tirages d'archives (pile sur le manifeste, tirages inclinés sous les chapitres). Aucune pour l'instant : les photos de l'exposition viendront après le festival.
- `components/genre/FrequencyList.tsx` : la liste des genres en fréquences, extraite de la page genre (CHANGER DE FRÉQUENCE) et réutilisée ici (CHOISIS UN GENRE).

### Étape 15 : intro courte, sans son par défaut (2026-11-14)

- **Intro** (`INTRO_LINES`) : seulement les 2 premiers sous-titres, « Bienvenue dans les archives de CORE.FM, / la radio qui te fait redécouvrir l'histoire des musiques noires populaires. » (environ 9 s). Le reste (les genres, leurs origines oubliées, le but de l'installation) est raconté sur la page projet.
- **Son coupé par défaut** (`SOUND_DEFAULT` dans `lib/experience/sound.ts`) : sur l'écran HOLD, « SANS SON » est sélectionné ; c'est au visiteur de cliquer « AVEC SON ». Le navigateur ne joue rien avant un geste de toute façon, et ce clic débloque l'audio. Un choix déjà enregistré sur l'appareil (« on » ou « off ») est respecté.

### Étape 16 : page crédits, menu (2026-11-14)

- **Menu burger** (`lib/experience/nav.ts`) : plus de lien ACCUEIL, seulement LE PROJET et CRÉDITS. Chaque page a son propre « ◂ HOME ».
- **Page crédits** (`app/(site)/credits/page.tsx`) : exactement un écran (`h-dvh`, rien ne défile), comme un générique d'émission. Barre « CRÉDITS », « ◂ HOME », les 4 personnes, puis « CORE.FM · CONÇUE AUX GOBELINS, L'ÉCOLE DE L'IMAGE · 2026 ». Téléphone : une ligne par personne, rôles à la suite (séparés par ·). Paysage (ordinateur, téléphone couché) : 4 colonnes, un rôle par ligne. Les tailles suivent la hauteur autant que la largeur (`min(vw, svh)`), testé de 375×667 à 1440×900 et en 844×390.
- **Contenu** (`lib/experience/credits.ts`) : noms et liens tirés de la page CORE.FM du portfolio de Nehémia, rôles tels que l'équipe les a décrits. Ordre : project lead, puis l'ordre du portfolio. Dana n'a pas de lien sur le portfolio : aucun bouton tant qu'il n'y en a pas. Pour ajouter un réseau : une entrée `{ label, url }` dans `links`.

### Étape 17 : page projet dans Sanity, grille harmonisée (2026-11-15)

Nouveau texte de l'équipe. Ordre : héros → 01 D'OÙ L'ON VIENT → 02 POUR NE PAS OUBLIER → 03 RETROUVER LE SIGNAL (l'installation et son cartel, sur la feuille qui glisse par-dessus le chapitre 02) → 04 PROCHAINE DIFFUSION → CHOISIS UN GENRE → fin. Retirés avec l'ancien texte : l'encart SHATTA / BOUYON (`SignalMixup`) et le manifeste épinglé SE RAPPELER (variante `statement` de `ContextSection`).

- **Sanity** : document unique « Page projet » (`sanity/schemas/projectPage.ts`, id fixe `projectPage`), en tête de la liste du Studio, sans création, duplication ni suppression. Onglets : Haut de page (surtitre, titre, accroche), Chapitres (titre de section, phrase clé, texte en paragraphes simples, photos facultatives), L'installation (idem + fiche libellé / valeur, « · » pour une valeur par ligne), Diffusion (dates, lieu, ville, festival, site, horaires, entrée, et la phrase sous les dates en trois versions : avant / pendant / après). Les numéros de section sont calculés. Le titre de la section diffusion suit la date (PROCHAINE DIFFUSION / EN DIRECT / DIFFUSÉ), dans le code.
- **Lecture** (`sanity/lib/projectPage.ts`) : le document **publié** seulement (les brouillons ne s'affichent pas), revalidé toutes les 60 s. Sans config Sanity, sans document ou si Sanity ne répond pas : le même contenu, en local (`DEFAULT_PROJECT` dans `lib/experience/project.ts`), qui a aussi servi à créer le document.
- **Grille** (`components/grid.ts`) : sur ordinateur, deux alignements seulement : colonne 1 (barres de titre, phrases clés, dates, libellés) et colonne 4 (paragraphes, valeurs, phrase, lien), libellés sur les colonnes 1 à 3 comme les listes de la page genre. Paragraphes limités à 62 caractères de large. Téléphone inchangé (paragraphes alternés pleine largeur / décalés d'une colonne). La feuille des pages genre (NOTIONS CLÉS) garde ses valeurs en décalé sur ordinateur (`align="stagger"`, par défaut) ; la page projet passe `align="column"`.

Dev : le 14 au soir, le disque plein a corrompu le cache de Turbopack (`.next/dev/cache`). Ensuite le serveur de dev renvoyait en boucle des mises à jour HMR (≈ 220/s, sans aucun fichier modifié), sa mémoire montait à 3,5 Go en quelques minutes et Next le redémarrait (`server-restart-close-to-memory-threshold` dans `.next/dev/trace`) : pages à 3 à 70 s. Remède : arrêter le serveur, `rm -rf .next/dev`, relancer. Si ça revient : `npm run dev -- --no-server-fast-refresh`, et garder de la place sur le disque. Studio intégré (`/studio`) : l'erreur « Switched to client rendering… `useMemoCache` » venait de `serverExternalPackages` dans `next.config.ts`, qui chargeait `sanity` avec le `require` de Node, donc avec une autre copie de React que celle de Next. Seul `@sanity/client` reste externe ; le Studio se rend sans erreur.

### Étape 18 : son — voix de l'intro, frappe, glitchs (2026-11-15)

- **Cœur audio** (`lib/experience/audio.ts`, sorti de `hum.ts`) : le contexte audio, la sortie commune (coupée quand le son est désactivé), le déblocage au premier geste (installé par le header, donc sur **toutes les pages**), et le chargement des fichiers. Les fichiers sont décodés hors du contexte (`OfflineAudioContext`) : ils se chargent pendant le loader, avant tout clic, sans avertissement du navigateur. Un fichier absent ou illisible reste muet (un avertissement en console), le reste continue.
- **Voix** (`public/assets/audio/vo/VO.m4a`, 6 s, mono) : jouée pendant la phase `intro`, 0.4 s après le début (`INTRO_VOICE.lead`), gain ×1.3 (l'enregistrement plafonne à −8 dBFS). Préchargée derrière le loader.
  - Les sous-titres (`INTRO_CUES`, `lib/experience/introScript.ts`) sont calés sur l'enveloppe de l'enregistrement : ligne 1 tapée de 0.16 à 2.05 s (voix 0.20 → 2.14), ligne 2 de 2.58 à 5.6 s (voix 2.62 → 5.70), puis 1.6 s pour lire. **Nouvel enregistrement = remesurer ces temps.** Intro ≈ 7.6 s.
  - Pendant que la voix joue, c'est **son horloge** qui tape les lignes (temps du contexte audio moins la latence de sortie), pas `performance.now`. Sans voix (son coupé, audio pas encore débloqué, fichier pas chargé) : même minutage sur une horloge simple.
  - Son activé en pleine intro (bouton du header) : la voix démarre là où en sont les sous-titres, comme une radio qu'on allume en cours d'émission. PASSER : fondu de 50 ms.
- **Frappe** (`lib/experience/sfx.ts`) : le `typing.mp3` de l'installation (boucle de 46 clics, ~15.5/s), réencodé `sfx/typing.m4a`. Les clics sont repérés dans le fichier au chargement (suiveur d'enveloppe), donc on peut en jouer un seul, au hasard, avec ±5 % de vitesse.
  - `typeKey()` : un clic par caractère tapé. Sous-titres de l'intro (plus bas sous la voix, `keyUnderVoice`), texte du contexte des pages genre tapé au scroll (en remontant aussi). Au plus un clic toutes les 45 ms.
  - `typingRun(s)` : chaque déchiffrage (`scrambleText`) tape pendant sa durée, comme sur l'installation (titres, menus, survols, titres de section). Les déchiffrages simultanés partagent un seul flux de clics ; annuler le déchiffrage arrête la frappe. Plafond 2.5 s.
- **Glitchs** (`glitch`) : rafales hachées, paliers forts / coupés de 25 à 50 ms, comme le scintillement `steps(1)` du CSS. Deux couches dans la même porte :
  - un **grésillement synthétisé** (bruit « écrasé » façon bitcrusher : valeurs tenues 2 à 9 échantillons, graves coupés sous 600 Hz, normalisé à −12 dBFS RMS), passage et vitesse au hasard. C'est la partie qu'on entend ;
  - dessous, le `glitch.mp3` de l'installation (parasites « pas de signal », 2.5 s extraites, `sfx/static.m4a`), en couche grave (`glitchBody`).
  - Pourquoi : ce fichier est un grondement, presque tout sous 300 Hz (−17 dBFS vers 100 Hz, −44 dBFS vers 3 kHz). La première version le filtrait en bande 0.9–3.5 kHz : le glitch sortait vers −50 dBFS, le léger vers −70, **inaudibles**. Et un téléphone ou un portable ne rend pas ces graves. Il reste utile au casque.
  - Joués à : l'arrivée du menu des genres (une rafale pour toute la cascade), l'apparition d'un modèle de genre (rafale de 1.1 s qui s'éteint avec la déchirure ASCII ; `GenreModelLayer.onAppear`, branché dans `AsciiBackground`).
  - **Glitch léger** (`softGlitch`, `SFX.glitchSoft`) : grésillement seul, accéléré (plus fin), sans couche grave, pour les petits moments : la sortie du menu burger (0.3 s), PASSER (0.18 s, le coupé de la voix devient un zapping), et la formation du champ de glyphes sur la home (`dissolve`, 1.2 s qui s'éteint, quand le logo se fond dans l'ASCII).
  - Le grésillement est aussi adouci : aigus coupés au-dessus de 3.5 kHz, paliers forts moins forts (0.5 à 0.85 au lieu de 0.65 à 1).
- **Volume des effets** (2026-11-16, tout était beaucoup trop fort, surtout les glitchs) : tous les effets (bourdonnement du HOLD, frappe, glitchs, tirages) passent par une sortie commune, `SFX.master` (0.6), en plus de leurs niveaux propres. La voix n'y passe pas (`INTRO_VOICE.gain`). Niveaux mesurés sur le fil audio, à la sortie du site (Chromium, AudioWorklet, maximum par bloc de 128 échantillons), avant → après :
  - glitch −24/−26 → **−36/−39 dBFS** ; glitch léger −32/−34 → **−44/−46** ; glitch modèle −24/−27 → **−36/−38** puis décroît ;
  - photo posée −27/−29 → **−39/−43** ;
  - frappe −27/−31 → **−34/−36** ; déchiffrage −30/−31 → **−36/−38** ;
  - bourdonnement du HOLD : −4.4 dB (`master` seul) ; voix inchangée, ≈ −15 à −25 (d'après le fichier).
  - Une mesure faite sur le fil principal (AnalyserNode ou ScriptProcessor) rate des morceaux : la page est occupée par le WebGL.
- **Tirages d'archives** (`printDown`, `ContextSection`) : un seul petit toucher de papier, bref et étouffé (bruit filtré 350 Hz à ~2.2 kHz, ~30 ms), au contact : 0.15 s après le déclenchement (`SFX.printFall`), car la pose CSS dure 0.5 s mais a fait 80 % du chemin à 0.14 s. Un seul son par image même si un scroll rapide en pose plusieurs, aucun au premier calcul (page ouverte au milieu de la section). Soulever un tirage (en remontant) : aucun son. La première version (souffle pendant la chute + claquement + petit « boum » grave, et un souffle en remontant) était trop forte et faisait cartoon : abandonnée le 2026-11-16.
- **Frappe, correctif** : chaque clic est copié dans son propre petit buffer et joué en entier. Avant, on jouait un extrait de la boucle (départ + durée) : sa fin est une heure fixe de l'horloge audio, donc un clic parti quelques ms en retard (fil audio en avance sur `currentTime`) était tronqué, parfois sauté.
- **Bouton son dans le header** (`components/header/SoundToggle.tsx`) : à gauche du burger, un petit vumètre de 4 barres. Même choix que l'écran HOLD (même clé `localStorage`), caché avec le burger pendant l'ouverture. `aria-pressed`, nommé « Son ». Trois états :
  - son actif et autorisé : les barres sautent par paliers ;
  - son choisi mais **le navigateur attend un clic ou un toucher** (page ouverte ou rechargée, puis seulement scrollée : le scroll ne compte jamais comme geste) : barres immobiles qui clignotent, « Touche pour lancer le son ». Appuyer lance le son (sans le couper) ; n'importe quel clic ou toucher sur la page aussi ;
  - son coupé : barres à plat.
- **Déblocage permanent** (`installAudioUnlock`) : les écouteurs restent actifs toute la visite. Safari peut suspendre à nouveau le contexte (sortie audio changée, onglet en arrière-plan) : le geste suivant le relance, et le retour sur l'onglet essaie aussi.
- Rien ne se charge tant que le son est coupé (sauf la voix, sur la home, pour pouvoir l'activer au HOLD). Rien ne joue avant le premier geste, rien n'est mis en file d'attente. `reduced-motion` : pas de frappe ni de glitch (pas d'animation), la voix joue.
- Panneau (`?debug`) : section « Son » (effets (tous), voix, trois niveaux de frappe, frappes/s, glitch, glitch (grave), glitch léger, glitch modèle, photo posée, instant du contact) et boutons pour tester chaque son. Niveaux posés sans écoute sur de vrais haut-parleurs : **à régler à l'oreille**, puis « Copy config » (clés `sfx` et `voice`).
- iPhone : le Web Audio respecte le bouton silencieux. Téléphone en mode silencieux = aucun son, même avec « AVEC SON ».
