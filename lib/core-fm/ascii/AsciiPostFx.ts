// Vendored from something.fm@7129c50 client/lib/ascii/AsciiPostFx.ts
import { BlendFunction, Effect } from "postprocessing";
import {
  Color,
  ColorRepresentation,
  Texture,
  Uniform,
  WebGLRenderer,
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

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tCharacters;
  uniform float uCharCount;
  uniform float uCellSize;
  uniform vec3 uColor;
  uniform vec3 uBgColor;
  uniform float uColorMode;
  uniform float uInvert;
  uniform float uContrast;
  uniform float uThreshold;
  uniform float uTime;
  uniform float uJitter;
  uniform float uJitterSpeed;
  uniform float uSpeedVariance;
  uniform float uBgFill;
  uniform float uBgFloor;
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

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 cellsCount = resolution / uCellSize;
    vec2 cellCoord = floor(uv * cellsCount);
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
    // between blurAt1 (quality 1) and blurAt0 (quality 0). Contiguous taps (no
    // skipped cells) up to a radius of 2.
    float deg = 1.0 - uQuality;
    vec2 cellUV = uCellSize / resolution;
    float blurCells = mix(uBlurAt1, uBlurAt0, deg);
    float spacing = blurCells * 0.5;
    vec3 sceneRgb = vec3(0.0);
    for (int dy = -2; dy <= 2; dy++) {
      for (int dx = -2; dx <= 2; dx++) {
        vec2 o = vec2(float(dx), float(dy)) * spacing * cellUV;
        sceneRgb += texture2D(inputBuffer, sampleUV + o).rgb;
      }
    }
    sceneRgb /= 25.0;
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

    // No-signal static — COVERAGE ramp: more cells fill in as uBgFill rises
    // (quantity, not opacity). Each filled cell becomes a full-bright glyph.
    // Added after the reveal so it stays fixed while the content reveals/hides.
    float speck = hash21(cellCoord * 1.927 + vec2(13.7, 9.2));
    if (speck < uBgFill) {
      float g = hash21(cellCoord * 3.71 + vec2(5.1, 2.3));
      lum = max(lum, g);
    }

    vec2 inCell = fract(uv * cellsCount);

    // Per-cell animated jitter (shared by the floor fill + the main glyph).
    float cellPhase = hash21(cellCoord * 0.731);
    float speedHash = hash21(cellCoord * 1.473 + vec2(7.31, 4.17));
    float speedMul = mix(1.0, speedHash * 2.0, uSpeedVariance);
    float bucket = floor(uTime * uJitterSpeed * speedMul + cellPhase * 17.0);
    float jit = hash21(cellCoord + vec2(bucket * 0.137, bucket * 0.911));
    float offset = (jit * 2.0 - 1.0) * uJitter;

    // Faint baseline fill — EVERY cell gets a non-empty random-density glyph at
    // opacity uBgFloor, drawn UNDER everything (independent of the coverage).
    vec3 col = uBgColor;
    if (uBgFloor > 0.001) {
      float gFloor = 0.15 + 0.85 * hash21(cellCoord * 3.71 + vec2(5.1, 2.3));
      float floorIdx = clamp(floor(gFloor * (uCharCount - 1.0) + offset + 0.5), 0.0, uCharCount - 1.0);
      vec2 floorUV = vec2((floorIdx + inCell.x) / uCharCount, inCell.y);
      col = mix(uBgColor, uColor, texture2D(tCharacters, floorUV).a * uBgFloor);
    }

    // Main glyph: content + no-signal coverage static, full strength, on top.
    if (lum >= 0.001) {
      float idxF = clamp(floor(lum * (uCharCount - 1.0) + offset + 0.5), 0.0, uCharCount - 1.0);
      vec2 atlasUV = vec2((idxF + inCell.x) / uCharCount, inCell.y);
      vec3 base = mix(uColor, sceneRgb, uColorMode);
      col = mix(col, base, texture2D(tCharacters, atlasUV).a);
    }

    outputColor = vec4(col, 1.0);
  }
