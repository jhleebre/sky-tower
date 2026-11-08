// One run up the tower: player physics, moving blocks, spikes, fireballs,
// checkpoints and filled holes. No DOM or three.js.
//
// Everything that changes during a run lives in the sim object, so cloneSim()
// gives an independent copy. Physics runs on a fixed step (STEP) and the same
// inputs always give the same result, which is what lets the autoplay planner
// try moves on a copy and then have the real game replay them exactly.
//
// Inputs per step: {turn: -1|0|1 (1 = left), fwd: -1|0|1, jump: bool (just pressed)}
// Events (all optional, they only report): die(), respawn(), jump(), land(vy, groundType),
// bounce(), reach(floor), win(), fire(launcher), pop(ball)
import { HW, PH, GRAV, JV, JB, MOVE, TURN, STEP, FIRE_SPEED, FIRE_R } from '../config.js';
import { sToXZ, isPillar } from './ring.js';

const E = 1e-4;
const NOEV = {};
const key = (i, y, j) => i + ',' + y + ',' + j;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export function createSim(tower, phys) {
  const n = tower.movers.length;
  const s = {
    tower, phys,
    simT: 0,      // hazard clock (also runs in menus)
    time: 0,      // run time
    deaths: 0,
    cp: 0,        // highest floor reached
    spawnCp: 0,   // last floor stood on (어려움 restarts here)
    won: false,
    filled: tower.floors.map(() => false),
    mx: new Float64Array(n), mz: new Float64Array(n), mdx: new Float64Array(n), mdz: new Float64Array(n),
    fireNext: Float64Array.from(tower.fires, e => e.ph),
    balls: [],
    P: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ground: false, gType: null, gMover: -1, coyote: 0, buffer: 0, dead: 0, face: 0, walk: 0 },
  };
  tower.movers.forEach((m, k) => { const [x, z] = sToXZ(m.r, m.s0); s.mx[k] = x; s.mz[k] = z; });
  respawn(s);
  return s;
}

export function cloneSim(s) {
  return {
    ...s,
    filled: s.filled.slice(),
    mx: s.mx.slice(), mz: s.mz.slice(), mdx: s.mdx.slice(), mdz: s.mdz.slice(),
    fireNext: s.fireNext.slice(),
    balls: s.balls.map(b => ({ ...b })),
    P: { ...s.P },
  };
}

/** Starts a fresh run, optionally from the flag of floor `from` (0 = the ground). */
export function resetRun(s, from = 0) {
  s.cp = s.spawnCp = from; s.time = 0; s.deaths = 0; s.won = false;
  s.filled.fill(false);
  if (!s.phys.noFill) for (let f = 1; f <= from; f++) s.filled[f] = true;
  killBalls(s);
  respawn(s);
}

export function killBalls(s) { for (const b of s.balls) b.alive = false; }

/** Floor whose flag the player restarts at. 어려움 uses the last floor stood on (even a lower one). */
export const curCp = s => s.phys.noFill ? s.spawnCp : s.cp;

export function respawn(s) {
  const P = s.P, f = s.tower.floors[curCp(s)];
  P.x = f.spawn[0] - 4.5; P.z = f.spawn[1] - 4.5; P.y = f.y + 1;
  P.vx = P.vy = P.vz = 0; P.dead = 0; P.gMover = -1; P.ground = true; P.gType = null;
  const a = Math.atan2(P.z, P.x); P.face = Math.atan2(-Math.sin(a), Math.cos(a));
}

/* ---------- world queries ---------- */
export function cellType(s, i, y, j) {
  const T = s.tower;
  if (i < 0 || i > 9 || j < 0 || j > 9) return y >= -1 ? 'wall' : null;
  if (isPillar(i, j)) return (y >= -1 && y <= T.TOP) ? 'wall' : null;
  const k = key(i, y, j), t = T.B.get(k);
  if (t) return t;
  const n = T.holeAt.get(k);
  if (n !== undefined && s.filled[n]) { const f = T.floors[n]; return f.type === 'goal' ? 'goal' : 'floor' + f.stage; }
  return null;
}
export const solid = (s, i, y, j) => cellType(s, i, y, j) !== null;

/** 0 down, 1 warning, 2 up */
export function spikeState(s, sp) {
  const T = s.phys.spike, per = T.down + T.warn + T.up, t = ((s.simT + sp.ph) % per + per) % per;
  return t < T.down ? 0 : (t < T.down + T.warn ? 1 : 2);
}

/* ---------- hazards ---------- */
function updMovers(s) {
  const M = s.tower.movers;
  for (let k = 0; k < M.length; k++) {
    const m = M[k], sc = m.s0 + Math.sin(s.simT * m.w + m.ph) * m.A;
    const [x, z] = sToXZ(m.r, sc);
    s.mdx[k] = x - s.mx[k]; s.mdz[k] = z - s.mz[k]; s.mx[k] = x; s.mz[k] = z;
  }
}

