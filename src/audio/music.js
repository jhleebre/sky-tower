// Background music, synthesised and scheduled with WebAudio (no audio files).
// An airy 16-bar loop in G major on the canon progression with its stepwise
// falling bass (G–D/F#–Em–Bm/D–C–G/B–C–D, played twice): an original melody,
// then a variation that climbs higher, like the tower.
// The band grows as you climb: pad, bass, rising arpeggio and lead from the
// start, hi-hat from floor 3, kick and clap from floor 6, a counter-bell from
// floor 9, and the tempo rises a little every floor.
// Goes through sound.out, so M (mute all) applies too; N turns just the music off.
import { sound } from './sound.js';
import { prefs } from '../util/storage.js';

const STEPS = 16;                   // sixteenth notes per bar
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

// One chord per bar: bass note (canon bass, stepping down) and chord tones (MIDI)
const CANON = [
  { bass: 43, tri: [67, 71, 74] }, // G
  { bass: 42, tri: [66, 69, 74] }, // D/F#
  { bass: 40, tri: [67, 71, 76] }, // Em
  { bass: 38, tri: [66, 71, 74] }, // Bm/D
  { bass: 36, tri: [67, 72, 76] }, // C
  { bass: 35, tri: [67, 71, 74] }, // G/B
  { bass: 36, tri: [67, 72, 76] }, // C
  { bass: 38, tri: [66, 69, 74] }, // D
];
const BARS = [...CANON, ...CANON];

// Lead melody per bar: [step, note, length in steps]
const MELODY = [
  // Theme: calm, long notes, like looking up at the tower
  [[0, 74, 6], [6, 71, 2], [8, 74, 4], [12, 79, 4]],
  [[0, 78, 6], [6, 76, 2], [8, 74, 8]],
  [[0, 76, 4], [4, 79, 4], [8, 83, 4], [12, 79, 4]],
  [[0, 78, 8], [8, 74, 4], [12, 71, 4]],
  [[0, 72, 4], [4, 76, 4], [8, 79, 4], [12, 84, 4]],
  [[0, 83, 6], [6, 81, 2], [8, 79, 8]],
  [[0, 76, 2], [2, 79, 2], [4, 84, 4], [8, 83, 2], [10, 81, 2], [12, 79, 4]],
  [[0, 78, 4], [4, 74, 4], [8, 78, 4], [12, 81, 4]],
  // Variation: running notes that keep stepping upward
  [[0, 79, 2], [2, 81, 2], [4, 83, 2], [6, 86, 2], [8, 83, 4], [12, 79, 4]],
  [[0, 81, 2], [2, 78, 2], [4, 74, 2], [6, 78, 2], [8, 81, 4], [12, 86, 4]],
  [[0, 83, 2], [2, 79, 2], [4, 76, 2], [6, 79, 2], [8, 83, 4], [12, 88, 4]],
  [[0, 86, 6], [6, 83, 2], [8, 78, 8]],
  [[0, 84, 2], [2, 83, 2], [4, 81, 2], [6, 79, 2], [8, 76, 2], [10, 79, 2], [12, 84, 4]],
  [[0, 83, 4], [4, 86, 4], [8, 91, 8]],
  [[0, 88, 2], [2, 86, 2], [4, 84, 2], [6, 83, 2], [8, 81, 4], [12, 84, 4]],
  [[0, 86, 4], [4, 81, 4], [8, 78, 4], [12, 74, 4]],
];
// Arpeggio in eighths: climbs the chord into the next octave, like stairs
const ARP = [0, 1, 2, 3, 4, 5, 4, 3];
const arpNote = (tri, k) => tri[k % 3] + 12 * Math.floor(k / 3);

