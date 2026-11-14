import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  KernelSize,
  RenderPass,
  VignetteEffect,
} from "postprocessing";
import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import { AsciiPostFx } from "./ascii/AsciiPostFx";
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
  // ASCII glyph flicker from the wave energy: [calm, full energy].
  // Installation: [1.5, 9] and [3, 16].
  jitter: [1.5, 4] as [number, number],
  jitterSpeed: [3, 8] as [number, number],
  // Faint glyph field. Installation: 0.1 on blue. The output is linear → sRGB,
  // so small values read much brighter than they are (0.04 ≈ 22 % grey).
  bgFloor: 0.015,
  bloom: 0.5, // base bloom intensity
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
 * Fixed full-viewport WebGL layer:
 *   RenderPass(wave) → [ASCII] → RenderPass(logo, over the ASCII) → [bloom, vignette]
 * The wave goes through the ASCII effect (installation look); the chrome logo
 * is drawn on top of it so it stays sharp (LOGO_FX.ascii puts it through the
 * ASCII instead). Bloom then glows both. Sizes itself to its canvas.
 */
export class BackgroundStage {
  readonly renderer: WebGLRenderer;
  readonly composer: EffectComposer;
  readonly wave = new WaveLayer();
  readonly tuner: GhostTuner;
  readonly logo: LogoLayer;
  readonly ascii: AsciiPostFx;
  readonly bloom: BloomEffect;
  readonly vignette: VignetteEffect;
  /** Live readout for the debug pane. */
  readonly stats = { fps: 0 };

  private readonly scene = new Scene(); // through the ASCII
  private readonly overlay = new Scene(); // over the ASCII
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
    this.unsubCue = onStageCue(() => this.renderStill());

    this.ascii = new AsciiPostFx({
      ...SITE_ASCII,
      bgFloor: STAGE_FX.bgFloor * this.presence,
      jitter: STAGE_FX.jitter[0],
    });
    this.bloom = new BloomEffect({
      intensity: STAGE_FX.bloom,
      luminanceThreshold: 0.8,
      luminanceSmoothing: 0.3,
      kernelSize: KernelSize.MEDIUM,
    });
    this.vignette = new VignetteEffect({ offset: 0.3, darkness: 0.5 });

    // Over the ASCII: keep its colour, clear depth only.
    const overlayPass = new RenderPass(this.overlay, this.camera);
    overlayPass.clearPass.setClearFlags(false, true, false);

    this.composer = new EffectComposer(this.renderer);
    const passes = [
      new RenderPass(this.scene, this.camera),
      new EffectPass(this.camera, this.ascii),
      overlayPass,
      new EffectPass(this.camera, this.bloom, this.vignette),
    ];
    passes.forEach((pass, i) => {
      pass.renderToScreen = i === passes.length - 1;
      this.composer.addPass(pass);
    });

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resize();
    void this.loadAssets();
  }

  /** Logo (by bytes), then shader precompile + one frame: the loader waits on
   * both, so nothing hitches when the experience starts. */
  private async loadAssets(): Promise<void> {
    try {
      await this.logo.load(LOGO_URL, (p) => reportLoad("logo", p));
      reportLoad("logo", 1);
      if (this.disposed) return;
      this.logo.showAllForCompile(); // compile skips invisible objects
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
      this.render(0); // also compiles the post-processing passes
    } catch (e) {
      console.warn("[BackgroundStage] logo failed to load", e);
    }
    reportLoad("logo", 1);
    reportLoad("scene", 1);
  }

  start(): void {
    if (this.running || this.disposed || this.reducedMotion) return;
    if (document.hidden) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Base ASCII cell in CSS px (scaled by the pixel ratio). */
  setCellSize(css: number): void {
    STAGE_FX.cellCss = css;
    this.ascii.set({ cellSize: css * this.pixelRatio });
    this.renderStill();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.observer.disconnect();
    this.unsubCue();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.wave.dispose();
    this.logo.dispose();
    this.env.dispose();
    this.ascii.dispose();
    this.composer.dispose();
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
    this.render(dt);
    this.raf = requestAnimationFrame(this.frame);
  };

  private render(dt: number): void {
    const fx = STAGE_FX;
    this.elapsed += dt;

    // Dark (loading, forge) ↔ main: the wave and the glyph field fade.
    const presence = stageCues.dark ? 0 : 1;
    this.presence = this.running ? ease(this.presence, presence, fx.presenceRate, dt) : presence;
    this.tuner.update(dt);
    this.wave.setFade(this.presence);
    this.wave.update(dt, this.elapsed);

    // Fitted every frame so the pane's size sliders apply live.
    this.logo.fit(this.camera);
    this.logo.update(dt, this.reducedMotion);

    // Glyph flicker: the forge settles from chaos to calm as the hold
    // completes; otherwise it follows the wave's energy.
    const lerp = ([a, b]: [number, number], k: number) => a + (b - a) * k;
    const forge = this.logo.forging ? stageCues.forge : -1;
    const e = forge >= 0 ? forge : this.wave.energy;
    // While the field forms (presence rising), its glyphs flicker harder.
    const forming = forge >= 0 ? 0 : (1 - this.presence) * fx.formingJitter;
    this.ascii.set({
      bgFloor: fx.bgFloor * this.presence,
      jitter: lerp(forge >= 0 ? fx.forgeJitter : fx.jitter, e) + forming,
      jitterSpeed: lerp(forge >= 0 ? fx.forgeJitterSpeed : fx.jitterSpeed, e) + forming * 2,
    });
    this.bloom.intensity =
      fx.bloom + Math.max(0, forge) * fx.forgeGlow + this.logo.flash * fx.flashGlow;

    this.composer.render(dt);
  }

  /** Reduced motion: frames are only drawn on demand. */
  private renderStill(): void {
    if (!this.running && !this.disposed) this.render(0);
  }

  private resize(): void {
    if (this.disposed) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;

    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    // false: CSS owns the canvas box (fixed, 100lvh), we only size the buffer.
    this.composer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.wave.setResolution(width * this.pixelRatio, height * this.pixelRatio);
    this.ascii.set({ cellSize: STAGE_FX.cellCss * this.pixelRatio });
    this.renderStill();
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };
}
