// Game-wide tuning constants. No DOM or three.js here, so the world simulation
// (and tools/check-tower.mjs) can run anywhere.

// Player body: half width and height. The tower grid is 10x10 cells of 1 unit.
export const HW = .3, PH = 1.8;

export const GRAV = 32;     // gravity
export const JV = 9.4;      // jump launch speed (a little over one block)
export const JB = 14.8;     // slime bounce speed (about three blocks)
export const MOVE = 4.8;    // walking speed
export const TURN = 2.8;    // turning speed (rad/s)
export const STEP = 1 / 120; // fixed physics step

export const FIRE_SPEED = 5.5, FIRE_R = .32;

export const PLAYER_COLOR = '#ff5a4e';
export const SKY_END = '#120f33'; // sky above the last floor

/**
 * Per-difficulty feel. `layout` picks the tower shape in data/stages.js (LAYOUTS);
 * 보통 and 어려움 share the same tower, but 어려움 never fills the holes below a reached flag.
 */
export const PHYS = {
  easy: { label: '쉬움', color: '#3ee0a1', iceA: 14, coyote: .13, core: HW - .16, spike: { down: 2.3, warn: .6, up: .6 }, layout: 'easy' },
  normal: { label: '보통', color: '#ffd23f', iceA: 5, coyote: .08, core: HW - .12, spike: { down: 1.5, warn: .5, up: .6 }, layout: 'hard' },
  hard: { label: '어려움', color: '#ff3d5e', iceA: 5, coyote: .08, core: HW - .12, spike: { down: 1.5, warn: .5, up: .6 }, layout: 'hard', noFill: true },
};
export const DIFFS = Object.keys(PHYS);
