// Everything around the tower: grass field, scattered clouds, distant mountains,
// two cloud-sea layers you climb through, a gradient sky dome with a sun glow,
// and stars near the top. Sky colours, fog and light follow the player's height
// so climbing visibly takes you from a bright meadow into the night sky.
import * as THREE from 'three';
import { STAGES } from '../data/stages.js';
import { SKY_END } from '../config.js';
import { mulberry32 } from '../util/rng.js';
import { scene, camera, tintLights } from './renderer.js';

const grassBig = new THREE.Mesh(new THREE.BoxGeometry(80, 1, 80), new THREE.MeshLambertMaterial({ color: '#4caf50' }));
grassBig.position.y = -1.52; grassBig.receiveShadow = true; scene.add(grassBig);

// Blocky clouds scattered up the whole height
{
  const cr = mulberry32(9), cm = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x444444 });
  for (let i = 0; i < 75; i++) {
    const a = cr() * 6.28, d = 22 + cr() * 16, cy = cr() * 190; const c = new THREE.Group();
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.2 + cr() * 1.6, 1 + cr() * .6, 1.6 + cr()), cm); s.position.set(k * 1.8 - 1.8, cr() * .4, cr() * .6); c.add(s); }
    c.position.set(Math.cos(a) * d, cy, Math.sin(a) * d); c.rotation.y = -a; scene.add(c);
  }
}

/* ---------- sky dome ---------- */
// Per floor: [horizon, zenith]. The horizon is a paler version of the floor's sky, the zenith a deeper one.
const lighten = (c, l) => new THREE.Color(c).offsetHSL(0, 0, l);
const PAL = STAGES.map(S => [lighten(S.sky, .1), lighten(S.sky, -.18).offsetHSL(0, .1, 0)])
  .concat([[new THREE.Color('#2a2466'), new THREE.Color(SKY_END).offsetHSL(0, 0, -.04)]]);
const SUN_DIR = new THREE.Vector3(6, 11, 4).normalize();

const skyMat = new THREE.ShaderMaterial({
  uniforms: { hor: { value: new THREE.Color() }, zen: { value: new THREE.Color() }, sunDir: { value: SUN_DIR }, sunAmt: { value: 1 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 hor; uniform vec3 zen; uniform vec3 sunDir; uniform float sunAmt; varying vec3 vDir;
    void main(){
      float h = clamp(vDir.y, -1.0, 1.0);
      vec3 c = mix(hor, zen, smoothstep(0.0, 0.75, h));
      c = mix(c, hor * 0.92, smoothstep(0.0, -0.4, h));
      float s = max(dot(vDir, sunDir), 0.0);
      c += vec3(1.0, 0.92, 0.7) * (pow(s, 600.0) * 1.2 + pow(s, 12.0) * 0.18) * sunAmt;
      gl_FragColor = vec4(c, 1.0);
    }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMat);
dome.renderOrder = -10; scene.add(dome);

// Stars: fade in over the last floors
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
{
  const r = mulberry32(77), pos = [];
  for (let i = 0; i < 700; i++) {
    const u = r() * 2 - 1, a = r() * 6.283, y = Math.abs(u) * .95 + .05, q = Math.sqrt(1 - y * y);
    pos.push(Math.cos(a) * q * 280, y * 280, Math.sin(a) * q * 280);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, starMat); stars.renderOrder = -9; dome.add(stars);
}

/* ---------- distant mountains ---------- */
const mountMat = new THREE.MeshLambertMaterial({ color: '#6f8fb0', flatShading: true, fog: false });
{
  const r = mulberry32(31);
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * 6.283 + r() * .2, d = 180 + r() * 60, h = 14 + r() * 24, w = 26 + r() * 24;
    const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5 + Math.floor(r() * 3), 1), mountMat);
    m.position.set(Math.cos(a) * d, h / 2 - 3, Math.sin(a) * d); m.rotation.y = r() * 6; scene.add(m);
  }
}

/* ---------- cloud seas ---------- */
function cloudTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = mulberry32(5);
  for (let i = 0; i < 140; i++) {
    const x = r() * 256, y = r() * 256, rad = 10 + r() * 30;
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) { // tile seamlessly
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6);
  return t;
}
const seaTex = cloudTex();
const seas = [26, 70].map((y, n) => {
  const mat = new THREE.MeshBasicMaterial({ map: seaTex, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide, fog: false });
  // a ring, so the tower itself (and the path) is never covered
  const m = new THREE.Mesh(new THREE.RingGeometry(16, 300, 64, 1), mat);
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = -5 + n; scene.add(m);
  return { m, mat, y };
});

/* ---------- per-frame update ---------- */
const tmpH = new THREE.Color(), tmpZ = new THREE.Color(), mountBase = new THREE.Color('#5d7f6a');

/** [floor index below y, 0..1 of the way to the next floor] */
function stageFrac(y, floors) {
  for (let i = 0; i < floors.length - 1; i++) { const a = floors[i].y, b = floors[i + 1].y; if (y >= a && y < b) return [i, (y - a) / (b - a)]; }
  return y < 0 ? [0, 0] : [floors.length - 1, 1];
}

export function updateSky(y, floors, t) {
  const [i, f] = stageFrac(y, floors), k = f * f;
  const a = PAL[Math.min(i, PAL.length - 1)], b = PAL[Math.min(i + 1, PAL.length - 1)];
  tmpH.copy(a[0]).lerp(b[0], k); tmpZ.copy(a[1]).lerp(b[1], k);
  skyMat.uniforms.hor.value.copy(tmpH); skyMat.uniforms.zen.value.copy(tmpZ);
  dome.position.copy(camera.position);

  const top = floors[floors.length - 1].y, h = Math.max(0, Math.min(1, y / top));
  // thinner air higher up: you see further, and the fog takes the horizon colour
  scene.fog.color.copy(tmpH); scene.fog.near = 22 + h * 12; scene.fog.far = 62 + h * 50;
  const night = Math.max(0, Math.min(1, (h - .72) / .25));
  starMat.opacity = night; skyMat.uniforms.sunAmt.value = 1 - night * .8;
  // far mountains fade into the horizon (aerial perspective), more so as you climb
  mountMat.color.copy(mountBase).lerp(tmpH, .55 + h * .3);
  // cloud seas thin out when the camera is inside them, drift slowly
  for (const s of seas) s.mat.opacity = .85 * Math.min(1, Math.abs(camera.position.y - s.y) / 6);
  seaTex.offset.set(t * .002, t * .001);
  tintLights(tmpH);
}
