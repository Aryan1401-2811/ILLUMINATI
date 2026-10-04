import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GameScene } from '@/core/GameScene';
import { getOutlineMaterial, toonMaterial } from '@/render/toon';

export interface PieceOptions {
  /** Yaw in radians. */
  rotY?: number;
  /** Extra tilt (radians) applied before the yaw. */
  rotX?: number;
  rotZ?: number;
  /** Ink outline around this piece (default true). Turn off for small details. */
  outline?: boolean;
  /** Casts a shadow (default false: only big props should, see the performance budget). */
  shadow?: boolean;
}

interface Piece {
  geo: THREE.BufferGeometry;
  outline: boolean;
  shadow: boolean;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();

/**
 * Builds an arena out of simple coloured shapes and then MERGES them, so a whole street of
 * buildings, lamps and crates costs a handful of draw calls instead of hundreds:
 *
 *   const kit = new ZoneKit(scene, 'zone1');
 *   kit.box(0, 0, -8, 6, 5, 4, '#ffd27a', { shadow: true });   // x, y(bottom), z, w, h, d
 *   kit.cyl(3, 0, 2, 0.2, 0.2, 3, '#2a1a12');
 *   kit.collideBox(0, -8, 6, 4);
 *   kit.finish();                                              // adds everything to the scene
 *
 * Colours are stored per vertex, so every solid piece shares ONE toon material. The ink outline
 * is a second merged mesh with smoothed normals (hard-edged boxes would otherwise get gaps).
 */
export class ZoneKit {
  readonly root = new THREE.Group();
  private pieces: Piece[] = [];
  private glowPieces: THREE.BufferGeometry[] = [];
  private disposables: { dispose(): void }[] = [];
  private finished = false;

  constructor(
    readonly scene: GameScene,
    name: string,
    /** Ink outline width in pixels for everything in this zone. */
    private outlineWidth = 3,
  ) {
    this.root.name = name;
  }

  // ── solid, lit, vertex-coloured shapes ───────────────────────────────────

  /** Any geometry, placed with a matrix. The kit takes ownership of `geo`. */
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, matrix: THREE.Matrix4, opts: PieceOptions = {}) {
    const g = prepare(geo, matrix, _c.set(color));
    this.pieces.push({ geo: g, outline: opts.outline ?? true, shadow: opts.shadow ?? false });
  }

