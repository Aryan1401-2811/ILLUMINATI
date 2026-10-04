import * as THREE from 'three';

interface Circle {
  x: number;
  z: number;
  r: number;
}
interface Box {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/**
 * Simple flat (XZ-plane) collision for arenas: a circular or rectangular play area
 * plus round and box obstacles. Characters call resolve() after moving.
 * No physics engine needed for a brawler on flat ground.
 */
export class Collision {
  /** Circular play area. Set radius to Infinity for none. */
  boundsCenter = new THREE.Vector2(0, 0);
  boundsRadius = Infinity;
  private circles: Circle[] = [];
  private boxes: Box[] = [];

  setCircularBounds(radius: number, cx = 0, cz = 0) {
    this.boundsRadius = radius;
    this.boundsCenter.set(cx, cz);
  }

  addCircle(x: number, z: number, r: number): () => void {
    const c = { x, z, r };
    this.circles.push(c);
    return () => (this.circles = this.circles.filter((o) => o !== c));
  }

  addBox(cx: number, cz: number, width: number, depth: number): () => void {
    const b = { minX: cx - width / 2, maxX: cx + width / 2, minZ: cz - depth / 2, maxZ: cz + depth / 2 };
    this.boxes.push(b);
    return () => (this.boxes = this.boxes.filter((o) => o !== b));
  }

  clear() {
    this.circles = [];
    this.boxes = [];
    this.boundsRadius = Infinity;
  }

  /** Push `pos` (a body of `radius`) out of obstacles and back inside the bounds. Mutates pos. */
  resolve(pos: THREE.Vector3, radius: number): boolean {
    let hit = false;
    for (const c of this.circles) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const min = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 1e-4;
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
        hit = true;
      }
    }
    for (const b of this.boxes) {
      const nx = THREE.MathUtils.clamp(pos.x, b.minX, b.maxX);
      const nz = THREE.MathUtils.clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * radius;
          pos.z = nz + (dz / d) * radius;
        } else {
          // centre inside the box: push out along the shallowest axis
          const pushes = [pos.x - b.minX, b.maxX - pos.x, pos.z - b.minZ, b.maxZ - pos.z];
          const i = pushes.indexOf(Math.min(...pushes));
          if (i === 0) pos.x = b.minX - radius;
          else if (i === 1) pos.x = b.maxX + radius;
          else if (i === 2) pos.z = b.minZ - radius;
          else pos.z = b.maxZ + radius;
        }
        hit = true;
      }
    }
    if (this.boundsRadius !== Infinity) {
      const dx = pos.x - this.boundsCenter.x;
      const dz = pos.z - this.boundsCenter.y;
      const max = this.boundsRadius - radius;
      const d2 = dx * dx + dz * dz;
      if (d2 > max * max) {
        const d = Math.sqrt(d2);
        pos.x = this.boundsCenter.x + (dx / d) * max;
        pos.z = this.boundsCenter.y + (dz / d) * max;
        hit = true;
      }
    }
    return hit;
  }

  /** True if a point is inside an obstacle or outside the bounds (for projectiles). */
  blocked(pos: THREE.Vector3, radius = 0): boolean {
    const p = pos.clone();
    return this.resolve(p, radius);
  }
}
