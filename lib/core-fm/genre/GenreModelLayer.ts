// Adapted from something.fm@7129c50 client/tv1/visuals/ModelLayer.ts: same
// lights + RoomEnvironment, turntable at 0.3 rad/s. Fitted into a DOM box
// (the genre page's hero) instead of the screen centre.
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  type Material,
  type Mesh,
  type MeshPhysicalMaterial,
  type MeshStandardMaterial,
  type Object3D,
  type PerspectiveCamera,
  PMREMGenerator,
  type Texture,
  Vector3,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createGltfLoader } from "../gltfLoader";

/** Live-tunable (the debug pane edits this object). */
export const GENRE_FX = {
  size: 0.9, // fraction of the hero box the model may fill
  spin: 0.3, // rad/s, as on the installation
  tilt: 0.22, // rad: turntable leaned toward the camera, the top reads better
  facing: 1, // turns an off-centre model to face the camera (0 = off)
  fadeIn: 1.4, // s: lights up into glyphs
  fadeOut: 0.45, // s
  light: 1, // × the installation's lights
  env: 1, // × environment reflections
  glitchIn: 0.12, // extra torn rows while it appears (ASCII tear)
  // ASCII on genre pages (TV1 MODEL_TONE), blended in with the page.
  detail: 0.8, // finer glyphs than the home (0.565): the model reads better
  contrast: 1,
  weight: [0.72, 0.4] as [number, number], // [LOW on target, LOW far]
  quality: [1, 0] as [number, number], // [HIGH on target, HIGH far]
  // EQ deformation at full distance (installation EQ_FX), fractions of the screen.
  warpX: 0.08, // LOW: slow horizontal wobble
  warpY: 0.06, // MID: vertical ripple
  tear: 0.12, // HIGH: rows torn sideways
  pageRate: 1.6, // /s: home (wave) ↔ genre page (model)
};

interface Loaded {
  root: Object3D;
  /** Footprint diagonal (turntable width) and height, normalised units. */
  width: number;
  height: number;
  materials: { m: MeshStandardMaterial; env: number }[];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * One genre model at a time, in the ASCII scene (it is drawn as glyphs).
 * Asking for another URL fades the current one out, then swaps; loaded models
 * are kept (going back and forth is instant). Fades by its light: dark = no
 * glyphs, so it "lights up" into the ASCII field.
 */
export class GenreModelLayer {
  readonly group = new Group();
  /** 0..1, how present the model is. */
  level = 0;
  /** 0..1, decays after the model appears (extra glitch). */
  glitch = 0;

  private readonly fitRoot = new Group(); // position + scale
  private readonly lean = new Group(); // facing + tilt
  private readonly spinner = new Group(); // turntable
  // Warm-up: loaded models drawn for one frame, sub-pixel, so their shaders
  // compile and their geometry + textures reach the GPU before they are shown.
  private readonly warmRoot = new Group();
  private warmFrames = 0;
  private readonly env: Texture;
  private readonly lights: { light: AmbientLight | DirectionalLight; base: number }[] = [];
  private readonly loader = createGltfLoader();
  private readonly requests = new Map<string, Promise<void>>();
  private readonly loaded = new Map<string, Loaded>();
  private current: { url: string; model: Loaded } | null = null;
  private spin = 0.7; // starts three-quarter
  private facingX = 0;
  private disposed = false;

  constructor(renderer: WebGLRenderer) {
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();

    const add = (light: AmbientLight | DirectionalLight) => {
      this.lights.push({ light, base: light.intensity });
      this.group.add(light);
    };
    add(new AmbientLight(0xffffff, 1.2));
    const key = new DirectionalLight(0xffffff, 3.0);
    key.position.set(3, 4, 5);
    const fill = new DirectionalLight(0xffffff, 1.2);
    fill.position.set(-3, -2, 2);
    // Rim/back light: separates a dark model from the black background.
    const rim = new DirectionalLight(0xffffff, 2.5);
    rim.position.set(-2, 3, -5);
    [key, fill, rim].forEach(add);

    this.lean.add(this.spinner);
    this.fitRoot.add(this.lean);
    this.fitRoot.visible = false;
    this.warmRoot.scale.setScalar(1e-4);
    // The lights always stay in the scene (at 0 when no model shows): the
    // light count is part of the shader, so warmed-up shaders stay valid.
    this.group.add(this.fitRoot, this.warmRoot);
  }