  /** Box whose BOTTOM centre is at (x, y, z). */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: THREE.ColorRepresentation, opts: PieceOptions = {}) {
    this.add(new THREE.BoxGeometry(w, h, d), color, place(x, y + h / 2, z, opts), opts);
  }

  /** Upright cylinder / cone / prism whose BOTTOM centre is at (x, y, z). */
  cyl(x: number, y: number, z: number, rTop: number, rBottom: number, h: number, color: THREE.ColorRepresentation, opts: PieceOptions & { segments?: number } = {}) {
    this.add(new THREE.CylinderGeometry(rTop, rBottom, h, opts.segments ?? 12), color, place(x, y + h / 2, z, opts), opts);
  }

  /** Sphere (or squashed blob) centred at (x, y, z). */
  ball(x: number, y: number, z: number, r: number, color: THREE.ColorRepresentation, opts: PieceOptions & { squash?: [number, number, number] } = {}) {
    const m = place(x, y, z, opts);
    if (opts.squash) m.scale(_p.set(...opts.squash));
    this.add(new THREE.SphereGeometry(r, 12, 9), color, m, opts);
  }

  // ── unlit glowing shapes (lamps, energy, chained gold) ───────────────────

  /** A glowing blob. `intensity` above 1 blooms. Never outlined, never shadowed. */
  glow(x: number, y: number, z: number, r: number, color: THREE.ColorRepresentation, intensity = 3, squash?: [number, number, number]) {
    const m = place(x, y, z, {});
    if (squash) m.scale(_p.set(...squash));
    this.glowPieces.push(prepare(new THREE.SphereGeometry(r, 10, 8), m, _c.set(color).multiplyScalar(intensity)));
  }

  /** A glowing box (neon strips, lit windows, runes). */
  glowBox(x: number, y: number, z: number, w: number, h: number, d: number, color: THREE.ColorRepresentation, intensity = 3, opts: PieceOptions = {}) {
    this.glowPieces.push(prepare(new THREE.BoxGeometry(w, h, d), place(x, y + h / 2, z, opts), _c.set(color).multiplyScalar(intensity)));
  }

  // ── textured flats (floors, signs, backdrops) ────────────────────────────

  /**
   * A textured rectangle. `lit` ones take toon shading and shadows (floors); unlit ones show the
   * texture exactly as drawn (signs, posters). Returns the mesh so it can be animated.
   */
  plane(
    texture: THREE.Texture,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    opts: { flat?: boolean; rotY?: number; lit?: boolean; transparent?: boolean; renderOrder?: number; brightness?: number; alphaTest?: number } = {},
  ): THREE.Mesh {
    const lit = opts.lit ?? false;
    const mat = lit
      ? toonMaterial({ map: texture, transparent: opts.transparent })
      : new THREE.MeshBasicMaterial({ map: texture, transparent: opts.transparent ?? false });
    if (!lit && opts.brightness !== undefined) (mat as THREE.MeshBasicMaterial).color.setScalar(opts.brightness);
    if (opts.transparent) mat.depthWrite = false;
    if (opts.alphaTest) mat.alphaTest = opts.alphaTest; // hard cut-out (torn paper), still writes depth
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    if (opts.flat) mesh.rotation.x = -Math.PI / 2;
    if (opts.rotY) mesh.rotation[opts.flat ? 'z' : 'y'] = opts.rotY;
    mesh.receiveShadow = lit;
    mesh.renderOrder = opts.renderOrder ?? 0;
    this.root.add(mesh);
    this.disposables.push(mat);
    return mesh;
  }

  /** Keep something to dispose when the scene unloads (canvas textures, custom materials). */
  track<T extends { dispose(): void }>(thing: T): T {
    this.disposables.push(thing);
    return thing;
  }

  // ── collision ────────────────────────────────────────────────────────────

  collideBox(cx: number, cz: number, width: number, depth: number) {
    this.scene.collision.addBox(cx, cz, width, depth);
  }

  collideCircle(x: number, z: number, r: number) {
    this.scene.collision.addCircle(x, z, r);
  }

  /** Four thick invisible walls around a rectangular play area (thick so a dodge never tunnels). */
  rectBounds(minX: number, maxX: number, minZ: number, maxZ: number, thickness = 6) {
    const w = maxX - minX + thickness * 2;
    const d = maxZ - minZ + thickness * 2;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    this.collideBox(cx, minZ - thickness / 2, w, thickness);
    this.collideBox(cx, maxZ + thickness / 2, w, thickness);
    this.collideBox(minX - thickness / 2, cz, thickness, d);
    this.collideBox(maxX + thickness / 2, cz, thickness, d);
  }

  // ── build ────────────────────────────────────────────────────────────────

  /** Merge everything and add it to the scene. Call once, last. */
  finish(): THREE.Group {
    if (this.finished) return this.root;
    this.finished = true;

    const solidMat = toonMaterial({ color: 0xffffff });
    solidMat.vertexColors = true;
    this.disposables.push(solidMat);
    for (const shadow of [true, false]) {
      const group = this.pieces.filter((p) => p.shadow === shadow);
      if (!group.length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(group.map((p) => p.geo))!, solidMat);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      mesh.name = shadow ? 'solids-shadow' : 'solids';
      this.root.add(mesh);
    }

    const outlined = this.pieces.filter((p) => p.outline).map((p) => smoothNormalCopy(p.geo));
    if (outlined.length) {
      const outline = new THREE.Mesh(mergeGeometries(outlined)!, getOutlineMaterial(this.outlineWidth));
      outline.userData.isOutline = true;
      outline.name = 'solids-outline';
      this.root.add(outline);
      outlined.forEach((g) => g.dispose());
    }
    this.pieces.forEach((p) => p.geo.dispose());
    this.pieces = [];

    if (this.glowPieces.length) {
      const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
      this.disposables.push(glowMat);
      const glow = new THREE.Mesh(mergeGeometries(this.glowPieces)!, glowMat);
      glow.name = 'glows';
      this.root.add(glow);
      this.glowPieces.forEach((g) => g.dispose());
      this.glowPieces = [];
    }

    this.scene.three.add(this.root);
    // geometries are disposed by GameScene.dispose(); materials and textures are ours
    this.scene.listen(() => this.disposables.forEach((d) => d.dispose()));
    return this.root;
  }
}

function place(x: number, y: number, z: number, opts: PieceOptions): THREE.Matrix4 {
  _q.setFromEuler(_e.set(opts.rotX ?? 0, opts.rotY ?? 0, opts.rotZ ?? 0, 'YXZ'));
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s);
}

/** Bake the transform and a flat colour into a non-indexed geometry with position/normal/color. */
function prepare(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, color: THREE.Color): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.applyMatrix4(matrix);
  g.deleteAttribute('uv');
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Same shape, but normals averaged across each corner so the inverted-hull outline has no gaps. */
function smoothNormalCopy(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const sums = new Map<string, THREE.Vector3>();
  const keys: string[] = [];
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    keys.push(key);
    let v = sums.get(key);
    if (!v) sums.set(key, (v = new THREE.Vector3()));
    v.x += nor.getX(i);
    v.y += nor.getY(i);
    v.z += nor.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = sums.get(keys[i])!;
    const len = v.length() || 1;
    out.set([v.x / len, v.y / len, v.z / len], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', pos.clone());
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return g;
}
