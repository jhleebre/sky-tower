// Meshes for one tower (rebuilt when the difficulty changes), kept in sync with
// the simulation every frame, plus fading of whatever hides the player.
import * as THREE from 'three';
import { scene } from './renderer.js';
import { TX, FLOOR_TEX } from './textures.js';
import { MAT, FADED, lam, moverMat, moverFaded, coneGeo, coneMat, coneWarn, ballGeo, coreGeo, ballMat, coreMat, SHARED_GEO } from './materials.js';
import { blockAO, cubeGeo, slabGeo } from './blockGeo.js';
import { spikeState } from '../world/sim.js';
import { isPillar } from '../world/ring.js';

const key = (i, y, j) => i + ',' + y + ',' + j;
const FLAG_REACHED = '#3ee0a1', FLAG_GOAL = '#ff3d5e', FLAG_OPEN = '#ffffff';

let V = null; // meshes of the current tower

export function buildTowerMesh(tower) {
  if (V) {
    scene.remove(V.group);
    V.group.traverse(o => { if (o.geometry && !SHARED_GEO.has(o.geometry)) o.geometry.dispose(); });
    V.floors.forEach(f => { f.mat.dispose(); f.flagMat.dispose(); });
  }
  const group = new THREE.Group(); scene.add(group);
  const blockMeshes = [], meshAt = new Map(), floorBuckets = {}, geoCache = new Map();
  // What counts as solid for corner shading: fixed blocks, floors and the pillar (not moving blocks or holes)
  const TOP = tower.TOP;
  const occ = (i, y, j) => i >= 0 && i <= 9 && j >= 0 && j <= 9 && (tower.B.has(key(i, y, j)) || (isPillar(i, j) && y >= -1 && y <= TOP));
  const shadows = m => { m.castShadow = true; m.receiveShadow = true; return m; };

  tower.B.forEach((t, k) => {
    const [i, y, j] = k.split(',').map(Number);
    if (t === 'ground' || t === 'goal' || t.startsWith('floor')) { (floorBuckets[y] = floorBuckets[y] || []).push([i, j]); return; }
    const m = shadows(new THREE.Mesh(cubeGeo(blockAO(occ, i, y, j), geoCache), MAT[t])); m.position.set(i - 4.5, y + .5, j - 4.5); group.add(m);
    if (t === 'lava') m.castShadow = false;
    m.userData = { t, cx: i - 4.5, cy: y + .5, cz: j - 4.5, faded: false }; blockMeshes.push(m); meshAt.set(k, m);
  });

  const slab = (mat, cells, y) => { const m = shadows(new THREE.Mesh(slabGeo(cells, y, occ), mat)); group.add(m); return m; };
  const floors = tower.floors.map(f => {
    const cells = floorBuckets[f.y] || [];
    const mat = lam(f.stage === 0 ? TX.grassTop : (f.type === 'goal' ? TX.gold : FLOOR_TEX[f.stage - 1]), { vertexColors: true });
    if (cells.length) slab(mat, cells, f.y);
    let holeMesh = null;
    if (f.hole.length) { holeMesh = slab(mat, f.hole, f.y); holeMesh.visible = false; }
    const fl = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(.08, 2.2, .08), new THREE.MeshLambertMaterial({ color: '#5a5f80' })); pole.position.y = 1.1;
    const flagMat = new THREE.MeshLambertMaterial({ color: f.stage === 0 ? FLAG_REACHED : (f.type === 'goal' ? FLAG_GOAL : FLAG_OPEN), side: THREE.DoubleSide });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(.8, .5), flagMat); flag.position.set(.42, 1.9, 0);
    pole.castShadow = flag.castShadow = true; fl.add(pole, flag); fl.position.set(f.spawn[0] - 4.5 + .38, f.y + 1, f.spawn[1] - 4.5 + .38); group.add(fl);
    return { f, mat, holeMesh, flagMat, reached: f.stage === 0, filled: false };
  });

  const pH = TOP + 2;
  const pillarTex = TX.brick.clone(); pillarTex.needsUpdate = true; pillarTex.wrapS = pillarTex.wrapT = THREE.RepeatWrapping; pillarTex.repeat.set(2, pH);
  const pillar = shadows(new THREE.Mesh(new THREE.BoxGeometry(2, pH, 2), new THREE.MeshLambertMaterial({ map: pillarTex }))); pillar.position.set(0, -1 + pH / 2, 0); group.add(pillar);
  const trophy = new THREE.Mesh(new THREE.OctahedronGeometry(.9), new THREE.MeshLambertMaterial({ color: '#ffd23f', emissive: '#6a4a00' })); trophy.position.set(0, TOP + 2.6, 0); group.add(trophy);
  for (const sx of [-5, 5]) for (const sz of [-5, 5]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(.12, TOP + 3, .12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .35 }));
    p.position.set(sx, (TOP + 3) / 2 - 1, sz); group.add(p);
  }

  const movers = tower.movers.map(m => {
    const mesh = shadows(new THREE.Mesh(new THREE.BoxGeometry(m.hx * 2, 1, m.hz * 2), moverMat));
    mesh.userData = { faded: false }; group.add(mesh); return mesh;
  });
  const spikes = tower.spikes.map(sp => {
    const g = new THREE.Group();
    for (const [ox, oz] of [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]]) { const c = new THREE.Mesh(coneGeo, coneMat); c.castShadow = true; c.position.set(ox, 0, oz); g.add(c); }
    g.position.set(sp.i - 4.5, sp.y + 1 - .55, sp.j - 4.5); group.add(g);
    return { obj: g, off: -.55 };
  });
  const launchers = tower.fires.map(e => meshAt.get(key(e.i, e.y, e.j)));

  V = { tower, group, blockMeshes, floors, movers, spikes, launchers, balls: [], trophy };
}

