import {
  Box3,
  Color,
  Group,
  type Material,
  type Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  type PerspectiveCamera,
  Plane,
  type Texture,
  Vector3,
} from "three";
import { createGltfLoader } from "../gltfLoader";
import { stageCues } from "../stageCues";

export type LogoMode = "tilt" | "spin";

/** Live-tunable (the debug pane edits this object). */
export const LOGO_FX = {
  visible: true,
  ascii: false, // true = only the ASCII silhouette, no chrome
  mode: "tilt" as LogoMode,
  size: 0.62, // width, as a fraction of the viewport width…
  maxHeight: 0.28, // …capped to this fraction of the viewport height
  y: 0.02, // vertical offset, fraction of the viewport height (+ = up), landscape
  yPortrait: 0.12, // same on portrait screens: leaves room for the menu
  depth: 2.5, // extrusion thickness multiplier (the glb is only 5 % deep)
  // Tilt: slow figure-of-eight sway, the logo stays readable.
  tiltY: 0.42, // rad (~24°)
  tiltX: 0.14, // rad (~8°)
  tiltSpeed: 0.45, // rad/s
  // Spin: turntable.
  spinSpeed: 0.7, // rad/s
  // Chrome
  color: "#ffffff",
  metalness: 1,
  roughness: 0.08,
  envIntensity: 1.3,
  ghostLevel: 0.85, // ASCII silhouette brightness (→ glyph density)
  // Forge (the HOLD): the silhouette starts huge and settles into place.
  forgeScale: 2.4, // size at the start of the hold, × final size
  forgeShake: 0.012, // tremble at full hold, × logo width
  forgeSway: 0.3, // sway while forging, × tiltY/tiltX
  // Forged: the chrome sweeps in over the silhouette, left → right.
  sweep: 0.9, // s
  ghostOut: 0.5, // s: the silhouette fades once the chrome is complete
  // Light passing over the chrome as it appears (forged and shown): the
  // reflections start rotated round and slide back into place.
  lightFrom: -1.4, // rad
  lightSweep: 1.6, // s
  flash: 0.8, // s: glow spike decay (forged and shown)
  // Dissolve (hidden): the chrome fades and shrinks while its ASCII silhouette
  // flares up and sinks into the glyph field.
  hide: 1.4, // s
  outScale: 0.82, // final size, × start
  outGhost: 0.6, // silhouette flare, × ghostLevel
  // Shown (end of the intro): scale in + fade in + glow + light sweep.
  showIn: 1.0, // s: fade in
  showScale: 0.82, // starts at this size
  turn: 0.4, // rad: starts turned, eases into the sway
  settle: 1.8, // s: scale + turn settle
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x: number) => {
  const k = clamp01(x);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
const fadeIn = (t: number, at: number, dur: number) => clamp01((t - at) / Math.max(dur, 1e-3));

/** One copy of the logo: root (fit) → pivot (motion) → orient (stand up). */
class Rig {
  readonly root = new Group();
  readonly pivot = new Group();
  readonly orient = new Group();

  constructor(readonly material: Material) {
    // The curve is flat on the glTF XZ plane: stand it up facing +z.
    this.orient.rotation.x = Math.PI / 2;
    this.pivot.add(this.orient);
    this.root.add(this.pivot);
    this.root.visible = false;
  }

  attach(model: Object3D): void {
    model.traverse((obj) => {
      if ((obj as Mesh).isMesh) (obj as Mesh).material = this.material;
    });
    this.orient.add(model);
  }
}

type Phase = "hidden" | "forge" | "in" | "out";

/**
 * The CORE.FM logo (Blender curve, exported flat) as polished chrome. Two
 * copies share the geometry:
 *  - `chromeRoot` goes in the overlay scene (over the ASCII, stays sharp);
 *  - `asciiRoot` is a plain white silhouette in the wave scene, so it turns
 *    into glyphs — the "signal" the chrome comes from and goes back to.
 * Driven by stageCues.logo (forge / forged / shown / hidden, see LogoCue).
 */
export class LogoLayer {
  /** 0..1 glow spike when the chrome appears (read by the stage). */
  flash = 0;

  private readonly chrome: Rig;
  private readonly ghost: Rig;
  private readonly chromeMat: MeshStandardMaterial;
  private readonly ghostMat: MeshBasicMaterial;
  // Keeps x ≤ constant: the forged chrome sweeps in from the left.
  private readonly clip = new Plane(new Vector3(-1, 0, 0), 0);
  private aspect = 0.6; // logo height / width once loaded
  private width = 1; // fitted world width
  private baseY = 0; // fitted vertical position
  private phase: Phase = "hidden";
  private fromForge = false; // current "in" phase follows a forge
  private t = 0; // seconds into the current phase
  private scale = 1; // last applied scale factor
  private outFrom = { chrome: 0, ghost: 0, scale: 1 }; // levels when the dissolve started
  private time = 0; // sway clock
  private loaded = false;
  private disposed = false;

  constructor(envMap: Texture) {
    this.chromeMat = new MeshStandardMaterial({
      color: new Color(LOGO_FX.color),
      metalness: LOGO_FX.metalness,
      roughness: LOGO_FX.roughness,
      envMap,
      envMapIntensity: LOGO_FX.envIntensity,
      clippingPlanes: [this.clip],
    });
    this.ghostMat = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.chrome = new Rig(this.chromeMat);
    this.ghost = new Rig(this.ghostMat);
  }

  get chromeRoot(): Group {
    return this.chrome.root;
  }

  get asciiRoot(): Group {
    return this.ghost.root;
  }

  /** The silhouette is being forged by the hold. */
  get forging(): boolean {
    return this.phase === "forge";
  }

  async load(url: string, onProgress?: (p: number) => void): Promise<void> {
    const gltf = await createGltfLoader().loadAsync(url, (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
    });
    if (this.disposed) return;
    const model = gltf.scene;
    model.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const old = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      old.forEach((m: Material) => m.dispose());
    });

    // Centre, and normalise to a width of 1.
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    model.position.sub(center);
    const wrap = new Group();
    wrap.add(model);
    wrap.scale.setScalar(1 / size.x);
    this.aspect = size.z / size.x; // glTF z ends up as screen height

    this.chrome.attach(wrap);
    this.ghost.attach(wrap.clone()); // shares the geometry
    this.loaded = true;
  }

  /** Make both copies visible for one pass (shader precompile). */
  showAllForCompile(): void {
    this.chrome.root.visible = true;
    this.ghost.root.visible = true;
  }

  /** Restart the current reveal from the beginning (debug). */
  replay(): void {
    this.phase = "hidden";
    this.t = 0;
  }

  /** Fit to the viewport for a camera looking at the origin. */
  fit(camera: PerspectiveCamera): void {
    const fx = LOGO_FX;
    const dist = camera.position.length();
    const visH = 2 * dist * Math.tan((camera.fov * Math.PI) / 360);
    const visW = visH * camera.aspect;
    this.width = Math.min(fx.size * visW, (fx.maxHeight * visH) / this.aspect);
    this.baseY = (camera.aspect < 1 ? fx.yPortrait : fx.y) * visH;
  }

  update(dt: number, still = false): void {
    if (!this.loaded) return;
    const fx = LOGO_FX;
    this.applyLook();
    this.flash = Math.max(0, this.flash - dt / Math.max(fx.flash, 1e-3));

    // Cue → phase.
    const cue = fx.visible ? stageCues.logo : "hidden";
    if (cue === "forge" && this.phase !== "forge") {
      this.enter("forge", still);
    } else if (cue === "forged" && this.phase !== "in") {
      this.fromForge = true;
      this.enter("in", still);
    } else if (cue === "shown" && this.phase !== "in") {
      this.fromForge = false;
      this.enter("in", still);
    } else if (cue === "hidden" && (this.phase === "in" || this.phase === "forge")) {
      this.outFrom = {
        chrome: this.chrome.root.visible ? this.chromeMat.opacity : 0,
        ghost: this.ghostMat.opacity,
        scale: this.scale,
      };
      this.enter("out", still);
    }
    if (this.phase === "hidden") {
      this.setVisible(false);
      return;
    }
    this.t += dt;
    const t = this.t;

    // Levels for this frame.
    let ghost = 0;
    let sweep = 1; // 0 = chrome fully clipped, 1 = complete
    let chromeOpacity = 1;
    let turn = 0;
    let scale = 1;
    let sway = 1;
    let shake = 0;
    let light = 0; // env rotation offset (rad)

    if (this.phase === "forge") {
      const p = stageCues.forge;
      ghost = fx.ghostLevel * Math.min(1, p * 1.6);
      sweep = 0;
      scale = fx.forgeScale + (1 - fx.forgeScale) * easeInOut(p);
      sway = fx.forgeSway;
      shake = still ? 0 : fx.forgeShake * p;
    } else if (this.phase === "in") {
      light = fx.lightFrom * (1 - easeInOut(t / fx.lightSweep));
      if (this.fromForge) {
        // The silhouette is already there: the chrome sweeps over it at once.
        sweep = easeInOut(t / fx.sweep);
        ghost = fx.ghostLevel * (1 - fadeIn(t, fx.sweep, fx.ghostOut));
        sway = fx.forgeSway + (1 - fx.forgeSway) * easeOut(t / fx.settle);
      } else {
        chromeOpacity = easeOut(t / fx.showIn);
        scale = fx.showScale + (1 - fx.showScale) * easeOut(t / fx.settle);
        turn = fx.turn * (1 - easeOut(t / fx.settle));
      }
    } else {
      // Dissolve into the ASCII.
      const u = clamp01(t / Math.max(fx.hide, 1e-3));
      const from = this.outFrom;
      chromeOpacity = from.chrome * (1 - easeInOut(u));
      scale = from.scale * (1 + (fx.outScale - 1) * easeOut(u));
      ghost = Math.max(from.ghost * (1 - u), fx.outGhost * fx.ghostLevel * Math.sin(Math.PI * u));
      if (u >= 1) {
        this.phase = "hidden";
        this.setVisible(false);
        return;
      }
    }
    if (fx.ascii) {
      // Silhouette only: it stays, no chrome.
      ghost = Math.max(ghost, fx.ghostLevel * Math.min(sweep, chromeOpacity));
      chromeOpacity = 0;
    }
    this.scale = scale;

    // Chrome: clip sweep, light sweep, fades.
    const width = this.width * scale;
    const margin = 0.65 * width; // half width + room for the rotation
    this.clip.constant = -margin + 2 * margin * sweep;
    this.chromeMat.envMapRotation.set(0, light, 0);
    const fading = chromeOpacity < 1;
    if (this.chromeMat.transparent !== fading) {
      this.chromeMat.transparent = fading;
      this.chromeMat.needsUpdate = true;
    }
    this.chromeMat.opacity = chromeOpacity;
    this.chrome.root.visible = chromeOpacity > 0.001 && sweep > 0;
    this.ghostMat.opacity = ghost;
    this.ghost.root.visible = ghost > 0.001;

    // Motion, shared by both copies.
    let rx: number;
    let ry: number;
    if (still) {
      rx = 0.06; // reduced motion: a fixed three-quarter pose
      ry = 0.28;
    } else {
      this.time += dt;
      const s = this.time * fx.tiltSpeed;
      rx = (fx.mode === "spin" ? 0.5 : 1) * sway * fx.tiltX * Math.sin(s * 0.73 + 1.3);
      ry =
        fx.mode === "spin" && this.phase !== "forge"
          ? this.chrome.pivot.rotation.y + fx.spinSpeed * dt
          : sway * fx.tiltY * Math.sin(s) + turn;
    }
    const sx = shake * width * (Math.random() * 2 - 1);
    const sy = shake * width * (Math.random() * 2 - 1);
    for (const rig of [this.chrome, this.ghost]) {
      rig.pivot.rotation.set(rx, ry, 0);
      rig.root.scale.setScalar(width);
      rig.root.position.set(sx, this.baseY + sy, 0);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.chrome.root.traverse((obj) => (obj as Mesh).geometry?.dispose());
    this.chromeMat.dispose();
    this.ghostMat.dispose();
  }

  private enter(phase: Phase, still: boolean): void {
    this.phase = phase;
    // Reduced motion: jump to the end state.
    this.t = still ? 1e3 : 0;
    if (phase === "in" && !still) this.flash = 1;
  }

  /** Re-read LOGO_FX (debug pane) — cheap, called every frame. */
  private applyLook(): void {
    const fx = LOGO_FX;
    const m = this.chromeMat;
    m.color.set(fx.color);
    m.metalness = fx.metalness;
    m.roughness = fx.roughness;
    m.envMapIntensity = fx.envIntensity;
    // Local Y = thickness, before standing up.
    for (const rig of [this.chrome, this.ghost]) rig.orient.scale.set(1, fx.depth, 1);
  }

  private setVisible(v: boolean): void {
    this.chrome.root.visible = v;
    this.ghost.root.visible = v;
  }
}
