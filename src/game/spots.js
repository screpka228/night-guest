import * as THREE from 'three';
import { emitNoise } from './noise.js';
import { playKnock, playTrap } from './sfx.js';

const OPEN_RADIUS = 1.5;
const DECOY_TEXT = {
  decoyCan: 'Пустая банка',
  decoyNote: 'Записка: «Не оставайся здесь на ночь…»'
};

// Интерактивные точки (ящики, тумбочки): «Открыть», звук 1, ловушка 3.5, ключи — цель игры
export function createSpots({ scene, spots, contents, buttons, items, frontDoor, notify, onEscape }) {
  const state = { keysFound: false };

  const objs = spots.map((s) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.16, 0.26),
      new THREE.MeshBasicMaterial({ color: 0xa06a30 })
    );
    mesh.position.set(s.x, s.y + 0.09, s.z);
    scene.add(mesh);
    return { spot: s, mesh, opened: false };
  });

  const mk = (text, attr) => {
    const b = document.createElement('button');
    b.className = 'mode-btn item-btn';
    b.textContent = text;
    b.dataset[attr] = '';
    b.hidden = true;
    return b;
  };
  const openBtn = mk('Открыть', 'spot');
  const exitBtn = mk('Открыть дверь', 'exit');
  buttons.prepend(openBtn, exitBtn);

  let near = null;
  let nearFront = false;

  const press = (btn, fn) =>
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fn();
    });

  press(openBtn, () => {
    if (!near || near.opened) return;
    const c = contents[near.spot.id];
    const { x, z } = near.spot;
    // руки заняты — предмет остаётся внутри, ящик не открываем
    if (c && ['bottle', 'can', 'carkeys', 'oil'].includes(c.type) && items.state.heldItem) {
      notify('Руки заняты');
      return;
    }
    near.opened = true;
    near.mesh.material.color.set(0x4a3018);
    near.mesh.position.y -= 0.05;

    if (c && c.type === 'trap') {
      emitNoise(x, z, 3.5, { force: true, loud: true }); // гость сразу бежит сюда
      playTrap();
      notify('Ловушка! Грохот…');
      return;
    }
    emitNoise(x, z, 1);
    playKnock();
    if (!c) {
      notify('Пусто');
    } else if (c.type === 'keys') {
      state.keysFound = true;
      notify('Вы нашли ключи! Бегите к двери!');
    } else if (DECOY_TEXT[c.type]) {
      notify(DECOY_TEXT[c.type]);
    } else {
      items.give(c.type);
    }
  });

  press(exitBtn, () => {
    if (state.keysFound && nearFront) onEscape();
  });

  function update(player) {
    near = null;
    let bd = OPEN_RADIUS;
    for (const o of objs) {
      if (o.opened) continue;
      const d = Math.hypot(player.x - o.spot.x, player.z - o.spot.z);
      if (d <= bd) {
        bd = d;
        near = o;
      }
    }
    nearFront = Math.hypot(player.x - frontDoor.x, player.z - frontDoor.z) <= OPEN_RADIUS;
    openBtn.hidden = !near;
    exitBtn.hidden = !(state.keysFound && nearFront);
  }

  function dispose() {
    openBtn.remove();
    exitBtn.remove();
  }

  return { update, dispose, state, objs };
}
