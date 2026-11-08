// Blocky player model with walk animation, and its drop shadow.
import * as THREE from 'three';
import { PLAYER_COLOR } from '../config.js';
import { solid } from '../world/sim.js';
import { scene } from './renderer.js';

const player = new THREE.Group();
const limbs = [];
{
  const bodyM = new THREE.MeshLambertMaterial({ color: PLAYER_COLOR });
  const darkM = new THREE.MeshLambertMaterial({ color: new THREE.Color(PLAYER_COLOR).multiplyScalar(.65) });
  const skin = new THREE.MeshLambertMaterial({ color: '#ffd9b0' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(.6, .62, .36), bodyM); body.position.y = .96;
  const head = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), skin); head.position.y = 1.53;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(.52, .14, .52), darkM); hair.position.y = 1.74;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(.26, .65, .3), darkM); legL.geometry.translate(0, -.325, 0); legL.position.set(-.14, .65, 0);
  const legR = new THREE.Mesh(legL.geometry, darkM); legR.position.set(.14, .65, 0);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(.18, .6, .22), bodyM); armL.geometry.translate(0, -.28, 0); armL.position.set(-.4, 1.25, 0);
  const armR = new THREE.Mesh(armL.geometry, bodyM); armR.position.set(.4, 1.25, 0);
  const eM = new THREE.MeshBasicMaterial({ color: 0x14183a });
  for (const sx of [-.12, .12]) { const e = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, .02), eM); e.position.set(sx, 1.56, .26); player.add(e); }
  player.add(body, head, hair, legL, legR, armL, armR); limbs.push(legL, legR, armL, armR);
}
player.traverse(o => { if (o.isMesh) o.castShadow = true; });
scene.add(player);

const shadow = new THREE.Mesh(new THREE.PlaneGeometry(.7, .7), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .35, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

// Squash and stretch: squash() on landing / bouncing, eases back to normal
let sq = 0;
/** k: 0..1 how hard (positive squashes down, negative stretches up) */
export function squash(k) { sq = k; }

/** hidden: first-person view (the camera is inside the head) */
export function updatePlayer(sim, dt, hidden) {
  const P = sim.P, T = sim.tower;
  player.position.set(P.x, P.y, P.z);
  player.visible = P.dead <= 0 && !hidden;
  sq += (0 - sq) * Math.min(1, dt * 10);
  player.scale.set(1 + sq * .25, 1 - sq * .3, 1 + sq * .25);
  let fd = P.face - player.rotation.y; fd = Math.atan2(Math.sin(fd), Math.cos(fd)); player.rotation.y += fd * Math.min(1, dt * 12);
  const sp = Math.min(1, Math.hypot(P.vx, P.vz) / 3);
  const sw = P.ground ? Math.sin(P.walk) * .6 * sp : .4;
  limbs[0].rotation.x = sw; limbs[1].rotation.x = -sw; limbs[2].rotation.x = -sw * .8; limbs[3].rotation.x = sw * .8;

  // shadow on the first surface below (a block, a floor or a moving block)
  let sy = null;
  const ci = Math.floor(P.x + 5), cj = Math.floor(P.z + 5);
  for (let y = Math.floor(P.y - .01); y > Math.floor(P.y) - 40; y--) { if (solid(sim, ci, y, cj)) { sy = y + 1; break; } }
  T.movers.forEach((m, k) => {
    if (Math.abs(P.x - sim.mx[k]) < m.hx && Math.abs(P.z - sim.mz[k]) < m.hz && m.y + 1 <= P.y + .01 && (sy === null || m.y + 1 > sy)) sy = m.y + 1;
  });
  if (sy !== null && P.dead <= 0) {
    shadow.visible = true; shadow.position.set(P.x, sy + .02, P.z);
    const h = P.y - sy; shadow.scale.setScalar(Math.max(.5, 1 - h * .06)); shadow.material.opacity = Math.max(.15, .42 - h * .03);
  } else shadow.visible = false;
}