/** Moves the meshes to match the simulation (moving blocks, spikes, fireballs, flags, holes). */
export function syncTower(sim, dt) {
  const T = V.tower, t = sim.simT;
  V.movers.forEach((mesh, k) => mesh.position.set(sim.mx[k], T.movers[k].y + .5, sim.mz[k]));
  T.spikes.forEach((sp, k) => {
    const v = V.spikes[k], st = spikeState(sim, sp);
    const target = st === 0 ? -.55 : (st === 1 ? -.36 + Math.sin(t * 40) * .03 : 0);
    v.off += (target - v.off) * Math.min(1, dt * (st === 2 ? 30 : 10));
    v.obj.position.y = sp.y + 1 + v.off;
    const mat = st === 1 ? coneWarn : coneMat;
    if (v.obj.children[0].material !== mat) v.obj.children.forEach(c => c.material = mat);
  });
  // launchers swell just before they fire
  V.launchers.forEach((mesh, k) => { if (mesh) mesh.scale.setScalar(sim.fireNext[k] - t < .35 ? 1.08 : 1); });
  sim.balls.forEach((b, k) => {
    let m = V.balls[k];
    if (!m) { m = new THREE.Mesh(ballGeo, ballMat); m.add(new THREE.Mesh(coreGeo, coreMat)); V.group.add(m); V.balls[k] = m; }
    m.visible = b.alive; if (b.alive) m.position.set(b.x, b.y, b.z);
  });
  for (let k = sim.balls.length; k < V.balls.length; k++) V.balls[k].visible = false;
  V.floors.forEach((v, n) => {
    const reached = v.f.stage === 0 || v.f.stage <= sim.cp;
    if (reached !== v.reached) { v.reached = reached; v.flagMat.color.set(reached ? FLAG_REACHED : (v.f.type === 'goal' ? FLAG_GOAL : FLAG_OPEN)); }
    if (v.holeMesh && sim.filled[n] !== v.filled) { v.filled = sim.filled[n]; v.holeMesh.visible = v.filled; }
  });
  TX.lava.offset.y = (t * .12) % 1;
  V.trophy.rotation.y += dt * 1.5; V.trophy.position.y = T.TOP + 2.6 + Math.sin(t * 2) * .2;
}

/** Makes blocks and floors between the camera and the player see-through. */
export function fadeOccluders(camera, P, sim, dt) {
  const cx = camera.position.x, cz = camera.position.z, cy = camera.position.y, tx = P.x, ty = P.y + .9, tz = P.z;
  const dx = tx - cx, dz = tz - cz, L2 = Math.max(1e-6, dx * dx + dz * dz);
  const blocks = (px, py, pz) => {
    const bx = px - cx, bz = pz - cz, t = (bx * dx + bz * dz) / L2;
    if (t <= .02 || t >= .93) return false;
    const lx = bx - t * dx, lz = bz - t * dz;
    if (lx * lx + lz * lz > 1.6 * 1.6) return false;
    return Math.abs(py - (cy + t * (ty - cy))) < 1.3;
  };
  for (const m of V.blockMeshes) {
    const u = m.userData;
    if (Math.abs(u.cy - P.y) > 12) { if (u.faded) { u.faded = false; m.material = MAT[u.t]; } continue; }
    const f = blocks(u.cx, u.cy, u.cz);
    if (f !== u.faded) { u.faded = f; m.material = f ? FADED[u.t] : MAT[u.t]; }
  }
  V.movers.forEach((mesh, k) => {
    const f = blocks(sim.mx[k], V.tower.movers[k].y + .5, sim.mz[k]);
    if (f !== mesh.userData.faded) { mesh.userData.faded = f; mesh.material = f ? moverFaded : moverMat; }
  });
  for (const v of V.floors) {
    const f = v.f.y > P.y + .4 && v.f.y < camera.position.y + .5, o = f ? .22 : 1;
    v.mat.opacity += (o - v.mat.opacity) * Math.min(1, dt * 10); v.mat.depthWrite = !f;
  }
}
