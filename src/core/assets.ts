import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Asset loading with caching. Files live in /public and are referenced by path:
 *   asset('models/hero.glb')  →  works in dev, GitHub Pages and itch.io
 */
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

const gltfLoader = new GLTFLoader();
const gltfCache = new Map<string, Promise<GLTF>>();
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, Promise<THREE.Texture>>();

export function loadGLTF(path: string): Promise<GLTF> {
  let p = gltfCache.get(path);
  if (!p) {
    p = gltfLoader.loadAsync(asset(path));
    gltfCache.set(path, p);
  }
  return p;
}

/** Load a model and return an independent copy (safe to use many times, supports skinned meshes). */
export async function loadModel(path: string): Promise<{ root: THREE.Object3D; animations: THREE.AnimationClip[] }> {
  const gltf = await loadGLTF(path);
  return { root: SkeletonUtils.clone(gltf.scene), animations: gltf.animations };
}

export function loadTexture(path: string, srgb = true): Promise<THREE.Texture> {
  let p = textureCache.get(path);
  if (!p) {
    p = textureLoader.loadAsync(asset(path)).then((t) => {
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
    textureCache.set(path, p);
  }
  return p;
}
