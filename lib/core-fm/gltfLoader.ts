import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * GLTFLoader for the site's models. They are optimised by
 * `npm run models` (scripts/optimize-models.sh): meshopt-compressed geometry
 * (needs this decoder, a small inline WASM) and WebP textures (read natively).
 * Uncompressed files load too.
 */
export function createGltfLoader(): GLTFLoader {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}
