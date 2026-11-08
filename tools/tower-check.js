// Tower check shared by check-tower.mjs (Node) and check-tower.html (browser).
//  1. The generated layouts still match the recorded fingerprints (catches
//     accidental changes to the tower; update LAYOUT_HASH on purpose when you
//     change the tower).
//  2. The autoplay planner can climb all ten floors on every difficulty.
//  3. Replaying the planned inputs on a fresh run reaches the top without a
//     single fall (the simulation is deterministic).
import { PHYS, DIFFS } from '../src/config.js';
import { STAGES } from '../src/data/stages.js';
import { buildTower } from '../src/world/tower.js';
import { createSim, resetRun, cloneSim } from '../src/world/sim.js';
import { planStage, drain, replay } from '../src/dev/planner.js';

// Fingerprints of the original single-file game's towers
export const LAYOUT_HASH = { easy: '6e49f181-44abb1db', hard: 'd21a4c3a-d1a77751' };

function fnv(s) { let a = 2166136261; for (let i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619) >>> 0; } return a.toString(16).padStart(8, '0'); }

/** Fingerprint of a generated tower (blocks, floors, moving blocks, spikes, launchers). */
export function layoutHash(T) {
  const b = [...T.B.entries()].map(e => e.join('=')).sort().join(';');
  const rest = JSON.stringify({
    f: T.floors.map(f => [f.y, f.stage, f.type, f.spawn, f.hole]),
    m: T.movers.map(m => [m.r, m.s0, m.A, m.w, m.ph, m.y, m.stage]),
    s: T.spikes.map(p => [p.i, p.j, p.y, p.ph]),
    e: T.fires.map(e => [e.i, e.j, e.y, e.ti, e.tj, e.period, e.ph, e.stage]),
    t: T.TOP,
  });
  return fnv(b) + '-' + fnv(rest);
}

/** Checks difficulties (default all), logging each line. Returns the failure count. */
export function checkTower(diffs = DIFFS, log = console.log) {
  let failed = 0;
  for (const layout of Object.keys(LAYOUT_HASH)) {
    const T = buildTower(layout), h = layoutHash(T);
    const holeClash = [...T.holeAt.keys()].filter(k => T.B.has(k));
    if (h !== LAYOUT_HASH[layout]) { failed++; log(`✘ layout '${layout}' changed: ${h} (expected ${LAYOUT_HASH[layout]})`); }
    else log(`✔ layout '${layout}' unchanged (${h}), ${T.B.size} cells, route ${T.route.length} stops`);
    if (holeClash.length) { failed++; log(`✘ layout '${layout}': hole cells overlap blocks: ${holeClash.join(' ')}`); }
  }
  for (const d of diffs) {
    const phys = PHYS[d], T = buildTower(phys.layout);
    const s = createSim(T, phys); resetRun(s, 0);
    const start = cloneSim(s), all = [];
    let cur = s, ok = true, rollouts = 0;
    const t0 = Date.now();
    for (let k = 0; k < STAGES.length; k++) {
      const t1 = Date.now();
      const r = drain(planStage(cur, k));
      rollouts += r.rollouts;
      if (!r.ok) {
        ok = false; failed++;
        const w = r.failedAt;
        log(`✘ ${phys.label} ${k + 1}층 ${STAGES[k].name}: stuck at stop ${r.reachedStops + 1}/${r.stops}` + (w ? ` (${w.kind}${w.i !== undefined ? ` ${w.i},${w.y},${w.j}` : ''})` : '') + ` after ${r.rollouts} tries`);
        break;
      }
      all.push(r.codes);
      log(`   ${phys.label} ${k + 1}층 ${STAGES[k].name}: ${r.stops} stops, ${(r.codes.length / 120).toFixed(1)}s of play, ${r.rollouts} tries [${Date.now() - t1}ms]`);
      cur = r.end;
    }
    if (!ok) continue;
    // Replay everything on a fresh run
    const re = cloneSim(start);
    for (const c of all) replay(re, c);
    const same = re.won && re.deaths === 0 && re.P.x === cur.P.x && re.P.y === cur.P.y && re.simT === cur.simT;
    if (!same) { failed++; log(`✘ ${phys.label}: replay differs from the plan (won ${re.won}, deaths ${re.deaths})`); }
    else log(`✔ ${phys.label}: climbed all ${STAGES.length} floors in ${Math.floor(re.time / 60)}:${String(Math.floor(re.time % 60)).padStart(2, '0')} with 0 falls, replay matches (${rollouts} tries, ${Date.now() - t0}ms)`);
  }
  return failed;
}
