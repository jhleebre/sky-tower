// Chase camera with three views (first person, over the shoulder, far).
// The far views pull in when the central pillar is in the way.
import { isPillar } from '../world/ring.js';
import { camera } from './renderer.js';

export const VIEWS = {
  fp: { label: '1인칭' },
  near: { label: '어깨', d: 4.6, h: 1.3, look: 2.5, lookH: 1.3 },
  far: { label: '멀리', d: 8.5, h: 4.2, look: 1.2, lookH: 1.0 },
};
export const VIEW_ORDER = ['fp', 'near', 'far'];
const CAM_D = 4.6;

let camAng = 0, camH = 0, camDist = CAM_D;

export function snapCamera(P) { camAng = P.face; camH = P.y; camDist = CAM_D; }

function camSolid(x, y, z, TOP) {
  const i = Math.floor(x + 5), j = Math.floor(z + 5);
  if (i < 0 || i > 9 || j < 0 || j > 9) return false;
  const yy = Math.floor(y);
  return isPillar(i, j) && yy >= -1 && yy <= TOP;
}

export function updateCamera(P, dt, view, TOP) {
  const yd = Math.atan2(Math.sin(P.face - camAng), Math.cos(P.face - camAng)); camAng += yd * Math.min(1, dt * 8);
  camH += (P.y - camH) * Math.min(1, dt * 6);
  const fx = Math.sin(camAng), fz = Math.cos(camAng);
  if (view === 'fp') {
    camAng = P.face; camH = P.y;
    const ex = Math.sin(P.face), ez = Math.cos(P.face);
    camera.position.set(P.x + ex * .12, P.y + 1.62, P.z + ez * .12);
    camera.lookAt(P.x + ex * 4, P.y + .55, P.z + ez * 4);
    return;
  }
  const V = VIEWS[view];
  const hx = P.x, hy = camH + 1.6, hz = P.z, wx = -fx * V.d, wy = V.h, wz = -fz * V.d, len = Math.hypot(wx, wy, wz);
  let hitD = len;
  for (let t = .3; t <= len; t += .1) { const k = t / len; if (camSolid(hx + wx * k, hy + wy * k, hz + wz * k, TOP)) { hitD = Math.max(.8, t - .3); break; } }
  camDist += (hitD - camDist) * Math.min(1, dt * (hitD < camDist ? 20 : 4));
  const ck = camDist / len;
  camera.position.set(hx + wx * ck, hy + wy * ck, hz + wz * ck);
  camera.lookAt(P.x + fx * V.look, camH + V.lookH, P.z + fz * V.look);
}
