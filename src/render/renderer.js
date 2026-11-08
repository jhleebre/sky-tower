// WebGL renderer, scene, camera, lights and sun shadows.
import * as THREE from 'three';
import { STAGES } from '../data/stages.js';

export const canvas = document.getElementById('cv');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(new THREE.Color(STAGES[0].sky), 22, 62);

export const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);

// Sky light from above, a darker bounce from below, and a warm sun from one side
const hemi = new THREE.HemisphereLight(0xffffff, 0x4a5a8a, 0.62);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3dc, 0.95);
const SUN_DIR = new THREE.Vector3(6, 11, 4).normalize();
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
// The tower is 10x10, so a box a little wider than the tower holds every shadow near the player
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 60 });
sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
scene.add(sun, sun.target);

/** Keeps the sun's shadow box centred on the tower at the player's height. */
export function updateSun(P) {
  const cy = P.y + 1;
  sun.target.position.set(0, cy - 3, 0);
  sun.position.set(SUN_DIR.x * 30, cy - 3 + SUN_DIR.y * 30, SUN_DIR.z * 30);
}

/** Tints the light a little toward the current sky (warmer in the lava floors, cooler at night). */
export function tintLights(sky) {
  hemi.color.copy(sky).lerp(new THREE.Color(0xffffff), .6);
}

export function resize() {
  const r = canvas.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
