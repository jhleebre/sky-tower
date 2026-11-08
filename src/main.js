// Entry point: sets up the game and runs the frame loop.
import { renderer, scene, camera, resize, updateSun } from './render/renderer.js';
import { updateSky } from './render/scenery.js';
import { syncTower, fadeOccluders } from './render/towerMesh.js';
import { updatePlayer } from './render/player.js';
import { updateCamera } from './render/cameraRig.js';
import { updateEffects } from './render/effects.js';
import * as hud from './ui/hud.js';
import * as game from './game.js';

const { G } = game;

resize();
game.init();

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  game.update(dt);
  hud.tickBanner(dt);
  game.updateSounds();
  updateEffects(dt);

  const s = G.sim, P = s.P;
  updateCamera(P, dt, G.view, G.tower.TOP);
  updateSun(P);
  updateSky(P.y, G.tower.floors, now / 1000);
  updatePlayer(s, dt, G.view === 'fp');
  syncTower(s, dt);
  fadeOccluders(camera, P, s, dt);
  hud.updateHud(...game.hudValues());

  renderer.render(scene, camera);
}
requestAnimationFrame(t => { last = t; frame(t); });

// ?autoplay[&diff=normal|hard|all][&from=N][&speed=2]: the bot climbs the real tower, for QA
const params = new URLSearchParams(location.search);
if (params.has('autoplay')) {
  import('./dev/autoplay.js').then(m => m.runAutoplay({
    diff: params.get('diff') || params.get('autoplay') || G.diff,
    from: Number(params.get('from') || 1) - 1,
    speed: Number(params.get('speed') || 1),
  }));
}
