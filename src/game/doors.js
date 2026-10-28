import * as THREE from 'three';
import { emitNoise } from './noise.js';
import { playCreak } from './sfx.js';

const LEAF_W = 0.9;
const OPEN_ANGLE = 1.75; // дверь распахнута к стене, проём свободен
const NEAR = 1.2;
const LATERAL = 0.7;
const CREAK_INTENSITY = 1.5;
const CREAK_SPREAD = 2.5;
const CREAK_COOLDOWN = 15;

// Двери в проёмах: 50% скрипучих; скрип — метка 1.5 с разбросом ±2.5 м, кулдаун 15 с, масло убирает скрип
export function createDoors({ scene, doorways, enabled = true }) {
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1c });
  const doors = doorways.map((w, i) => {
    const pivot = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(LEAF_W, 2.05, 0.04), leafMat);
    leaf.position.set(LEAF_W / 2, 1.025, 0);
    pivot.add(leaf);
    // петли на стороне «начала» проёма
    const base = w.horizontal ? 0 : -Math.PI / 2;
    pivot.position.set(w.horizontal ? w.x - 0.5 : w.x, 0, w.horizontal ? w.z : w.z - 0.5);
    pivot.rotation.y = base + OPEN_ANGLE;
    scene.add(pivot);
    return {
      id: i,
      x: w.x,
      z: w.z,
      horizontal: w.horizontal,
      creaky: enabled && Math.random() < 0.5,
      cooldown: 0,
      oiled: false,
      lastSide: 0,
      wobble: 0,
      pivot,
      base
    };
  });

  function update(dt, player) {
    for (const d of doors) {
      d.cooldown = Math.max(0, d.cooldown - dt);
      // нормаль проёма: стена вдоль x → нормаль по z, и наоборот
      const n = d.horizontal ? player.z - d.z : player.x - d.x;
      const lat = Math.abs(d.horizontal ? player.x - d.x : player.z - d.z);
      if (lat < LATERAL && Math.abs(n) < NEAR) {
        const side = Math.abs(n) < 0.05 ? d.lastSide : Math.sign(n);
        if (d.lastSide && side && side !== d.lastSide && d.creaky && !d.oiled && d.cooldown <= 0) {
          emitNoise(d.x, d.z, CREAK_INTENSITY, { spread: CREAK_SPREAD });
          playCreak();
          d.wobble = 0.6;
          d.cooldown = CREAK_COOLDOWN;
        }
        d.lastSide = side;
      } else {
        d.lastSide = 0;
      }
      if (d.wobble > 0) {
        d.wobble = Math.max(0, d.wobble - dt);
        d.pivot.rotation.y = d.base + OPEN_ANGLE - Math.sin(d.wobble * 25) * 0.2 * (d.wobble / 0.6);
      }
    }
  }

  function nearest(player, radius) {
    let best = null;
    let bd = radius;
    for (const d of doors) {
      const dist = Math.hypot(player.x - d.x, player.z - d.z);
      if (dist <= bd) {
        bd = dist;
        best = d;
      }
    }
    return best;
  }

  return { doors, update, nearest };
}
