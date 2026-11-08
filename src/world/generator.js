// Builds the tower from a fixed seed: blocks, moving blocks, spikes, fire launchers
// and the ten checkpoint floors. Pure data, no rendering.
//
// Besides the blocks it records `route`: the stops a player makes on the way up,
// in order, used by the autoplay planner (src/dev/planner.js). Recording the route
// draws no random numbers, so the tower is the same with or without it.
//   {kind:'cell',   i, j, y, stage}  stand on block (i, y, j)
//   {kind:'bounce', i, j, y, stage}  bounce off the slime at (i, y, j)
//   {kind:'mover',  m, stage}        stand on moving block movers[m]
//   {kind:'floor',  f, stage}        reach floors[f] and walk to its flag
import { STAGES, LAYOUTS } from '../data/stages.js';
import { mulberry32 } from '../util/rng.js';
import { isPillar, sToXZ, cellOf, cheb, xzToS, radialNeighbor } from './ring.js';

export const SEED = 20261105;

export function generateTower(layout) {
  const D = LAYOUTS[layout] || LAYOUTS.hard;
  const rng = mulberry32(SEED), R = (a, b) => a + (b - a) * rng(), pick = a => a[Math.floor(rng() * a.length)];
  const B = new Map(), K = (i, y, j) => i + ',' + y + ',' + j;
  const movers = [], floors = [], path = [], spikes = [], fires = [], route = [];
  let r = 3.5, s = 0, top = 0, prev = cellOf(r, s), noRing = false;
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) if (!isPillar(i, j)) B.set(K(i, -1, j), 'ground');
  floors.push({ y: -1, stage: 0, type: 'cp', spawn: prev, hole: [] });

  STAGES.forEach((S, si) => {
    const sp = [];
    // aux: placed, but not a stop on the route (second block of a wide step, lava, spikes, fire lane)
    const add = (c, y, t, aux) => {
      B.set(K(c[0], y, c[1]), t); sp.push({ c, y, t, stage: si + 1 });
      if (!aux) route.push({ kind: t === 'slime' ? 'bounce' : 'cell', i: c[0], j: c[1], y, stage: si });
    };
    const step = (t, wide, kForce) => {
      let k = kForce || pick(D.k);
      if (!kForce && !noRing && rng() < .3) {
        const cand = r + (rng() < .5 ? -1 : 1);
        if (cand >= 2.5 && cand <= 4.5) {
          const sb = Math.round(s * cand / r);
          for (let kk = 1; kk <= 6; kk++) { const c = cellOf(cand, sb + kk); if (cheb(prev, c) === 2) { r = cand; s = sb + kk; k = 0; break; } }
        }
      }
      noRing = false;
      if (D.wideP && !wide && rng() < D.wideP) wide = true;
      s += k; const c = cellOf(r, s); add(c, top, t);
      if (wide) { const o = radialNeighbor(r, s, rng() < .5 ? 1 : -1); if (o) add(o, top, t, true); }
      top += 1; prev = c;
    };
    // sideways: jump toward / away from the pillar (two rings over), flat or one block up
    const side = (t, flat) => {
      const [x, z] = sToXZ(r, s);
      const ew = Math.abs(Math.abs(x) - r) < 1e-6 && Math.abs(z) < r - 1e-6, ns = Math.abs(Math.abs(z) - r) < 1e-6 && Math.abs(x) < r - 1e-6;
      if (!ew && !ns) return false;
      const fits = R => R >= 2.5 && R <= 4.5 && (ew ? Math.abs(z) < R - 1e-6 : Math.abs(x) < R - 1e-6);
      let opts = [r + 2, r - 2].filter(fits);
      if (!opts.length) { opts = [r + 1, r - 1].filter(fits); flat = false; } // only one ring over: make it a sideways step up
      if (!opts.length) return false;
      const R = opts[Math.floor(rng() * opts.length)];
      const nx = ew ? Math.sign(x) * R : x, nz = ns ? Math.sign(z) * R : z;
      const c = [Math.round(nx + 4.5), Math.round(nz + 4.5)]; if (isPillar(c[0], c[1])) return false;
      const y = flat ? top - 1 : top; add(c, y, t);
      s = Math.floor(s / (8 * r)) * 8 * R + xzToS(R, nx, nz); r = R; prev = c; if (!flat) top += 1; noRing = true;
      if (D.easy) { // two-wide landing (behind, so it never sits under the next step)
        const w = cellOf(R, s - 1); const free = d => !B.has(K(w[0], y + d, w[1]));
        if (!isPillar(w[0], w[1]) && cheb(w, c) === 1 && free(-1) && free(0) && free(1) && free(2) && free(3)) add(w, y, t, true);
      }
      return true;
    };

    const seq = ['step'];
    for (const it of S.intro) { seq.push(it); seq.push('step'); }
    if (S.mix) {
      const m = S.mix.slice();
      for (let q = m.length - 1; q > 0; q--) { const w = Math.floor(rng() * (q + 1)); [m[q], m[w]] = [m[w], m[q]]; }
      m.forEach((it, q) => { seq.push(it); if (q % 2 === 1) seq.push('step'); });
    }
    while (seq.length < S.n) seq.push(pick(S.feats));

    for (let ft of seq) {
      if (ft === 'mover') {
        const ok = x => { const P = 8 * r, L = 2 * r, ss = ((x % P) + P) % P; return Math.floor((ss + 1) / L) === Math.floor((ss + 5 - 1e-6) / L) && ss + 5 < P; };
        for (let tries = 0; tries < 3 && !ok(s); tries++) { const k = [2, 3, 1].find(k => ok(s + k)) || 2; s += k; const c = cellOf(r, s); add(c, top, S.block); top += 1; prev = c; }
        if (!ok(s)) ft = 'step';
      }
      // sideways moves can't start on a corner: walk one plain step and try again
      if (ft === 'side') { if (!side(S.block, rng() < .5)) { step(S.block, false, 2); if (!side(S.block, rng() < .5)) ft = 'step'; } }
      if (ft === 'zigzag') {
        let ok1 = side(S.block, true); if (!ok1) { step(S.block, false, 2); ok1 = side(S.block, true); }
        if (ok1) { step(S.block, false, 2); if (!side(S.block, true)) { step(S.block, false, 2); side(S.block, true); } } else ft = 'step';
      }
      if (ft === 'hop') { for (let q = 0; q < D.hopN; q++) { s += pick(D.hop); const c = cellOf(r, s); add(c, top - 1, S.block); prev = c; } }
      if (ft === 'step') step(S.block, false);
      else if (ft === 'wide') step(S.block, true);
      else if (ft === 'gap2') step(S.block, false, D.gap2);
      else if (ft === 'icestep') step('ice', false);
      else if (ft === 'stair') { s += 1; add(cellOf(r, s), top, S.block); s += 1; const c = cellOf(r, s); add(c, top + 1, S.block); top += 2; prev = c; }
      else if (ft === 'bridge' || ft === 'icebridge' || ft === 'lavabridge') {
        const t = ft === 'icebridge' ? 'ice' : S.block, lava = ft === 'lavabridge';
        s += 2; add(cellOf(r, s), top, t); s += 1; add(cellOf(r, s), top, lava ? 'lava' : t, lava); s += 1; const c = cellOf(r, s); add(c, top, t); top += 1; prev = c;
      }
      else if (ft === 'lavaside') {
        s += 2; const c = cellOf(r, s); add(c, top, S.block);
        for (const d of (D.easy ? [rng() < .5 ? 1 : -1] : [1, -1])) { const o = radialNeighbor(r, s, d); if (o) add(o, top, 'lava', true); }
        top += 1; prev = c;
      }
      else if (ft === 'slime') { s += 2; add(cellOf(r, s), top - 1, 'slime'); s += 2; const c = cellOf(r, s); add(c, top + 2, S.block); top += 3; prev = c; }
      else if (ft === 'mover') {
        movers.push({ r, s0: s + 3, A: 1, w: R(1.1, 1.5) * D.moverW, ph: R(0, 6.28), y: top, stage: si + 1 });
        route.push({ kind: 'mover', m: movers.length - 1, stage: si });
        s += 6; const c = cellOf(r, s); add(c, top + 1, S.block); top += 2; prev = c;
      }
      else if (ft === 'spike') {
        s += 2; add(cellOf(r, s), top, S.block);
        const base = R(0, 2.6);
        for (let q = 0; q < 2; q++) { s += 1; const c = cellOf(r, s); add(c, top, 'spike', true); spikes.push({ i: c[0], j: c[1], y: top, ph: base + q * .55 }); }
        s += 1; const c = cellOf(r, s); add(c, top, S.block); top += 1; prev = c;
      }
      else if (ft === 'fire') {
        // 3-4 block bridge; a launcher at body height beside the middle block fires across it
        const has = x => radialNeighbor(r, x, 1) || radialNeighbor(r, x, -1);
        const m = has(s + 3) ? 3 : (has(s + 4) ? 4 : 3);
        s += 2; add(cellOf(r, s), top, S.block);
        for (let q = 3; q <= m; q++) { s += 1; add(cellOf(r, s), top, S.block, true); }
        const mid = cellOf(r, s);
        let L = r < 4.5 ? radialNeighbor(r, s, 1) : null; if (!L) L = radialNeighbor(r, s, -1);
        if (L) { B.set(K(L[0], top + 1, L[1]), 'launcher'); fires.push({ i: L[0], j: L[1], y: top + 1, ti: mid[0], tj: mid[1], period: R(1.8, 2.3) * D.fireMul, ph: R(0, 1.6), stage: si + 1 }); }
        s += 1; const c = cellOf(r, s); add(c, top, S.block); top += 1; prev = c; noRing = true;
      }
    }

    // final approach: four plain steps, then the safe floor with a hole above them
    for (let q = 0; q < 4; q++) { s += 2; const c = cellOf(r, s); add(c, top, S.block); top += 1; prev = c; }
    const last4 = sp.slice(-4).map(p => p.c);
    const hole = [];
    const fy = top, type = si === STAGES.length - 1 ? 'goal' : 'cp';
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) {
      if (isPillar(i, j)) continue;
      if (last4.some(c => cheb(c, [i, j]) <= 1)) hole.push([i, j]);
      else B.set(K(i, fy, j), type === 'goal' ? 'goal' : 'floor' + (si + 1));
    }
    const inHole = c => hole.some(h => h[0] === c[0] && h[1] === c[1]);
    let ss = s, sc; do { ss += 1; sc = cellOf(r, ss); } while (inHole(sc));
    floors.push({ y: fy, stage: si + 1, type, spawn: sc, hole });
    route.push({ kind: 'floor', f: floors.length - 1, stage: si });
    s = ss; top = fy + 1; prev = sc; noRing = false;
    path.push(...sp);
  });
  return { B, movers, floors, path, spikes, fires, route, TOP: floors[floors.length - 1].y };
}
