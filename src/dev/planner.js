// Autoplay planner: finds inputs that climb one floor of the tower.
//
// The generator records the route (the stops a player makes: blocks, slime,
// moving blocks, the flag). For each stop the planner tries simple "human" moves
// on a copy of the simulation: turn to face the stop, wait a moment, walk toward
// it, jump when it is a set distance away, brake so as to stop on it. The first
// move that lands safely is kept; if a later stop can't be reached from where it
// ended, the search backs up and tries the next move (depth-first).
//
// The simulation is deterministic, so the recorded inputs replay exactly in the
// real game (src/dev/autoplay.js) and in tools/check-tower.mjs. No DOM here.
import { STEP, TURN } from '../config.js';
import { cloneSim, step } from '../world/sim.js';

/** One step's input packed into a byte: bits 0-1 turn+1, bit 2 forward, bit 3 jump. */
export const encode = (turn, fwd, jump) => (turn + 1) | (fwd << 2) | (jump ? 8 : 0);
export function decode(c, out = {}) { out.turn = (c & 3) - 1; out.fwd = (c >> 2) & 1; out.jump = (c & 8) !== 0; return out; }

// Candidate moves: wait this many steps first, then jump at this distance from the stop (0 = just walk)
const WAITS = [0, 6, 12, 18, 24, 36, 48, 60, 72, 90, 108, 126, 144, 168, 192, 216, 240, 270, 300, 330, 360, 420, 480];
const AIR_WAITS = [0, 3, 6, 10, 15, 22, 30];
const UP_D = [1.5, 1.2, 1.8, 2.1, .9, 2.5, 9];
const FLAT_D = [0, 1.6, 1.9, 1.3, 2.3, 9, 1.0];
const TOL = TURN * STEP * .5;      // stop turning when this close to the heading
const MAX_TICKS = 720;            // give up a move after 6 s (plus its wait)
const MAX_SUCCESS = 5;            // landings tried per stop before backing up

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/** Where a route stop is: aim point (x, z), standing height y, and whether it is ice. */
function target(s, wp) {
  const T = s.tower;
  if (wp.kind === 'mover') { const m = T.movers[wp.m]; return { x: s.mx[wp.m], z: s.mz[wp.m], y: m.y + 1, ice: false }; }
  if (wp.kind === 'floor') { const f = T.floors[wp.f]; return { x: f.spawn[0] - 4.5, z: f.spawn[1] - 4.5, y: f.y + 1, ice: false }; }
  return { x: wp.i - 4.5, z: wp.j - 4.5, y: wp.y + 1, ice: T.B.get(wp.i + ',' + wp.y + ',' + wp.j) === 'ice' };
}

/** Is the player standing on the stop (or, for slime, did it just bounce)? */
function reached(s, wp, bounced) {
  const P = s.P;
  if (wp.kind === 'bounce') return bounced;
  if (wp.kind === 'mover') return P.ground && P.gMover === wp.m;
  if (!P.ground) return false;
  let i = wp.i, j = wp.j, y = wp.y;
  if (wp.kind === 'floor') {
    const f = s.tower.floors[wp.f]; if (s.cp < wp.f) return false;
    i = f.spawn[0]; j = f.spawn[1]; y = f.y;
  }
  return Math.floor(P.x + 5) === i && Math.floor(P.z + 5) === j && Math.abs(P.y - (y + 1)) < .01;
}

function* candidates(s, wp) {
  const P = s.P;
  if (!P.ground) { for (const wait of AIR_WAITS) yield { wait, D: 0 }; return; }
  const Ds = target(s, wp).y > P.y + .5 ? UP_D : FLAT_D;
  for (const wait of WAITS) for (const D of Ds) yield { wait, D };
}

