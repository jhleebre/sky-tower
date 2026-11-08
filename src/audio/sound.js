// All sounds are synthesised with WebAudio, so there are no audio files to load.
// The context starts on the first user gesture (browsers block autoplay).
// Sounds from hazards take a distance so far-away ones stay quiet.
import { prefs } from '../util/storage.js';

const near = (d, r = 9) => Math.max(0, 1 - d / r);

export const sound = {
  ctx: null, out: null, muted: prefs.muted,

  onRunning: null, // called once audio is actually running (the game starts the music then)

  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C();
      this.out = this.ctx.createGain(); this.out.gain.value = this.muted ? 0 : .5; this.out.connect(this.ctx.destination);
      this.ctx.addEventListener('statechange', () => { if (this.ctx.state === 'running' && this.onRunning) this.onRunning(); });
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      // a silent blip: Safari / iOS only unlock audio once something plays inside a gesture
      const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate), s = this.ctx.createBufferSource();
      s.buffer = b; s.connect(this.ctx.destination); s.start(0);
    } catch (e) { this.ctx = null; }
  },

  /**
   * Browsers only allow audio to start inside certain user gestures, and which ones
   * differs (Chrome: pointer down, Safari / touch: click or touch end). Try on all of
   * them until audio is really running, then stop listening.
   */
  unlockOnGesture() {
    const EV = ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown'];
    const h = () => {
      this.init();
      if (this.ctx && this.ctx.state === 'running') EV.forEach(e => window.removeEventListener(e, h, true));
    };
    EV.forEach(e => window.addEventListener(e, h, true));
  },
  get live() { return this.ctx && this.ctx.state === 'running' && !this.muted; },

  tone(type, f0, f1, dur, vol, delay = 0) {
    if (!this.live || vol <= .001) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + .02);
  },
  noise(dur, vol, f0, f1, type = 'lowpass', delay = 0) {
    if (!this.live || vol <= .001) return;
    const t = this.ctx.currentTime + delay, n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource(), fl = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = buf; fl.type = type; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl).connect(g).connect(this.out); s.start(t);
  },

  jump() { this.tone('square', 260, 560, .13, .07); this.noise(.08, .08, 2000, 600); },
  /** k: 0..1 how hard the landing was; ice clinks */
  land(k, ice) {
    this.noise(.1 + k * .12, .12 + k * .3, 700 + k * 600, 90);
    this.tone('sine', 120, 50, .12 + k * .1, .1 + k * .2);
    if (ice) this.tone('triangle', 2200, 1800, .12, .05);
  },
  step(ice) { this.noise(.05, ice ? .05 : .07, ice ? 3000 : 1400, 300); },
  bounce() { this.tone('sine', 180, 720, .32, .22); this.tone('triangle', 360, 1100, .22, .07, .03); this.noise(.12, .1, 1200, 300); },
  checkpoint() { [784, 988, 1175, 1568].forEach((f, i) => this.tone('triangle', f, f * 1.01, .22, .14, i * .07)); this.noise(.5, .06, 6000, 2500, 'highpass'); },
  die() { this.tone('square', 520, 90, .45, .12); this.noise(.3, .2, 1500, 100); },
  fire(d) { const v = near(d); this.noise(.35, .22 * v, 400, 2200, 'bandpass'); this.tone('sawtooth', 90, 60, .25, .05 * v); },
  pop(d) { const v = near(d, 7); this.noise(.12, .18 * v, 2500, 200); },
  spikeWarn(d) { this.tone('square', 900, 900, .04, .04 * near(d, 7)); },
  spikeUp(d) { const v = near(d, 7); this.tone('square', 1500, 700, .07, .08 * v); this.noise(.06, .12 * v, 5000, 2000, 'highpass'); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, .3, .16, i * .12)); [1047, 1319, 1568].forEach(f => this.tone('sine', f, f, .9, .07, .7)); },
  firework() { this.noise(.4, .15, 3000, 300); this.tone('triangle', 500 + Math.random() * 500, 200, .3, .05); },
  click() { this.tone('sine', 660, 880, .06, .06); },

  /** Flips mute, remembers it, and returns the new state. */
  toggleMute() {
    this.muted = !this.muted; prefs.muted = this.muted;
    if (this.out) this.out.gain.value = this.muted ? 0 : .5;
    return this.muted;
  },
};
