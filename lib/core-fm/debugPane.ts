// Debug panel (?debug). Adapted from something.fm@7129c50
// client/lib/ascii/AsciiPane.ts + the TV1 wave pane (client/tv1/main.ts).
import { BlendFunction } from "postprocessing";
import { Pane } from "tweakpane";
import { STAGE_FX, type BackgroundStage } from "./BackgroundStage";
import { GENRE_FX } from "./genre/GenreModelLayer";
import { EQ_FX, type GhostEq } from "./genre/GhostEq";
import { LOGO_FX } from "./logo/LogoLayer";
import { setLogoCue, stageCues } from "./stageCues";
import { TUNER_FX } from "./wave/GhostTuner";
import { DEFAULT_WAVE_PARAMS, WAVE_FX, type WaveParams } from "./wave/WaveLayer";
import { INTRO_VOICE } from "@/lib/experience/introScript";
import {
  appearGlitch,
  glitch,
  printDown,
  SFX,
  softGlitch,
  typeKey,
  typingRun,
} from "@/lib/experience/sfx";

type Range = { min: number; max: number; step: number };
type ChangeEvent<T = unknown> = { value: T };

const WAVE_SLIDERS: [keyof WaveParams, Range][] = [
  ["layers", { min: 1, max: 12, step: 1 }],
  ["freq", { min: 0.5, max: 8, step: 0.1 }],
  ["freqVar", { min: 0, max: 1, step: 0.01 }],
  ["amp", { min: 0, max: 0.6, step: 0.005 }],
  ["ampVar", { min: 0, max: 1, step: 0.01 }],
  ["speed", { min: 0, max: 3, step: 0.05 }],
  ["speedVar", { min: 0, max: 2, step: 0.01 }],
  ["transSpeed", { min: 0, max: 3, step: 0.05 }],
  ["ampSpeed", { min: 0, max: 3, step: 0.05 }],
  ["ampMod", { min: 0, max: 1, step: 0.01 }],
  ["phaseSpread", { min: 0, max: 6.28, step: 0.05 }],
  ["thickness", { min: 0.001, max: 0.03, step: 0.0005 }],
  ["glow", { min: 0.5, max: 3, step: 0.05 }],
  ["zoom", { min: 0.3, max: 3, step: 0.05 }],
];

const hex = (c: unknown) =>
  typeof c === "number" ? `#${c.toString(16).padStart(6, "0")}` : String(c);

