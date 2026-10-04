import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Entity } from '@/core/Entity';
import { AFTERIMAGE_FX } from './config';
import { fxDt } from './fxTime';

/**
 * A frozen, flat-coloured copy of a character's current pose that fades out: the ghost panels
 * a comic draws behind a fast move. Spawned a few times in a row during a dodge.
 */
export class DodgeAfterimage extends Entity {
  private age = 0;
  private mat: THREE.MeshBasicMaterial;
  private skeletons: THREE.Skeleton[] = [];

  constructor(source: THREE.Object3D, color: THREE.ColorRepresentation) {
    super();
    this.mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(1.6),
      transparent: true,
      opacity: AFTERIMAGE_FX.opacity,
      depthWrite: false,
      fog: false,
    });
    // SkeletonUtils.clone copies the bones in their CURRENT pose, and nothing animates the copy.
    const ghost = SkeletonUtils.clone(source);
    const outlines: THREE.Object3D[] = [];
    ghost.traverse((o) => {
      if (o.userData.isOutline) outlines.push(o);
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.material = this.mat;
      mesh.castShadow = mesh.receiveShadow = false;
      mesh.renderOrder = 2;
      if (mesh.isSkinnedMesh && !this.skeletons.includes(mesh.skeleton)) this.skeletons.push(mesh.skeleton);
    });
    outlines.forEach((o) => o.removeFromParent());
    source.updateWorldMatrix(true, false);
    source.matrixWorld.decompose(this.object.position, this.object.quaternion, this.object.scale);
    // the clone keeps the source's local transform; the entity root now carries the world one
    ghost.position.set(0, 0, 0);
    ghost.quaternion.identity();
    ghost.scale.set(1, 1, 1);
    this.object.add(ghost);
  }

  update(dt: number) {
    this.age += fxDt(dt);
    const k = this.age / AFTERIMAGE_FX.life;
    this.mat.opacity = AFTERIMAGE_FX.opacity * Math.max(0, 1 - k);
    if (k >= 1) this.destroy();
  }

  onRemoved() {
    this.mat.dispose();
    this.skeletons.forEach((s) => s.dispose()); // bone textures; geometry is shared with the hero
    // detach before GameScene's final geometry sweep so the hero's shared geometry is left alone
    this.object.clear();
  }
}
