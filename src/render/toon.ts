import * as THREE from 'three';

/**
 * Comic look helpers:
 *  - toonMaterial(): flat banded shading (3 tones)
 *  - addOutline(): thick black ink outline around any mesh (constant pixel width)
 *  - toonify(): convert a loaded GLTF (or any object) to toon materials + outlines
 */

let gradientMap: THREE.DataTexture | null = null;

/** 3-band light ramp: shadow / mid / lit. */
export function getGradientMap(): THREE.DataTexture {
  if (gradientMap) return gradientMap;
  const tones = [70, 160, 255];
  const data = new Uint8Array(tones.length * 4);
  tones.forEach((t, i) => data.set([t, t, t, 255], i * 4));
  gradientMap = new THREE.DataTexture(data, tones.length, 1, THREE.RGBAFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

export interface ToonOptions {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
}

export function toonMaterial(opts: ToonOptions = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: opts.color ?? 0xffffff,
    map: opts.map ?? null,
    gradientMap: getGradientMap(),
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
}

// ── Outlines ────────────────────────────────────────────────────────────────

/** Shared resolution uniform so outlines stay the same pixel width on any screen. */
export const outlineResolution = { value: new THREE.Vector2(1920, 1080) };

const outlineMaterials = new Map<string, THREE.MeshBasicMaterial>();

/** Back-face "inverted hull" material pushed out in screen space. */
export function getOutlineMaterial(widthPx = 3, color: THREE.ColorRepresentation = 0x120c10): THREE.MeshBasicMaterial {
  const key = `${widthPx}|${new THREE.Color(color).getHexString()}`;
  let mat = outlineMaterials.get(key);
  if (mat) return mat;
  mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const width = { value: widthPx };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.outlineWidth = width;
    shader.uniforms.outlineResolution = outlineResolution;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float outlineWidth;\nuniform vec2 outlineResolution;\nvoid main() {')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_SKINNING
          vec3 olNormal = normalize(normalMatrix * objectNormal);
        #else
          vec3 olNormal = normalize(normalMatrix * normal);
        #endif
        vec2 olDir = (projectionMatrix * vec4(olNormal, 0.0)).xy;
        float olLen = length(olDir);
        if (olLen > 1e-5) {
          gl_Position.xy += (olDir / olLen) * (outlineWidth * 2.0 / outlineResolution) * gl_Position.w;
        }`,
      );
  };
  mat.customProgramCacheKey = () => `outline-${key}`;
  outlineMaterials.set(key, mat);
  return mat;
}

/** Add an ink outline to a single mesh (works for skinned meshes too). */
export function addOutline(mesh: THREE.Mesh, widthPx = 3, color?: THREE.ColorRepresentation): THREE.Mesh {
  const mat = getOutlineMaterial(widthPx, color);
  let outline: THREE.Mesh;
  if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
    const sm = mesh as THREE.SkinnedMesh;
    const o = new THREE.SkinnedMesh(sm.geometry, mat);
    o.bind(sm.skeleton, sm.bindMatrix);
    outline = o;
  } else {
    outline = new THREE.Mesh(mesh.geometry, mat);
  }
  outline.name = `${mesh.name}__outline`;
  outline.userData.isOutline = true;
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.frustumCulled = mesh.frustumCulled;
  outline.renderOrder = mesh.renderOrder - 1;
  mesh.add(outline);
  return outline;
}

export interface ToonifyOptions {
  outline?: boolean;
  outlineWidth?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Multiply every material colour by this (e.g. to tint enemies). */
  tint?: THREE.ColorRepresentation;
}

/** Convert every mesh under `root` to toon shading and give it an ink outline. */
export function toonify(root: THREE.Object3D, opts: ToonifyOptions = {}): void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !o.userData.isOutline) meshes.push(o as THREE.Mesh);
  });
  const tint = opts.tint !== undefined ? new THREE.Color(opts.tint) : null;
  for (const mesh of meshes) {
    const convert = (m: THREE.Material) => {
      const src = m as THREE.MeshStandardMaterial;
      const color = src.color ? src.color.clone() : new THREE.Color(0xffffff);
      if (tint) color.multiply(tint);
      const toon = toonMaterial({ color, map: src.map ?? null, emissive: src.emissive ?? 0x000000 });
      toon.name = src.name;
      m.dispose();
      return toon;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
    mesh.castShadow = opts.castShadow ?? true;
    mesh.receiveShadow = opts.receiveShadow ?? true;
    if (opts.outline !== false) addOutline(mesh, opts.outlineWidth ?? 3);
  }
}