  /** Start loading (no-op if loading or loaded). */
  preload(url: string, onProgress?: (p: number) => void): Promise<void> {
    let req = this.requests.get(url);
    if (!req) {
      req = this.load(url, onProgress);
      this.requests.set(url, req);
    }
    return req;
  }

  /** Load several models; `onProgress` gets their mean progress (0..1). */
  async preloadAll(urls: string[], onProgress?: (p: number) => void): Promise<void> {
    const parts = urls.map(() => 0);
    const report = () => onProgress?.(parts.reduce((a, b) => a + b, 0) / Math.max(1, parts.length));
    await Promise.all(
      urls.map((url, i) =>
        this.preload(url, (p) => {
          parts[i] = p;
          report();
        }),
      ),
    );
    onProgress?.(1);
  }

  /**
   * Put every loaded model on stage (sub-pixel) for the next rendered frame,
   * then take them off. Call before the renderer's compile + a render.
   */
  warmUp(): void {
    for (const [url, model] of this.loaded) {
      if (this.current?.url !== url && !model.root.parent) this.warmRoot.add(model.root);
    }
    this.warmFrames = 2; // survives this frame's update, removed on the next
  }

  /**
   * Fit into `box` (CSS px, relative to the canvas) for a camera looking down
   * −z at the origin. Called every frame: the box scrolls with the page.
   */
  fit(camera: PerspectiveCamera, canvasW: number, canvasH: number, box: DOMRect): void {
    const model = this.current?.model;
    const dist = camera.position.z;
    const visH = 2 * dist * Math.tan((camera.fov * Math.PI) / 360);
    const px = visH / canvasH; // world units per CSS px at z = 0
    const cx = (box.left + box.width / 2 - canvasW / 2) * px;
    const cy = -(box.top + box.height / 2 - canvasH / 2) * px;

    // Seen from the screen centre, a model up in the hero shows its underside:
    // lean it toward the camera by the viewing angle.
    this.facingX = Math.atan2(cy, dist) * GENRE_FX.facing;
    const rx = this.facingX + GENRE_FX.tilt;
    this.lean.rotation.x = rx;
    if (!model) return;

    // Leaned turntable: its projected height grows with the footprint. And it
    // is big next to the camera distance, so its near side looks bigger:
    // fit extent·s·d / (d − w·s/2) ≤ box, i.e. s ≤ B·d / (extent·d + B·w/2).
    const w = model.width;
    const h = model.height * Math.cos(rx) + model.width * Math.abs(Math.sin(rx));
    const bw = box.width * px * GENRE_FX.size;
    const bh = box.height * px * GENRE_FX.size;
    const s = Math.min((bw * dist) / (w * dist + (bw * w) / 2), (bh * dist) / (h * dist + (bh * w) / 2));
    this.fitRoot.position.set(cx, cy, 0);
    this.fitRoot.scale.setScalar(Math.max(s, 1e-4));
  }

  /**
   * `want`: the model the page asks for (null = none). `onScreen`: its box is
   * in view (skip drawing it otherwise). `still`: reduced motion, no fades.
   */
  update(dt: number, want: string | null, onScreen: boolean, still: boolean): void {
    if (want) void this.preload(want);
    if (this.warmFrames > 0 && --this.warmFrames === 0) {
      for (const child of [...this.warmRoot.children]) this.warmRoot.remove(child);
    }

    // Swap once the current one has faded out (right away if none, or still).
    const swap = still || this.level <= 0.001 || !this.current;
    if (want !== (this.current?.url ?? null) && swap) {
      this.detach();
      const next = want ? this.loaded.get(want) : undefined;
      if (want && next) this.attach(want, next);
    }

    const shown = want !== null && this.current?.url === want;
    if (still) {
      this.level = shown ? 1 : 0;
      this.glitch = 0;
    } else {
      const dur = shown ? GENRE_FX.fadeIn : GENRE_FX.fadeOut;
      const step = dt / Math.max(dur, 1e-3);
      this.level = clamp01(this.level + (shown ? step : -step));
      this.glitch = Math.max(0, this.glitch - dt / Math.max(GENRE_FX.fadeIn, 1e-3));
      this.spin += GENRE_FX.spin * dt;
    }
    this.spinner.rotation.y = still ? 0.7 : this.spin;

    // Fade by light: an ease-in so it starts as a few bright glyphs.
    const k = this.level * this.level;
    for (const { light, base } of this.lights) light.intensity = base * GENRE_FX.light * k;
    for (const { m, env } of this.current?.model.materials ?? []) {
      m.envMapIntensity = env * GENRE_FX.env * k;
    }
    this.fitRoot.visible = !!this.current && this.level > 0.001 && onScreen;
  }

