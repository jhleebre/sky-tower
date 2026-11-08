// DOM side of the game: HUD chips, stage banner and the start / pause / win cards.
// Elements are defined in index.html; this module only fills and toggles them.
const $ = id => document.getElementById(id);

export const fmt = s => { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------- overlays ---------- */
const OVS = ['ovStart', 'ovPause', 'ovWin'];
/** Shows one overlay card (or none with null). */
export function showOv(id) { OVS.forEach(o => $(o).hidden = o !== id); }
export const startShown = () => !$('ovStart').hidden;
/** Presses the first button of the start card (Space in the menu). */
export function clickStart() { const b = document.querySelector('#startBtns .btn'); if (b) b.click(); }

/* ---------- banner ---------- */
let bannerT = 0;
export function banner(k, n, h) {
  $('bK').textContent = k; $('bN').textContent = n;
  $('bH').hidden = !h; $('bH').textContent = h || '';
  $('banner').classList.add('show'); bannerT = h ? 3.4 : 2.2;
}
export function hideBanner() { $('banner').classList.remove('show'); bannerT = 0; }
export function tickBanner(dt) { if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('show'); } }

/* ---------- HUD ---------- */
let hc = '';
export function resetHud() { hc = ''; }
/** stage: 1-based floor shown, pct: height climbed 0..100, phy: difficulty entry from config.PHYS */
export function updateHud(stage, stageName, time, deaths, pct, phy) {
  const s = [stage, Math.floor(time), deaths, Math.round(pct), phy.label].join('|'); if (s === hc) return; hc = s;
  $('sNum').textContent = stage; $('sName').textContent = stageName; $('tm').textContent = fmt(time); $('dc').textContent = deaths; $('bar').style.width = pct + '%';
  $('dTag').textContent = phy.label; $('dTag').style.background = phy.color;
}
export function setViewLabel(label) { $('viewBtn').textContent = label; }
export function setMusicLabel(on) { const b = $('musicBtn'); b.textContent = on ? '음악 켬' : '음악 끔'; b.setAttribute('aria-pressed', on); }
export function setMuteLabel(muted) { const b = $('muteBtn'); b.textContent = muted ? '소리 끔' : '소리 켬'; b.setAttribute('aria-pressed', !muted); }

/* ---------- cards ---------- */
/** cont: null, or {label, fn} for the continue button. */
export function renderStart({ diff, phy, best, cont, onStart }) {
  $('diffSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.d === diff));
  $('bestLine').hidden = best == null; $('bestLine').textContent = phy.label + ' 최고 기록 ' + (best == null ? '' : fmt(best));
  const bx = $('startBtns'); bx.innerHTML = '';
  const mk = (txt, cls, fn) => { const b = document.createElement('button'); b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = txt; b.onclick = fn; bx.appendChild(b); return b; };
  if (cont) { mk(cont.label, '', cont.fn); mk('처음부터 새로 시작', 'alt', onStart); }
  else mk('시작하기', '', onStart);
}

export function showPause(noFill) { $('toCpBtn').hidden = !!noFill; showOv('ovPause'); $('resumeBtn').focus(); }

export function showWin({ msg, time, deaths, bestLine }) {
  $('wMsg').textContent = msg; $('wTime').textContent = fmt(time); $('wDeaths').textContent = deaths; $('wBest').textContent = bestLine;
  showOv('ovWin'); $('againBtn').focus();
}

/** Wires the static buttons. h: {onDiff(d), onMenu, onView, onMute, onMusic, onResume, onToCp, onRestart, onHome, onAgain} */
export function bindHud(h) {
  $('diffSeg').querySelectorAll('button').forEach(b => b.onclick = () => h.onDiff(b.dataset.d));
  $('menuBtn').onclick = h.onMenu;
  $('viewBtn').onclick = e => { h.onView(); e.currentTarget.blur(); };
  $('muteBtn').onclick = e => { h.onMute(); e.currentTarget.blur(); };
  $('musicBtn').onclick = e => { h.onMusic(); e.currentTarget.blur(); };
  $('resumeBtn').onclick = h.onResume;
  $('toCpBtn').onclick = h.onToCp;
  $('restartBtn').onclick = h.onRestart;
  $('homeBtn').onclick = h.onHome;
  $('againBtn').onclick = h.onAgain;
  $('winHomeBtn').onclick = h.onHome;
}
