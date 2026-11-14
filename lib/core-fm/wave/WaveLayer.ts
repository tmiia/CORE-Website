// Adapted from something.fm@7129c50 client/tv1/visuals/WaveLayer.ts
// Changes: the tuning distance comes from setDistance() and the turning speed
// from setMotion() (GhostTuner) instead of the potentiometer stream; impulses
// (nudge, for swipes) and motion feed eased targets so nothing jumps; softer
// defaults for the website (see WAVE_FX); resolution set explicitly.
import {
  Color,
  type IUniform,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
} from "three";
import { ease } from "./tuning";
import { fragmentShader, vertexShader } from "./wave";

export interface WaveParams {
  layers: number;
  freq: number;
  freqVar: number;
  amp: number;
  ampVar: number;
  speed: number;
  speedVar: number;
  transSpeed: number;
  ampSpeed: number;
  ampMod: number;
  phaseSpread: number;
  thickness: number;
  glow: number;
  zoom: number;
  colorA: { r: number; g: number; b: number };
  colorB: { r: number; g: number; b: number };
}

/** Installation defaults (TV1 frequency screen). */
export const DEFAULT_WAVE_PARAMS: WaveParams = {
  layers: 4,
  freq: 2.5,
  freqVar: 0.35,
  amp: 0.15,
  ampVar: 1,
  speed: 1.3,
  speedVar: 2,
  transSpeed: 0.45,
  ampSpeed: 1.5,
  ampMod: 0.2,
  phaseSpread: 1.0,
  thickness: 0.006,
  glow: 1.6,
  zoom: 0.7,
  colorA: { r: 255, g: 255, b: 255 },
  colorB: { r: 255, g: 255, b: 255 },
};

/** Deformation + motion response. Read every frame (the debug pane edits it
 * live). Installation values in comments where the site differs. */
export const WAVE_FX = {
  chaos: 0, // minimum agitation, even on target (0 = clean line)
  converge: 1, // 1 = traces merge into one line on target
  distort: 0.22, // noise displacement at full energy
  tear: 0.08, // horizontal tearing at full energy (installation 0.35)
  smooth: 2, // per second, chaos easing toward the distance (installation 6)
  // Look at full energy, as multipliers of the base (installation: 2.6, 3, 3.2).
  farAmp: 2.6,
  farThickness: 3,
  farFreq: 1.6,
  // Continuous turning (GhostTuner), speed in frequency units per second.
  motionKick: 0.04, // agitation per unit/s
  motionScroll: 0.08, // sideways slide (wave units/s) per unit/s
  // Impulses (nudge — swipes later).
  kickPerUnit: 0.5,
  kickDecay: 5, // per second
  scrollPerUnit: 0.6,
  scrollDecay: 4, // per second
  // Easing of what reaches the shader (per second): rise, fall, slide.
  kickGain: 0.6,
  attack: 4,
  release: 2,
  scrollEase: 3,
  scrollMax: 1.5, // wave units per second
};

/** Oscilloscope: N independent horizontal sine traces. Fullscreen quad. */
export class WaveLayer {
  readonly mesh: Mesh;
  private readonly geometry = new PlaneGeometry(2, 2);
  private readonly material: ShaderMaterial;
  private readonly uniforms: Record<string, IUniform>;

  private readonly base = {
    amp: DEFAULT_WAVE_PARAMS.amp,
    thickness: DEFAULT_WAVE_PARAMS.thickness,
    freq: DEFAULT_WAVE_PARAMS.freq,
  };
  private distance = 0; // curved tuning distance (0 = on target .. 1 = far)
  private chaos = 0; // eased toward max(WAVE_FX.chaos, distance)
  private motion = 0; // turning speed, frequency units/s (signed)
  private impulse = 0; // nudge agitation, decays
  private scrollImpulse = 0; // nudge slide, decays
  private kick = 0; // eased agitation from motion + impulses
  private scrollVel = 0; // eased slide speed
  private scroll = 0;
  // Trace colours as set; the uniforms get them × fade.
  private readonly colorA: Color;
  private readonly colorB: Color;
  private fade = 1;

