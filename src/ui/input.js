// Keyboard and touch input. Held directions end up in `keys` (keyboard) and
// `touch` (on-screen cross); the game decides what presses mean in its current state.
//   L / R: turn left / right, U / D: walk forward / back, J: jump
export const KEYMAP = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D', Space: 'J' };
export const touch = { L: 0, R: 0, U: 0, D: 0 };

const $ = id => document.getElementById(id);
const TOUCH_HINT = '왼쪽 <b>버튼</b>: ▲ 앞으로 · ▼ 뒤로 · ↺ ↻ 몸 돌리기. 버튼 사이를 누르면 두 개가 같이 눌려요.<br>오른쪽 <b>점프</b> 버튼으로 점프해요. 위쪽 <b>시점</b> 버튼으로 1인칭·어깨·멀리 보기를 바꿔요.';

/**
 * h.onKeyDown(e), h.onKeyUp(e): raw key events
 * h.onJump(down): touch jump button
 * h.onBlur(): window lost focus, h.onHidden(): tab hidden
 */
export function bindInput(h) {
  window.addEventListener('keydown', h.onKeyDown);
  window.addEventListener('keyup', h.onKeyUp);
  window.addEventListener('blur', () => { dptr.clear(); dpadRecalc(); h.onBlur(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) h.onHidden(); });

  const pad = $('pad'), dpad = $('dpad'), jbtn = $('jbtn');
  const showPad = () => { pad.hidden = false; $('keysHint').innerHTML = TOUCH_HINT; };
  try { if (matchMedia('(pointer:coarse)').matches) showPad(); } catch (e) { /* ignore */ }
  window.addEventListener('touchstart', () => { if (pad.hidden) showPad(); }, { passive: true });

  // one thumb on the cross: its position decides which of the 4 buttons are held (diagonals press two)
  const dptr = new Map();
  function dpadRecalc() {
    touch.L = touch.R = touch.U = touch.D = 0;
    const r = dpad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, hw = r.width / 2;
    dptr.forEach(p => {
      const dx = (p.x - cx) / hw, dy = (p.y - cy) / hw; if (Math.hypot(dx, dy) < .2) return;
      if (dy < -.36) touch.U = 1; if (dy > .36) touch.D = 1; if (dx < -.36) touch.L = 1; if (dx > .36) touch.R = 1;
    });
    dpad.querySelectorAll('.db').forEach(b => b.classList.toggle('on', !!touch[b.dataset.k]));
  }
  dpad.addEventListener('pointerdown', e => { e.preventDefault(); try { dpad.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } dptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); dpadRecalc(); });
  dpad.addEventListener('pointermove', e => { if (!dptr.has(e.pointerId)) return; dptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); dpadRecalc(); });
  const dEnd = e => { if (dptr.delete(e.pointerId)) dpadRecalc(); };
  dpad.addEventListener('pointerup', dEnd); dpad.addEventListener('pointercancel', dEnd); dpad.addEventListener('lostpointercapture', dEnd);

  jbtn.addEventListener('pointerdown', e => { e.preventDefault(); try { jbtn.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } h.onJump(true); jbtn.classList.add('on'); });
  const jEnd = () => { h.onJump(false); jbtn.classList.remove('on'); };
  jbtn.addEventListener('pointerup', jEnd); jbtn.addEventListener('pointercancel', jEnd); jbtn.addEventListener('lostpointercapture', jEnd);
  $('cv').addEventListener('contextmenu', e => e.preventDefault());
}
