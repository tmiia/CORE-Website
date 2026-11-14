// Equalizer gameplay of something.fm@7129c50 (client/tv1/transition/ModelControls.ts,
// EQ_FX in client/tv1/visuals/tuningFx.ts), played by a ghost hand. No three:
// the genre page's HUD ticks it, the WebGL stage reads `deform`.
import { distanceNorm, ease } from "../wave/tuning";

export type Band = "high" | "mid" | "low";
export const BANDS: Band[] = ["high", "mid", "low"];
export type EqValues = Record<Band, number>;
export type EqPhase = "tune" | "pause" | "lock" | "detune";

/** Pot range, as on the installation (server/config.ts EQUALIZER). */
const RANGE = { min: 0, max: 10 };

/** Live-tunable (the debug pane edits this object). */
export const EQ_FX = {
  enabled: true,
  // Installation EQ feedback: distance → deformation, and each turn kicks it.
  curve: 0.6,
  kickPerUnit: 0.5, // per pot unit turned
  kickDecay: 4, // per second
  kickGain: 0.7,
  smooth: 6, // per second
  // The ghost hand turns one pot at a time onto its target (a damped spring,
  // re-rolled each time: some overshoot, some creep in), and stops somewhere
  // inside the tolerance, like a visitor would.
  omegaMin: 2.2, // rad/s
  omegaMax: 3.4,
  dampingMin: 0.45,
  dampingMax: 0.85,
  settleSpeed: 0.25, // units/s: slow enough to let go of the pot
  pauseMin: 0.25, // s between two pots
  pauseMax: 0.8,
  lockMin: 2.5, // s: all three on target
  lockMax: 4.5,
  // Detune: one to three pots knocked off together, then tuned back.
  detuneMin: 2.5, // pot units off the target
  detuneMax: 6,
  detuneOmega: 3.5, // rad/s, critically damped
  detuneSeconds: 1.1,
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clampPot = (v: number) => Math.min(RANGE.max, Math.max(RANGE.min, v));
const zero = (): EqValues => ({ high: 0, mid: 0, low: 0 });
const MAX_STEP = 1 / 120; // spring integration substep (s)

interface Pot {
  value: number;
  velocity: number;
  aim: number;
  omega: number;
  damping: number;
  moving: boolean;
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The equalizer step, playing itself: tune → (pause → tune)… → lock → detune →
 * tune… forever. Each band owns one deformation of the model, scaled by its
 * distance to the target (0 = in tolerance = clean), as on TV1:
 *   LOW → horizontal wobble + ink weight, MID → vertical ripple,
 *   HIGH → torn rows + blur/noise.
 */
export class GhostEq {
  /** Pot positions (0–10), for the HUD. */
  readonly values: EqValues;
  /** Per-band deformation 0..1 (distance + kick), for the stage. */
  readonly deform = zero();
  phase: EqPhase = "tune";
  /** The pot being turned (tune phase). */
  active: Band | null = null;

  private readonly pots: Record<Band, Pot>;
  private readonly dist = zero();
  private readonly kick = zero();
  private queue: Band[] = [];
  private timer = 0;

  constructor(
    private readonly target: EqValues,
    private readonly tolerance: number,
    start: "far" | "locked" = "far",
  ) {
    const pot = (b: Band): Pot => {
      const t = target[b];
      let value = t;
      if (start === "far") {
        // Somewhere clearly off: away from the target, inside the range.
        const off = rand(tolerance + 1.5, tolerance + 5);
        value = clampPot(t + (t + off <= RANGE.max && Math.random() < 0.5 ? off : -off));
        if (Math.abs(value - t) <= tolerance) value = clampPot(t + off);
      }
      return { value, velocity: 0, aim: value, omega: 1, damping: 1, moving: false };
    };
    this.pots = { high: pot("high"), mid: pot("mid"), low: pot("low") };
    this.values = { high: 0, mid: 0, low: 0 };
    for (const b of BANDS) {
      this.values[b] = this.pots[b].value;
      this.dist[b] = this.distanceOf(b);
    }
    if (start === "locked") this.enter("lock");
    else this.startTuning();
    this.computeDeform();
  }

  /** Mean deformation 0..1: drives the ASCII flicker. */
  get energy(): number {
    return (this.deform.high + this.deform.mid + this.deform.low) / 3;
  }

  /** Knock it off now (debug). */
  detuneNow(): void {
    this.enter("detune");
  }

  update(dt: number): void {
    if (dt <= 0) return;
    const fx = EQ_FX;
    if (fx.enabled) {
      for (let left = dt; left > 0; left -= MAX_STEP) this.integrate(Math.min(left, MAX_STEP));
      this.advance(dt);
    }
    for (const b of BANDS) {
      this.dist[b] = ease(this.dist[b], fx.enabled ? this.distanceOf(b) : 0, fx.smooth, dt);
      this.kick[b] *= Math.exp(-fx.kickDecay * dt);
    }
    this.computeDeform();
  }

  private advance(dt: number): void {
    const fx = EQ_FX;
    this.timer -= dt;
    switch (this.phase) {
      case "tune": {
        const b = this.active;
        if (!b) {
          this.enter("lock");
          break;
        }
        const p = this.pots[b];
        const onTarget = Math.abs(p.value - this.target[b]) <= this.tolerance;
        if (onTarget && Math.abs(p.velocity) < fx.settleSpeed) {
          p.moving = false; // let go of the pot
          p.velocity = 0;
          this.queue.shift();
          this.active = null;
          if (this.queue.length) this.enter("pause");
          else this.enter("lock");
        }
        break;
      }
      case "pause":
        if (this.timer <= 0) this.turnNext();
        break;
      case "lock":
        if (this.timer <= 0) this.enter("detune");
        break;
      case "detune":
        if (this.timer <= 0) {
          for (const b of BANDS) {
            this.pots[b].moving = false;
            this.pots[b].velocity = 0;
          }
          this.startTuning();
        }
        break;
    }
  }

  /** Damped spring toward `aim` (semi-implicit Euler), moving pots only. */
  private integrate(h: number): void {
    const fx = EQ_FX;
    for (const b of BANDS) {
      const p = this.pots[b];
      if (!p.moving) continue;
      const w = p.omega;
      const accel = w * w * (p.aim - p.value) - 2 * p.damping * w * p.velocity;
      p.velocity += accel * h;
      const next = clampPot(p.value + p.velocity * h);
      if (next !== p.value + p.velocity * h) p.velocity = 0; // hit the end stop
      // Each turn kicks its own band, as on TV1.
      this.kick[b] = Math.min(1, this.kick[b] + Math.abs(next - p.value) * fx.kickPerUnit);
      p.value = next;
      this.values[b] = next;
    }
  }

  private startTuning(): void {
    this.queue = shuffle(
      BANDS.filter((b) => Math.abs(this.pots[b].value - this.target[b]) > this.tolerance),
    );
    if (this.queue.length) this.turnNext();
    else this.enter("lock");
  }

  private turnNext(): void {
    const fx = EQ_FX;
    const b = this.queue[0];
    if (!b) {
      this.enter("lock");
      return;
    }
    this.phase = "tune";
    this.active = b;
    const p = this.pots[b];
    // Lands somewhere inside the tolerance, not dead on the target.
    p.aim = clampPot(this.target[b] + rand(-0.6, 0.6) * this.tolerance);
    p.omega = rand(fx.omegaMin, fx.omegaMax);
    p.damping = rand(fx.dampingMin, fx.dampingMax);
    p.moving = true;
  }

  private enter(phase: EqPhase): void {
    const fx = EQ_FX;
    this.phase = phase;
    this.active = null;
    switch (phase) {
      case "pause":
        this.timer = rand(fx.pauseMin, fx.pauseMax);
        break;
      case "lock":
        this.timer = rand(fx.lockMin, fx.lockMax);
        break;
      case "detune": {
        const count = 1 + Math.floor(Math.random() * BANDS.length);
        for (const b of shuffle(BANDS).slice(0, count)) {
          const p = this.pots[b];
          const t = this.target[b];
          const off = rand(fx.detuneMin, fx.detuneMax);
          let aim = clampPot(t + (Math.random() < 0.5 ? off : -off));
          if (Math.abs(aim - t) <= this.tolerance + 1) aim = clampPot(t + (aim > t ? -off : off));
          p.aim = aim;
          p.omega = fx.detuneOmega;
          p.damping = 1;
          p.moving = true;
        }
        this.timer = fx.detuneSeconds;
        break;
      }
      case "tune":
        break;
    }
  }

  private distanceOf(b: Band): number {
    const t = this.target[b];
    const reach = Math.max(t - RANGE.min, RANGE.max - t) - this.tolerance;
    return distanceNorm(this.pots[b].value, t, this.tolerance, reach, EQ_FX.curve);
  }

  private computeDeform(): void {
    for (const b of BANDS) {
      this.deform[b] = Math.min(1, this.dist[b] + this.kick[b] * EQ_FX.kickGain);
    }
  }
}