function spawnBall(s, e, ev) {
  let b = s.balls.find(b => !b.alive);
  if (!b) { b = {}; s.balls.push(b); }
  b.alive = true; b.x = e.cx + e.dx * .6; b.z = e.cz + e.dz * .6; b.y = e.y + .5;
  b.vx = e.dx * FIRE_SPEED; b.vz = e.dz * FIRE_SPEED; b.d = 0;
  if (ev.fire) ev.fire(e);
}

function updFires(s, dt, ev) {
  const F = s.tower.fires;
  for (let k = 0; k < F.length; k++) {
    if (s.simT >= s.fireNext[k]) {
      spawnBall(s, F[k], ev);
      s.fireNext[k] += F[k].period;
      if (s.fireNext[k] < s.simT) s.fireNext[k] = s.simT + F[k].period;
    }
  }
  for (const b of s.balls) {
    if (!b.alive) continue;
    b.x += b.vx * dt; b.z += b.vz * dt; b.d += FIRE_SPEED * dt;
    const t = cellType(s, Math.floor(b.x + 5), Math.floor(b.y), Math.floor(b.z + 5));
    if (b.d > 6.5 || (b.d > .9 && t && t !== 'launcher')) { b.alive = false; if (ev.pop) ev.pop(b); }
  }
}

/** Hazards keep moving while the game is in a menu or paused. */
export function idle(s, dt, ev = NOEV) {
  s.simT += dt; updMovers(s); updFires(s, dt, ev);
}

/* ---------- player collision ---------- */
function moverBox(s, k) {
  const m = s.tower.movers[k], x = s.mx[k], z = s.mz[k];
  return { x0: x - m.hx, x1: x + m.hx, y0: m.y, y1: m.y + 1, z0: z - m.hz, z1: z + m.hz };
}
function overlapsBox(P, b) {
  return P.x - HW < b.x1 - E && P.x + HW > b.x0 + E && P.y < b.y1 - E && P.y + PH > b.y0 + E && P.z - HW < b.z1 - E && P.z + HW > b.z0 + E;
}

let hitMover = -1;
function moveAxis(s, ax, d) {
  if (d === 0) return false;
  const P = s.P;
  P[ax] += d;
  const i0 = Math.floor(P.x - HW + 5 + E), i1 = Math.floor(P.x + HW + 5 - E), j0 = Math.floor(P.z - HW + 5 + E), j1 = Math.floor(P.z + HW + 5 - E), y0 = Math.floor(P.y + E), y1 = Math.floor(P.y + PH - E);
  let hit = false; hitMover = -1;
  for (let i = i0; i <= i1; i++) for (let y = y0; y <= y1; y++) for (let j = j0; j <= j1; j++) {
    if (!solid(s, i, y, j)) continue; hit = true;
    if (ax === 'x') P.x = d > 0 ? Math.min(P.x, (i - 5) - HW) : Math.max(P.x, (i - 4) + HW);
    else if (ax === 'z') P.z = d > 0 ? Math.min(P.z, (j - 5) - HW) : Math.max(P.z, (j - 4) + HW);
    else P.y = d > 0 ? Math.min(P.y, y - PH) : Math.max(P.y, y + 1);
  }
  for (let k = 0; k < s.tower.movers.length; k++) {
    const b = moverBox(s, k); if (!overlapsBox(P, b)) continue; hit = true; hitMover = k;
    if (ax === 'x') P.x = d > 0 ? b.x0 - HW : b.x1 + HW; else if (ax === 'z') P.z = d > 0 ? b.z0 - HW : b.z1 + HW; else P.y = d > 0 ? b.y0 - PH : b.y1;
  }
  return hit;
}

function groundType(s) {
  const P = s.P, y = Math.floor(P.y - .01), types = [];
  for (const [ox, oz] of [[0, 0], [-HW + .02, -HW + .02], [HW - .02, -HW + .02], [-HW + .02, HW - .02], [HW - .02, HW - .02]]) {
    const t = cellType(s, Math.floor(P.x + ox + 5), y, Math.floor(P.z + oz + 5)); if (t) types.push(t);
  }
  if (types.includes('slime')) return 'slime';
  return cellType(s, Math.floor(P.x + 5), y, Math.floor(P.z + 5)) || types[0] || null;
}

