// Vendored from something.fm@7129c50 client/lib/ascii/AsciiPostFx.ts.
//
// Site change (mobile performance): the effect is split in two. A per-CELL
// pass does all the work (scene sampling, blur, tone, noise, reveal, static,
// jitter) once per glyph cell and writes the two glyph indices into a small
// texture (one texel per cell); the full-resolution pass then only draws the
// glyphs (two atlas lookups per pixel). Same maths, same per-cell hashes, same
// look — the heavy part runs a few thousand times per frame instead of once
// per screen pixel. The scene comes from setSceneTexture() (the stage renders
// it at a low resolution), not from the composer's input buffer.
// colorMode "scene" is not supported by the split (the site is monochrome).
import { Effect } from "postprocessing";
import {
  Color,
  type ColorRepresentation,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  type Texture,
  Uniform,
  Vector2,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { buildAtlas, type FillMode } from "./charAtlas";

export type { FillMode };

export type ColorMode = "monochrome" | "scene";

export interface AsciiPostFxConfig {
  cellSize?: number;
  characters?: string;
  charCount?: number;
  fillMode?: FillMode;
  fontFamily?: string;
  bold?: boolean;
  atlasCellPixelSize?: number;

  colorMode?: ColorMode;
  color?: ColorRepresentation;
  bgColor?: ColorRepresentation;

  invert?: boolean;
  contrast?: number;
  threshold?: number;
  bgFill?: number; // no-signal static: fraction of cells filled (coverage 0..1)
  bgFloor?: number; // faint full-coverage background fill, as an opacity (0..1)

  // Macro "progress" controls
  quality?: number; // 1 = clean/sharp, 0 = blurry + noisy
  colorMix?: number; // 0 = monochrome, 1 = scene colour (continuous uColorMode)
  detail?: number; // 1 = base cell size, 0 = coarse blocks
  weight?: number; // 0.5 = neutral ink, >0.5 heavier, <0.5 sparser

  // Shaping for the macros (the "look" each progress ramps toward)
  blurAt0?: number; // blur radius in cells at quality 0
  blurAt1?: number; // blur radius in cells at quality 1
  noiseAmp?: number; // luma noise amplitude at quality 0
  weightRange?: number; // gamma range for weight
  detailCoarseFactor?: number; // cellSize multiplier at detail 0

  jitter?: number;
  jitterSpeed?: number;
  speedVariance?: number;

  // Screen-space warp of the sampled scene (the glyph grid stays fixed).
  // Amplitudes are fractions of the screen; 0 = off.
  warpX?: number; // horizontal sine wobble
  warpXFreq?: number; // waves over the screen height
  warpY?: number; // vertical sine ripple
  warpYFreq?: number; // waves over the screen width
  tear?: number; // random rows shoved sideways
  tearRows?: number; // band count over the height

  // Reveal animation (diagonal sweep + per-cell stagger)
  revealProgress?: number; // 0 = hidden, 1 = fully revealed
  revealSkew?: number; // 0 = top→bottom, 1 = right→left, 0.5 = diagonal
  revealNoise?: number; // irregularity of the reveal front
  revealSoft?: number; // softness of the band edge
  stagger?: number; // per-cell random delay spread
}

const DEFAULT_CHARS =
  " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;-+*=#@%&";

type ResolvedConfig = Required<AsciiPostFxConfig>;

const DEFAULTS: ResolvedConfig = {
  cellSize: 7,
  characters: DEFAULT_CHARS,
  charCount: DEFAULT_CHARS.length,
  fillMode: "characters",
  fontFamily: "monospace",
  bold: true,
  atlasCellPixelSize: 64,
  colorMode: "monochrome",
  color: 0xffffff,
  bgColor: 0x000000,
  invert: false,
  contrast: 1,
  threshold: 0,
  bgFill: 0,
  bgFloor: 0,
  quality: 1,
  colorMix: 0,
  detail: 1,
  weight: 0.5,
  blurAt0: 2,
  blurAt1: 0,
  noiseAmp: 0.4,
  weightRange: 2.5,
  detailCoarseFactor: 3,
  jitter: 0,
  jitterSpeed: 0,
  speedVariance: 0,
  warpX: 0,
  warpXFreq: 1.5,
  warpY: 0,
  warpYFreq: 3,
  tear: 0,
  tearRows: 40,
  revealProgress: 1,
  revealSkew: 0.5,
  revealNoise: 0.1,
  revealSoft: 0.05,
  stagger: 0,
};

const ATLAS_KEYS: ReadonlyArray<keyof AsciiPostFxConfig> = [
  "characters",
  "charCount",
  "fillMode",
  "fontFamily",
  "bold",
  "atlasCellPixelSize",
];

const WARP_UNIFORMS: ReadonlyArray<[keyof AsciiPostFxConfig & keyof ResolvedConfig, string]> = [
  ["warpX", "uWarpX"],
  ["warpXFreq", "uWarpXFreq"],
  ["warpY", "uWarpY"],
  ["warpYFreq", "uWarpYFreq"],
  ["tear", "uTear"],
  ["tearRows", "uTearRows"],
];


const CELL_VERTEX = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * One fragment per glyph cell (gl_FragCoord = cell coordinates). Everything
 * the original effect computed per pixel but that only depends on the cell.
 * Output: R = main glyph index + 1 (0 = none), G = floor glyph index, /255.
 */
const CELL_FRAGMENT = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 uResolution;
  uniform float uCellSize;
  uniform float uCharCount;
  uniform float uInvert;
  uniform float uContrast;
  uniform float uThreshold;
  uniform float uTime;
  uniform float uJitter;
  uniform float uJitterSpeed;
  uniform float uSpeedVariance;
  uniform float uBgFill;
  uniform float uQuality;
  uniform float uBlurAt0;
  uniform float uBlurAt1;
  uniform float uNoiseAmp;
  uniform float uWeight;
  uniform float uWeightRange;
  uniform float uRevealProgress;
  uniform float uRevealSkew;
  uniform float uRevealNoise;
  uniform float uRevealSoft;
  uniform float uStagger;
  uniform float uWarpX;
  uniform float uWarpXFreq;
  uniform float uWarpY;
  uniform float uWarpYFreq;
  uniform float uTear;
  uniform float uTearRows;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 78.233);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 cellCoord = floor(gl_FragCoord.xy);
    vec2 cellsCount = uResolution / uCellSize;
    if (cellCoord.x >= cellsCount.x || cellCoord.y >= cellsCount.y) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec2 cellCenterUV = (cellCoord + 0.5) / cellsCount;

    // Warp: displaces WHERE each cell samples the scene, so the content bends
    // in whole-cell steps while the glyph grid itself stays put.
    vec2 sampleUV = cellCenterUV;
    if (uWarpX + uWarpY + uTear > 0.0001) {
      sampleUV.x += uWarpX * sin(cellCenterUV.y * 6.2831853 * uWarpXFreq + uTime * 1.3);
      sampleUV.y += uWarpY * sin(cellCenterUV.x * 6.2831853 * uWarpYFreq + uTime * 1.9);
      float row = floor(cellCenterUV.y * uTearRows);
      float tb = floor(uTime * 12.0);
      float torn = step(0.5, hash21(vec2(row * 1.7, tb + 3.1)));
      sampleUV.x += uTear * (hash21(vec2(row, tb)) * 2.0 - 1.0) * torn;
    }

    // Quality blur: 5x5 box over neighbouring cell centres. Radius interpolates
    // between blurAt1 (quality 1) and blurAt0 (quality 0). At radius 0 every
    // tap is the same point: sample once.
    float deg = 1.0 - uQuality;
    vec2 cellUV = uCellSize / uResolution;
    float blurCells = mix(uBlurAt1, uBlurAt0, deg);
    vec3 sceneRgb;
    if (blurCells < 0.001) {
      sceneRgb = texture2D(tScene, sampleUV).rgb;
    } else {
      float spacing = blurCells * 0.5;
      sceneRgb = vec3(0.0);
      for (int dy = -2; dy <= 2; dy++) {
        for (int dx = -2; dx <= 2; dx++) {
          vec2 o = vec2(float(dx), float(dy)) * spacing * cellUV;
          sceneRgb += texture2D(tScene, sampleUV + o).rgb;
        }
      }
      sceneRgb /= 25.0;
    }
    float lum = dot(sceneRgb, vec3(0.2126, 0.7152, 0.0722));

    lum = clamp((lum - 0.5) * uContrast + 0.5, 0.0, 1.0);
    lum = mix(lum, 1.0 - lum, uInvert);
    lum = smoothstep(uThreshold, 1.0, lum);

    // Weight: gamma on luminance. 0.5 neutral, >0.5 heavier ink, <0.5 sparser.
    lum = pow(lum, exp2((0.5 - uWeight) * uWeightRange));

    // Quality random degradation: animated luma noise, gated to lit cells only
    // so the background never fills in.
    float tBucket = floor(uTime * 8.0);
    float qn = hash21(cellCoord * 2.17 + vec2(tBucket * 0.37, tBucket * 0.71));
    lum += (qn - 0.5) * uNoiseAmp * deg * step(0.001, lum);

    lum = clamp(lum, 0.0, 1.0);

    // Reveal dissolves the CONTENT only (diagonal sweep + per-cell stagger).
    float diag = mix(cellCenterUV.y, 1.0 - cellCenterUV.x, uRevealSkew);
    diag += (hash21(cellCoord * 1.93) - 0.5) * uRevealNoise; // irregular front
    diag += hash21(cellCoord * 0.71) * uStagger; // staggered cascade
    float span = 1.0 + uRevealNoise + uStagger + 2.0 * uRevealSoft;
    float front = uRevealProgress * span - uRevealSoft - 0.5 * uRevealNoise;
    float reveal = smoothstep(diag - uRevealSoft, diag + uRevealSoft, front);
    lum *= reveal;

    // No-signal static: more cells fill in as uBgFill rises.
    float speck = hash21(cellCoord * 1.927 + vec2(13.7, 9.2));
    if (speck < uBgFill) {
      float g = hash21(cellCoord * 3.71 + vec2(5.1, 2.3));
      lum = max(lum, g);
    }

    // Per-cell animated jitter (shared by the floor fill + the main glyph).
    float cellPhase = hash21(cellCoord * 0.731);
    float speedHash = hash21(cellCoord * 1.473 + vec2(7.31, 4.17));
    float speedMul = mix(1.0, speedHash * 2.0, uSpeedVariance);
    float bucket = floor(uTime * uJitterSpeed * speedMul + cellPhase * 17.0);
    float jit = hash21(cellCoord + vec2(bucket * 0.137, bucket * 0.911));
    float offset = (jit * 2.0 - 1.0) * uJitter;

    // Faint baseline fill glyph (drawn at uBgFloor opacity by the glyph pass).
    float gFloor = 0.15 + 0.85 * hash21(cellCoord * 3.71 + vec2(5.1, 2.3));
    float floorIdx = clamp(floor(gFloor * (uCharCount - 1.0) + offset + 0.5), 0.0, uCharCount - 1.0);

    // Main glyph: content + no-signal static. 0 = empty cell.
    float mainIdx = 0.0;
    if (lum >= 0.001) {
      mainIdx = clamp(floor(lum * (uCharCount - 1.0) + offset + 0.5), 0.0, uCharCount - 1.0) + 1.0;
    }

    gl_FragColor = vec4(mainIdx / 255.0, floorIdx / 255.0, 0.0, 1.0);
  }
