import * as THREE from 'three';
import { emitNoise } from './noise.js';
import { playImpact } from './sfx.js';
import { isBlocked } from '../three/collision.js';

const PICK_RADIUS = 1.5;
const THROW_SPEED = 8;
const THROW_LIFT = 3;
const GRAVITY = 9.8;

const cyl = (r, h, color) =>
  new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), new THREE.MeshBasicMaterial({ color }));
const box = (w, h, d, color) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));

// y — высота поверхности, на которой лежит предмет; icon — цвет и форма в слоте HUD
const DEFS = [
  { id: 'bottle', name: 'Бутылка', throwable: true, x: 8.5, y: 0.8, z: 1.5, h: 0.25, icon: ['#3fa05a', 'cyl'], make: () => cyl(0.04, 0.25, 0x3fa05a) },
  { id: 'can', name: 'Банка', throwable: true, x: -1.2, y: 0.4, z: 4.5, h: 0.12, icon: ['#aaaaaa', 'cyl'], make: () => cyl(0.05, 0.12, 0xaaaaaa) },
  { id: 'keys', name: 'Ключи', throwable: true, x: 2.6, y: 0.7, z: -0.9, h: 0.02, icon: ['#e0c040', 'box'], make: () => box(0.09, 0.02, 0.05, 0xe0c040) },
  { id: 'oil', name: 'Масло', throwable: false, x: 9.1, y: 0.9, z: -0.125, h: 0.22, icon: ['#8a5a20', 'cyl'], make: () => cyl(0.045, 0.22, 0x8a5a20) }
];

// Предметы: state.heldItem, слот HUD, бросок (шум 3 в точке падения), масло для дверей, ключи у входной двери
export function createItems({ scene, camera, colliders, buttons, screen, doors, frontDoor }) {
  const state = { heldItem: null }; // { type, mesh }

  const objects = DEFS.map((d) => {
    const mesh = d.make();
    mesh.position.set(d.x, d.y + d.h / 2 + 0.005, d.z);
    scene.add(mesh);
    return { def: d, mesh };
  });
  const projectiles = [];

  // --- HUD: слот 60×60 и подпись ---
  const slot = document.createElement('div');
  slot.className = 'item-slot';
  const icon = document.createElement('i');
  slot.appendChild(icon);
  const label = document.createElement('div');
  label.className = 'item-label';

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.hidden = true;
  screen.appendChild(toast);
  let toastTimer = 0;
  const showToast = (t) => {
    toast.textContent = t;
    toast.hidden = false;
    toastTimer = 2;
  };

  function renderHeld() {
    const d = state.heldItem && DEFS.find((x) => x.id === state.heldItem.type);
    slot.classList.toggle('full', !!d);
    if (d) {
      icon.style.background = d.icon[0];
      icon.className = d.icon[1];
      label.textContent = 'В руках: ' + d.name;
    } else {
      icon.className = '';
      icon.style.background = 'none';
      label.textContent = '';
    }
  }

  const mk = (text, attr) => {
    const b = document.createElement('button');
    b.className = 'mode-btn item-btn';
    b.textContent = text;
    b.dataset[attr] = '';
    b.hidden = true;
    return b;
  };
  const pickBtn = mk('Подобрать', 'pick');
  const throwBtn = mk('Бросить', 'throw');
  const oilBtn = mk('Смазать', 'oil');
  const openBtn = mk('Открыть', 'open');
  buttons.prepend(slot, label, pickBtn, throwBtn, oilBtn, openBtn);
  const runBtn = buttons.querySelector('[data-mode="run"]');
  renderHeld();

  let nearObj = null;
  let nearDoor = null;
  let nearFront = false;

  const press = (btn, fn) =>
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fn();
    });

  // подбор: предмет убирается из сцены, попадает в руки
  press(pickBtn, () => {
    if (!nearObj || state.heldItem) return;
    nearObj.mesh.visible = false;
    state.heldItem = { type: nearObj.def.id, mesh: nearObj.mesh };
    nearObj.taken = true;
    renderHeld();
  });

  // бросок: новый снаряд в 0.5 м перед камерой, скорость вперёд*8 + 3 вверх
  press(throwBtn, () => {
    const held = state.heldItem;
    const def = held && DEFS.find((d) => d.id === held.type);
    if (!def || !def.throwable) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const mesh = def.make();
    mesh.position.copy(camera.position).addScaledVector(dir, 0.5);
    scene.add(mesh);
    projectiles.push({
      mesh,
      v: new THREE.Vector3(dir.x * THROW_SPEED, dir.y * THROW_SPEED + THROW_LIFT, dir.z * THROW_SPEED)
    });
    state.heldItem = null;
    renderHeld();
  });

  press(oilBtn, () => {
    if (!state.heldItem || state.heldItem.type !== 'oil' || !nearDoor) return;
    nearDoor.creaky = false; // дверь больше не скрипит
    state.heldItem = null;
    renderHeld();
    showToast('Дверь смазана');
  });

  // заглушка будущей концовки A
  press(openBtn, () => {
    if (!state.heldItem || state.heldItem.type !== 'keys' || !nearFront) return;
    setTimeout(() => alert('Ключи подошли, но дверь пока заблокирована'), 0);
  });

  function land(p, x, z) {
    scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
    emitNoise(x, z, 3, { force: true, loud: true }); // метка в общий массив noiseEvents
    playImpact();
  }

  function update(dt, player) {
    // полёт: pos += v*dt, v.y -= 9.8*dt; падение на пол или стену — шум
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      const pos = p.mesh.position;
      p.v.y -= GRAVITY * dt;
      const nx = pos.x + p.v.x * dt;
      const nz = pos.z + p.v.z * dt;
      const ny = pos.y + p.v.y * dt;
      if (ny < 2.05 && isBlocked(colliders, nx, nz, 0.05)) {
        land(p, pos.x, pos.z); // стена или мебель
        projectiles.splice(i, 1);
        continue;
      }
      pos.set(nx, Math.min(ny, 2.65), nz);
      if (ny <= 0) {
        land(p, nx, nz);
        projectiles.splice(i, 1);
      }
    }

    const held = state.heldItem;
    nearObj = null;
    if (!held) {
      let bd = PICK_RADIUS;
      for (const o of objects) {
        if (o.taken) continue;
        const d = Math.hypot(player.x - o.def.x, player.z - o.def.z);
        if (d <= bd) {
          bd = d;
          nearObj = o;
        }
      }
    }
    nearDoor = held && held.type === 'oil' ? doors.nearest(player, PICK_RADIUS) : null;
    nearFront = !!held && held.type === 'keys' && Math.hypot(player.x - frontDoor.x, player.z - frontDoor.z) <= PICK_RADIUS;
    const def = held && DEFS.find((d) => d.id === held.type);

    pickBtn.hidden = !nearObj;
    // «Смазать» вместо «Бросить», когда в руках масло
    throwBtn.hidden = !(def && def.throwable);
    oilBtn.hidden = !nearDoor;
    openBtn.hidden = !nearFront;
    if (runBtn) runBtn.style.display = throwBtn.hidden ? '' : 'none'; // «Бросить» заменяет «Бег»

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toast.hidden = true;
    }
  }

  function dispose() {
    toast.remove();
    for (const el of [slot, label, pickBtn, throwBtn, oilBtn, openBtn]) el.remove();
    if (runBtn) runBtn.style.display = '';
  }

  return { update, dispose, state };
}
