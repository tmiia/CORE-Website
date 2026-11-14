import { distanceNorm } from "./tuning";
import type { WaveLayer } from "./WaveLayer";

export type TunerPhase = "search" | "lock" | "detune";

/** Live-tunable (the debug pane edits this object). */
export const TUNER_FX = {
  enabled: true,
  // Installation frequency feedback (FREQ_FX): distance → chaos.
  tolerance: 0.5,
  reach: 40,
  curve: 0.5,
  // Search: a damped spring pulls the knob onto the target. Stiffness and
  // damping are re-rolled each search: damping < 1 overshoots then settles,
  // close to 1 creeps in.
  omegaMin: 0.9, // rad/s
  omegaMax: 1.4,
  dampingMin: 0.45,
  dampingMax: 0.9,
  lockSpeed: 0.4, // units/s: slow enough to count as settled
  // Lock: on target, one clean line.
  lockMin: 2, // s
  lockMax: 4,
  // Detune: pulled away (critically damped), then searching again from wherever
  // it got to — velocity carries over, so the turn-around is smooth.
  detuneMin: 20, // frequency units
  detuneMax: 40,
  detuneOmega: 1.8, // rad/s
  detuneSeconds: 1.8,
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randSign = () => (Math.random() < 0.5 ? -1 : 1);
const MAX_STEP = 1 / 120; // spring integration substep (s)

/**
 * Plays the installation's frequency gameplay on its own, continuously: a
 * virtual knob springs onto the target (sometimes overshooting), holds, then
 * gets pulled away, forever. Feeds the wave its distance (same curve as TV1)
 * and its turning speed (agitation + sideways slide).
 */
export class GhostTuner {
  /** Live readout for the debug pane. */
  readonly state = { phase: "search" as TunerPhase, distance: 0, speed: 0 };

  private offset: number; // current − target, frequency units
  private velocity = 0; // units/s
  private aim = 0; // where the spring pulls
  private omega = 1;
  private damping = 1;
  private phase: TunerPhase = "search";
  private timer = 0;

  constructor(
    private readonly wave: WaveLayer,
    start: "far" | "locked" = "far",
  ) {
    const fx = TUNER_FX;
    if (start === "locked") {
      this.offset = 0;
      this.enter("lock");
    } else {
      this.offset = randSign() * rand(fx.detuneMin, fx.detuneMax);
      this.enter("search");
    }
    this.wave.setDistance(this.norm(), true);
    this.syncState();
  }

  /** Jump straight to a detune (debug). */
  detuneNow(): void {
    this.enter("detune");
  }

  update(dt: number): void {
    if (!TUNER_FX.enabled) {
      this.wave.setDistance(0);
      this.wave.setMotion(0);
      return;
    }
    if (dt > 0) this.advance(dt);
    this.wave.setDistance(this.norm());
    this.wave.setMotion(this.velocity);
    this.syncState();
  }

  private advance(dt: number): void {
    const fx = TUNER_FX;
    for (let left = dt; left > 0; left -= MAX_STEP) this.integrate(Math.min(left, MAX_STEP));
    this.timer -= dt;

    switch (this.phase) {
      case "search":
        if (Math.abs(this.offset) <= fx.tolerance && Math.abs(this.velocity) < fx.lockSpeed) {
          this.enter("lock");
        }
        break;
      case "lock":
        if (this.timer <= 0) this.enter("detune");
        break;
      case "detune":
        if (this.timer <= 0) this.enter("search");
        break;
    }
  }

  /** Damped spring toward `aim` (semi-implicit Euler). */
  private integrate(h: number): void {
    const w = this.omega;
    const accel = w * w * (this.aim - this.offset) - 2 * this.damping * w * this.velocity;
    this.velocity += accel * h;
    this.offset += this.velocity * h;
  }

  private enter(phase: TunerPhase): void {
    const fx = TUNER_FX;
    this.phase = phase;

    switch (phase) {
      case "search":
        this.aim = 0;
        this.omega = rand(fx.omegaMin, fx.omegaMax);
        this.damping = rand(fx.dampingMin, fx.dampingMax);
        break;
      case "lock":
        // Keep the spring on the target so it stays put.
        this.aim = 0;
        this.timer = rand(fx.lockMin, fx.lockMax);
        break;
      case "detune":
        this.aim = this.offset + randSign() * rand(fx.detuneMin, fx.detuneMax);
        this.omega = fx.detuneOmega;
        this.damping = 1;
        this.timer = fx.detuneSeconds;
        break;
    }
  }

  private norm(): number {
    const fx = TUNER_FX;
    return distanceNorm(this.offset, 0, fx.tolerance, fx.reach, fx.curve);
  }

  private syncState(): void {
    this.state.phase = this.phase;
    this.state.distance = Math.round(Math.abs(this.offset) * 10) / 10;
    this.state.speed = Math.round(Math.abs(this.velocity) * 10) / 10;
  }
}
