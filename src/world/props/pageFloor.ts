import * as THREE from 'three';
import { toonMaterial } from '@/render/toon';
import type { ZoneKit } from './ZoneKit';
import { canvasTexture, comicText } from './canvas';

export interface FloorRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * The ground of an arena, painted as part of a comic page. `draw` works directly in WORLD
 * METRES (x → right, z → down the canvas), so floor art lines up with props and collision:
 *
 *   pageFloor(kit, { minX: -24, maxX: 24, minZ: -10, maxZ: 20 }, 42, (g) => {
 *     g.fillStyle = '#f3c877'; g.fillRect(-18, -3.6, 36, 7.2);   // a road, in metres
 *   });
 *
 * A huge plain sheet of the same paper lies just underneath so the page never visibly ends.
 */
export function pageFloor(kit: ZoneKit, rect: FloorRect, pxPerMetre: number, draw: (g: CanvasRenderingContext2D) => void, paper = '#fbf1dc'): THREE.Mesh {
  const w = rect.maxX - rect.minX;
  const d = rect.maxZ - rect.minZ;
  const tex = kit.track(
    canvasTexture(Math.round(w * pxPerMetre), Math.round(d * pxPerMetre), (g, cw, ch) => {
      g.fillStyle = paper;
      g.fillRect(0, 0, cw, ch);
      g.setTransform(cw / w, 0, 0, ch / d, (-rect.minX * cw) / w, (-rect.minZ * ch) / d);
      draw(g);
    }),
  );
  const floor = kit.plane(tex, (rect.minX + rect.maxX) / 2, 0, (rect.minZ + rect.maxZ) / 2, w, d, { flat: true, lit: true });
  floor.name = 'page-floor';

  const sheetMat = kit.track(toonMaterial({ color: paper }));
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), sheetMat);
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.y = -0.04;
  sheet.receiveShadow = true;
  sheet.name = 'page-sheet';
  kit.root.add(sheet);
  return floor;
}

/** Comic lettering on the floor, sized in metres. */
export function floorText(g: CanvasRenderingContext2D, text: string, x: number, z: number, metres: number, fill: string, opts: Parameters<typeof comicText>[6] = {}) {
  const k = 64; // draw at 64 px per metre of letter height, then scale down: keeps fonts crisp
  g.save();
  g.translate(x, z);
  g.scale(metres / k, metres / k);
  comicText(g, text, 0, 0, k, fill, opts);
  g.restore();
}

/** Halftone dots over a floor rectangle, in metres. */
export function floorDots(g: CanvasRenderingContext2D, x: number, z: number, w: number, d: number, color: string, step = 0.3, radius = 0.075, fade: 'none' | 'north' | 'south' | 'east' | 'west' = 'none') {
  g.save();
  g.beginPath();
  g.rect(x, z, w, d);
  g.clip();
  g.fillStyle = color;
  let row = 0;
  for (let pz = z; pz < z + d + step; pz += step * 0.866, row++) {
    for (let px = x + (row % 2 ? step / 2 : 0); px < x + w + step; px += step) {
      let k = 1;
      if (fade === 'south') k = 1 - (pz - z) / d;
      else if (fade === 'north') k = (pz - z) / d;
      else if (fade === 'east') k = 1 - (px - x) / w;
      else if (fade === 'west') k = (px - x) / w;
      const r = radius * Math.max(0, Math.min(1, k));
      if (r < 0.008) continue;
      g.beginPath();
      g.arc(px, pz, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

/** An ink panel border (rectangle outline) on the floor, in metres. */
export function floorFrame(g: CanvasRenderingContext2D, x: number, z: number, w: number, d: number, line = 0.22, color = '#1a1013') {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = line;
  g.lineJoin = 'miter';
  g.strokeRect(x, z, w, d);
  g.restore();
}
