// A generated tower plus the lookups the simulation needs. Built once per layout;
// nothing in here changes during play (run state lives in world/sim.js).
import { generateTower } from './generator.js';

export function buildTower(layout) {
  const T = generateTower(layout);
  // Moving blocks slide along their ring side: 2 long that way, 1 across
  for (const m of T.movers) {
    const P = 8 * m.r, L = 2 * m.r, side = Math.floor((((m.s0 % P) + P) % P) / L);
    m.axis = (side === 0 || side === 2) ? 'z' : 'x';
    m.hx = m.axis === 'x' ? 1 : .5; m.hz = m.axis === 'z' ? 1 : .5;
  }
  // Launchers fire toward the middle of their bridge
  for (const e of T.fires) {
    e.cx = e.i - 4.5; e.cz = e.j - 4.5;
    const dx = (e.ti - 4.5) - e.cx, dz = (e.tj - 4.5) - e.cz, l = Math.hypot(dx, dz) || 1;
    e.dx = dx / l; e.dz = dz / l;
  }
  // Hole cells of each floor (solid once filled) and floors by height
  const holeAt = new Map(), floorAt = new Map();
  T.floors.forEach((f, n) => {
    floorAt.set(f.y, f);
    for (const [i, j] of f.hole) holeAt.set(i + ',' + f.y + ',' + j, n);
  });
  return { ...T, layout, holeAt, floorAt };
}
