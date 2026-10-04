import type * as THREE from 'three';

/**
 * Free a boss's GPU resources on removal. Loaded .glb models share their geometry with the
 * asset cache (every copy uses the same buffers), and outline materials are shared by
 * render/toon, so neither is disposed — only the per-instance materials and anything
 * built in code.
 */
export function disposeBossVisuals(root: THREE.Object3D): void {
  const walk = (o: THREE.Object3D, inModel: boolean) => {
    const model = inModel || o.userData.sharedGeometry === true;
    const mesh = o as THREE.Mesh;
    if (!o.userData.isOutline) {
      if (mesh.geometry && !model) mesh.geometry.dispose();
      const mat = mesh.material;
      if (mat) for (const m of Array.isArray(mat) ? mat : [mat]) m.dispose();
    }
    for (const c of o.children) walk(c, model);
  };
  walk(root, false);
}

/** Mark a loaded model root so disposeBossVisuals() leaves its shared geometry alone. */
export function markSharedGeometry(root: THREE.Object3D): void {
  root.userData.sharedGeometry = true;
}
