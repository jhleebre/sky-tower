// Blocky particle effects: bursts (falls, fireballs popping), landing dust,
// slime splashes, the checkpoint sparkle ring and summit fireworks.
import * as THREE from 'three';
import { scene } from './renderer.js';

const parts = [];
const pGeo = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map();
const matOf = c => { let m = mats.get(c); if (!m) { m = new THREE.MeshBasicMaterial({ color: c }); mats.set(c, m); } return m; };

/**
 * Spawns one cube particle. v: velocity, o: {size, life, g (gravity), drag, grow (size goes up then down)}
 */
function spawn(x, y, z, c, vx, vy, vz, o = {}) {
  const p = new THREE.Mesh(pGeo, matOf(c)); p.position.set(x, y, z);
  const size = o.size || .16, life = o.life || .9;
  p.scale.setScalar(size);
  p.userData = { v: new THREE.Vector3(vx, vy, vz), l: life, L: life, size, g: o.g ?? 20, drag: o.drag || 0, grow: !!o.grow, spin: o.spin || 0 };
  scene.add(p); parts.push(p);
}

export function burst(x, y, z, c, n = 18) {
  for (let i = 0; i < n; i++) spawn(x, y, z, c, (Math.random() - .5) * 7, Math.random() * 6 + 2, (Math.random() - .5) * 7);
}

/** Puffs of dust spreading along the ground. k: 0..1 strength */
export function dust(x, y, z, k = 1, c = '#e8e4da') {
  const n = Math.round(5 + k * 10);
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.283 + Math.random() * .5, sp = 1.2 + k * 2.2 + Math.random();
    spawn(x + Math.cos(a) * .25, y + .05, z + Math.sin(a) * .25, c, Math.cos(a) * sp, .4 + Math.random() * .8, Math.sin(a) * sp,
      { size: .12 + Math.random() * .1, life: .45 + Math.random() * .25, g: 2, drag: 4, grow: true, spin: 3 });
  }
}

/** Green droplets thrown up off a slime block. */
export function splash(x, y, z) {
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * 6.283, sp = 1.5 + Math.random() * 2.5;
    spawn(x, y + .05, z, i % 3 ? '#8ee86a' : '#c8ffb0', Math.cos(a) * sp, 3 + Math.random() * 4, Math.sin(a) * sp, { size: .1 + Math.random() * .08, life: .7, g: 16 });
  }
}

/** Ring of sparkles rising around the player at a checkpoint flag. */
export function sparkleRing(x, y, z) {
  const cols = ['#ffd23f', '#fff3b0', '#3ee0a1'];
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * 6.283;
    spawn(x + Math.cos(a) * .9, y + .1, z + Math.sin(a) * .9, cols[i % 3], Math.cos(a) * .6, 2.5 + (i % 4) * .6, Math.sin(a) * .6,
      { size: .1, life: 1.3, g: -1, drag: .5, spin: 4 });
  }
}

/** Firework shell bursting at (x, y, z). */
export function firework(x, y, z, c) {
  for (let i = 0; i < 30; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * 6.283, q = Math.sqrt(1 - u * u), sp = 5 + Math.random() * 2;
    spawn(x, y, z, c, Math.cos(a) * q * sp, u * sp + 1, Math.sin(a) * q * sp, { size: .13, life: 1.1, g: 6, drag: 1.2, spin: 5 });
  }
}

export function updateEffects(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i], u = p.userData;
    u.v.y -= u.g * dt;
    if (u.drag) u.v.multiplyScalar(Math.max(0, 1 - u.drag * dt));
    p.position.addScaledVector(u.v, dt); u.l -= dt;
    const f = Math.max(0, u.l / u.L);
    p.scale.setScalar(Math.max(.01, u.size * (u.grow ? Math.sin(f * Math.PI) * 1.6 : f * 1.1)));
    if (u.spin) { p.rotation.x += u.spin * dt; p.rotation.y += u.spin * .7 * dt; }
    if (u.l <= 0) { scene.remove(p); parts.splice(i, 1); }
  }
}