`;

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

export class AsciiPostFx extends Effect {
  private config: ResolvedConfig;
  private atlasTexture: Texture;
  private elapsed = 0;
  private readonly defaultBlendFunction = this.blendMode.blendFunction;

  constructor(config: AsciiPostFxConfig = {}) {
    const merged: ResolvedConfig = { ...DEFAULTS, ...config };
    if (config.charCount === undefined && config.characters !== undefined) {
      merged.charCount = Array.from(config.characters).length;
    }

    // `colorMix` (continuous) is canonical for uColorMode; fall back to the
    // colorMode enum when only that was provided.
    const initColorMix =
      config.colorMix !== undefined
        ? merged.colorMix
        : merged.colorMode === "scene"
          ? 1
          : 0;
    merged.colorMix = initColorMix;
    const effCellSize =
      merged.cellSize *
      (merged.detailCoarseFactor +
        (1 - merged.detailCoarseFactor) * merged.detail);

    const atlas = buildAtlasFromConfig(merged);

    super("AsciiPostFx", FRAGMENT_SHADER, {
      uniforms: new Map<string, Uniform<unknown>>([
        ["tCharacters", new Uniform(atlas.texture)],
        ["uCharCount", new Uniform(atlas.count)],
        ["uCellSize", new Uniform(effCellSize)],
        ["uColor", new Uniform(new Color(merged.color))],
        ["uBgColor", new Uniform(new Color(merged.bgColor))],
        ["uColorMode", new Uniform(initColorMix)],
        ["uInvert", new Uniform(merged.invert ? 1 : 0)],
        ["uContrast", new Uniform(merged.contrast)],
        ["uThreshold", new Uniform(merged.threshold)],
        ["uBgFill", new Uniform(merged.bgFill)],
        ["uBgFloor", new Uniform(merged.bgFloor)],
        ["uQuality", new Uniform(merged.quality)],
        ["uBlurAt0", new Uniform(merged.blurAt0)],
        ["uBlurAt1", new Uniform(merged.blurAt1)],
        ["uNoiseAmp", new Uniform(merged.noiseAmp)],
        ["uWeight", new Uniform(merged.weight)],
        ["uWeightRange", new Uniform(merged.weightRange)],
        ["uTime", new Uniform(0)],
        ["uJitter", new Uniform(merged.jitter)],
        ["uJitterSpeed", new Uniform(merged.jitterSpeed)],
        ["uSpeedVariance", new Uniform(merged.speedVariance)],
        ["uRevealProgress", new Uniform(merged.revealProgress)],
        ["uRevealSkew", new Uniform(merged.revealSkew)],
        ["uRevealNoise", new Uniform(merged.revealNoise)],
        ["uRevealSoft", new Uniform(merged.revealSoft)],
        ["uStagger", new Uniform(merged.stagger)],
        ["uWarpX", new Uniform(merged.warpX)],
        ["uWarpXFreq", new Uniform(merged.warpXFreq)],
        ["uWarpY", new Uniform(merged.warpY)],
        ["uWarpYFreq", new Uniform(merged.warpYFreq)],
        ["uTear", new Uniform(merged.tear)],
        ["uTearRows", new Uniform(merged.tearRows)],
      ]),
    });

    this.config = merged;
    this.atlasTexture = atlas.texture;
  }

  override update(
    _renderer: WebGLRenderer,
    _inputBuffer: WebGLRenderTarget,
    deltaTime?: number,
  ) {
    this.elapsed += deltaTime ?? 0;
    this.uniforms.get("uTime")!.value = this.elapsed;
  }

  resetTime(elapsedSeconds = 0) {
    this.elapsed = elapsedSeconds;
    this.uniforms.get("uTime")!.value = this.elapsed;
  }

  set(partial: Partial<AsciiPostFxConfig>) {
    const needsRebuild = ATLAS_KEYS.some(
      (k) => k in partial && partial[k] !== this.config[k],
    );

    this.config = { ...this.config, ...partial };

    if (needsRebuild) {
      this.atlasTexture.dispose();
      const atlas = buildAtlasFromConfig(this.config);
      this.uniforms.get("tCharacters")!.value = atlas.texture;
      this.uniforms.get("uCharCount")!.value = atlas.count;
      this.atlasTexture = atlas.texture;
    }

    if (
      "cellSize" in partial ||
      "detail" in partial ||
      "detailCoarseFactor" in partial
    ) {
      const c = this.config;
      this.uniforms.get("uCellSize")!.value =
        c.cellSize *
        (c.detailCoarseFactor + (1 - c.detailCoarseFactor) * c.detail);
    }
    if ("color" in partial) {
      (this.uniforms.get("uColor")!.value as Color).set(this.config.color);
    }
    if ("bgColor" in partial) {
      (this.uniforms.get("uBgColor")!.value as Color).set(this.config.bgColor);
    }
    if ("colorMix" in partial) {
      this.uniforms.get("uColorMode")!.value = this.config.colorMix;
    }
    if ("colorMode" in partial) {
      const v = this.config.colorMode === "scene" ? 1 : 0;
      this.config.colorMix = v;
      this.uniforms.get("uColorMode")!.value = v;
    }
    if ("invert" in partial) {
      this.uniforms.get("uInvert")!.value = this.config.invert ? 1 : 0;
    }
    if ("contrast" in partial) {
      this.uniforms.get("uContrast")!.value = this.config.contrast;
    }
    if ("threshold" in partial) {
      this.uniforms.get("uThreshold")!.value = this.config.threshold;
    }
    if ("bgFill" in partial) {
      this.uniforms.get("uBgFill")!.value = this.config.bgFill;
    }
    if ("bgFloor" in partial) {
      this.uniforms.get("uBgFloor")!.value = this.config.bgFloor;
    }
    if ("quality" in partial) {
      this.uniforms.get("uQuality")!.value = this.config.quality;
    }
    if ("blurAt0" in partial) {
      this.uniforms.get("uBlurAt0")!.value = this.config.blurAt0;
    }
    if ("blurAt1" in partial) {
      this.uniforms.get("uBlurAt1")!.value = this.config.blurAt1;
    }
    if ("noiseAmp" in partial) {
      this.uniforms.get("uNoiseAmp")!.value = this.config.noiseAmp;
    }
    if ("weight" in partial) {
      this.uniforms.get("uWeight")!.value = this.config.weight;
    }
    if ("weightRange" in partial) {
      this.uniforms.get("uWeightRange")!.value = this.config.weightRange;
    }
    if ("jitter" in partial) {
      this.uniforms.get("uJitter")!.value = this.config.jitter;
    }
    if ("jitterSpeed" in partial) {
      this.uniforms.get("uJitterSpeed")!.value = this.config.jitterSpeed;
    }
    if ("speedVariance" in partial) {
      this.uniforms.get("uSpeedVariance")!.value = this.config.speedVariance;
    }
    if ("revealProgress" in partial) {
      this.uniforms.get("uRevealProgress")!.value = this.config.revealProgress;
    }
    if ("revealSkew" in partial) {
      this.uniforms.get("uRevealSkew")!.value = this.config.revealSkew;
    }
    if ("revealNoise" in partial) {
      this.uniforms.get("uRevealNoise")!.value = this.config.revealNoise;
    }
    if ("revealSoft" in partial) {
      this.uniforms.get("uRevealSoft")!.value = this.config.revealSoft;
    }
    if ("stagger" in partial) {
      this.uniforms.get("uStagger")!.value = this.config.stagger;
    }
    for (const [key, uniform] of WARP_UNIFORMS) {
      if (key in partial) this.uniforms.get(uniform)!.value = this.config[key];
    }
  }

  /** Bypass the effect (raw scene passes through) without removing the pass. */
  setEnabled(enabled: boolean) {
    this.blendMode.blendFunction = enabled
      ? this.defaultBlendFunction
      : BlendFunction.SKIP;
  }

  /** Fast path for animating the reveal each frame without the set() overhead. */
  setRevealProgress(p: number) {
    this.config.revealProgress = p;
    this.uniforms.get("uRevealProgress")!.value = p;
  }

  getConfig(): Readonly<ResolvedConfig> {
    return this.config;
  }

  dispose() {
    this.atlasTexture.dispose();
  }
}