// Forgiving hazard checks: only a slimmer core of the body counts
function touchingLava(s) {
  const P = s.P, C = s.phys.core;
  const i0 = Math.floor(P.x - C + 5), i1 = Math.floor(P.x + C + 5), j0 = Math.floor(P.z - C + 5), j1 = Math.floor(P.z + C + 5), y0 = Math.floor(P.y - .03), y1 = Math.floor(P.y + PH - .2);
  for (let i = i0; i <= i1; i++) for (let y = y0; y <= y1; y++) for (let j = j0; j <= j1; j++) if (cellType(s, i, y, j) === 'lava') return true;
  return false;
}
function onRaisedSpike(s) {
  const P = s.P, C = s.phys.core;
  for (const sp of s.tower.spikes) {
    if (spikeState(s, sp) !== 2) continue;
    const top = sp.y + 1;
    if (P.y < top - .05 || P.y > top + .35) continue;
    const x0 = sp.i - 5, z0 = sp.j - 5;
    if (P.x + C > x0 && P.x - C < x0 + 1 && P.z + C > z0 && P.z - C < z0 + 1) return true;
  }
  return false;
}
function hitByFire(s) {
  const P = s.P, C = s.phys.core;
  for (const b of s.balls) {
    if (!b.alive) continue;
    const cx = clamp(b.x, P.x - C, P.x + C), cy = clamp(b.y, P.y + .1, P.y + PH - .1), cz = clamp(b.z, P.z - C, P.z + C);
    if ((b.x - cx) ** 2 + (b.y - cy) ** 2 + (b.z - cz) ** 2 < FIRE_R * FIRE_R) return true;
  }
  return false;
}

function die(s, ev) {
  if (s.P.dead > 0) return;
  s.P.dead = .7; s.deaths++;
  if (ev.die) ev.die();
}

function reach(s, f, ev) {
  if (!f || f.stage <= s.cp) return;
  s.cp = f.stage;
  if (!s.phys.noFill) s.filled[f.stage] = true;
  if (ev.reach) ev.reach(f);
  if (f.type === 'goal') { s.won = true; if (ev.win) ev.win(); }
}

/* ---------- one physics step ---------- */
export function step(s, inp, ev = NOEV) {
  const P = s.P, T = s.tower, phy = s.phys, dt = STEP;
  if (inp.jump) P.buffer = .12;
  s.simT += dt; s.time += dt; updMovers(s); updFires(s, dt, ev);
  if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) { respawn(s); if (ev.respawn) ev.respawn(); } return; }

  // ride the moving block, and get pushed by ones that move into you
  if (P.gMover >= 0) { moveAxis(s, 'x', s.mdx[P.gMover]); moveAxis(s, 'z', s.mdz[P.gMover]); }
  for (let k = 0; k < T.movers.length; k++) {
    const b = moverBox(s, k);
    if (overlapsBox(P, b)) { if (T.movers[k].axis === 'x') P.x = s.mdx[k] > 0 ? b.x1 + HW : b.x0 - HW; else P.z = s.mdz[k] > 0 ? b.z1 + HW : b.z0 - HW; }
  }

  // tank-style: left/right turns the body, up/down walks forward/back
  P.face += inp.turn * TURN * dt;
  let fwd = inp.fwd;
  if (fwd < 0) fwd *= .6;
  const tx = Math.sin(P.face) * fwd * MOVE, tz = Math.cos(P.face) * fwd * MOVE;
  const onIce = P.ground && P.gType === 'ice';
  const a = (P.ground ? (onIce ? phy.iceA : 50) : 24) * dt;
  const ddx = tx - P.vx, ddz = tz - P.vz, dl = Math.hypot(ddx, ddz);
  if (dl <= a) { P.vx = tx; P.vz = tz; } else { P.vx += ddx / dl * a; P.vz += ddz / dl * a; }
  if (P.buffer > 0 && (P.ground || P.coyote > 0)) { P.vy = JV; P.ground = false; P.coyote = 0; P.buffer = 0; P.gMover = -1; if (ev.jump) ev.jump(); }
  P.vy -= GRAV * dt; P.vy = Math.max(P.vy, -30); P.buffer -= dt; P.coyote -= dt;
  if (moveAxis(s, 'x', P.vx * dt)) P.vx = 0;
  if (moveAxis(s, 'z', P.vz * dt)) P.vz = 0;
  const wasGround = P.ground, wasType = P.gType;
  P.ground = false; P.gMover = -1;
  const vyBefore = P.vy;
  if (moveAxis(s, 'y', P.vy * dt)) { if (vyBefore < 0) { P.ground = true; P.gMover = hitMover; } P.vy = 0; }
  if (P.ground) {
    P.coyote = phy.coyote;
    P.gType = P.gMover >= 0 ? 'mover' : groundType(s);
    if (P.gType === 'slime') { P.vy = JB; P.ground = false; P.gMover = -1; if (ev.bounce) ev.bounce(); }
    else if (!wasGround || wasType !== P.gType) {
      if (!wasGround && ev.land) ev.land(vyBefore, P.gType);
      if (P.gType && (P.gType.startsWith('floor') || P.gType === 'goal' || P.gType === 'ground')) {
        const fo = T.floorAt.get(Math.floor(P.y - .01));
        if (fo) { s.spawnCp = fo.stage; reach(s, fo, ev); }
      }
    }
  }
  if (s.won) return;
  if (touchingLava(s) || onRaisedSpike(s) || hitByFire(s)) { die(s, ev); return; }
  if (!phy.noFill && P.y < T.floors[s.cp].y - 25) die(s, ev); // 어려움: no rescue, you fall as far as the holes let you
  if (P.ground) P.walk += Math.hypot(P.vx, P.vz) * dt * 2.4;
}
