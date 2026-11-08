// Geometry of the square rings around the central pillar.
// Cells are (i, j) in 0..9; world x = i - 4.5, z = j - 4.5. A ring of radius r is
// walked by the distance s along it (perimeter 8r), starting at (r, -r).

export const isPillar = (i, j) => (i === 4 || i === 5) && (j === 4 || j === 5);

export function sToXZ(r, s) {
  const P = 8 * r, L = 2 * r;
  s = ((s % P) + P) % P;
  if (s <= L) return [r, -r + s];
  if (s <= 2 * L) return [r - (s - L), r];
  if (s <= 3 * L) return [-r, r - (s - 2 * L)];
  return [-r + (s - 3 * L), -r];
}

export const cellOf = (r, s) => { const [x, z] = sToXZ(r, s); return [Math.round(x + 4.5), Math.round(z + 4.5)]; };
export const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

export function xzToS(R, x, z) {
  if (Math.abs(x - R) < 1e-6) return z + R;
  if (Math.abs(z - R) < 1e-6) return 2 * R + (R - x);
  if (Math.abs(x + R) < 1e-6) return 4 * R + (R - z);
  return 6 * R + (x + R);
}

/** The cell one ring in (d=-1) or out (d=1) from ring position s, or null at corners / the pillar / the edge. */
export function radialNeighbor(r, s, d) {
  const nr = r + d; if (nr < 1.5 || nr > 4.5) return null;
  const [x, z] = sToXZ(r, s); let nx = x, nz = z;
  if (Math.abs(Math.abs(x) - r) < 1e-6 && Math.abs(z) < r - 1e-6) nx = x + Math.sign(x) * d;
  else if (Math.abs(Math.abs(z) - r) < 1e-6 && Math.abs(x) < r - 1e-6) nz = z + Math.sign(z) * d;
  else return null;
  const c = [Math.round(nx + 4.5), Math.round(nz + 4.5)];
  return isPillar(c[0], c[1]) ? null : c;
}