export function mountDebugPane(stage: BackgroundStage): { dispose(): void } {
  const { ascii, bloom, vignette, wave } = stage;
  const cfg = ascii.getConfig();

  // tweakpane's bundled types don't surface addFolder/addBinding (same as the
  // installation), so it's driven untyped.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pane: any = new Pane({
    title: "CORE.FM — background",
    expanded: window.innerWidth >= 640,
  });
  const el = pane.element as HTMLElement;
  Object.assign(el.parentElement!.style, {
    zIndex: "2147483646",
    maxHeight: "calc(100dvh - 16px)",
    overflowY: "auto",
  });

  // Reduced motion: no loop, so the fps graph sits at 0 — say so.
  pane.addBinding(stage.stats, "loop", { label: "boucle", readonly: true, interval: 500 });
  pane.addBinding(stage.stats, "fps", {
    label: "fps (moy.)",
    readonly: true,
    format: (v: number) => v.toFixed(0),
    interval: 500,
  });
  pane.addBinding(stage.stats, "fps", {
    readonly: true,
    view: "graph",
    min: 0,
    max: 120,
    interval: 200,
  });

  // --- Performance ---
  const fPerf = pane.addFolder({ title: "Performance", expanded: false });
  fPerf.addBinding(stage.stats, "pixelRatio", { label: "densité actuelle", readonly: true, interval: 500 });
  fPerf
    .addBinding(STAGE_FX, "sceneSamples", { label: "scène (px/cellule)", min: 1, max: 8, step: 1 })
    .on("change", (e: ChangeEvent<number>) => stage.setSceneSamples(e.value));
  fPerf
    .addBinding(STAGE_FX, "bloomScale", { label: "bloom (résolution)", min: 0.125, max: 1, step: 0.125 })
    .on("change", (e: ChangeEvent<number>) => stage.setBloomScale(e.value));
  fPerf.addBinding(stage.stats, "adaptive", { label: "qualité", readonly: true, interval: 500 });
  fPerf.addBinding(stage.stats, "bloom", { label: "bloom", readonly: true, interval: 500 });
  fPerf.addBinding(STAGE_FX, "adaptiveMinFps", { label: "adaptatif: fps min", min: 0, max: 60, step: 1 });
  fPerf.addBinding(STAGE_FX, "adaptiveBloom", { label: "adaptatif: couper le bloom d'abord" });
  fPerf.addBinding(STAGE_FX, "minPixelRatio", { label: "adaptatif: densité min", min: 0.5, max: 2, step: 0.25 });

  // --- Logo (chrome) ---
  // LOGO_FX is read every frame, so plain bindings apply live.
  const l = LOGO_FX;
  const fLogo = pane.addFolder({ title: "Logo", expanded: true });
  fLogo.addButton({ title: "Rejouer l'apparition" }).on("click", () => {
    setLogoCue("shown");
    stage.logo.replay();
  });
  fLogo.addBinding(l, "visible");
  fLogo.addBinding(l, "mode", { options: { "bascule (tilt)": "tilt", "rotation (spin)": "spin" } });
  fLogo.addBinding(l, "ascii", { label: "silhouette ASCII seule" });
  fLogo.addBinding(l, "size", { label: "largeur (% écran)", min: 0.1, max: 1, step: 0.01 });
  fLogo.addBinding(l, "maxHeight", { label: "hauteur max", min: 0.05, max: 0.8, step: 0.01 });
  fLogo.addBinding(l, "y", { label: "décalage vert. (paysage)", min: -0.4, max: 0.4, step: 0.01 });
  fLogo.addBinding(l, "yPortrait", { label: "décalage vert. (portrait)", min: -0.4, max: 0.4, step: 0.01 });
  fLogo.addBinding(l, "depth", { label: "épaisseur ×", min: 0.5, max: 8, step: 0.1 });
  const fMotion = fLogo.addFolder({ title: "mouvement", expanded: false });
  fMotion.addBinding(l, "tiltY", { label: "bascule Y (rad)", min: 0, max: 1.2, step: 0.01 });
  fMotion.addBinding(l, "tiltX", { label: "bascule X (rad)", min: 0, max: 0.8, step: 0.01 });
  fMotion.addBinding(l, "tiltSpeed", { label: "vitesse bascule", min: 0, max: 2, step: 0.01 });
  fMotion.addBinding(l, "spinSpeed", { label: "vitesse rotation", min: 0, max: 4, step: 0.05 });
  const fChrome = fLogo.addFolder({ title: "chrome", expanded: false });
  fChrome.addBinding(l, "color");
  fChrome.addBinding(l, "metalness", { min: 0, max: 1, step: 0.01 });
  fChrome.addBinding(l, "roughness", { min: 0, max: 1, step: 0.005 });
  fChrome.addBinding(l, "envIntensity", { label: "reflets", min: 0, max: 4, step: 0.05 });
  const fReveal = fLogo.addFolder({ title: "transitions (s)", expanded: false });
  fReveal.addBinding(l, "ghostLevel", { label: "intensité silhouette", min: 0, max: 1, step: 0.01 });
  fReveal.addBinding(l, "sweep", { label: "forgé: balayage", min: 0.05, max: 3, step: 0.05 });
  fReveal.addBinding(l, "ghostOut", { label: "forgé: fin silhouette", min: 0, max: 3, step: 0.05 });
  fReveal.addBinding(l, "lightFrom", { label: "reflet: départ (rad)", min: -3.14, max: 3.14, step: 0.01 });
  fReveal.addBinding(l, "lightSweep", { label: "reflet: durée", min: 0.1, max: 4, step: 0.05 });
  fReveal.addBinding(l, "hide", { label: "dissolution: durée", min: 0.05, max: 4, step: 0.05 });
  fReveal.addBinding(l, "outScale", { label: "dissolution: taille ×", min: 0.3, max: 1.2, step: 0.01 });
  fReveal.addBinding(l, "outGhost", { label: "dissolution: silhouette", min: 0, max: 1, step: 0.01 });
  fReveal.addBinding(l, "showIn", { label: "retour: fondu", min: 0.05, max: 4, step: 0.05 });
  fReveal.addBinding(l, "showScale", { label: "retour: taille départ ×", min: 0.3, max: 1.5, step: 0.01 });
  fReveal.addBinding(l, "turn", { label: "retour: rotation départ", min: 0, max: 3.14, step: 0.01 });
  fReveal.addBinding(l, "settle", { label: "retour: durée", min: 0.1, max: 5, step: 0.05 });
  const fForge = fLogo.addFolder({ title: "forge (HOLD)", expanded: false });
  fForge.addBinding(l, "forgeScale", { label: "taille de départ ×", min: 1, max: 5, step: 0.05 });
  fForge.addBinding(l, "forgeShake", { label: "tremblement", min: 0, max: 0.06, step: 0.001 });
  fForge.addBinding(l, "forgeSway", { label: "balancement ×", min: 0, max: 1, step: 0.01 });
  fForge.addBinding(STAGE_FX, "forgeGlow", { label: "halo max", min: 0, max: 6, step: 0.05 });
  fForge.addBinding(STAGE_FX, "flashGlow", { label: "flash chrome", min: 0, max: 10, step: 0.1 });
  fForge.addBinding(l, "flash", { label: "durée flash (s)", min: 0.05, max: 2, step: 0.05 });
  fForge.addBinding(STAGE_FX, "presenceRate", { label: "fond: vitesse apparition", min: 0.1, max: 6, step: 0.05 });
  fForge.addBinding(STAGE_FX, "formingJitter", { label: "fond: scintillement formation", min: 0, max: 15, step: 0.5 });

  // --- Genre page (model + ghost equalizer) ---
  const gf = GENRE_FX;
  const fGenre = pane.addFolder({ title: "Page genre", expanded: Boolean(stageCues.genre) });
  fGenre.addButton({ title: "Dérégler l'égaliseur" }).on("click", () => {
    (stageCues.genre?.eq as Partial<GhostEq> | undefined)?.detuneNow?.();
  });
  fGenre.addBinding(gf, "size", { label: "taille (% du cadre)", min: 0.2, max: 1.5, step: 0.01 });
  fGenre.addBinding(gf, "spin", { label: "rotation (rad/s)", min: 0, max: 2, step: 0.01 });
  fGenre.addBinding(gf, "tilt", { label: "inclinaison (rad)", min: -0.6, max: 0.8, step: 0.01 });
  fGenre.addBinding(gf, "facing", { label: "face caméra", min: 0, max: 1, step: 0.05 });
  fGenre.addBinding(gf, "light", { label: "lumière ×", min: 0, max: 3, step: 0.05 });
  fGenre.addBinding(gf, "env", { label: "reflets ×", min: 0, max: 3, step: 0.05 });
  const fGenreFx = fGenre.addFolder({ title: "ASCII + déformation", expanded: false });
  fGenreFx.addBinding(gf, "detail", { label: "détail", min: 0, max: 1, step: 0.01 });
  fGenreFx.addBinding(gf, "contrast", { label: "contraste", min: 0.2, max: 3, step: 0.05 });
  fGenreFx.addBinding(gf, "warpX", { label: "GRAVES: ondulation X", min: 0, max: 0.3, step: 0.005 });
  fGenreFx.addBinding(gf, "warpY", { label: "MÉDIUMS: ondulation Y", min: 0, max: 0.3, step: 0.005 });
  fGenreFx.addBinding(gf, "tear", { label: "AIGUS: déchirure", min: 0, max: 0.5, step: 0.005 });
  fGenreFx.addBinding(gf, "glitchIn", { label: "glitch apparition", min: 0, max: 0.5, step: 0.005 });
  fGenreFx.addBinding(gf, "fadeIn", { label: "apparition (s)", min: 0.1, max: 4, step: 0.05 });
  fGenreFx.addBinding(gf, "fadeOut", { label: "disparition (s)", min: 0.1, max: 2, step: 0.05 });
  fGenreFx.addBinding(gf, "pageRate", { label: "wave ↔ modèle (/s)", min: 0.2, max: 6, step: 0.05 });
  const eqfx = EQ_FX;
  const fEq = fGenre.addFolder({ title: "égaliseur fantôme", expanded: false });
  fEq.addBinding(eqfx, "enabled", { label: "actif" });
  fEq.addBinding(eqfx, "curve", { label: "courbe distance", min: 0.1, max: 2, step: 0.05 });
  fEq.addBinding(eqfx, "kickGain", { label: "à-coups", min: 0, max: 2, step: 0.05 });
  fEq.addBinding(eqfx, "omegaMin", { label: "ressort min (rad/s)", min: 0.5, max: 8, step: 0.1 });
  fEq.addBinding(eqfx, "omegaMax", { label: "ressort max (rad/s)", min: 0.5, max: 8, step: 0.1 });
  fEq.addBinding(eqfx, "dampingMin", { label: "amortissement min", min: 0.1, max: 1.5, step: 0.01 });
  fEq.addBinding(eqfx, "dampingMax", { label: "amortissement max", min: 0.1, max: 1.5, step: 0.01 });
  fEq.addBinding(eqfx, "lockMin", { label: "réglé min (s)", min: 0.5, max: 10, step: 0.1 });
  fEq.addBinding(eqfx, "lockMax", { label: "réglé max (s)", min: 0.5, max: 10, step: 0.1 });
  fEq.addBinding(eqfx, "detuneMin", { label: "dérèglement min", min: 0.5, max: 8, step: 0.1 });
  fEq.addBinding(eqfx, "detuneMax", { label: "dérèglement max", min: 0.5, max: 8, step: 0.1 });

  // --- Wave ---
  const waveParams: Record<string, unknown> = { ...DEFAULT_WAVE_PARAMS };
  const fWave = pane.addFolder({ title: "Wave", expanded: false });
  for (const [key, range] of WAVE_SLIDERS) {
    fWave
      .addBinding(waveParams, key, range)
      .on("change", (e: ChangeEvent) => wave.setParam(key, e.value as never));
  }
  for (const key of ["colorA", "colorB"] as const) {
    fWave
      .addBinding(waveParams, key, { color: { type: "int" } })
      .on("change", (e: ChangeEvent) => wave.setParam(key, e.value as never));
  }

  // --- Ghost tuner (autonomous frequency gameplay) ---
  const t = TUNER_FX;
  const fTuner = pane.addFolder({ title: "Accordeur fantôme", expanded: true });
  fTuner.addBinding(t, "enabled");
  fTuner.addBinding(stage.tuner.state, "phase", { readonly: true, interval: 100 });
  fTuner.addBinding(stage.tuner.state, "distance", {
    readonly: true,
    view: "graph",
    min: 0,
    max: 45,
    interval: 50,
  });
  fTuner.addBinding(stage.tuner.state, "speed", {
    label: "vitesse",
    readonly: true,
    view: "graph",
    min: 0,
    max: 30,
    interval: 50,
  });
  fTuner.addButton({ title: "Décrocher maintenant" }).on("click", () => stage.tuner.detuneNow());
  const fSearch = fTuner.addFolder({ title: "recherche (ressort)", expanded: false });
  fSearch.addBinding(t, "omegaMin", { label: "raideur min", min: 0.2, max: 4, step: 0.05 });
  fSearch.addBinding(t, "omegaMax", { label: "raideur max", min: 0.2, max: 4, step: 0.05 });
  fSearch.addBinding(t, "dampingMin", { label: "amorti min", min: 0.1, max: 1.5, step: 0.05 });
  fSearch.addBinding(t, "dampingMax", { label: "amorti max", min: 0.1, max: 1.5, step: 0.05 });
  fSearch.addBinding(t, "lockSpeed", { label: "vitesse calage", min: 0.05, max: 3, step: 0.05 });
  const fLock = fTuner.addFolder({ title: "calé / décrochage", expanded: false });
  fLock.addBinding(t, "lockMin", { label: "calé min (s)", min: 0, max: 10, step: 0.1 });
  fLock.addBinding(t, "lockMax", { label: "calé max (s)", min: 0, max: 10, step: 0.1 });
  fLock.addBinding(t, "detuneMin", { label: "écart min", min: 1, max: 80, step: 1 });
  fLock.addBinding(t, "detuneMax", { label: "écart max", min: 1, max: 80, step: 1 });
  fLock.addBinding(t, "detuneOmega", { label: "raideur décroch.", min: 0.2, max: 6, step: 0.05 });
  fLock.addBinding(t, "detuneSeconds", { label: "durée décroch.", min: 0.2, max: 5, step: 0.05 });
  const fCurve = fTuner.addFolder({ title: "distance → chaos", expanded: false });
  fCurve.addBinding(t, "reach", { min: 5, max: 150, step: 1 });
  fCurve.addBinding(t, "curve", { min: 0.1, max: 2, step: 0.05 });
  fCurve.addBinding(t, "tolerance", { min: 0, max: 3, step: 0.1 });

  // --- Wave FX (energy + swipe response) ---
  const fFx = pane.addFolder({ title: "Wave FX / swipe", expanded: false });
  fFx.addBinding(WAVE_FX, "chaos", { label: "chaos min", min: 0, max: 1, step: 0.01 });
  fFx.addBinding(WAVE_FX, "converge", { min: 0, max: 1, step: 0.05 });
  fFx.addBinding(WAVE_FX, "distort", { min: 0, max: 0.6, step: 0.01 });
  fFx.addBinding(WAVE_FX, "tear", { min: 0, max: 1, step: 0.01 });
  fFx.addBinding(WAVE_FX, "smooth", { min: 0.25, max: 20, step: 0.25 });
  fFx.addBinding(WAVE_FX, "farAmp", { label: "loin: amp ×", min: 1, max: 4, step: 0.05 });
  fFx.addBinding(WAVE_FX, "farThickness", { label: "loin: épaisseur ×", min: 1, max: 5, step: 0.05 });
  fFx.addBinding(WAVE_FX, "farFreq", { label: "loin: fréquence ×", min: 1, max: 4, step: 0.05 });
  fFx.addBinding(WAVE_FX, "motionKick", { label: "agitation/vitesse", min: 0, max: 0.2, step: 0.005 });
  fFx.addBinding(WAVE_FX, "motionScroll", { label: "glisse/vitesse", min: 0, max: 0.3, step: 0.005 });
  fFx.addBinding(WAVE_FX, "attack", { label: "montée /s", min: 0.25, max: 20, step: 0.25 });
  fFx.addBinding(WAVE_FX, "release", { label: "descente /s", min: 0.25, max: 20, step: 0.25 });
  fFx.addBinding(WAVE_FX, "scrollEase", { label: "lissage glisse /s", min: 0.25, max: 20, step: 0.25 });
  fFx.addBinding(WAVE_FX, "kickPerUnit", { min: 0, max: 2, step: 0.05 });
  fFx.addBinding(WAVE_FX, "kickDecay", { min: 0.5, max: 15, step: 0.5 });
  fFx.addBinding(WAVE_FX, "kickGain", { min: 0, max: 1.5, step: 0.05 });
  fFx.addBinding(WAVE_FX, "scrollPerUnit", { min: 0, max: 3, step: 0.05 });
  fFx.addBinding(WAVE_FX, "scrollDecay", { min: 0.5, max: 15, step: 0.5 });
  fFx.addBinding(WAVE_FX, "scrollMax", { min: 0, max: 5, step: 0.1 });
  // Simulated swipe: one card to the left / right.
  fFx.addButton({ title: "◀ swipe" }).on("click", () => wave.nudge(-1));
  fFx.addButton({ title: "swipe ▶" }).on("click", () => wave.nudge(1));

  // --- ASCII ---
  const a = {
    enabled: true,
    cellCss: STAGE_FX.cellCss,
    detail: cfg.detail,
    weight: cfg.weight,
    contrast: cfg.contrast,
    threshold: cfg.threshold,
    quality: cfg.quality,
    noiseAmp: cfg.noiseAmp,
    bgFloor: STAGE_FX.bgFloor,
    jitterCalm: STAGE_FX.jitter[0],
    jitterFull: STAGE_FX.jitter[1],
    jitterSpeedCalm: STAGE_FX.jitterSpeed[0],
    jitterSpeedFull: STAGE_FX.jitterSpeed[1],
    speedVariance: cfg.speedVariance,
    glyphColor: hex(cfg.color),
    bgColor: hex(cfg.bgColor),
    fillMode: cfg.fillMode,
    characters: cfg.characters,
    fontFamily: cfg.fontFamily,
    bold: cfg.bold,
  };
  const set = (patch: Parameters<typeof ascii.set>[0]) => ascii.set(patch);

  const fAscii = pane.addFolder({ title: "ASCII", expanded: true });
  fAscii
    .addBinding(a, "enabled", { label: "ASCII on" })
    .on("change", (e: ChangeEvent<boolean>) => ascii.setEnabled(e.value));
  fAscii
    .addBinding(a, "cellCss", { label: "cell (css px)", min: 2, max: 24, step: 0.5 })
    .on("change", (e: ChangeEvent<number>) => stage.setCellSize(e.value));
  fAscii
    .addBinding(a, "detail", { min: 0, max: 1, step: 0.005 })
    .on("change", (e: ChangeEvent<number>) => set({ detail: e.value }));
  fAscii
    .addBinding(a, "weight", { min: 0, max: 1, step: 0.005 })
    .on("change", (e: ChangeEvent<number>) => set({ weight: e.value }));
  fAscii
    .addBinding(a, "contrast", { min: 0.1, max: 4, step: 0.01 })
    .on("change", (e: ChangeEvent<number>) => set({ contrast: e.value }));
  fAscii
    .addBinding(a, "threshold", { min: 0, max: 1, step: 0.01 })
    .on("change", (e: ChangeEvent<number>) => set({ threshold: e.value }));
  fAscii
    .addBinding(a, "quality", { min: 0, max: 1, step: 0.01 })
    .on("change", (e: ChangeEvent<number>) => set({ quality: e.value }));
  fAscii
    .addBinding(a, "noiseAmp", { min: 0, max: 1, step: 0.01 })
    .on("change", (e: ChangeEvent<number>) => set({ noiseAmp: e.value }));
  fAscii
    .addBinding(a, "bgFloor", { label: "faint fill", min: 0, max: 0.5, step: 0.005 })
    .on("change", (e: ChangeEvent<number>) => (STAGE_FX.bgFloor = e.value));

  const fLife = fAscii.addFolder({ title: "flicker (calm → swipe)", expanded: false });
  fLife
    .addBinding(a, "jitterCalm", { min: 0, max: 12, step: 0.5 })
    .on("change", (e: ChangeEvent<number>) => (STAGE_FX.jitter[0] = e.value));
  fLife
    .addBinding(a, "jitterFull", { min: 0, max: 12, step: 0.5 })
    .on("change", (e: ChangeEvent<number>) => (STAGE_FX.jitter[1] = e.value));
  fLife
    .addBinding(a, "jitterSpeedCalm", { min: 0, max: 30, step: 0.5 })
    .on("change", (e: ChangeEvent<number>) => (STAGE_FX.jitterSpeed[0] = e.value));
  fLife
    .addBinding(a, "jitterSpeedFull", { min: 0, max: 30, step: 0.5 })
    .on("change", (e: ChangeEvent<number>) => (STAGE_FX.jitterSpeed[1] = e.value));
  fLife
    .addBinding(a, "speedVariance", { min: 0, max: 1, step: 0.01 })
    .on("change", (e: ChangeEvent<number>) => set({ speedVariance: e.value }));

  const fLook = fAscii.addFolder({ title: "glyphs & colors", expanded: false });
  fLook
    .addBinding(a, "glyphColor")
    .on("change", (e: ChangeEvent<string>) => set({ color: e.value }));
  fLook
    .addBinding(a, "bgColor")
    .on("change", (e: ChangeEvent<string>) => set({ bgColor: e.value }));
  fLook
    .addBinding(a, "fillMode", {
      options: { characters: "characters", squares: "squares", circles: "circles", dots: "dots" },
    })
    .on("change", (e: ChangeEvent<string>) => set({ fillMode: e.value as never }));
  fLook
    .addBinding(a, "characters")
    .on("change", (e: ChangeEvent<string>) => set({ characters: e.value }));
  fLook
    .addBinding(a, "fontFamily", {
      options: { monospace: "monospace", "Courier New": "Courier New", Menlo: "Menlo" },
    })
    .on("change", (e: ChangeEvent<string>) => set({ fontFamily: e.value }));
  fLook
    .addBinding(a, "bold")
    .on("change", (e: ChangeEvent<boolean>) => set({ bold: e.value }));

  // --- Bloom / vignette ---
  const b = {
    enabled: true,
    intensity: STAGE_FX.bloom,
    threshold: bloom.luminanceMaterial.threshold,
    smoothing: bloom.luminanceMaterial.smoothing,
  };
  const fBloom = pane.addFolder({ title: "Bloom", expanded: false });
  // Removes the bloom from the pass (a SKIP blend would still compute its blur).
  fBloom
    .addBinding(b, "enabled")
    .on("change", (e: ChangeEvent<boolean>) => stage.setBloomEnabled(e.value));
  fBloom
    .addBinding(b, "intensity", { min: 0, max: 3, step: 0.05 })
    .on("change", (e: ChangeEvent<number>) => (STAGE_FX.bloom = e.value));
  fBloom
    .addBinding(b, "threshold", { min: 0, max: 1, step: 0.01 })
    .on("change", (e: ChangeEvent<number>) => (bloom.luminanceMaterial.threshold = e.value));
  fBloom
    .addBinding(b, "smoothing", { min: 0, max: 1, step: 0.01 })
    .on("change", (e: ChangeEvent<number>) => (bloom.luminanceMaterial.smoothing = e.value));

  const v = { enabled: true, offset: vignette.offset, darkness: vignette.darkness };
  const fVig = pane.addFolder({ title: "Vignette", expanded: false });
  fVig.addBinding(v, "enabled").on("change", (e: ChangeEvent<boolean>) => {
    vignette.blendMode.blendFunction = e.value ? BlendFunction.NORMAL : BlendFunction.SKIP;
  });
  fVig
    .addBinding(v, "offset", { min: 0, max: 1, step: 0.01 })
    .on("change", (e: ChangeEvent<number>) => (vignette.offset = e.value));
  fVig
    .addBinding(v, "darkness", { min: 0, max: 1, step: 0.01 })
    .on("change", (e: ChangeEvent<number>) => (vignette.darkness = e.value));

  // --- Sound: levels by ear (sound on, after a first click) ---
  const fSound = pane.addFolder({ title: "Son", expanded: false });
  const level = { min: 0, max: 0.6, step: 0.01 };
  fSound.addBinding(SFX, "master", { label: "effets (tous)", min: 0, max: 1.5, step: 0.01 });
  fSound.addBinding(INTRO_VOICE, "gain", { label: "voix", min: 0, max: 3, step: 0.05 });
  fSound.addBinding(SFX, "key", { label: "frappe (scroll)", ...level });
  fSound.addBinding(SFX, "keyUnderVoice", { label: "frappe (intro)", ...level });
  fSound.addBinding(SFX, "decode", { label: "frappe (déchiffrage)", ...level });
  fSound.addBinding(SFX, "decodeRate", { label: "frappes / s", min: 5, max: 30, step: 0.5 });
  fSound.addBinding(SFX, "glitch", { label: "glitch", ...level });
  fSound.addBinding(SFX, "glitchBody", { label: "glitch (grave)", ...level });
  fSound.addBinding(SFX, "glitchSoft", { label: "glitch léger", ...level });
  fSound.addBinding(SFX, "appear", { label: "glitch modèle", ...level });
  fSound.addBinding(SFX, "print", { label: "photo posée", ...level });
  fSound.addBinding(SFX, "printFall", { label: "photo : contact (s)", min: 0, max: 0.5, step: 0.01 });
  fSound.addButton({ title: "Tester : frappe" }).on("click", () => typeKey());
  fSound.addButton({ title: "Tester : déchiffrage" }).on("click", () => typingRun(0.6));
  fSound.addButton({ title: "Tester : glitch" }).on("click", () => glitch());
  fSound.addButton({ title: "Tester : glitch léger" }).on("click", () => softGlitch());
  fSound.addButton({ title: "Tester : glitch modèle" }).on("click", () => appearGlitch());
  fSound.addButton({ title: "Tester : photo posée" }).on("click", () => printDown());

  // --- Export: paste the result back to lock the values in code ---
  pane.addButton({ title: "Copy config (JSON)" }).on("click", () => {
    const json = JSON.stringify(
      { logo: LOGO_FX, wave: waveParams, waveFx: WAVE_FX, tuner: TUNER_FX, stage: STAGE_FX, ascii: a, bloom: b, vignette: v, sfx: SFX, voice: INTRO_VOICE },
      null,
      2,
    );
    console.log(json);
    void navigator.clipboard?.writeText(json).catch(() => {});
  });

  return { dispose: () => pane.dispose() };
}
