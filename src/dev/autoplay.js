// QA autoplay: open index.html?autoplay (see README for options).
// The planner (planner.js) works out each floor on a copy of the run, a few
// milliseconds per frame, staying ahead of the player; the real game then replays
// those inputs live, so you watch the actual game, physics and hazards included.
// The game holds still only if the player catches up with the planner.
// At every floor the real run is compared with the planned one (they must match
// exactly). Esc stops and returns to the menu. Autoplay runs don't set records.
import { STAGES } from '../data/stages.js';
import { PHYS, DIFFS } from '../config.js';
import { cloneSim, curCp } from '../world/sim.js';
import { planStage, decode } from './planner.js';
import { fmt } from '../ui/hud.js';
import * as game from '../game.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = cond => new Promise(r => { const i = setInterval(() => { if (cond()) { clearInterval(i); r(); } }, 100); });

/** Runs a planner generator a few ms at a time so the page keeps rendering. */
function sliced(gen, isCancelled, ms = 6) {
  return new Promise(res => {
    const run = () => {
      if (isCancelled()) return res(null);
      const t0 = performance.now();
      for (;;) {
        const r = gen.next();
        if (r.done) return res(r.value);
        if (performance.now() - t0 > ms) break;
      }
      setTimeout(run, 0);
    };
    run();
  });
}

function makePanel() {
  const el = document.createElement('div');
  el.className = 'chip auto';
  el.innerHTML = '<div class="t"></div><div class="s"></div><div class="ks"><span data-k="L">↺</span><span data-k="U">▲</span><span data-k="R">↻</span><span data-k="J">점프</span></div>';
  document.getElementById('app').appendChild(el);
  const q = s => el.querySelector(s);
  return {
    el,
    title(t) { q('.t').textContent = t; },
    status(t) { q('.s').textContent = t; },
    keys(inp, jumpLit) {
      q('[data-k=L]').classList.toggle('on', !!inp && inp.turn > 0);
      q('[data-k=R]').classList.toggle('on', !!inp && inp.turn < 0);
      q('[data-k=U]').classList.toggle('on', !!inp && inp.fwd > 0);
      q('[data-k=J]').classList.toggle('on', jumpLit);
    },
  };
}

const sameState = (a, b) => a.simT === b.simT && a.P.x === b.P.x && a.P.y === b.P.y && a.P.z === b.P.z && a.P.face === b.P.face && a.cp === b.cp;

/** Climbs one difficulty from floor `from`. Resolves to {ok, time, deaths, msg}. */
async function climb(d, from, panel, stopped) {
  const { G } = game;
  game.setDiff(d, { remember: false });
  const label = PHYS[d].label;
  const plans = []; // {codes, end, start}
  let pi = 0, ci = 0, jumpUntil = 0, desync = null, planFail = null, holding = false;
  const inp = {};

  G.pilot = () => {
    for (;;) {
      const p = plans[pi];
      if (!p) { holding = true; return null; }
      if (ci === 0 && !p.checked) { p.checked = true; if (!sameState(G.sim, p.start)) desync = `${pi + from + 1}층 시작`; }
      if (ci < p.codes.length) {
        decode(p.codes[ci++], inp); holding = false;
        if (inp.jump) jumpUntil = performance.now() + 180;
        return inp;
      }
      pi++; ci = 0;
    }
  };
  game.start({ from });

  // Plan every floor ahead of the replay, starting from an exact copy of the run
  let cur = cloneSim(G.sim);
  const planning = (async () => {
    for (let k = from; k < STAGES.length; k++) {
      const t0 = performance.now();
      const r = await sliced(planStage(cur, k), stopped);
      if (!r) return;
      console.log(`[autoplay] ${label} ${k + 1}층 ${r.ok ? '계획 완료' : '계획 실패'}: 정류장 ${r.reachedStops}/${r.stops}, 시도 ${r.rollouts}회, ${(performance.now() - t0).toFixed(0)}ms`);
      if (!r.ok) { planFail = `${k + 1}층 ${STAGES[k].name}`; return; }
      plans.push({ codes: r.codes, end: r.end, start: cur });
      cur = r.end;
    }
  })();

  const tick = setInterval(() => {
    const s = G.sim, c = Math.min(curCp(s), STAGES.length - 1);
    panel.title(`자동 플레이 · ${label} · ${c + 1}층 ${STAGES[c].name}${G.speed !== 1 ? ` · ${G.speed}배속` : ''}`);
    panel.status(holding ? `다음 층 경로 계산 중… (계획 ${plans.length + from}/${STAGES.length}층)` : `계획 ${plans.length + from}/${STAGES.length}층 · ${fmt(s.time)} · 아웃 ${s.deaths} · Esc: 그만하기 · V: 시점`);
    panel.keys(holding ? null : inp, performance.now() < jumpUntil);
  }, 50);

  await until(() => stopped() || G.state === 'win' || planFail || desync || G.sim.deaths > 0);
  clearInterval(tick);
  await planning;
  const s = G.sim;
  if (stopped()) return { ok: false, msg: '중단' };
  if (planFail) return { ok: false, msg: `${label}: ${planFail}에서 경로를 찾지 못했어요` };
  if (desync) return { ok: false, msg: `${label}: ${desync}에서 계획과 실제 게임이 달라졌어요` };
  if (s.deaths > 0) return { ok: false, msg: `${label}: 재생 중 아웃 (${Math.min(curCp(s), 9) + 1}층)` };
  return { ok: true, time: s.time, deaths: s.deaths, msg: `${label} ${fmt(s.time)} ✔` };
}

/**
 * diff: 'easy' | 'normal' | 'hard' | 'all', from: 0-based start floor, speed: simulation speed.
 * The final result is also left in window.__autoplay for scripted checks.
 */
export async function runAutoplay({ diff = 'easy', from = 0, speed = 1 } = {}) {
  const { G } = game;
  const diffs = diff === 'all' ? DIFFS : [PHYS[diff] ? diff : 'easy'];
  from = Math.max(0, Math.min(STAGES.length - 1, from | 0));
  const panel = makePanel();
  let stop = false;
  const stopped = () => stop;
  G.pilotStop = () => { stop = true; };
  G.speed = Math.max(.25, Math.min(8, speed || 1));
  const results = [];
  window.__autoplay = { done: false, results };

  for (const d of diffs) {
    const r = await climb(d, from, panel, stopped);
    results.push({ diff: d, ...r });
    if (!r.ok) break;
    await sleep(4500); // let the summit fireworks and the result card show
  }

  G.pilot = null; G.pilotStop = null; G.speed = 1; G.runActive = false;
  window.__autoplay.done = true;
  console.log('[autoplay]', results.map(r => `${r.diff}: ${r.msg}`).join(' | '));
  if (stop) { panel.el.remove(); game.goHome(); return; }
  const allOk = results.length === diffs.length && results.every(r => r.ok);
  panel.title(allOk ? '자동 플레이 완료' : '자동 플레이 실패');
  panel.status(results.map(r => r.msg).join(' · '));
  panel.keys(null, false);
  panel.el.classList.toggle('fail', !allOk);
}