/** Plays one candidate move on a copy of s. Returns {codes, sim} if it ends standing on the stop, else null. */
function rollout(s0, wp, cand, next) {
  const s = cloneSim(s0), P = s.P, codes = [];
  let bounced = false;
  const ev = { bounce() { bounced = true; } };
  const minY = Math.min(P.y, target(s, wp).y) - 1.2;
  const deaths0 = s.deaths, maxT = cand.wait + MAX_TICKS;
  const inp = { turn: 0, fwd: 0, jump: false };
  let jumped = false, settle = -1;
  for (let tick = 0; tick < maxT; tick++) {
    let turn = 0, fwd = 0, jump = false;
    if (settle < 0) {
      const t = target(s, wp), dx = t.x - P.x, dz = t.z - P.z, hd = Math.hypot(dx, dz);
      const e = wrap(Math.atan2(dx, dz) - P.face);
      if (hd > .3) turn = e > TOL ? 1 : e < -TOL ? -1 : 0;
      // nearly over the slime: already turn toward where the bounce should carry us (slime can sit on a corner)
      if (wp.kind === 'bounce' && next && hd < .7) {
        const n = target(s, next), en = wrap(Math.atan2(n.x - P.x, n.z - P.z) - P.face);
        turn = en > TOL ? 1 : en < -TOL ? -1 : 0;
      }
      if (tick >= cand.wait) {
        // walk while still far enough to brake in time (ice and air brake slower)
        const a = P.ground ? (P.gType === 'ice' ? s.phys.iceA : 50) : Math.min(24, t.ice ? s.phys.iceA : 50);
        const vt = hd > 1e-6 ? (P.vx * dx + P.vz * dz) / hd : 0;
        const stop = vt > 0 ? vt * vt / (2 * a) : 0;
        fwd = Math.abs(e) < (P.ground ? .35 : .6) && hd > stop + .08 ? 1 : 0;
        if (!jumped && cand.D > 0 && P.ground && Math.abs(e) < .2 && hd <= cand.D) { jump = true; jumped = true; }
      }
    }
    codes.push(encode(turn, fwd, jump));
    inp.turn = turn; inp.fwd = fwd; inp.jump = jump;
    step(s, inp, ev);
    if (s.deaths !== deaths0 || P.dead > 0) return null;
    if (s.won) return { codes, sim: s };
    if (settle >= 0) { // stand still until stopped; sliding off counts as a miss
      if (!reached(s, wp, false)) return null;
      settle++;
      if (wp.kind === 'mover' ? settle >= 4 : Math.hypot(P.vx, P.vz) < .05) return { codes, sim: s };
      continue;
    }
    if (reached(s, wp, bounced)) { if (wp.kind === 'bounce') return { codes, sim: s }; settle = 0; continue; }
    if (P.y < minY) return null;
    // landed after the jump but not on the stop: fine if level with it (walk on), otherwise a miss
    if (jumped && P.ground && Math.abs(P.y - target(s, wp).y) > .01 && !(wp.kind === 'floor' && s.cp >= wp.f)) return null;
  }
  return null;
}

/**
 * Plans floor `stage` (0-based) from state s0, which should stand on that floor's flag.
 * Generator: yields now and then so a browser can spread the work over frames
 * (drain() runs it in one go). Returns
 *   {ok, codes: Uint8Array of inputs, end: state after the last input, rollouts, stops, reachedStops}
 */
export function* planStage(s0, stage, { budget = 8000 } = {}) {
  const wps = s0.tower.route.filter(w => w.stage === stage);
  const st = { rollouts: 0, deepest: 0 };
  function* solve(s, k) {
    if (k > st.deepest) st.deepest = k;
    if (k === wps.length || s.won) return [];
    let ok = 0;
    for (const c of candidates(s, wps[k])) {
      if (st.rollouts >= budget) return null;
      if (++st.rollouts % 4 === 0) yield;
      const r = rollout(s, wps[k], c, wps[k + 1]);
      if (!r) continue;
      const rest = yield* solve(r.sim, k + 1);
      if (rest) { rest.unshift(r); return rest; }
      if (++ok >= MAX_SUCCESS) return null;
    }
    return null;
  }
  const segs = yield* solve(s0, 0);
  const base = { rollouts: st.rollouts, stops: wps.length, reachedStops: st.deepest };
  if (!segs) return { ok: false, codes: new Uint8Array(0), end: s0, failedAt: wps[st.deepest], ...base };
  const codes = new Uint8Array(segs.reduce((n, r) => n + r.codes.length, 0));
  let o = 0; for (const r of segs) { codes.set(r.codes, o); o += r.codes.length; }
  return { ok: true, codes, end: segs.length ? segs[segs.length - 1].sim : s0, ...base };
}

/** Runs a planStage generator to the end synchronously. */
export function drain(gen) { let r; while (!(r = gen.next()).done); return r.value; }

/** Replays packed inputs on s (mutates it). */
export function replay(s, codes, ev) {
  const inp = {};
  for (const c of codes) step(s, decode(c, inp), ev);
  return s;
}
