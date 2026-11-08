// Game flow: states (menu / play / paused / win), difficulty, start / continue,
// checkpoints and records, and turning input into simulation steps.
// Connects the world simulation to rendering and UI.
import { STEP, PHYS, PLAYER_COLOR } from './config.js';
import { STAGES } from './data/stages.js';
import { buildTower } from './world/tower.js';
import { createSim, resetRun, respawn, curCp, step, idle, killBalls, spikeState } from './world/sim.js';
import { buildTowerMesh } from './render/towerMesh.js';
import { burst, dust, splash, sparkleRing, firework } from './render/effects.js';
import { squash } from './render/player.js';
import { sound } from './audio/sound.js';
import { snapCamera, VIEWS, VIEW_ORDER } from './render/cameraRig.js';
import { KEYMAP, touch, bindInput } from './ui/input.js';
import * as hud from './ui/hud.js';
import { getBest, setBest, prefs } from './util/storage.js';

export const G = {
  state: 'menu',    // 'menu' | 'play' | 'paused' | 'win'
  diff: 'easy',
  phy: PHYS.easy,
  tower: null,      // world/tower.js
  sim: null,        // world/sim.js (the run in progress, or the idle tower behind the menu)
  runActive: false, // a run can be continued from the menu
  view: 'far',
  speed: 1,         // simulation speed (autoplay can run faster)
  pilot: null,      // autoplay: returns the input for the next step, or null to hold still
  pilotStop: null,  // autoplay: called on Esc to take back control
};

const keys = { L: 0, R: 0, U: 0, D: 0, J: 0 };
let jumpQueued = false;

// Simulation events -> sound, effects, banners, win
const distTo = (x, y, z) => { const P = G.sim.P; return Math.hypot(P.x - x, P.y + .9 - y, P.z - z); };
const DUST = { ice: '#e6f6ff', slime: '#b8ff9a', ground: '#d9f0c8', mover: '#d6e6ff' };
const events = {
  die: () => { const P = G.sim.P; burst(P.x, P.y + .8, P.z, PLAYER_COLOR); sound.die(); },
  respawn: () => snapCamera(G.sim.P),
  jump: () => { const P = G.sim.P; dust(P.x, P.y, P.z, .15); squash(-.35); sound.jump(); },
  land: (vy, type) => {
    const P = G.sim.P, k = Math.max(0, Math.min(1, (-vy - 4) / 14));
    dust(P.x, P.y, P.z, k, DUST[type] || '#e8e4da'); squash(.25 + k * .5); sound.land(k, type === 'ice');
  },
  bounce: () => { const P = G.sim.P; splash(P.x, P.y, P.z); squash(.9); sound.bounce(); },
  fire: e => sound.fire(distTo(e.cx, e.y + .5, e.cz)),
  pop: b => { burst(b.x, b.y, b.z, '#ff9f4d', 6); sound.pop(distTo(b.x, b.y, b.z)); },
  reach: f => {
    const P = G.sim.P; burst(P.x, P.y + .5, P.z, '#ffd23f'); sparkleRing(P.x, P.y, P.z); sound.checkpoint();
    if (f.type !== 'goal') { const S = STAGES[f.stage]; hud.banner('STAGE ' + (f.stage + 1), S.name, S.hint); }
  },
  win,
};

function clearKeys() { for (const k in keys) keys[k] = 0; jumpQueued = false; }

function buildWorld(d) {
  G.tower = buildTower(PHYS[d].layout);
  G.sim = createSim(G.tower, PHYS[d]);
  buildTowerMesh(G.tower);
}

function begin() {
  G.state = 'play'; hud.showOv(null);
  respawn(G.sim); snapCamera(G.sim.P); clearKeys();
}