`;

/** Full resolution: find the pixel's cell, draw its glyphs. */
const GLYPH_FRAGMENT = /* glsl */ `
  uniform sampler2D tCells;
  uniform vec2 uCellTexSize;
  uniform sampler2D tCharacters;
  uniform sampler2D tScene;
  uniform float uCharCount;
  uniform float uCellSize;
  uniform vec3 uColor;
  uniform vec3 uBgColor;
  uniform float uBgFloor;
  uniform float uBypass;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (uBypass > 0.5) {
      outputColor = vec4(texture2D(tScene, uv).rgb, 1.0);
      return;
    }
    vec2 cellPos = uv * (resolution / uCellSize);
    vec2 cellCoord = floor(cellPos);
    vec2 inCell = fract(cellPos);
    vec2 cell = texture2D(tCells, (cellCoord + 0.5) / uCellTexSize).rg * 255.0;

    vec3 col = uBgColor;
    if (uBgFloor > 0.001) {
      float floorIdx = floor(cell.g + 0.5);
      vec2 floorUV = vec2((floorIdx + inCell.x) / uCharCount, inCell.y);
      col = mix(uBgColor, uColor, texture2D(tCharacters, floorUV).a * uBgFloor);
    }
    float mainIdx = floor(cell.r + 0.5);
    if (mainIdx > 0.5) {
      vec2 atlasUV = vec2((mainIdx - 1.0 + inCell.x) / uCharCount, inCell.y);
      col = mix(col, uColor, texture2D(tCharacters, atlasUV).a);
    }
    outputColor = vec4(col, 1.0);
  }