  dispose(): void {
    this.disposed = true;
    this.detach();
    for (const model of this.loaded.values()) disposeObject(model.root);
    this.loaded.clear();
    this.env.dispose();
  }

  private async load(url: string, onProgress?: (p: number) => void): Promise<void> {
    let gltf: GLTF;
    try {
      gltf = await this.loader.loadAsync(url, (e) => {
        if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
      });
    } catch (e) {
      console.warn(`[GenreModelLayer] failed to load ${url}`, e);
      return;
    }
    const scene = gltf.scene;
    onProgress?.(1);
    if (this.disposed) {
      disposeObject(scene);
      return;
    }

    // Centre, normalise to a height-or-footprint of 1.
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const footprint = Math.hypot(size.x, size.z);
    const unit = 1 / Math.max(footprint, size.y, 1e-6);
    scene.position.sub(center);
    const root = new Group();
    root.add(scene);
    root.scale.setScalar(unit);

    const materials: Loaded["materials"] = [];
    scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        const m = mat as MeshStandardMaterial;
        if (!("envMapIntensity" in m)) continue;
        fromSpecularGlossiness(gltf, m);
        // Transmission (the Ford's glass) makes three render the whole scene
        // a second time every frame; through ASCII it can't be seen anyway.
        const physical = m as MeshPhysicalMaterial;
        if (physical.isMeshPhysicalMaterial && physical.transmission > 0) physical.transmission = 0;
        m.envMap = this.env;
        materials.push({ m, env: m.envMapIntensity ?? 1 });
      }
    });
    this.loaded.set(url, { root, width: footprint * unit, height: size.y * unit, materials });
  }

  private attach(url: string, model: Loaded): void {
    this.current = { url, model };
    this.spinner.add(model.root);
    this.level = 0;
    this.glitch = 1;
  }

  private detach(): void {
    if (!this.current) return;
    this.spinner.remove(this.current.model.root);
    this.current = null;
    this.level = 0;
  }
}

/**
 * three dropped KHR_materials_pbrSpecularGlossiness (the paredão uses it): the
 * loader falls back to plain white metal, which saturates into a solid block
 * of glyphs. Approximate it: diffuse → colour, glossiness → 1 − roughness.
 */
function fromSpecularGlossiness(gltf: GLTF, m: MeshStandardMaterial): void {
  const index = gltf.parser.associations.get(m)?.materials;
  if (index === undefined) return;
  const def = (gltf.parser.json as { materials?: { extensions?: Record<string, unknown> }[] })
    .materials?.[index]?.extensions?.KHR_materials_pbrSpecularGlossiness as
    | { diffuseFactor?: number[]; glossinessFactor?: number }
    | undefined;
  if (!def) return;
  const [r = 1, g = 1, b = 1] = def.diffuseFactor ?? [];
  m.color.setRGB(r, g, b);
  m.metalness = 0;
  m.roughness = 1 - (def.glossinessFactor ?? 1);
}

function disposeObject(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats as Material[]) {
      // Its own textures (maps); the shared environment is disposed by the layer.
      for (const [key, value] of Object.entries(m)) {
        if (key !== "envMap" && value && typeof value === "object" && "isTexture" in value) {
          (value as Texture).dispose();
        }
      }
      m.dispose();
    }
  });
}