/** New run. from: start at that floor's flag (autoplay QA). */
export function start({ from = 0 } = {}) {
  resetRun(G.sim, from); G.runActive = true; begin();
  const S = STAGES[from];
  const sub = from > 0 ? '이어서 올라가요!' : (G.phy.noFill ? '어려움 모드 · 떨어지면 아래층까지 갈 수 있어요!' : G.phy.label + ' 모드 · 꼭대기까지 올라가자!');
  hud.banner('STAGE ' + (from + 1), S.name, sub);
}
function cont() {
  begin();
  const c = Math.min(curCp(G.sim), STAGES.length - 1);
  hud.banner('STAGE ' + (c + 1), STAGES[c].name, '이어서 올라가요!');
}
function pause() { G.state = 'paused'; hud.showPause(G.phy.noFill); }
function resume() { G.state = 'play'; hud.showOv(null); }

export function goHome() {
  G.state = 'menu'; hud.hideBanner(); killBalls(G.sim);
  renderStart(); hud.showOv('ovStart');
}

function win() {
  G.state = 'win'; G.runActive = false;
  const s = G.sim, record = !G.pilot; // autoplay runs don't count as records
  let best = getBest(G.diff);
  const nb = record && (best == null || s.time < best);
  if (nb) { best = s.time; setBest(G.diff, best); }
  const P = s.P;
  sound.win();
  const cols = ['#ffd23f', '#3ee0a1', '#ff70a6', '#4f9dff', '#ffffff', '#ff9f4d'];
  for (let i = 0; i < 8; i++) setTimeout(() => {
    const a = i * 2.4;
    firework(P.x + Math.cos(a) * 2.5, P.y + 3 + (i % 3), P.z + Math.sin(a) * 2.5, cols[i % cols.length]); sound.firework();
  }, 200 + i * 260);
  setTimeout(() => {
    if (G.state !== 'win') return;
    hud.showWin({
      msg: G.phy.label + ' 모드로 10층 블록 탑 꼭대기에 올랐어요.' + (nb ? ' 새 최고 기록이에요!' : record ? '' : ' (자동 플레이)'),
      time: s.time, deaths: s.deaths,
      bestLine: best == null ? '' : G.phy.label + ' 최고 기록 ' + hud.fmt(best),
    });
  }, 1000);
}

/** remember: save as the player's choice (autoplay switches without saving) */
export function setDiff(d, { remember = true } = {}) {
  if (d === G.diff || !PHYS[d]) return;
  G.diff = d; G.phy = PHYS[d]; if (remember) prefs.diff = d;
  buildWorld(d); G.runActive = false; snapCamera(G.sim.P); hud.resetHud();
  renderStart();
}

function renderStart() {
  const s = G.sim;
  hud.renderStart({
    diff: G.diff, phy: G.phy, best: getBest(G.diff), onStart: () => start(),
    cont: G.runActive && s.cp < STAGES.length ? { label: '이어하기 · ' + (curCp(s) + 1) + '층부터 (' + hud.fmt(s.time) + ')', fn: cont } : null,
  });
}

function setView(v) { G.view = v; prefs.view = v; hud.setViewLabel(VIEWS[v].label); }
function cycleView() { setView(VIEW_ORDER[(VIEW_ORDER.indexOf(G.view) + 1) % VIEW_ORDER.length]); }

/* ---------- input ---------- */
function toggleMute() { hud.setMuteLabel(sound.toggleMute()); }