`;

// Scalar config keys → uniform names (shared by both passes where needed).
const SCALAR_UNIFORMS: ReadonlyArray<[keyof ResolvedConfig, string]> = [
  ["contrast", "uContrast"],
  ["threshold", "uThreshold"],
  ["bgFill", "uBgFill"],
  ["bgFloor", "uBgFloor"],
  ["quality", "uQuality"],
  ["blurAt0", "uBlurAt0"],
  ["blurAt1", "uBlurAt1"],
  ["noiseAmp", "uNoiseAmp"],
  ["weight", "uWeight"],
  ["weightRange", "uWeightRange"],
  ["jitter", "uJitter"],
  ["jitterSpeed", "uJitterSpeed"],
  ["speedVariance", "uSpeedVariance"],
  ["revealProgress", "uRevealProgress"],
  ["revealSkew", "uRevealSkew"],
  ["revealNoise", "uRevealNoise"],
  ["revealSoft", "uRevealSoft"],
  ["stagger", "uStagger"],
  ...WARP_UNIFORMS,
];

const CELL_ONLY = [
  "tScene",
  "uResolution",
  "uInvert",
  "uContrast",
  "uThreshold",
  "uTime",
  "uJitter",
  "uJitterSpeed",
  "uSpeedVariance",
  "uBgFill",
  "uQuality",
  "uBlurAt0",
  "uBlurAt1",
  "uNoiseAmp",
  "uWeight",
  "uWeightRange",
  "uRevealProgress",
  "uRevealSkew",
  "uRevealNoise",
  "uRevealSoft",
  "uStagger",
  "uWarpX",
  "uWarpXFreq",
  "uWarpY",
  "uWarpYFreq",
  "uTear",
  "uTearRows",
];
const SHARED = ["uCellSize", "uCharCount"];
const GLYPH_ONLY = [
  "tCells",
  "uCellTexSize",
  "tCharacters",
  "tScene",
  "uColor",
  "uBgColor",
  "uBgFloor",
  "uBypass",
];

function buildAtlasFromConfig(cfg: ResolvedConfig) {
  return buildAtlas({
    characters: cfg.characters,
    charCount: cfg.charCount,
    fillMode: cfg.fillMode,
    cellPixelSize: cfg.atlasCellPixelSize,
    fontFamily: cfg.fontFamily,
    bold: cfg.bold,
  });
}

const effectiveCellSize = (c: ResolvedConfig) =>
  c.cellSize * (c.detailCoarseFactor + (1 - c.detailCoarseFactor) * c.detail);

export class AsciiPostFx extends Effect {
  private config: ResolvedConfig;
  private atlasTexture: Texture;
  private elapsed = 0;
  // One Uniform object per name, shared by the cell material and the effect.
  private readonly u: Record<string, Uniform<unknown>>;
  private readonly cellTarget: WebGLRenderTarget;
  private readonly cellMaterial: ShaderMaterial;
  private readonly cellQuad: Mesh;
  private readonly cellScene = new Scene();
  private readonly cellCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private width = 1;
  private height = 1;

  constructor(config: AsciiPostFxConfig = {}) {
    const merged: ResolvedConfig = { ...DEFAULTS, ...config };
    if (config.charCount === undefined && config.characters !== undefined) {
      merged.charCount = Array.from(config.characters).length;
    }
    merged.colorMix = config.colorMix ?? (merged.colorMode === "scene" ? 1 : 0);

    const atlas = buildAtlasFromConfig(merged);
    const cellTarget = new WebGLRenderTarget(2, 2, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: false,
      generateMipmaps: false,
    });

    const u: Record<string, Uniform<unknown>> = {
      tScene: new Uniform<Texture | null>(null),
      tCells: new Uniform(cellTarget.texture),
      uCellTexSize: new Uniform(new Vector2(2, 2)),
      uResolution: new Uniform(new Vector2(1, 1)),
      tCharacters: new Uniform(atlas.texture),
      uCharCount: new Uniform(atlas.count),
      uCellSize: new Uniform(effectiveCellSize(merged)),
      uColor: new Uniform(new Color(merged.color)),
      uBgColor: new Uniform(new Color(merged.bgColor)),
      uInvert: new Uniform(merged.invert ? 1 : 0),
      uTime: new Uniform(0),
      uBypass: new Uniform(0),
    };
    for (const [key, name] of SCALAR_UNIFORMS) u[name] = new Uniform(merged[key]);

    const pick = (names: string[]) => new Map(names.map((n) => [n, u[n]]));
    super("AsciiPostFx", GLYPH_FRAGMENT, { uniforms: pick([...SHARED, ...GLYPH_ONLY]) });

    this.u = u;
    this.config = merged;
    this.atlasTexture = atlas.texture;
    this.cellTarget = cellTarget;
    this.cellMaterial = new ShaderMaterial({
      uniforms: Object.fromEntries([...SHARED, ...CELL_ONLY].map((n) => [n, u[n]])),
      vertexShader: CELL_VERTEX,
      fragmentShader: CELL_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.cellQuad = new Mesh(new PlaneGeometry(2, 2), this.cellMaterial);
    this.cellQuad.frustumCulled = false;
    this.cellScene.add(this.cellQuad);
  }

  /** The scene to turn into glyphs (rendered by the stage, any resolution). */
  setSceneTexture(texture: Texture | null) {
    this.u.tScene.value = texture;
  }

  override setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    (this.u.uResolution.value as Vector2).set(width, height);
    this.fitCellTarget();
  }

  override update(renderer: WebGLRenderer, _inputBuffer: WebGLRenderTarget, deltaTime?: number) {
    this.elapsed += deltaTime ?? 0;
    this.u.uTime.value = this.elapsed;
    if (this.u.uBypass.value) return;
    // The per-cell pass; EffectPass then sets its own target and draws glyphs.
    renderer.setRenderTarget(this.cellTarget);
    renderer.render(this.cellScene, this.cellCamera);
  }

  resetTime(elapsedSeconds = 0) {
    this.elapsed = elapsedSeconds;
    this.u.uTime.value = this.elapsed;
  }

  set(partial: Partial<AsciiPostFxConfig>) {
    const needsRebuild = ATLAS_KEYS.some((k) => k in partial && partial[k] !== this.config[k]);

    this.config = { ...this.config, ...partial };
    const c = this.config;

    if (needsRebuild) {
      this.atlasTexture.dispose();
      const atlas = buildAtlasFromConfig(c);
      this.u.tCharacters.value = atlas.texture;
      this.u.uCharCount.value = atlas.count;
      this.atlasTexture = atlas.texture;
    }
    if ("cellSize" in partial || "detail" in partial || "detailCoarseFactor" in partial) {
      this.u.uCellSize.value = effectiveCellSize(c);
      if ("cellSize" in partial || "detailCoarseFactor" in partial) this.fitCellTarget();
    }
    if ("color" in partial) (this.u.uColor.value as Color).set(c.color);
    if ("bgColor" in partial) (this.u.uBgColor.value as Color).set(c.bgColor);
    if ("colorMode" in partial) c.colorMix = c.colorMode === "scene" ? 1 : 0;
    if ("invert" in partial) this.u.uInvert.value = c.invert ? 1 : 0;
    for (const [key, name] of SCALAR_UNIFORMS) {
      if (key in partial) this.u[name].value = c[key];
    }
  }

  /** Bypass (debug): show the raw scene instead of glyphs. */
  setEnabled(enabled: boolean) {
    this.u.uBypass.value = enabled ? 0 : 1;
  }

  /** Fast path for animating the reveal each frame without the set() overhead. */
  setRevealProgress(p: number) {
    this.config.revealProgress = p;
    this.u.uRevealProgress.value = p;
  }

  getConfig(): Readonly<ResolvedConfig> {
    return this.config;
  }

  dispose() {
    this.atlasTexture.dispose();
    this.cellTarget.dispose();
    this.cellMaterial.dispose();
    this.cellQuad.geometry.dispose();
  }

  /**
   * One texel per cell, sized for the finest grid the config allows (detail 1),
   * so easing `detail` never reallocates it.
   */
  private fitCellTarget() {
    const c = this.config;
    const finest = Math.max(1, c.cellSize * Math.min(1, c.detailCoarseFactor));
    const cols = Math.ceil(this.width / finest) + 1;
    const rows = Math.ceil(this.height / finest) + 1;
    const size = this.u.uCellTexSize.value as Vector2;
    if (size.x === cols && size.y === rows) return;
    this.cellTarget.setSize(cols, rows);
    size.set(cols, rows);
  }
}
