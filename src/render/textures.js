// 16x16 pixel textures drawn on canvases (no image files).
import * as THREE from 'three';
import { STAGES } from '../data/stages.js';
import { mulberry32 } from '../util/rng.js';

function tex(draw, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d'); draw(g, mulberry32(seed));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}
function noise(g, r, cols, x0 = 0, y0 = 0, w = 16, h = 16) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x, y, 1, 1); }
}
function border(g, c) { g.fillStyle = c; g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16); }
function bricks(g, mortar) {
  g.fillStyle = mortar;
  for (let y = 0; y < 16; y += 4) { g.fillRect(0, y, 16, 1); const o = (y / 4) % 2 ? 0 : 8; g.fillRect(o, y, 1, 4); g.fillRect((o + 8) % 16, y, 1, 4); }
}
const DIRT = ['#8b5a3c', '#7a4e33', '#966647', '#6f472f'], GRN = ['#5cbf4a', '#4fae3f', '#67cc55', '#57b847'];

export const TX = {
  grassTop: tex((g, r) => { noise(g, r, GRN); border(g, '#3f8f33'); }, 1),
  grassSide: tex((g, r) => { noise(g, r, DIRT); for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(r() * 3); noise(g, r, GRN, x, 0, 1, h); } border(g, '#5a3a26'); }, 2),
  dirt: tex((g, r) => { noise(g, r, DIRT); border(g, '#5a3a26'); }, 3),
  stone: tex((g, r) => { noise(g, r, ['#8a8f9c', '#7d828f', '#969ba8', '#737885']); g.fillStyle = '#666b78'; g.fillRect(3, 5, 4, 1); g.fillRect(9, 10, 5, 1); g.fillRect(6, 12, 1, 2); border(g, '#5c606b'); }, 4),
  sand: tex((g, r) => { noise(g, r, ['#e8d38a', '#dcc67c', '#f0dc96', '#e2cc82']); border(g, '#c4ad66'); }, 5),
  lava: tex((g, r) => { noise(g, r, ['#ff5a1f', '#ff7a2f', '#ffb13b', '#e8361a', '#ff8f2f']); for (let k = 0; k < 5; k++) { g.fillStyle = '#ffe066'; g.fillRect(Math.floor(r() * 14), Math.floor(r() * 14), 2, 1); } }, 6),
  ice: tex((g, r) => { noise(g, r, ['#bfe9ff', '#a9e0ff', '#d6f3ff', '#b5e4ff']); g.fillStyle = '#ffffff'; for (let k = 0; k < 6; k++) { g.fillRect(3 + k, 9 - k, 1, 1); g.fillRect(9 + k, 13 - k, 1, 1); } border(g, '#8cc8ea'); }, 7),
  slime: tex((g, r) => { noise(g, r, ['#8ee86a', '#7ee05a', '#9af07a']); g.fillStyle = '#4fae3f'; g.fillRect(3, 3, 10, 1); g.fillRect(3, 12, 10, 1); g.fillRect(3, 3, 1, 10); g.fillRect(12, 3, 1, 10); g.fillStyle = '#b8ff9a'; g.fillRect(5, 5, 2, 2); border(g, '#4fae3f'); }, 8),
  mover: tex((g, r) => { noise(g, r, ['#4f9dff', '#4592f2', '#5aa6ff']); g.fillStyle = '#ffffff'; for (const ox of [2, 9]) { g.fillRect(ox, 7, 5, 2); g.fillRect(ox + 3, 5, 1, 6); g.fillRect(ox + 4, 6, 1, 4); } border(g, '#2b6fcc'); }, 9),
  gold: tex((g, r) => { noise(g, r, ['#ffd23f', '#ffcc33', '#ffe066', '#f5c22a']); g.fillStyle = '#fff3b0'; g.fillRect(2, 2, 3, 1); g.fillRect(2, 3, 1, 2); border(g, '#c79a00'); }, 10),
  brick: tex((g, r) => { noise(g, r, ['#7b84b8', '#737cb0', '#838cc0']); bricks(g, '#565d8c'); }, 11),
  wood: tex((g, r) => { noise(g, r, ['#b8844e', '#ad7a45', '#c08b55']); g.fillStyle = '#7a5230'; for (const y of [0, 4, 8, 12]) g.fillRect(0, y, 16, 1); for (const [x, y] of [[5, 0], [12, 4], [3, 8], [10, 12]]) g.fillRect(x, y, 1, 4); }, 12),
  snow: tex((g, r) => { noise(g, r, ['#f4f8ff', '#e8eef8', '#ffffff', '#dde6f2']); border(g, '#b8c4d8'); }, 13),
  moss: tex((g, r) => { noise(g, r, ['#8a8f9c', '#7d828f', '#5f9e52', '#6aae5c', '#969ba8']); border(g, '#4f6a4a'); }, 14),
  metal: tex((g, r) => { noise(g, r, ['#8b93a6', '#838b9e', '#939bae']); g.fillStyle = '#5b6274'; for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) g.fillRect(x, y, 1, 1); g.fillStyle = '#a7aec0'; g.fillRect(1, 1, 14, 1); border(g, '#5b6274'); }, 15),
  redbrick: tex((g, r) => { noise(g, r, ['#b4523f', '#a84a38', '#bf5c47']); bricks(g, '#e0cfc4'); }, 16),
  dark: tex((g, r) => { noise(g, r, ['#4a4560', '#433e58', '#524c6a', '#3e3a52']); border(g, '#2e2b3e'); }, 17),
  quartz: tex((g, r) => { noise(g, r, ['#f1ece4', '#e9e3d9', '#f7f3ec']); g.fillStyle = '#d8d0c2'; g.fillRect(0, 7, 16, 1); border(g, '#cfc6b8'); }, 18),
  spike: tex((g, r) => { noise(g, r, ['#5b6274', '#545b6c', '#636a7c']); g.fillStyle = '#2a2e3a'; for (const [x, y] of [[3, 3], [10, 3], [3, 10], [10, 10]]) g.fillRect(x, y, 3, 3); g.fillStyle = '#ffcc33'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1); }, 19),
  launcher: tex((g, r) => { noise(g, r, ['#3a3a48', '#34343f', '#41414f']); g.fillStyle = '#1c1c24'; g.fillRect(4, 4, 8, 8); g.fillStyle = '#ff7a2f'; g.fillRect(6, 6, 4, 4); g.fillStyle = '#ffd23f'; g.fillRect(7, 7, 2, 2); border(g, '#1c1c24'); }, 20),
};
TX.lava.wrapS = TX.lava.wrapT = THREE.RepeatWrapping;

function floorTex(base, seed) {
  return tex((g, r) => {
    const c = new THREE.Color(base);
    const cols = [0, -.04, .04, -.07].map(d => '#' + c.clone().offsetHSL(0, 0, d).getHexString());
    noise(g, r, cols);
    g.fillStyle = '#' + c.clone().offsetHSL(0, 0, -.18).getHexString();
    g.fillRect(0, 7, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(7, 0, 1, 7); g.fillRect(15, 8, 1, 8);
  }, seed);
}
/** Tile texture for each checkpoint floor (index = stage - 1). */
export const FLOOR_TEX = STAGES.map((S, i) => floorTex(S.floor, 30 + i + 1));
