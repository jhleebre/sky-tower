// localStorage wrapper that never throws (private mode, blocked storage, ...).
export const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};

const P = 'skytower3d-';

// One-time move: the old 어려움 is now 보통
if (!LS.get(P + 'migr-normal', false)) {
  if (LS.get(P + 'diff', null) === 'hard') LS.set(P + 'diff', 'normal');
  const oldBest = LS.get(P + '10-best-hard', null), legacy = LS.get(P + '10-best', null);
  const mv = oldBest != null ? oldBest : legacy;
  if (mv != null) LS.set(P + '10-best-normal', mv);
  LS.del(P + '10-best-hard');
  LS.set(P + 'migr-normal', true);
}

/** Best time (seconds) per difficulty, or null. */
export const getBest = d => LS.get(P + '10-best-' + d, null);
export const setBest = (d, t) => LS.set(P + '10-best-' + d, t);

export const prefs = {
  get diff() { return LS.get(P + 'diff', 'easy'); },
  set diff(v) { LS.set(P + 'diff', v); },
  get view() { return LS.get(P + 'view', 'far'); },
  set view(v) { LS.set(P + 'view', v); },
  get muted() { return LS.get(P + 'mute', false); },
  set muted(v) { LS.set(P + 'mute', v); },
  get music() { return LS.get(P + 'music', true); },
  set music(v) { LS.set(P + 'music', v); },
};
