// Checks the tower layouts and that the bot can climb every difficulty.
// Run after editing the generator, stages or physics.
//   npm test                 all difficulties
//   npm test -- easy hard    only those
// No Node? Open tools/check-tower.html through the local server instead.
import { DIFFS } from '../src/config.js';
import { checkTower } from './tower-check.js';

const picked = process.argv.slice(2).filter(d => DIFFS.includes(d));
process.exit(checkTower(picked.length ? picked : undefined) ? 1 : 0);
