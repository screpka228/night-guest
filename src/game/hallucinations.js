import * as THREE from 'three';
import { isBlocked } from '../three/collision.js';
import { playCreak, playFootsteps, playScreech, startStressBreath } from './sfx.js';
import { getBrightness } from '../data/settings.js';

const GHOST_NEAR = 4; // гость ближе — стресс растёт
const GHOST_FAR = 8; // дальше — падает
const LIGHT_RADIUS = 2.5;
// источники света в квартире: окна лунного света и лампа на тумбочке
const LIGHTS = [
  { x: -10.9, z: 0.9 },
  { x: -0.5, z: 7.2 },
  { x: -8.6, z: -2.2 }
];
const NORMAL_RATE = 0.6; // сложность «Нормально» — базовая частота

const rand = (a, b) => a + Math.random() * (b - a);

// Стресс и галлюцинации: ложный гость, ложные звуки, искажение, один скример за игру
export function createHallucinations({ scene, camera, colliders, rooms, container, canvas, difficulty, night = 1 }) {
  const rate = difficulty.hallucinationRate; // 0 — выключено (практика)
  const mult = (rate / NORMAL_RATE) * (1 + 0.25 * (night - 1)); // с каждой ночью чаще
  let stress = 0;
  let prevRinging = false;
  let screamerUsed = false;
  let breath = null;

  // виньетка
  const vignette = document.createElement('div');
  vignette.className = 'vignette';
  container.appendChild(vignette);

  // таймеры
  let soundTimer = rand(20, 30);
  let fakeTimer = rand(40, 60);
  let distortTimer = rand(15, 25);
  let distortLeft = 0;
  let scareEl = null;
  let scareTimeout = 0;

  // ложный гость
  let fake = null;
  const fakeMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 });
  const fakeGeo = new THREE.CapsuleGeometry(0.3, 1.4);

  function spawnFake(player) {
    for (let k = 0; k < 30; k++) {
      const r = rooms[(Math.random() * rooms.length) | 0];
      const x = rand(r.x1 + 0.6, r.x2 - 0.6);
      const z = rand(r.z1 + 0.6, r.z2 - 0.6);
      const d = Math.hypot(x - player.x, z - player.z);
      if (d < 5 || d > 14 || isBlocked(colliders, x, z, 0.3)) continue;
      const mesh = new THREE.Mesh(fakeGeo, fakeMat.clone());
      mesh.position.set(x, 1.0, z);
      scene.add(mesh);
      fake = { mesh, x, z, life: 25, fade: 0, stuck: 0 };
      return;
    }
  }

  function removeFake() {
    if (!fake) return;
    scene.remove(fake.mesh);
    fake.mesh.material.dispose();
    fake = null;
  }

  // луч фонарика (центр, ~12°) пересекает капсулу
  const dir = new THREE.Vector3();
  function lit() {
    camera.getWorldDirection(dir);
    const dx = fake.x - camera.position.x;
    const dz = fake.z - camera.position.z;
    const dy = 1.0 - camera.position.y;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 10) return false;
    const dot = (dir.x * dx + dir.y * dy + dir.z * dz) / dist;
    const angle = Math.acos(Math.min(1, dot));
    return angle < Math.atan(0.5 / dist) + 0.12;
  }

  function moveFake(dt, player) {
    const dx = player.x - fake.x;
    const dz = player.z - fake.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.2) {
      fake.fade = 0.5; // дошла — растворилась, убить не может
      return;
    }
    const step = 1.2 * dt;
    const nx = fake.x + (dx / d) * step;
    const nz = fake.z + (dz / d) * step;
    let moved = false;
    if (!isBlocked(colliders, nx, fake.z, 0.3)) {
      fake.x = nx;
      moved = true;
    }
    if (!isBlocked(colliders, fake.x, nz, 0.3)) {
      fake.z = nz;
      moved = true;
    }
    fake.stuck = moved ? 0 : fake.stuck + dt;
    if (fake.stuck > 1) fake.fade = 0.5;
    fake.mesh.position.set(fake.x, 1.0, fake.z);
  }

  function setFilter(on) {
    const base = 'brightness(' + getBrightness() + ')';
    canvas.style.filter = on ? base + ' hue-rotate(90deg) contrast(1.5)' : base;
  }

  function screamer() {
    screamerUsed = true;
    stress = 0;
    scareEl = document.createElement('div');
    scareEl.className = 'scare';
    scareEl.innerHTML = '<div class="face"><i class="eye l"></i><i class="eye r"></i><i class="mouth"></i></div>';
    document.body.appendChild(scareEl);
    playScreech();
    navigator.vibrate?.([100, 50, 100]);
    scareTimeout = setTimeout(() => {
      scareEl?.remove();
      scareEl = null;
    }, 200);
  }

  let lastPlayer = { x: 0, z: 0 };

  function update(dt, { player, ghost, hidingActive, phoneRinging }) {
    lastPlayer = player;
    // --- стресс ---
    const gd = Math.hypot(ghost.pos.x - player.x, ghost.pos.z - player.z);
    let delta = 0;
    if (gd < GHOST_NEAR) delta += 2;
    else if (gd > GHOST_FAR) delta -= 1;
    if (hidingActive) delta += 1;
    if (LIGHTS.some((l) => Math.hypot(l.x - player.x, l.z - player.z) < LIGHT_RADIUS)) delta -= 1;
    stress += delta * dt;
    if (phoneRinging && !prevRinging) stress += 10; // звонок телефона
    prevRinging = phoneRinging;
    stress = Math.min(100, Math.max(0, stress));

    // --- визуализация: виньетка и дыхание при стрессе > 50 ---
    const k = stress > 50 ? (stress - 50) / 50 : 0;
    vignette.style.opacity = k > 0 ? 0.3 + 0.6 * k : 0;
    if (k > 0 && !breath) breath = startStressBreath();
    if (breath && stress < 45) {
      breath.stop();
      breath = null;
    }
    breath?.setLevel(k);

    if (mult <= 0) return; // практика: без галлюцинаций

    if (stress > 60) {
      soundTimer -= dt;
      if (soundTimer <= 0) {
        soundTimer = rand(20, 30) / mult;
        // шаги за спиной или скрип двери: только звук, меток шума нет
        if (Math.random() < 0.6) playFootsteps();
        else playCreak();
      }
      if (!fake && !hidingActive) {
        fakeTimer -= dt;
        if (fakeTimer <= 0) {
          fakeTimer = rand(40, 60) / mult;
          spawnFake(player);
        }
      }
    }
    if (stress > 80) {
      distortTimer -= dt;
      if (distortTimer <= 0 && distortLeft <= 0) {
        distortTimer = rand(20, 30) / mult;
        distortLeft = 1;
        setFilter(true);
      }
    }
    if (distortLeft > 0) {
      distortLeft -= dt;
      if (distortLeft <= 0) setFilter(false);
    }
    if (stress >= 99.5 && !screamerUsed) screamer();

    // --- ложный гость ---
    if (fake) {
      fake.life -= dt;
      if (fake.fade > 0) {
        fake.fade -= dt;
        fake.mesh.material.opacity = Math.max(0, (fake.fade / 0.5) * 0.6);
        if (fake.fade <= 0) removeFake();
      } else {
        moveFake(dt, player);
        if (fake && (lit() || fake.life <= 0)) fake.fade = 0.5; // луч фонарика растворяет за 0.5 с
      }
    }
  }

  function dispose() {
    breath?.stop();
    breath = null;
    clearTimeout(scareTimeout);
    scareEl?.remove();
    removeFake();
    fakeGeo.dispose();
    fakeMat.dispose();
    vignette.remove();
    setFilter(false);
  }

  return {
    update,
    dispose,
    get stress() {
      return stress;
    },
    setStress: (v) => {
      stress = v;
    },
    debugSpawnFake: () => spawnFake(lastPlayer),
    // для отладки: сейчас работают ли галлюцинации
    get active() {
      return mult > 0 && stress > 60;
    },
    get fake() {
      return fake;
    }
  };
}
