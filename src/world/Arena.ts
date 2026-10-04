import * as THREE from 'three';
import type { GameScene } from '@/core/GameScene';
import { addOutline, toonMaterial } from '@/render/toon';

/**
 * Placeholder arena so every sandbox has somewhere to stand.
 * Visuals owner builds the real zone arenas (same pattern: meshes + collision).
 */

function makeComicFloorTexture(): THREE.CanvasTexture {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4e6c8';
  g.fillRect(0, 0, size, size);

  // light halftone dots
  g.fillStyle = 'rgba(120,80,40,0.10)';
  for (let y = 0; y < size; y += 14) {
    for (let x = (y / 14) % 2 ? 7 : 0; x < size; x += 14) {
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
    }
  }

  // comic panel gutters
  g.strokeStyle = '#2a1a12';
  g.lineWidth = 12;
  g.lineJoin = 'round';
  const rects: [number, number, number, number][] = [
    [0, 0, 600, 380],
    [600, 0, 424, 380],
    [0, 380, 340, 644],
    [340, 380, 684, 300],
    [340, 680, 380, 344],
    [720, 680, 304, 344],
  ];
  for (const [x, y, w, h] of rects) g.strokeRect(x + 10, y + 10, w - 20, h - 20);

  // speed lines in one panel
  g.strokeStyle = 'rgba(42,26,18,0.25)';
  g.lineWidth = 3;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.beginPath();
    g.moveTo(530 + Math.cos(a) * 40, 530 + Math.sin(a) * 40);
    g.lineTo(530 + Math.cos(a) * 140, 530 + Math.sin(a) * 140);
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export interface ArenaOptions {
  radius?: number;
  pillars?: boolean;
}

export function buildPlaygroundArena(scene: GameScene, opts: ArenaOptions = {}) {
  const radius = opts.radius ?? 16;
  const root = new THREE.Group();
  root.name = 'arena';

  // floor
  const tex = makeComicFloorTexture();
  tex.repeat.set(radius / 3.5, radius / 3.5);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius + 8, 64), toonMaterial({ map: tex }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  // ring wall of standing comic panels
  const wallMat = toonMaterial({ color: '#efe0bd' });
  const frameMat = toonMaterial({ color: '#2a1a12' });
  const segments = 28;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const h = 2.2 + ((i * 7) % 5) * 0.45;
    const w = ((2 * Math.PI * (radius + 0.6)) / segments) * 0.92;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.35), wallMat);
    panel.position.set(Math.sin(a) * (radius + 0.6), h / 2, Math.cos(a) * (radius + 0.6));
    panel.rotation.y = a;
    panel.castShadow = panel.receiveShadow = true;
    addOutline(panel, 4);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.12, 0.38), frameMat);
    stripe.position.y = h / 2 - 0.35;
    panel.add(stripe);
    root.add(panel);
  }
  scene.collision.setCircularBounds(radius);

  if (opts.pillars !== false) {
    const pillarMat = toonMaterial({ color: '#d9b77a' });
    const capMat = toonMaterial({ color: '#b5462e' });
    const spots: [number, number][] = [
      [-7, -6],
      [7, -6],
      [-8, 6],
      [8, 5],
    ];
    for (const [x, z] of spots) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 3.4, 8), pillarMat);
      pillar.position.set(x, 1.7, z);
      pillar.castShadow = pillar.receiveShadow = true;
      addOutline(pillar, 4);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2, 0.35, 2), capMat);
      cap.position.y = 1.85;
      cap.castShadow = true;
      addOutline(cap, 4);
      pillar.add(cap);
      root.add(pillar);
      scene.collision.addCircle(x, z, 0.95);
    }
  }

  scene.three.add(root);
  return root;
}
