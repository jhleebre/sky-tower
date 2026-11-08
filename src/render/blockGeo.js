// Block geometry with baked corner shading (ambient occlusion).
// Each face corner gets darker the more of the three cells around it (two sides
// and the diagonal, in the layer the face looks into) are solid, the way blocky
// voxel games make blocks read as chunky solid lumps. Brightness goes into a
// vertex colour that multiplies the texture.
import * as THREE from 'three';

// Faces in BoxGeometry's group order (+x, -x, +y, -y, +z, -z) so multi-material
// blocks (grass) map the same way. o: corner 0, u/v: face axes (u x v = n), v points up on sides.
const FACES = [
  { n: [1, 0, 0], o: [1, 0, 1], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], o: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], o: [0, 1, 1], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], o: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], o: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], o: [1, 0, 0], u: [-1, 0, 0], v: [0, 1, 0] },
];
// Corner k of a face: [u side, v side] (0 = toward -u/-v, 1 = toward +u/+v)
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const UVS = [0, 0, 1, 0, 1, 1, 0, 1];
const SHADE = [.5, .68, .84, 1];

/** AO level 0..3 for each of the 24 face corners of the cell at (i, y, j). occ(i, y, j) -> solid? */
export function blockAO(occ, i, y, j) {
  const out = new Array(24);
  FACES.forEach((F, f) => {
    const bi = i + F.n[0], by = y + F.n[1], bj = j + F.n[2];
    CORNERS.forEach(([cu, cv], k) => {
      const su = cu ? 1 : -1, sv = cv ? 1 : -1;
      const ux = F.u[0] * su, uy = F.u[1] * su, uz = F.u[2] * su, vx = F.v[0] * sv, vy = F.v[1] * sv, vz = F.v[2] * sv;
      const s1 = occ(bi + ux, by + uy, bj + uz) ? 1 : 0, s2 = occ(bi + vx, by + vy, bj + vz) ? 1 : 0;
      const c = occ(bi + ux + vx, by + uy + vy, bj + uz + vz) ? 1 : 0;
      out[f * 4 + k] = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
    });
  });
  return out;
}

/** Adds the faces of one cube (offset ox, oy, oz) to arrays. faces: which of the 6 to add. */
function pushCube(A, ox, oy, oz, ao, faces) {
  FACES.forEach((F, f) => {
    if (!faces[f]) return;
    const base = A.pos.length / 3;
    CORNERS.forEach(([cu, cv], k) => {
      A.pos.push(ox + F.o[0] + F.u[0] * cu + F.v[0] * cv, oy + F.o[1] + F.u[1] * cu + F.v[1] * cv, oz + F.o[2] + F.u[2] * cu + F.v[2] * cv);
      A.nor.push(F.n[0], F.n[1], F.n[2]);
      A.uv.push(UVS[k * 2], UVS[k * 2 + 1]);
      const s = SHADE[ao[f * 4 + k]]; A.col.push(s, s, s);
    });
    const a = ao.slice(f * 4, f * 4 + 4);
    // split the quad along the diagonal that keeps the shading smooth
    const tri = a[0] + a[2] >= a[1] + a[3] ? [0, 1, 2, 0, 2, 3] : [1, 2, 3, 1, 3, 0];
    const start = A.idx.length;
    for (const t of tri) A.idx.push(base + t);
    A.groups[f].push([start, 6]);
  });
}

function toGeometry(A) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(A.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(A.col, 3));
  // Reorder indices by face direction so each direction is one draw group (material index = face)
  const idx = [];
  A.groups.forEach((list, f) => {
    const start = idx.length;
    for (const [s, n] of list) for (let q = 0; q < n; q++) idx.push(A.idx[s + q]);
    if (idx.length > start) g.addGroup(start, idx.length - start, f);
  });
  g.setIndex(idx);
  return g;
}
const arrays = () => ({ pos: [], nor: [], uv: [], col: [], idx: [], groups: [[], [], [], [], [], []] });
const ALL = [1, 1, 1, 1, 1, 1];

/** Unit cube centred on the origin with the given AO (geometries are shared per AO pattern via cache). */
export function cubeGeo(ao, cache) {
  const k = ao.join('');
  let g = cache.get(k);
  if (!g) { const A = arrays(); pushCube(A, -.5, -.5, -.5, ao, ALL); g = toGeometry(A); cache.set(k, g); }
  return g;
}

/** One merged mesh geometry for many cells at height y (floors). Faces against solid cells are left out. */
export function slabGeo(cells, y, occ) {
  const A = arrays();
  for (const [i, j] of cells) {
    const faces = FACES.map(F => occ(i + F.n[0], y + F.n[1], j + F.n[2]) ? 0 : 1);
    pushCube(A, i - 5, y, j - 5, blockAO(occ, i, y, j), faces);
  }
  return toGeometry(A);
}
