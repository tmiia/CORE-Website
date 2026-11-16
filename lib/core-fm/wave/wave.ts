// Vendored from something.fm@7129c50 client/tv1/visuals/wave.ts
import { noiseGLSL } from "./noise";

export const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Oscilloscope: N independent horizontal sine traces. Each layer has its own
// frequency / amplitude / phase / speed (no shared spiral winding, no z-axis
// depth) — flat glowing lines crossing the screen like a scope readout.
//
// Tuning feedback (uChaos = distance to the target, uKick = a recent turn):
// far away the traces split apart, get noisy and tear sideways; on target they
// converge into one clean reference sine. uScroll slides everything in the
// turning direction.
export const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uLayers;
  uniform float uFreq;        // base spatial frequency (arcs across width)
  uniform float uFreqVar;     // per-layer frequency spread
  uniform float uAmp;         // base vertical amplitude
  uniform float uAmpVar;      // per-layer amplitude spread
  uniform float uSpeed;       // master tempo (scales translate + amplitude)
  uniform float uSpeedVar;    // per-layer speed spread (desyncs the layers)
  uniform float uTransSpeed;  // horizontal translation rate
  uniform float uAmpSpeed;    // amplitude breathing rate
  uniform float uAmpMod;      // amplitude breathing depth (0 = static)
  uniform float uPhaseSpread; // per-layer phase offset
  uniform float uThickness;
  uniform float uGlow;
  uniform float uZoom;
  uniform vec2 uResolution;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  uniform float uChaos;    // 0 on target .. 1 farthest (eased)
  uniform float uKick;     // extra chaos from a recent turn (decays)
  uniform float uConverge; // 1 = layers merge into the reference line on target
  uniform float uDistort;  // noise displacement at full chaos
  uniform float uTear;     // horizontal tearing at full chaos
  uniform float uScroll;   // horizontal offset driven by the turning direction

  #define PI 3.14159265
  #define TAU 6.28318530

  // Per-layer pseudo-random so each trace is independent.
  float hash(float n) { return fract(sin(n * 43758.5453123) * 1.7654321); }

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 78.233);
    return fract(p.x * p.y);
  }

  ${noiseGLSL}

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    float aspect = uResolution.x / uResolution.y;
    float energy = uChaos + uKick;

    // Tearing: some horizontal bands slide sideways, re-rolled ~10x per second.
    // Kept to the far zone so the approach reads as the picture settling.
    float tearAmt = uTear * smoothstep(0.3, 1.0, energy);
    float band = floor(uv.y * 24.0);
    float tb = floor(uTime * 10.0);
    float torn = step(0.55, hash21(vec2(band, tb + 11.0)));
    float xOff = (hash21(vec2(band * 1.7, tb)) - 0.5) * 2.0 * tearAmt * torn;

    float x = (uv.x - 0.5) * aspect / uZoom + xOff - uScroll;
    float y = (uv.y - 0.5) / uZoom;

    // Reference trace: what every layer collapses onto when converged.
    float refTx  = uTime * uSpeed * uTransSpeed;
    float refOsc = 1.0 + uAmpMod * sin(uTime * uSpeed * uAmpSpeed);
    float refY   = uAmp * refOsc * sin(x * uFreq + refTx);
    float spread = mix(1.0 - uConverge, 1.0, clamp(energy, 0.0, 1.0));
    float distort = uDistort * energy;

    vec3 color = vec3(0.0);

    int layers = int(uLayers);
    for (int i = 0; i < 20; i++) {
      if (i >= layers) break;

      float fi = float(i);
      float t = (uLayers > 1.0) ? fi / (uLayers - 1.0) : 0.5;

      float r1 = hash(fi + 1.0);
      float r2 = hash(fi + 7.3);
      float r3 = hash(fi + 13.7);

      // Independent parameters per trace.
      float freq  = uFreq  * (1.0 + (r1 - 0.5) * 2.0 * uFreqVar);
      float amp   = uAmp   * (1.0 + (r2 - 0.5) * 2.0 * uAmpVar);
      float vary  = 1.0 + (r3 - 0.5) * 2.0 * uSpeedVar; // per-layer desync
      float phase = t * PI * uPhaseSpread + r1 * TAU;

      // Two independent time drives, both scaled by the master uSpeed:
      //   tx   → slides the trace horizontally
      //   aOsc → makes its amplitude breathe in and out
      float tx   = uTime * uSpeed * uTransSpeed * vary;
      float aOsc = 1.0 + uAmpMod * sin(uTime * uSpeed * uAmpSpeed + phase);

      float lineY = amp * aOsc * sin(x * freq + tx + phase);
      lineY = mix(refY, lineY, spread);

      if (distort > 0.0005) {
        float n = snoise(vec2(x * 1.6 + fi * 5.3, uTime * 0.9 + fi * 2.1))
                + 0.5 * snoise(vec2(x * 6.5 - fi * 3.1, uTime * 2.4 + fi));
        lineY += n * distort;
      }

      float dist = abs(y - lineY);
      float line = uThickness / dist;
      line = pow(line, uGlow);

      color += line * mix(uColorA, uColorB, t);
    }

    color = 1.0 - exp(-color * 1.5);

    gl_FragColor = vec4(color, 1.0);
  }
`;
