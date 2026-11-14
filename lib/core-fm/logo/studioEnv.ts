import {
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";

/**
 * Procedural "chrome product shot" environment: HDR softbox strips on black,
 * prefiltered with PMREM. Black & white, no HDRI file to download. A chrome
 * surface is only what it reflects, so this *is* the look: crisp white streaks
 * sliding over a silver face as the logo moves.
 */
export function createStudioEnv(renderer: WebGLRenderer): WebGLRenderTarget {
  const scene = new Scene();
  scene.background = new Color(0x000000);
  const geometry = new PlaneGeometry(1, 1);
  const materials: MeshBasicMaterial[] = [];

  // [width, height, x, y, z, intensity] — the camera looks down −z, so a face
  // turned to it reflects what's at +z (behind the camera).
  // Classic chrome "horizon": bright sky band, dark gap, grey ground, and a thin
  // hot line in between — as the logo tilts, the face sweeps through them.
  const panels: [number, number, number, number, number, number][] = [
    [14, 3.2, 0, 3.4, 5, 2], // sky band, above the camera
    [14, 0.12, 0, 0.55, 6, 8], // hot horizon line
    [14, 2.4, 0, -2.6, 5, 0.3], // grey ground band, below
    [10, 6, 0, 0.5, 8, 0.06], // faint fill so the dark gap isn't dead black
    [0.6, 7, -2.6, 0, 4, 5], // tall strip, front-left
    [0.4, 7, 2.4, 0.3, 4.2, 4], // tall strip, front-right
    [9, 0.9, 0, 4.5, 1, 3], // overhead bar: top edges
    [7, 0.5, 0, -1, -5, 4], // back strip: rim on the edges
    [30, 30, 0, -6, 0, 0.03], // faint floor
  ];
  for (const [w, h, x, y, z, k] of panels) {
    const material = new MeshBasicMaterial({ color: new Color(k, k, k), side: DoubleSide });
    materials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.scale.set(w, h, 1);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  }

  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  geometry.dispose();
  materials.forEach((m) => m.dispose());
  return target;
}
