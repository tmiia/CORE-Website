import {
  BloomEffect,
  type Effect,
  EffectComposer,
  EffectPass,
  KernelSize,
  RenderPass,
  VignetteEffect,
} from "postprocessing";
import {
  ACESFilmicToneMapping,
  LinearFilter,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  UnsignedByteType,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { AsciiPostFx } from "./ascii/AsciiPostFx";
import { GENRE_FX, GenreModelLayer } from "./genre/GenreModelLayer";
import { reportLoad } from "./loadProgress";
import { LogoLayer } from "./logo/LogoLayer";
import { createStudioEnv } from "./logo/studioEnv";
import { onStageCue, stageCues } from "./stageCues";
import { GhostTuner } from "./wave/GhostTuner";
import { ease } from "./wave/tuning";
import { WaveLayer } from "./wave/WaveLayer";

const LOGO_URL = "/assets/models/core-logo.glb";

/** ASCII field as on the installation's frequency screen, in black & white.
 * Tone = TV1 SPIRAL_TONE. `cellSize` is set from CELL_CSS × pixel ratio. */
const SITE_ASCII = {
  bgColor: "#000000",
  color: "#ffffff",
  contrast: 1.2,
  quality: 1,
  detail: 0.565,
  weight: 0.5,
  threshold: 0,
  speedVariance: 0.6,
};

/** Live-tunable stage settings (the debug pane edits this object). */
export const STAGE_FX = {
  // Base ASCII cell in CSS px. The installation used 10 *device* px on a TV;
  // CSS px keeps glyphs the same physical size across phone pixel ratios.
  // Effective glyph ≈ cell × 1.87 at detail 0.565.
  cellCss: 5,
  // Scene buffer resolution, in pixels per base cell. The ASCII grid only
  // reads the scene at cell centres, so the wave and the models don't need
  // screen resolution: 3 is visually the same, ~10× cheaper.
  sceneSamples: 3,
  // ASCII glyph flicker from the wave energy: [calm, full energy].
  // Installation: [1.5, 9] and [3, 16].
  jitter: [1.5, 4] as [number, number],
  jitterSpeed: [3, 8] as [number, number],
  // Faint glyph field. Installation: 0.1 on blue. The output is linear → sRGB,
  // so small values read much brighter than they are (0.04 ≈ 22 % grey).
  bgFloor: 0.015,
  bloom: 0.5, // base bloom intensity
  bloomScale: 0.5, // bloom resolution, fraction of the screen (see LiteBloomEffect)
  // Adaptive quality (watchFrameRate): below this frame rate for 2 s, the
  // bloom goes (if adaptiveBloom), then the pixel ratio drops a step at a
  // time, down to minPixelRatio.
  adaptiveMinFps: 50,
  adaptiveBloom: true,
  // At the bottom of the ladder, the reductions are kept only if they raised
  // the frame rate by this factor; otherwise the frame rate is capped (Safari
  // Low Power Mode: 30 fps) and full quality comes back.
  adaptiveGain: 1.15,
  adaptiveWarmup: 3, // s before measuring (loading, first compiles)
  minPixelRatio: 1,
  // Dark (loading, forge) ↔ main: wave + glyph field fade, per second.
  presenceRate: 1.2,
  formingJitter: 6, // extra glyph flicker while the field forms
  // Forge (HOLD): ASCII flicker [hold start, complete] — chaos settling down…
  forgeJitter: [9, 1.5] as [number, number],
  forgeJitterSpeed: [18, 4] as [number, number],
  forgeGlow: 2.2, // …and the glow building up (extra bloom at full hold)
  flashGlow: 4, // bloom spike when the chrome materialises
};

export interface BackgroundStageOptions {
  maxPixelRatio?: number;
  /** Render a single still frame (and on resize) instead of animating. */
  reducedMotion?: boolean;
}

/**
 * Bloom computed at a fraction of the screen resolution (STAGE_FX.bloomScale).
 * postprocessing's mipmap blur ignores `resolutionScale`: its luminance pass
 * and blur chain started at full resolution, which made the bloom ~4/5 of
 * the GPU time. It is a soft glow, so a smaller source looks the same.
 */
class LiteBloomEffect extends BloomEffect {
  static readonly LEVELS = 8; // postprocessing's default, at full resolution

  override setSize(width: number, height: number): void {
    super.setSize(width, height);
    const scale = STAGE_FX.bloomScale;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    this.luminancePass.setSize(w, h);
    // A smaller source makes every blur level cover more screen: drop the
    // finest ones so the glow keeps the same reach.
    this.mipmapBlurPass.levels = Math.max(
      1,
      Math.round(LiteBloomEffect.LEVELS + Math.log2(Math.min(1, scale))),
    );
    this.mipmapBlurPass.setSize(w, h);
  }
}

/** Effect pass whose effects can change at runtime (bloom in or out). */
class SwappableEffectPass extends EffectPass {
  replaceEffects(...effects: Effect[]): void {
    this.setEffects(effects);
    this.recompile();
  }
}

const NO_DEFORM = { high: 0, mid: 0, low: 0 };
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp = ([a, b]: [number, number], k: number) => a + (b - a) * k;

/**
 * Fixed full-viewport WebGL layer:
 *   scene (wave | genre model) → small buffer → [ASCII: cell pass + glyphs]
 *     → RenderPass(logo, over the ASCII) → [bloom, vignette]
 * The scene is rendered at a few pixels per glyph cell (all the ASCII reads),
 * the glyphs at screen resolution. The wave goes through the ASCII effect
 * (installation look); the chrome logo
 * is drawn on top of it so it stays sharp (LOGO_FX.ascii puts it through the
 * ASCII instead). Bloom then glows both. Sizes itself to its canvas.
 * On a genre page (stageCues.genre) the wave fades out and the genre's model
 * turns in the page's hero, deformed by its ghost equalizer.
 */
export class BackgroundStage {
  readonly renderer: WebGLRenderer;
  readonly composer: EffectComposer;
  readonly wave = new WaveLayer();
  readonly tuner: GhostTuner;
  readonly logo: LogoLayer;
  readonly genre: GenreModelLayer;
  readonly ascii: AsciiPostFx;
  readonly bloom: BloomEffect;
  readonly vignette: VignetteEffect;
  /** Live readout for the debug pane. `loop`: whether frames are animated at
   * all (reduced motion draws still frames only, so fps stays at 0). */
  readonly stats = { fps: 0, pixelRatio: 1, loop: "arrêtée", bloom: "actif", adaptive: "qualité max" };
  readonly fx = STAGE_FX; // console access (profiling)
  // watchFrameRate: current 1 s window, slow windows in a row (and their fps
  // sum), fps before the first reduction, ladder finished.
  private readonly perf = { frames: 0, time: 0, slow: 0, sum: 0, baseline: 0, done: false };
  private pixelRatioCap = Infinity; // lowered by watchFrameRate

  private readonly scene = new Scene(); // through the ASCII
  private readonly overlay = new Scene(); // over the ASCII
  private readonly sceneTarget: WebGLRenderTarget; // the scene, small
  private readonly overlayPass: RenderPass;
  private readonly postPass: SwappableEffectPass; // bloom + vignette
  private bloomOn = true;
  private readonly anchorObserver = new ResizeObserver(() => this.measureAnchor());
  private anchorEl: HTMLElement | null = null;
  private readonly anchorDoc = { x: 0, y: 0, w: 0, h: 0 };
  private preloaded: Set<string> | null = null; // set once loadAssets started
  private cssWidth = 1; // canvas size, CSS px (read on resize only)
  private cssHeight = 1;
  // Narrow lens for the logo (little perspective distortion). The wave is a
  // clip-space quad, camera-independent.
  private readonly camera = new PerspectiveCamera(35, 1, 0.1, 100);
  private readonly env: WebGLRenderTarget;
  private readonly observer: ResizeObserver;
  private readonly unsubCue: () => void;
  private readonly maxPixelRatio: number;
  private readonly reducedMotion: boolean;
  private pixelRatio = 1;
  private presence = stageCues.dark ? 0 : 1; // 0 = dark, 1 = wave + field
  private page = stageCues.genre ? 1 : 0; // 0 = home (wave), 1 = genre page (model)
  private toneActive = false; // the genre tone was written last frame
  private deform: Readonly<Record<"high" | "mid" | "low", number>> = NO_DEFORM;
  private scrollQueued = false;
  private elapsed = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: BackgroundStageOptions = {},
  ) {
    this.maxPixelRatio = opts.maxPixelRatio ?? 2;
    this.reducedMotion = opts.reducedMotion ?? false;
    if (this.reducedMotion) this.stats.loop = "figée (réduire les animations)";

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;

    this.camera.position.z = 3;
    this.wave.mesh.renderOrder = -1; // under the logo when both go through ASCII
    this.scene.add(this.wave.mesh);
    // Reduced motion: no loop, so show the calm, locked line.
    this.tuner = new GhostTuner(this.wave, this.reducedMotion ? "locked" : "far");

    this.env = createStudioEnv(this.renderer);
    this.logo = new LogoLayer(this.env.texture);
    this.overlay.add(this.logo.chromeRoot); // sharp, over the ASCII
    this.scene.add(this.logo.asciiRoot); // silhouette, turned into glyphs
    this.renderer.localClippingEnabled = true; // chrome sweep-in
    this.genre = new GenreModelLayer(this.renderer);
    this.scene.add(this.genre.group); // genre pages, turned into glyphs
    this.unsubCue = onStageCue(() => {
      // Reduced motion: draw again once the page's model has loaded.
      const url = stageCues.genre?.model;
      if (url && this.reducedMotion) void this.genre.preload(url).then(() => this.renderStill());
      if (this.preloaded) this.preloadLate(); // after the initial load only
      this.renderStill();
    });

    this.ascii = new AsciiPostFx({
      ...SITE_ASCII,
      bgFloor: STAGE_FX.bgFloor * this.presence,
      jitter: STAGE_FX.jitter[0],
    });
    this.bloom = new LiteBloomEffect({
      intensity: STAGE_FX.bloom,
      luminanceThreshold: 0.8,
      luminanceSmoothing: 0.3,
      kernelSize: KernelSize.MEDIUM,
    });
    this.vignette = new VignetteEffect({ offset: 0.3, darkness: 0.5 });

    // The scene only feeds the ASCII grid, so it is rendered small (a few
    // samples per glyph cell, see resize()), not at screen resolution. Same
    // buffer format as the composer's (8-bit, sRGB-encoded storage).
    this.sceneTarget = new WebGLRenderTarget(1, 1, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
      type: UnsignedByteType,
    });
    if (this.renderer.outputColorSpace === SRGBColorSpace) {
      this.sceneTarget.texture.colorSpace = SRGBColorSpace;
    }
    this.ascii.setSceneTexture(this.sceneTarget.texture);

    // Over the ASCII: keep its colour, clear depth only. Skipped while the
    // chrome logo isn't on screen.
    this.overlayPass = new RenderPass(this.overlay, this.camera);
    this.overlayPass.clearPass.setClearFlags(false, true, false);

    this.postPass = new SwappableEffectPass(this.camera, this.bloom, this.vignette);
    this.composer = new EffectComposer(this.renderer);
    const passes = [new EffectPass(this.camera, this.ascii), this.overlayPass, this.postPass];
    passes.forEach((pass, i) => {
      pass.renderToScreen = i === passes.length - 1;
      this.composer.addPass(pass);
    });

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    document.addEventListener("visibilitychange", this.onVisibility);
    // Reduced motion: no loop, but the genre model scrolls with its hero.
    if (this.reducedMotion) window.addEventListener("scroll", this.onScroll, { passive: true });
    this.resize();
    void this.loadAssets();
    const url = stageCues.genre?.model;
    if (url) void this.genre.preload(url).then(() => this.renderStill());
  }

  /** Logo (by bytes), then shader precompile + one frame: the loader waits on
   * both, so nothing hitches when the experience starts. */
  private async loadAssets(): Promise<void> {
    // The home's genre models load alongside the logo (the loader waits for
    // both), then everything is compiled and uploaded to the GPU here, behind
    // the loader — not on the first visit to a genre page.
    const genres = [...stageCues.preload];
    this.preloaded = new Set(genres);
    const genresLoaded = this.genre
      .preloadAll(genres, (p) => reportLoad("genres", p))
      .catch((e) => console.warn("[BackgroundStage] genre models failed to load", e))
      .finally(() => reportLoad("genres", 1));
    try {
      await this.logo.load(LOGO_URL, (p) => reportLoad("logo", p));
      reportLoad("logo", 1);
      await genresLoaded;
      if (this.disposed) return;
      this.logo.showAllForCompile(); // compile skips invisible objects
      this.genre.warmUp();
      // Async compile needs KHR_parallel_shader_compile; otherwise compile
      // synchronously (still before the experience starts).
      if (this.renderer.extensions.has("KHR_parallel_shader_compile")) {
        await this.renderer.compileAsync(this.overlay, this.camera);
        await this.renderer.compileAsync(this.scene, this.camera);
      } else {
        this.renderer.compile(this.overlay, this.camera);
        this.renderer.compile(this.scene, this.camera);
      }
      if (this.disposed) return;
      // Draws the warm-up models too: geometry and textures upload now.
      this.render(0); // also compiles the post-processing passes
    } catch (e) {
      console.warn("[BackgroundStage] logo failed to load", e);
    }
    reportLoad("logo", 1);
    reportLoad("genres", 1);
    reportLoad("scene", 1);
  }

  /** Models asked for after the loader (e.g. reaching the home from a genre
   * page): load in the background, warm up when they arrive. */
  private preloadLate(): void {
    const done = this.preloaded;
    if (!done) return;
    const urls = stageCues.preload.filter((u) => !done.has(u));
    if (!urls.length) return;
    urls.forEach((u) => done.add(u));
    void this.genre.preloadAll(urls).then(() => {
      if (this.disposed) return;
      this.genre.warmUp();
      this.renderStill();
    });
  }

  start(): void {
    if (this.running || this.disposed || this.reducedMotion) return;
    if (document.hidden) return;
    this.running = true;
    this.stats.loop = "animée";
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    if (!this.reducedMotion) this.stats.loop = "en pause";
    cancelAnimationFrame(this.raf);
  }

  /** Base ASCII cell in CSS px (scaled by the pixel ratio). */
  setCellSize(css: number): void {
    STAGE_FX.cellCss = css;
    this.ascii.set({ cellSize: css * this.pixelRatio });
    this.fitSceneTarget();
    this.renderStill();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.observer.disconnect();
    this.anchorObserver.disconnect();
    this.unsubCue();
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("scroll", this.onScroll);
    this.wave.dispose();
    this.logo.dispose();
    this.genre.dispose();
    this.env.dispose();
    this.ascii.dispose();
    this.composer.dispose();
    this.sceneTarget.dispose();
    this.renderer.dispose();
    // Free the GL context now: React StrictMode mounts twice in dev, and
    // browsers cap live contexts (mobile Safari especially).
    this.renderer.forceContextLoss();
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    // Clamp: a long frame (tab switch, jank) must not jump the animation.
    const raw = (now - this.last) / 1000;
    const dt = Math.min(raw, 0.1);
    this.last = now;
    if (raw > 0) this.stats.fps += (1 / raw - this.stats.fps) * 0.1;
    this.watchFrameRate(raw);
    this.render(dt);
    this.raf = requestAnimationFrame(this.frame);
  };

  /**
   * Adaptive quality: if frames keep running long (under ~50 fps for two
   * seconds in a row), drop the bloom first (the glyphs stay sharp), then
   * lower the pixel ratio a step at a time (2 → 1.5 → 1). Single long frames
   * (shader compile, model upload, tab switch) are ignored, and the first
   * seconds don't count.
   *
   * Still slow at the bottom of the ladder and no faster than before the
   * first step: the GPU wasn't the limit. Safari caps pages at 30 fps itself
   * in Low Power Mode (and when the phone runs hot). Full quality comes back
   * and the watch stops, since lowering it again would cost looks for no frames.
   */
  private watchFrameRate(raw: number): void {
    const p = this.perf;
    if (p.done || this.elapsed < STAGE_FX.adaptiveWarmup || raw <= 0 || raw > 0.1) return;
    p.frames++;
    p.time += raw;
    if (p.time < 1) return;
    const fps = p.frames / p.time;
    p.frames = 0;
    p.time = 0;
    const slow = fps < STAGE_FX.adaptiveMinFps;
    p.slow = slow ? p.slow + 1 : 0;
    p.sum = slow ? p.sum + fps : 0;
    if (p.slow < 2) return;
    const avg = p.sum / p.slow;
    p.slow = 0;
    p.sum = 0;
    p.baseline ||= avg; // before any reduction

    if (this.bloomOn && STAGE_FX.adaptiveBloom) {
      this.setBloomEnabled(false);
      this.stats.adaptive = "réduite";
    } else if (this.pixelRatio > STAGE_FX.minPixelRatio) {
      this.pixelRatioCap = Math.max(STAGE_FX.minPixelRatio, this.pixelRatio - 0.5);
      this.resize();
      this.stats.adaptive = "réduite";
    } else {
      p.done = true;
      if (avg >= p.baseline * STAGE_FX.adaptiveGain) {
        this.stats.adaptive = "réduite au minimum";
        return;
      }
      this.pixelRatioCap = Infinity;
      this.setBloomEnabled(true);
      this.resize();
      this.stats.adaptive = `rétablie : plafond à ${Math.round(avg)} fps (économie d'énergie ?)`;
    }
  }

  /**
   * Bloom in or out of the post chain. Out means removed from the pass: a
   * SKIP blend would still render its luminance and blur passes every frame.
   * The pass recompiles once (a single long frame, ignored by watchFrameRate).
   */
  setBloomEnabled(on: boolean): void {
    if (on === this.bloomOn || this.disposed) return;
    this.bloomOn = on;
    this.stats.bloom = on ? "actif" : "coupé";
    if (on) {
      // Not resized while out of the pass.
      this.bloom.setSize(this.cssWidth * this.pixelRatio, this.cssHeight * this.pixelRatio);
      this.postPass.replaceEffects(this.bloom, this.vignette);
    } else {
      this.postPass.replaceEffects(this.vignette);
    }
    this.renderStill();
  }

  private render(dt: number): void {
    const fx = STAGE_FX;
    this.elapsed += dt;

    // Dark (loading, forge) ↔ main: the wave and the glyph field fade.
    const presence = stageCues.dark ? 0 : 1;
    this.presence = this.running ? ease(this.presence, presence, fx.presenceRate, dt) : presence;
    // Home ↔ genre page: the wave gives way to the genre's model.
    const cue = stageCues.genre;
    const page = cue ? 1 : 0;
    this.page = this.running ? ease(this.page, page, GENRE_FX.pageRate, dt) : page;
    if (Math.abs(this.page - page) < 1e-3) this.page = page;
    this.tuner.update(dt);
    this.wave.setFade(this.presence * (1 - this.page));
    this.wave.update(dt, this.elapsed);

    // Fitted every frame so the pane's size sliders apply live.
    this.logo.fit(this.camera);
    this.logo.update(dt, this.reducedMotion);
    this.updateGenre(dt);

    // Glyph flicker: the forge settles from chaos to calm as the hold
    // completes; otherwise it follows the wave's energy (the equalizer's on a
    // genre page).
    const forge = this.logo.forging ? stageCues.forge : -1;
    const eqEnergy = (cue?.eq.energy ?? 0) * this.genre.level;
    const e = forge >= 0 ? forge : mix(this.wave.energy, eqEnergy, this.page);
    // While the field forms (presence rising), its glyphs flicker harder.
    const forming = forge >= 0 ? 0 : (1 - this.presence) * fx.formingJitter;
    this.ascii.set({
      bgFloor: fx.bgFloor * this.presence,
      jitter: lerp(forge >= 0 ? fx.forgeJitter : fx.jitter, e) + forming,
      jitterSpeed: lerp(forge >= 0 ? fx.forgeJitterSpeed : fx.jitterSpeed, e) + forming * 2,
    });
    this.bloom.intensity =
      fx.bloom + Math.max(0, forge) * fx.forgeGlow + this.logo.flash * fx.flashGlow;

    // Scene → small buffer (read by the ASCII cell pass), then the post chain.
    const r = this.renderer;
    r.setRenderTarget(this.sceneTarget);
    r.clear();
    r.render(this.scene, this.camera);
    this.overlayPass.enabled = this.logo.chromeRoot.visible;
    this.composer.render(dt);
  }

  /**
   * Genre page: fit the model into the page's hero box (it scrolls), fade it,
   * and let its equalizer deform the ASCII (TV1 ModelControls mapping). The
   * tone is only written while a genre page is (or was just) showing, so the
   * home and the debug pane keep their own values.
   */
  private updateGenre(dt: number): void {
    const cue = stageCues.genre;
    const g = GENRE_FX;
    let onScreen = false;
    let box: DOMRect | null = null;
    this.trackAnchor(cue?.anchor ?? null);
    if (cue?.anchor) {
      // Measured on layout changes only (see trackAnchor), moved by the scroll
      // here: no layout read per frame. The canvas is fixed at (0, 0).
      const a = this.anchorDoc;
      box = new DOMRect(a.x - window.scrollX, a.y - window.scrollY, a.w, a.h);
      onScreen = box.bottom > 0 && box.top < this.cssHeight && a.w > 0 && a.h > 0;
    }
    this.genre.update(dt, cue?.model ?? null, onScreen, this.reducedMotion);
    if (box) this.genre.fit(this.camera, this.cssWidth, this.cssHeight, box);

    if (cue) this.deform = cue.eq.deform; // kept while leaving: it fades with the page
    const p = this.page;
    if (p <= 0 && !this.toneActive) return;
    const d = this.deform;
    const k = p * this.genre.level; // deformation only once the model shows
    this.ascii.set({
      detail: mix(SITE_ASCII.detail, g.detail, p),
      contrast: mix(SITE_ASCII.contrast, g.contrast, p),
      weight: mix(SITE_ASCII.weight, lerp(g.weight, d.low), p),
      quality: mix(SITE_ASCII.quality, lerp(g.quality, d.high), k),
      warpX: g.warpX * d.low * k,
      warpY: g.warpY * d.mid * k,
      tear: (g.tear * d.high + g.glitchIn * this.genre.glitch) * k,
    });
    this.toneActive = p > 0;
  }

  /**
   * The genre page's hero box, in document coordinates. Re-measured when it or
   * the page resizes (ResizeObserver runs after layout, so the read is free),
   * never per frame: a per-frame getBoundingClientRect forces a full layout
   * whenever the page changed something (the EQ panel does, every frame).
   */
  private trackAnchor(el: HTMLElement | null): void {
    if (el === this.anchorEl) return;
    this.anchorObserver.disconnect();
    this.anchorEl = el;
    if (!el) return;
    this.anchorObserver.observe(el);
    this.anchorObserver.observe(document.body); // content above it moving
    this.measureAnchor();
  }

  private measureAnchor(): void {
    const el = this.anchorEl;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const a = this.anchorDoc;
    a.x = r.left + window.scrollX;
    a.y = r.top + window.scrollY;
    a.w = r.width;
    a.h = r.height;
  }

  /** Reduced motion: frames are only drawn on demand. */
  private renderStill(): void {
    if (!this.running && !this.disposed) this.render(0);
  }

  private readonly onScroll = (): void => {
    if (this.scrollQueued || !stageCues.genre) return;
    this.scrollQueued = true;
    requestAnimationFrame(() => {
      this.scrollQueued = false;
      this.renderStill();
    });
  };

  private resize(): void {
    if (this.disposed) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;
    this.cssWidth = width;
    this.cssHeight = height;
    this.measureAnchor();

    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio, this.pixelRatioCap);
    this.stats.pixelRatio = this.pixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    // false: CSS owns the canvas box (fixed, 100lvh), we only size the buffer.
    this.composer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.ascii.set({ cellSize: STAGE_FX.cellCss * this.pixelRatio });
    this.fitSceneTarget();
    this.renderStill();
  }

  /** Scene buffer: STAGE_FX.sceneSamples pixels per finest glyph cell. */
  private fitSceneTarget(): void {
    const width = this.cssWidth;
    const height = this.cssHeight;
    const perPx = STAGE_FX.sceneSamples / STAGE_FX.cellCss; // CSS px → scene px
    const w = Math.max(1, Math.ceil(width * perPx));
    const h = Math.max(1, Math.ceil(height * perPx));
    if (this.sceneTarget.width !== w || this.sceneTarget.height !== h) {
      this.sceneTarget.setSize(w, h);
    }
    this.wave.setResolution(w, h);
  }

  /** Bloom resolution, fraction of the screen (debug pane). */
  setBloomScale(scale: number): void {
    STAGE_FX.bloomScale = scale;
    this.bloom.setSize(this.cssWidth * this.pixelRatio, this.cssHeight * this.pixelRatio);
    this.renderStill();
  }

  /** Scene samples per glyph cell (debug pane). */
  setSceneSamples(samples: number): void {
    STAGE_FX.sceneSamples = samples;
    this.fitSceneTarget();
    this.renderStill();
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };
}
