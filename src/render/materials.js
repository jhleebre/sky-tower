// Shared materials and geometries. FADED holds see-through copies used when a
// block stands between the camera and the player.
import * as THREE from 'three';
import { FIRE_R } from '../config.js';
import { TX } from './textures.js';

export function lam(map, o) { return new THREE.MeshLambertMaterial(Object.assign({ map, transparent: true, opacity: 1 }, o || {})); }

// Block materials use vertex colours for the baked corner shading (render/blockGeo.js)
const VC = { vertexColors: true };
export const MAT = { grass: [lam(TX.grassSide, VC), lam(TX.grassSide, VC), lam(TX.grassTop, VC), lam(TX.dirt, VC), lam(TX.grassSide, VC), lam(TX.grassSide, VC)] };
for (const k of ['stone', 'sand', 'ice', 'slime', 'wood', 'snow', 'moss', 'metal', 'redbrick', 'dark', 'quartz', 'spike', 'launcher']) MAT[k] = lam(TX[k], VC);
MAT.ice.opacity = .9; MAT.slime.opacity = .95;
// lava glows: unlit, so shadows and shading never darken it
MAT.lava = new THREE.MeshBasicMaterial({ map: TX.lava, transparent: true, opacity: 1 });

function fadedOf(m) { if (Array.isArray(m)) return m.map(fadedOf); const f = m.clone(); f.opacity = .22; f.depthWrite = false; return f; }
export const FADED = {};
for (const k in MAT) FADED[k] = fadedOf(MAT[k]);

export const moverMat = lam(TX.mover), moverFaded = fadedOf(moverMat);

export const coneGeo = new THREE.ConeGeometry(.11, .5, 6); coneGeo.translate(0, .25, 0);
export const coneMat = new THREE.MeshLambertMaterial({ color: '#e6e9f2' }), coneWarn = new THREE.MeshLambertMaterial({ color: '#ff6a6a' });
export const ballGeo = new THREE.SphereGeometry(FIRE_R, 12, 10), coreGeo = new THREE.SphereGeometry(FIRE_R * .55, 8, 6);
export const ballMat = new THREE.MeshBasicMaterial({ color: '#ff7a2f' }), coreMat = new THREE.MeshBasicMaterial({ color: '#ffe066' });
/** Geometries shared by every tower build (never disposed). */
export const SHARED_GEO = new Set([coneGeo, ballGeo, coreGeo]);
