import * as THREE from 'three';
import { emitNoise } from './noise.js';
import { isBlocked } from '../three/collision.js';

const PICK_RADIUS = 1.5;
const THROW_SPEED = 7;
const THROW_LIFT = 2.5;
const GRAVITY = 9.8;

const cyl = (r, h, color) =>
  new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), new THREE.MeshBasicMaterial({ color }));
const box = (w, h, d, color) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));

// y — высота поверхности, на которой лежит предмет
const DEFS = [
  { id: 'bottle', name: 'Бутылка', throwable: true, x: 5.6, y: 0.8, z: 0.2, make: () => cyl(0.04, 0.25, 0x3fa05a), h: 0.25 },
  { id: 'can', name: 'Банка', throwable: true, x: 0.2, y: 0.4, z: 3, make: () => cyl(0.05, 0.12, 0xaaaaaa), h: 0.12 },
  { id: 'keys', name: 'Ключи', throwable: true, x: -2, y: 0.7, z: -0.8, make: () => box(0.09, 0.02, 0.05, 0xd4b24a), h: 0.02 },
  { id: 'oil', name: 'Масло', throwable: false, x: 4.65, y: 0.9, z: -1.15, make: () => cyl(0.045, 0.22, 0xe0b020), h: 0.22 }
];

// Предметы: подобрать, бросить (шум 3 в точке падения), смазать дверь маслом
export function createItems({ scene, camera, colliders, buttons, screen, doors }) {
  const objects = DEFS.map((d) => {
    const mesh = d.make();
    mesh.position.set(d.x, d.y + d.h / 2 + 0.005, d.z);
    scene.add(mesh);
    return { def: d, mesh, taken: false };
  });
  let held = null;
  const projectiles = [];

  const heldEl = document.createElement('div');
  heldEl.className = 'held-hud';
  screen.appendChild(heldEl);
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

  const mk = (label, attr) => {
    const b = document.createElement('button');
    b.className = 'mode-btn item-btn';
    b.textContent = label;
    b.dataset[attr] = '';
    b.hidden = true;
    return b;
  };
  const pickBtn = mk('Подобрать', 'pick');
  const throwBtn = mk('Бросить', 'throw');
  const oilBtn = mk('Смазать', 'oil');
  buttons.prepend(pickBtn, throwBtn, oilBtn);
  const runBtn = buttons.querySelector('[data-mode="run"]');

  let nearObj = null;
  let nearDoor = null;

  const press = (btn, fn) =>
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fn();
    });

  press(pickBtn, () => {
    if (!nearObj || held) return;
    nearObj.taken = true;
    nearObj.mesh.visible = false;
    held = nearObj.def;
    heldEl.textContent = 'В руках: ' + held.name;
  });

  press(throwBtn, () => {
    if (!held || !held.throwable) return;
    const obj = objects.find((o) => o.def === held);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const mesh = obj.mesh;
    mesh.visible = true;
    mesh.position.copy(camera.position).addScaledVector(dir, 0.4);
    projectiles.push({
      mesh,
      vx: dir.x * THROW_SPEED,
      vy: dir.y * THROW_SPEED + THROW_LIFT,
      vz: dir.z * THROW_SPEED
    });
    held = null;
    heldEl.textContent = '';
  });

  press(oilBtn, () => {
    if (!held || held.id !== 'oil' || !nearDoor) return;
    nearDoor.oiled = true;
    held = null;
    heldEl.textContent = '';
    showToast('Дверь смазана');
  });

  function land(p, x, z) {
    scene.remove(p.mesh); // предмет исчезает; шум 3 в точке падения
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
    emitNoise(x, z, 3);
  }

  function update(dt, player) {
    // снаряды: дуга под действием гравитации, стены останавливают
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      const pos = p.mesh.position;
      p.vy -= GRAVITY * dt;
      const nx = pos.x + p.vx * dt;
      const nz = pos.z + p.vz * dt;
      const ny = pos.y + p.vy * dt;
      let hit = false;
      if (ny < 2.7 && isBlocked(colliders, nx, nz, 0.05) && ny < 2.05) {
        hit = true; // стена или мебель: падает у препятствия
      } else {
        pos.set(nx, Math.min(ny, 2.65), nz);
      }
      if (hit || ny <= 0.05) {
        land(p, pos.x, pos.z);
        projectiles.splice(i, 1);
      }
    }

    // ближайший предмет и дверь
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
    nearDoor = held && held.id === 'oil' ? doors.nearest(player, PICK_RADIUS) : null;

    pickBtn.hidden = !nearObj;
    throwBtn.hidden = !(held && held.throwable);
    oilBtn.hidden = !nearDoor;
    if (runBtn) runBtn.style.display = throwBtn.hidden ? '' : 'none'; // «Бросить» заменяет «Бег»

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toast.hidden = true;
    }
  }

  function dispose() {
    heldEl.remove();
    toast.remove();
    pickBtn.remove();
    throwBtn.remove();
    oilBtn.remove();
    if (runBtn) runBtn.style.display = '';
  }

  return { update, dispose, get held() { return held; } };
}
