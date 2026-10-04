import * as THREE from 'three';
import { Entity } from '@/core/Entity';

/** A column of warm light marking where the hero leaves a zone. Rises in, then pulses. */
export class ExitMarker extends Entity {
  private t = 0;
  private beam: THREE.Mesh;
  private ring: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  private ringMat: THREE.MeshBasicMaterial;

  constructor() {
    super();
    // Values > 1 bloom
    this.beamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffd23a').multiplyScalar(2.5),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 7, 24, 1, true), this.beamMat);
    this.beam.position.y = 3.5;

    this.ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffd23a').multiplyScalar(3),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.75, 40), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.05;

    this.object.add(this.beam, this.ring);
  }

  update(dt: number) {
    this.t += dt > 0 ? dt : 1 / 60; // keeps pulsing during hit-stop
    const rise = Math.min(1, this.t / 0.8);
    const pulse = 0.5 + Math.sin(this.t * 3) * 0.5;
    this.beamMat.opacity = rise * (0.25 + pulse * 0.15);
    this.beam.scale.set(1, rise, 1);
    this.ringMat.opacity = rise * (0.6 + pulse * 0.4);
    this.ring.scale.setScalar(1 + pulse * 0.12);
    this.beam.rotation.y += dt * 0.6;
  }

  onRemoved() {
    this.beam.geometry.dispose();
    this.ring.geometry.dispose();
    this.beamMat.dispose();
    this.ringMat.dispose();
  }
}