export const music = {
  enabled: prefs.music,
  playing: false,
  floor: 0,         // 0-based floor: more instruments and a bit faster higher up
  bpm: 100,
  step: 0,          // position in the loop, in sixteenths
  nextT: 0,         // audio time of the next step
  timer: null,
  bus: null, filter: null, noiseBuf: null,

  setup() {
    const ctx = sound.ctx;
    if (!ctx || this.bus) return !!this.bus;
    this.bus = ctx.createGain(); this.bus.gain.value = 0;
    this.bus.connect(sound.out);
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 2600;
    this.filter.connect(this.bus);
    const n = Math.floor(ctx.sampleRate * .05);
    this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return true;
  },

  /** restart: begin the loop from the top (new run) instead of resuming. */
  start(restart = false) {
    if (restart) this.step = 0;
    if (!this.enabled || this.playing || !this.setup()) return;
    const ctx = sound.ctx;
    this.playing = true;
    this.nextT = ctx.currentTime + .08;
    this.bus.gain.cancelScheduledValues(ctx.currentTime);
    this.bus.gain.setTargetAtTime(1, ctx.currentTime, .15);
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  },

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer); this.timer = null;
    const ctx = sound.ctx;
    this.bus.gain.cancelScheduledValues(ctx.currentTime);
    this.bus.gain.setTargetAtTime(0, ctx.currentTime, .08);
  },

  /** 0-based floor: 100 bpm on the first floor, +2 per floor. */
  setFloor(f) { this.floor = f; this.bpm = 100 + f * 2; },

  /** Flips music on/off, remembers it, and returns the new state. */
  toggle(shouldPlay) {
    this.enabled = !this.enabled; prefs.music = this.enabled;
    if (!this.enabled) this.stop();
    else if (shouldPlay) this.start();
    return this.enabled;
  },

  // Look-ahead scheduler: queue every step that starts in the next 0.15 s
  schedule() {
    const ctx = sound.ctx;
    if (!this.playing) return;
    // After a long stall (background tab) skip ahead instead of bursting notes
    if (this.nextT < ctx.currentTime - .2) this.nextT = ctx.currentTime + .02;
    while (this.nextT < ctx.currentTime + .15) {
      this.playStep(this.step, this.nextT);
      this.nextT += 60 / this.bpm / 4;
      this.step = (this.step + 1) % (BARS.length * STEPS);
    }
  },

  playStep(i, t) {
    const bar = Math.floor(i / STEPS), s = i % STEPS, ch = BARS[bar], six = 60 / this.bpm / 4, f = this.floor;
    // Pad: the chord held through the bar, soft
    if (s === 0) for (const n of ch.tri) this.note('sine', midi(n - 12), t, six * 15.5, .028, this.filter, false, .25);
    // Bass: half notes, with a passing octave on beat 4
    if (s === 0 || s === 8) this.note('triangle', midi(ch.bass), t, six * 6, .17, this.bus);
    if (s === 12) this.note('triangle', midi(ch.bass + 12), t, six * 3, .1, this.bus);
    // Rising arpeggio in eighths
    if (s % 2 === 0) this.note('square', midi(arpNote(ch.tri, ARP[s / 2])), t, six * 1.4, .02, this.filter);
    // Lead, with a soft bell an octave up
    for (const [st, n, len] of MELODY[bar]) {
      if (st !== s) continue;
      const dur = six * len * .95;
      this.note('triangle', midi(n), t, dur, .075, this.bus, true);
      this.note('sine', midi(n + 12), t, Math.min(dur, six * 3), .02, this.bus);
    }
    // Higher floors: a counter-bell answering the melody on the offbeats
    if (f >= 8 && s % 8 === 6) this.note('sine', midi(ch.tri[2] + 24), t, six * 2, .03, this.bus);
    // Drums join as you climb
    if (f >= 5 && s % 8 === 0) this.kick(t);
    if (f >= 5 && (s === 4 || s === 12)) this.clap(t);
    if (f >= 2 && s % 4 === 2) this.hat(t);
  },

  /** attack: seconds to fade in (0 = plucked) */
  note(type, f, t, dur, vol, dest, vibrato = false, attack = 0) {
    const ctx = sound.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (vibrato && dur > .2) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5; lg.gain.value = f * .005;
      lfo.connect(lg).connect(o.frequency); lfo.start(t + .12); lfo.stop(t + dur + .05);
    }
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.max(.01, attack));
    g.gain.setValueAtTime(vol, t + Math.max(dur * .6, attack + .01));
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + .02);
  },
  kick(t) {
    const ctx = sound.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + .12);
    g.gain.setValueAtTime(.28, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16);
    o.connect(g).connect(this.bus); o.start(t); o.stop(t + .18);
  },
  clap(t) {
    const ctx = sound.ctx, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = .8;
    g.gain.setValueAtTime(.09, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
    src.connect(bp).connect(g).connect(this.bus); src.start(t);
  },
  hat(t) {
    const ctx = sound.ctx, s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noiseBuf; hp.type = 'highpass'; hp.frequency.value = 7000;
    g.gain.setValueAtTime(.04, t); g.gain.exponentialRampToValueAtTime(.0001, t + .045);
    s.connect(hp).connect(g).connect(this.bus); s.start(t);
  },
};