  constructor() {
    const p = DEFAULT_WAVE_PARAMS;
    const rgb = (c: { r: number; g: number; b: number }) =>
      new Color(c.r / 255, c.g / 255, c.b / 255);
    this.colorA = rgb(p.colorA);
    this.colorB = rgb(p.colorB);

    this.uniforms = {
      uTime: { value: 0 },
      uLayers: { value: p.layers },
      uFreq: { value: p.freq },
      uFreqVar: { value: p.freqVar },
      uAmp: { value: p.amp },
      uAmpVar: { value: p.ampVar },
      uSpeed: { value: p.speed },
      uSpeedVar: { value: p.speedVar },
      uTransSpeed: { value: p.transSpeed },
      uAmpSpeed: { value: p.ampSpeed },
      uAmpMod: { value: p.ampMod },
      uPhaseSpread: { value: p.phaseSpread },
      uThickness: { value: p.thickness },
      uGlow: { value: p.glow },
      uZoom: { value: p.zoom },
      uColorA: { value: rgb(p.colorA) },
      uColorB: { value: rgb(p.colorB) },
      uResolution: { value: new Vector2(1, 1) },
      uChaos: { value: 0 },
      uKick: { value: 0 },
      uConverge: { value: WAVE_FX.converge },
      uDistort: { value: WAVE_FX.distort },
      uTear: { value: WAVE_FX.tear },
      uScroll: { value: 0 },
    };

    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false; // clip-space quad, camera-independent
  }

  /** 0..1: distance + turning agitation. Drives the ASCII jitter too. */
  get energy(): number {
    return Math.min(1, this.chaos + this.kick * WAVE_FX.kickGain);
  }

  /** Tuning distance, curved (0 = on target, 1 = far). `snap` skips the ease. */
  setDistance(norm: number, snap = false): void {
    this.distance = norm;
    if (snap) this.chaos = Math.max(WAVE_FX.chaos, norm);
  }

  /** 0 = invisible, 1 = full (scales the trace colours). */
  setFade(k: number): void {
    this.fade = k;
  }

  /** Continuous turning speed (frequency units/s, signed). */
  setMotion(speed: number): void {
    this.motion = speed;
  }

  /** An impulse (signed — a swipe later): agitation + a slide in its
   * direction, both decaying. Goes through the same easing, so no jump. */
  nudge(delta: number): void {
    const fx = WAVE_FX;
    this.impulse = Math.min(1, this.impulse + Math.abs(delta) * fx.kickPerUnit);
    this.scrollImpulse = Math.max(
      -fx.scrollMax,
      Math.min(fx.scrollMax, this.scrollImpulse + delta * fx.scrollPerUnit),
    );
  }

  update(dt: number, elapsed: number): void {
    const fx = WAVE_FX;
    this.chaos = ease(this.chaos, Math.max(fx.chaos, this.distance), fx.smooth, dt);

    this.impulse *= Math.exp(-fx.kickDecay * dt);
    this.scrollImpulse *= Math.exp(-fx.scrollDecay * dt);
    const kickTarget = Math.min(1, this.impulse + Math.abs(this.motion) * fx.motionKick);
    const rate = kickTarget > this.kick ? fx.attack : fx.release;
    this.kick = ease(this.kick, kickTarget, rate, dt);

    const scrollTarget = Math.max(
      -fx.scrollMax,
      Math.min(fx.scrollMax, this.motion * fx.motionScroll + this.scrollImpulse),
    );
    this.scrollVel = ease(this.scrollVel, scrollTarget, fx.scrollEase, dt);
    this.scroll += this.scrollVel * dt;

    const u = this.uniforms;
    const e = this.energy;
    u.uTime.value = elapsed;
    (u.uColorA.value as Color).copy(this.colorA).multiplyScalar(this.fade);
    (u.uColorB.value as Color).copy(this.colorB).multiplyScalar(this.fade);
    this.mesh.visible = this.fade > 0.001;
    u.uChaos.value = this.chaos;
    u.uKick.value = this.kick * fx.kickGain;
    u.uConverge.value = fx.converge;
    u.uDistort.value = fx.distort;
    u.uTear.value = fx.tear;
    u.uScroll.value = this.scroll;
    // Forming (fading in): the traces rise out of a flat line.
    const form = this.fade * this.fade * (3 - 2 * this.fade);
    u.uAmp.value = this.base.amp * (1 + e * (fx.farAmp - 1)) * (0.05 + 0.95 * form);
    u.uThickness.value = this.base.thickness * (1 + e * (fx.farThickness - 1));
    u.uFreq.value = this.base.freq * (1 + this.chaos * (fx.farFreq - 1));
  }

  /** Drawing-buffer size in device pixels. */
  setResolution(width: number, height: number): void {
    (this.uniforms.uResolution.value as Vector2).set(width, height);
  }

  setParam<K extends keyof WaveParams>(key: K, value: WaveParams[K]): void {
    if (key === "amp" || key === "thickness" || key === "freq") {
      // Applied by update(), scaled by the energy.
      this.base[key as keyof typeof this.base] = value as number;
      return;
    }
    const uniformKey = "u" + key.charAt(0).toUpperCase() + key.slice(1);
    const uniform = this.uniforms[uniformKey];
    if (!uniform) return;

    if (key === "colorA" || key === "colorB") {
      const c = value as { r: number; g: number; b: number };
      (key === "colorA" ? this.colorA : this.colorB).setRGB(c.r / 255, c.g / 255, c.b / 255);
    } else {
      uniform.value = value;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