function onKeyDown(e) {
  sound.init();
  if (e.code === 'KeyM' && !e.repeat) { toggleMute(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (G.pilot) { if (G.pilotStop) G.pilotStop(); return; }
    if (G.state === 'play') pause(); else if (G.state === 'paused') resume();
    return;
  }
  if (e.code === 'KeyV' && !e.repeat) { cycleView(); return; }
  const k = KEYMAP[e.code]; if (!k) return;
  if (G.pilot) { e.preventDefault(); return; } // autoplay owns the controls
  if (G.state !== 'play') {
    if (G.state === 'menu' && k === 'J' && !e.repeat && hud.startShown() && document.activeElement === document.body) { e.preventDefault(); hud.clickStart(); }
    return;
  }
  e.preventDefault();
  if (k === 'J' && !e.repeat && !keys.J) jumpQueued = true;
  keys[k] = 1;
}
function onKeyUp(e) { const k = KEYMAP[e.code]; if (k) keys[k] = 0; }
function onJump(down) {
  if (down) { if (!keys.J && G.state === 'play' && !G.pilot) jumpQueued = true; keys.J = 1; }
  else keys.J = 0;
}
function onBlur() { clearKeys(); if (G.state === 'play' && !G.pilot) pause(); }
function onHidden() { if (G.state === 'play' && !G.pilot) pause(); }

export function init() {
  G.diff = PHYS[prefs.diff] ? prefs.diff : 'easy'; G.phy = PHYS[G.diff];
  setView(VIEWS[prefs.view] ? prefs.view : 'far');
  bindInput({ onKeyDown, onKeyUp, onJump, onBlur, onHidden });
  hud.bindHud({
    onDiff: setDiff, onMenu: () => { if (G.state === 'play' && !G.pilot) pause(); }, onView: cycleView,
    onResume: resume, onToCp: () => { respawn(G.sim); snapCamera(G.sim.P); resume(); },
    onRestart: () => start(), onHome: goHome, onAgain: () => start(),
    onMute: () => { sound.init(); toggleMute(); },
  });
  hud.setMuteLabel(sound.muted);
  window.addEventListener('pointerdown', () => sound.init());
  buildWorld(G.diff); snapCamera(G.sim.P); renderStart(); hud.showOv('ovStart');
}

/* ---------- fixed-step simulation ---------- */
let acc = 0;
const human = { turn: 0, fwd: 0, jump: false };
function humanInput() {
  human.turn = ((keys.L || touch.L) ? 1 : 0) - ((keys.R || touch.R) ? 1 : 0);
  human.fwd = ((keys.U || touch.U) ? 1 : 0) - ((keys.D || touch.D) ? 1 : 0);
  human.jump = jumpQueued; jumpQueued = false;
  return human;
}

export function update(dt) {
  if (G.state === 'play') {
    acc += dt * G.speed;
    while (acc >= STEP && G.state === 'play') {
      const inp = G.pilot ? G.pilot() : humanInput();
      if (!inp) { acc = 0; break; } // autoplay is still planning: hold everything still
      step(G.sim, inp, events);
      acc -= STEP;
    }
  } else { acc = 0; idle(G.sim, dt, events); }
}

/* ---------- per-frame sounds that come from watching the world ---------- */
let stepPhase = 0;
const spikeSt = [];
/** Footsteps and spike clicks (no simulation event for these; they follow what is on screen). */
export function updateSounds() {
  const s = G.sim, P = s.P;
  const ph = Math.floor(P.walk / Math.PI);
  if (ph !== stepPhase) { stepPhase = ph; if (G.state === 'play' && P.ground && Math.hypot(P.vx, P.vz) > 1) sound.step(P.gType === 'ice'); }
  s.tower.spikes.forEach((sp, k) => {
    const st = spikeState(s, sp);
    if (st !== spikeSt[k] && spikeSt[k] !== undefined) {
      const d = distTo(sp.i - 4.5, sp.y + 1, sp.j - 4.5);
      if (st === 1) sound.spikeWarn(d); else if (st === 2) sound.spikeUp(d);
    }
    spikeSt[k] = st;
  });
}

/** Values for the HUD chips. */
export function hudValues() {
  const s = G.sim, stg = Math.min(STAGES.length, curCp(s) + 1);
  const pct = Math.max(0, Math.min(100, s.P.y / (G.tower.TOP + 1) * 100));
  return [stg, STAGES[stg - 1].name, s.time, s.deaths, pct, G.phy];
}
